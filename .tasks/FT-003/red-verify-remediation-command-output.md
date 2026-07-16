---
description: Fresh command evidence for FT-003 feature red-verification retry.
status: complete
---
# FT-003 Red-Verify Remediation Command Output

## Source Runtime Reproducibility

- PASS: `npm --workspace apps/backend run seed:medusa:catalog`
- PASS: `npm --workspace apps/backend run smoke:product-detail`
- PASS: `npm --workspace apps/backend run test:integration -- cart-merge-acceptance`
- Acceptance assertions include transfer, deterministic existing target, exact
  same-variant summing, foreign ownership denial, stock no-mutation, replay,
  concurrency response, consumed-source Store not-found, and injected recovery.

## Cross-Boundary Gates

- PASS: `npm --workspace apps/storefront run test:e2e -- cart`
- PASS: `npm run smoke:local`
- PASS: `npm run typecheck`
- PASS: `node scripts/mb-lint.mjs`
- PASS: `node scripts/mb-doctor.mjs --strict`
