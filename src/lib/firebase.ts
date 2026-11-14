import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  signOut,
  type Auth,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore, type Firestore } from 'firebase/firestore';

// In AI Studio, firebase-applet-config.json is auto-generated in the root.
import firebaseConfig from '../../firebase-applet-config.json';

/**
 * Demo / preview mode.
 *
 * Enabled by `VITE_DEMO_MODE=true` (used by the GitHub Pages build). In this
 * mode the app never talks to Firebase or to the Express API: authentication is
 * bypassed with a fixed demo user and all data comes from `demoStore`
 * (localStorage). This makes the UI fully explorable as a static site.
 */
export const IS_DEMO = import.meta.env.VITE_DEMO_MODE === 'true' || import.meta.env.VITE_DEMO_MODE === '1';

export interface SessionUser {
  uid: string;
  email: string | null;
  displayName?: string | null;
  isDemo?: boolean;
}

export const DEMO_USER: SessionUser = {
  uid: 'demo-user',
  email: 'demo@carema.app',
  displayName: 'CaReMa Demo',
  isDemo: true,
};

let firebaseApp: FirebaseApp | null = null;
let firestore: Firestore | null = null;
let firebaseAuth: Auth | null = null;

if (!IS_DEMO) {
  firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  firestore = getFirestore(firebaseApp, (firebaseConfig as any).firestoreDatabaseId);
  firebaseAuth = getAuth(firebaseApp);

  // Keep the session across reloads/tabs and on mobile browsers that evict
  // in-memory sessions. Failures are non-fatal (e.g. strict privacy modes).
  setPersistence(firebaseAuth, browserLocalPersistence).catch((error) => {
    console.warn('[firebase] could not set auth persistence', error);
  });
}

/**
 * Firestore handle. `null` in demo mode — the data layer checks `IS_DEMO`
 * before touching it, so nothing can accidentally hit the network.
 */
export const db = firestore as Firestore;
export const auth = firebaseAuth as Auth;

export function getCurrentUser(): SessionUser | null {
  if (IS_DEMO) return DEMO_USER;
  const user = firebaseAuth?.currentUser;
  if (!user) return null;
  return { uid: user.uid, email: user.email, displayName: user.displayName };
}

export async function signOutUser(): Promise<void> {
  if (IS_DEMO || !firebaseAuth) return;
  await signOut(firebaseAuth);
}

export function subscribeToAuth(
  callback: (user: SessionUser | null) => void,
  onError?: (error: unknown) => void
): () => void {
  if (IS_DEMO || !firebaseAuth) {
    callback(IS_DEMO ? DEMO_USER : null);
    return () => {};
  }
  return onAuthStateChanged(
    firebaseAuth,
    (user) => callback(user ? { uid: user.uid, email: user.email, displayName: user.displayName } : null),
    onError
  );
}

/**
 * Best-effort connectivity probe. Never throws and is a no-op in demo mode.
 */
export async function testConnection(): Promise<boolean> {
  if (IS_DEMO || !firestore) return true;
  try {
    // A denied read still proves the SDK reached Firestore; permission errors
    // are expected for the probe document.
    await getDocFromServer(doc(firestore, 'test', 'connection'));
    return true;
  } catch (error: any) {
    const code = String(error?.code ?? '');
    if (code.includes('permission-denied')) return true;
    if (String(error?.message ?? '').includes('the client is offline')) {
      console.error('[firebase] client is offline — check firebase-applet-config.json and network.');
    }
    return false;
  }
}
