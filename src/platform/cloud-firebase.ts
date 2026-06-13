import type { CloudProvider, CloudUser, CloudDoc } from "./cloud";

// Real cross-device cloud save via Firebase Auth (Google) + Firestore.
//
// Setup (in the Firebase console):
//   - enable Google sign-in (Authentication → Sign-in method)
//   - add a Firestore rule so each user reads/writes only their own save:
//       match /saves/{uid} { allow read, write: if request.auth.uid == uid; }
//
// The Firebase SDK is loaded with dynamic import() so it is code-split into its
// own chunk — it only downloads when a cloud config is actually present (see
// getProvider() in cloud-config.ts), keeping the initial bundle small.

const CACHE = "nlecloud:fbuser"; // cached signed-in user (uid survives reloads)

export function makeFirebaseProvider(config: Record<string, string>): CloudProvider {
  let ready: Promise<void> | null = null;
  let authMod: any = null;
  let fsMod: any = null;
  let auth: any = null;
  let db: any = null;

  async function init(): Promise<void> {
    if (ready) return ready;
    ready = (async () => {
      const appMod: any = await import("firebase/app");
      authMod = await import("firebase/auth");
      fsMod = await import("firebase/firestore");
      const app = appMod.initializeApp(config);
      auth = authMod.getAuth(app);
      db = fsMod.getFirestore(app);
    })();
    return ready;
  }

  // Warm up the SDK as soon as the app loads. A sign-in popup is only allowed
  // if it opens *synchronously* inside the user's click — if we waited to
  // download the SDK on click, the browser would block the popup. Pre-loading
  // here means signIn() can call signInWithPopup() immediately.
  void init();

  function cache(user: CloudUser | null): void {
    if (user) localStorage.setItem(CACHE, JSON.stringify(user));
    else localStorage.removeItem(CACHE);
  }

  function toUser(u: any): CloudUser {
    return { uid: u.uid, name: u.displayName || u.email || "Me" };
  }

  return {
    needsName: false,
    label: "Sign in with Google",

    currentUser(): CloudUser | null {
      try {
        const raw = localStorage.getItem(CACHE);
        return raw ? (JSON.parse(raw) as CloudUser) : null;
      } catch {
        return null;
      }
    },

    // Picks up a sign-in that completed via a full-page redirect (the popup
    // fallback below). Called once on app load by the sync engine.
    async resumeRedirect(): Promise<CloudUser | null> {
      await init();
      try {
        const res = await authMod.getRedirectResult(auth);
        if (res && res.user) {
          const user = toUser(res.user);
          cache(user);
          return user;
        }
      } catch {
        /* no pending redirect */
      }
      return null;
    },

    async signIn(): Promise<CloudUser | null> {
      await init();
      const provider = new authMod.GoogleAuthProvider();
      try {
        const cred = await authMod.signInWithPopup(auth, provider);
        const user = toUser(cred.user);
        cache(user);
        return user;
      } catch (e: any) {
        const code: string = e?.code || "";
        // Popup blocked, dismissed, or unsupported (mobile) → fall back to a
        // full-page redirect, which no popup blocker can stop. The page
        // navigates to Google and back; resumeRedirect() finishes the job.
        if (code.includes("popup") || code.includes("cancelled") || code.includes("operation-not-supported")) {
          await authMod.signInWithRedirect(auth, provider);
          return null; // page is navigating away
        }
        throw e;
      }
    },

    async signOut(): Promise<void> {
      await init();
      await authMod.signOut(auth);
      cache(null);
    },

    async load(uid: string): Promise<CloudDoc | null> {
      await init();
      const snap = await fsMod.getDoc(fsMod.doc(db, "saves", uid));
      return snap.exists() ? (snap.data() as CloudDoc) : null;
    },

    async save(uid: string, doc: CloudDoc): Promise<void> {
      await init();
      await fsMod.setDoc(fsMod.doc(db, "saves", uid), doc);
    },
  };
}
