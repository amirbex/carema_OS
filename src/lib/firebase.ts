import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';

// In AI Studio, firebase-applet-config.json is auto-generated in the root.
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
export const auth = getAuth(app);

// Keep the session across reloads/tabs and on mobile browsers that evict
// in-memory sessions. Failures are non-fatal (e.g. strict privacy modes).
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.warn('[firebase] could not set auth persistence', error);
});

/**
 * Best-effort connectivity probe.
 *
 * The old version called `getDocFromServer` on a path the security rules deny
 * and returned a rejected promise that nobody awaited — a permanent
 * "unhandled rejection" in the console. Now it never throws.
 */
export async function testConnection(): Promise<boolean> {
  try {
    // A denied read still proves the SDK reached Firestore; permission errors
    // are expected for the probe document.
    await getDocFromServer(doc(db, 'test', 'connection'));
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
