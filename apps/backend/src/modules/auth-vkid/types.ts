export interface VkIdAuthProviderOptions {
  clientId: string;
  serviceToken: string;
  callbackUrl: string;
}

export interface VkIdAuthState {
  callbackUrl: string;
  codeChallenge: string;
  codeVerifier: string;
  expiresAt: number;
  consumed?: boolean;
}

export interface VkIdTokenResponse {
  access_token: string;
  state: string;
  user_id: number | string;
}

export interface VkIdUserProfile {
  email: string;
  first_name?: string;
  last_name?: string;
  user_id: number | string;
}
