import { createHmac, randomBytes } from "node:crypto";

type Clock = () => number;

type BoundedOptions = {
  maxEntries: number;
  now?: Clock;
  salt?: Buffer | string;
};

type RateLimitOptions = BoundedOptions & {
  limit: number;
  windowMs: number;
};

type Counter = {
  count: number;
  resetAt: number;
};

const DEFAULT_SALT = randomBytes(32);
const MAX_RAW_KEY_LENGTH = 512;

const boundedInteger = (
  name: string,
  fallback: number,
  minimum: number,
  maximum: number
) => {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }

  return parsed;
};

const digest = (salt: Buffer | string, value: string) =>
  createHmac("sha256", salt).update(value).digest("hex");

export class BoundedRateLimiter {
  private readonly counters = new Map<string, Counter>();
  private readonly now: Clock;
  private readonly salt: Buffer | string;

  constructor(private readonly options: RateLimitOptions) {
    this.now = options.now ?? Date.now;
    this.salt = options.salt ?? DEFAULT_SALT;
  }

  consume(rawKey: string) {
    if (!rawKey || rawKey.length > MAX_RAW_KEY_LENGTH) {
      return false;
    }

    const now = this.now();
    this.prune(now);
    const key = digest(this.salt, rawKey);
    const current = this.counters.get(key);

    if (!current && this.counters.size >= this.options.maxEntries) {
      return false;
    }

    if (!current) {
      this.counters.set(key, { count: 1, resetAt: now + this.options.windowMs });
      return true;
    }

    if (current.count >= this.options.limit) {
      return false;
    }

    current.count += 1;
    return true;
  }

  snapshot() {
    return {
      keys: [...this.counters.keys()],
      size: this.counters.size,
    };
  }

  private prune(now: number) {
    for (const [key, counter] of this.counters) {
      if (counter.resetAt <= now) {
        this.counters.delete(key);
      }
    }
  }
}

export class BoundedReplayGuard {
  private readonly claims = new Map<string, number>();
  private readonly now: Clock;
  private readonly salt: Buffer | string;

  constructor(
    private readonly ttlMs: number,
    private readonly options: BoundedOptions
  ) {
    this.now = options.now ?? Date.now;
    this.salt = options.salt ?? DEFAULT_SALT;
  }

  claim(rawKey: string) {
    if (!rawKey || rawKey.length > MAX_RAW_KEY_LENGTH) {
      return false;
    }

    const now = this.now();
    for (const [key, expiresAt] of this.claims) {
      if (expiresAt <= now) {
        this.claims.delete(key);
      }
    }

    const key = digest(this.salt, rawKey);
    if (this.claims.has(key) || this.claims.size >= this.options.maxEntries) {
      return false;
    }

    this.claims.set(key, now + this.ttlMs);
    return true;
  }

  snapshot() {
    return { keys: [...this.claims.keys()], size: this.claims.size };
  }
}

const windowMs = boundedInteger(
  "AUTH_RATE_LIMIT_WINDOW_MS",
  60_000,
  1_000,
  3_600_000
);
const maxEntries = boundedInteger(
  "AUTH_RATE_LIMIT_MAX_KEYS",
  2_048,
  32,
  100_000
);

const startLimiter = new BoundedRateLimiter({
  limit: boundedInteger("AUTH_RATE_LIMIT_START_MAX", 20, 1, 1_000),
  maxEntries,
  windowMs,
});
const completionLimiter = new BoundedRateLimiter({
  limit: boundedInteger("AUTH_RATE_LIMIT_COMPLETE_MAX", 20, 1, 1_000),
  maxEntries,
  windowMs,
});
const callbackReplayGuard = new BoundedReplayGuard(20 * 60_000, {
  maxEntries,
});
const completionLocks = new Map<string, Promise<void>>();

export const consumeAuthRateLimit = (
  phase: "start" | "complete",
  provider: string,
  clientAddress: string
) =>
  (phase === "start" ? startLimiter : completionLimiter).consume(
    `${phase}\u0000${provider}\u0000${clientAddress}`
  );

export const claimOAuthCallback = (provider: string, state: string) =>
  callbackReplayGuard.claim(`callback\u0000${provider}\u0000${state}`);

export const withAuthCompletionLock = async <T>(
  lockKey: string,
  operation: () => Promise<T>
) => {
  const key = digest(DEFAULT_SALT, `auth-completion\u0000${lockKey}`);
  const previous = completionLocks.get(key);

  if (!previous && completionLocks.size >= maxEntries) {
    throw new Error("Authentication completion is temporarily unavailable.");
  }

  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  completionLocks.set(key, current);

  if (previous) {
    await previous;
  }

  try {
    return await operation();
  } finally {
    release();
    if (completionLocks.get(key) === current) {
      completionLocks.delete(key);
    }
  }
};
