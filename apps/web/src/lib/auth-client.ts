'use client';

import { createAuthClient } from 'better-auth/react';

/**
 * Browser-side auth. The base URL is left unset so every call is same-origin,
 * which keeps the session cookie working without any CORS configuration.
 */
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession, requestPasswordReset, resetPassword } =
  authClient;
