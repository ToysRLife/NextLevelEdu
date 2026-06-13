import type { CloudProvider, CloudUser, CloudDoc } from "./cloud";
import { SIGNUP_NOTIFY_URL } from "./cloud-config";

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
const APPROVAL = "nlecloud:approved:"; // + uid -> "1" | "0" (last-known approval)

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

  function cacheApproval(uid: string, approved: boolean): void {
    try {
      localStorage.setItem(APPROVAL + uid, approved ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  // Fire-and-forget admin notification for a brand-new signup. Uses no-cors so
  // it works against a simple endpoint (e.g. a Google Apps Script web app)
  // without CORS headers; we don't need to read the response.
  function notifySignup(uid: string, email: string, name: string): void {
    if (!SIGNUP_NOTIFY_URL) return;
    try {
      void fetch(SIGNUP_NOTIFY_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ uid, email, name, time: new Date().toISOString() }),
      });
    } catch {
      /* notification is best-effort */
    }
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

    cachedApproval(uid: string): boolean | null {
      const v = localStorage.getItem(APPROVAL + uid);
      return v === null ? null : v === "1";
    },

    // Admin-approval gate. On first sign-in, registers a pending account record
    // (users/{uid}) and notifies the admin; thereafter reports its approved flag.
    async accountStatus(user: CloudUser): Promise<{ approved: boolean }> {
      await init();
      const ref = fsMod.doc(db, "users", user.uid);
      try {
        const snap = await fsMod.getDoc(ref);
        if (!snap.exists()) {
          const email = auth.currentUser?.email || "";
          const name = auth.currentUser?.displayName || user.name || "";
          // Grandfather: an account that already has saved progress predates the
          // approval gate (a new user can't write a save until approved), so it's
          // trusted — auto-approve and record it. Otherwise it's a fresh signup:
          // register as pending and notify the admin.
          const hasSave = (await fsMod.getDoc(fsMod.doc(db, "saves", user.uid))).exists();
          if (hasSave) {
            await fsMod.setDoc(ref, { email, name, approved: true, grandfathered: true, createdAt: fsMod.serverTimestamp() });
            cacheApproval(user.uid, true);
            return { approved: true };
          }
          await fsMod.setDoc(ref, { email, name, approved: false, createdAt: fsMod.serverTimestamp() });
          notifySignup(user.uid, email, name);
          cacheApproval(user.uid, false);
          return { approved: false };
        }
        const approved = snap.data()?.approved === true;
        cacheApproval(user.uid, approved);
        return { approved };
      } catch {
        // Network/permission hiccup — fall back to the last-known value so an
        // already-approved user isn't locked out by a transient error.
        const cached = localStorage.getItem(APPROVAL + user.uid);
        return { approved: cached === "1" };
      }
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
