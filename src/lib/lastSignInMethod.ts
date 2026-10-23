/** Separate from library storage. Sign-out does not remove this key. */
export const LAST_SIGN_IN_METHOD_KEY = 'reading-shelf-last-sign-in-method';

export const SIGN_IN_METHODS = ['email', 'google'] as const;

export type SignInMethod = (typeof SIGN_IN_METHODS)[number];

const CAPTIONS: Record<SignInMethod, string> = {
  email: 'La última vez iniciaste sesión con Email',
  google: 'La última vez iniciaste sesión con Google',
};

export function isSignInMethod(value: unknown): value is SignInMethod {
  return value === 'email' || value === 'google';
}

export function lastSignInMethodCaption(method: SignInMethod): string {
  return CAPTIONS[method];
}

export function readLastSignInMethod(): SignInMethod | null {
  try {
    const value = localStorage.getItem(LAST_SIGN_IN_METHOD_KEY);
    return isSignInMethod(value) ? value : null;
  } catch {
    return null;
  }
}

/** Call only after a sign-in succeeds. There is no clear helper: logout must leave the key. */
export function writeLastSignInMethod(method: SignInMethod): void {
  try {
    localStorage.setItem(LAST_SIGN_IN_METHOD_KEY, method);
  } catch {
    // Private mode or blocked storage: the hint is optional.
  }
}
