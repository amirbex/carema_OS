export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

/**
 * Turn any thrown value into a short, user-presentable message.
 * Never leaks stack traces or personal data into the UI.
 */
export function describeError(error: unknown): string {
  const code = (error as any)?.code as string | undefined;
  const raw = error instanceof Error ? error.message : String(error ?? '');

  if (code === 'permission-denied' || /insufficient permissions/i.test(raw)) {
    return 'You do not have permission to do that.';
  }
  if (code === 'unavailable' || /network|offline/i.test(raw)) {
    return 'Network problem — changes will sync when you are back online.';
  }
  if (code === 'not-found') return 'That item no longer exists.';
  if (code === 'resource-exhausted' || /quota/i.test(raw)) {
    return 'Service limit reached. Please try again in a moment.';
  }
  if (code === 'unauthenticated' || /auth/i.test(raw)) {
    return 'Your session expired. Please sign in again.';
  }
  return 'Something went wrong. Please try again.';
}

/**
 * Log a structured, PII-free diagnostic and return a friendly message.
 *
 * Previously this helper *threw* a JSON string containing the user's email,
 * which produced unhandled promise rejections in every `catch` block.
 */
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): string {
  const info = {
    error: error instanceof Error ? error.message : String(error),
    code: (error as any)?.code ?? null,
    operationType,
    path,
  };
  console.error('[firestore]', JSON.stringify(info));
  return describeError(error);
}

/** Map Firebase Auth error codes to human sentences. */
export function describeAuthError(error: unknown): string {
  const code = (error as any)?.code as string | undefined;
  switch (code) {
    case 'auth/invalid-email':
      return 'That email address is not valid.';
    case 'auth/missing-password':
      return 'Please enter your password.';
    case 'auth/weak-password':
      return 'Passwords need at least 6 characters.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try signing in.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in window was closed before finishing.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in popup. Allow popups and retry.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is disabled for the project.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    default:
      return 'Sign-in failed. Please try again.';
  }
}
