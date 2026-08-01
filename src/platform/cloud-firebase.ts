import type { CloudDoc, CloudProvider, CloudUser, FeedbackEntry, PendingUser } from "./cloud";
import { ADMIN_EMAILS, SIGNUP_NOTIFY_URL } from "./cloud-config";

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
const NOTIFIED = "nlecloud:notified:"; // + uid -> last admin-notify epoch ms (throttle)

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
    return { uid: u.uid, name: u.displayName || u.email || "Me", email: u.email || "" };
  }

  function cachedEmail(): string {
    try {
      const raw = localStorage.getItem(CACHE);
      return raw ? JSON.parse(raw).email || "" : "";
    } catch {
      return "";
    }
  }

  function cacheApproval(uid: string, approved: boolean): void {
    try {
      localStorage.setItem(APPROVAL + uid, approved ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  // Fire-and-forget admin notification. Uses no-cors so it works against a
  // simple endpoint (e.g. a Google Apps Script web app) without CORS headers;
  // we don't need to read the response.
  function postNotify(payload: Record<string, unknown>): void {
    if (!SIGNUP_NOTIFY_URL) return;
    try {
      void fetch(SIGNUP_NOTIFY_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });
    } catch {
      /* notification is best-effort */
    }
  }

  // Notify the admin that an account is pending — on first signup AND on later
  // sign-ins while still unapproved — so a missed first email isn't the only
  // chance. Throttled per-account so reloads don't spam.
  const NOTIFY_THROTTLE_MS = 10 * 60 * 1000; // 10 minutes
  function maybeNotify(uid: string, email: string, name: string): void {
    if (!SIGNUP_NOTIFY_URL) return;
    try {
      const last = Number(localStorage.getItem(NOTIFIED + uid) || 0);
      if (Date.now() - last < NOTIFY_THROTTLE_MS) return;
      localStorage.setItem(NOTIFIED + uid, String(Date.now()));
    } catch {
      /* if storage is unavailable, just send */
    }
    postNotify({ uid, email, name, time: new Date().toISOString() });
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
        if (res?.user) {
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
        if (
          code.includes("popup") ||
          code.includes("cancelled") ||
          code.includes("operation-not-supported")
        ) {
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

    // Re-send the admin notification (the pending screen's "remind" button), so
    // a waiting learner can nudge the admin if the first email was missed.
    async remind(): Promise<void> {
      await init();
      const u = auth.currentUser;
      postNotify({
        uid: u?.uid || "",
        email: u?.email || "",
        name: u?.displayName || "",
        time: new Date().toISOString(),
        reminder: true,
      });
    },

    // --- Admin tools (server-side enforcement is in the Firestore rules) ---
    isAdmin(): boolean {
      const email = cachedEmail() || auth?.currentUser?.email || "";
      return !!email && ADMIN_EMAILS.includes(email);
    },

    async listPendingUsers(): Promise<PendingUser[]> {
      await init();
      const q = fsMod.query(fsMod.collection(db, "users"), fsMod.where("approved", "==", false));
      const snap = await fsMod.getDocs(q);
      return snap.docs.map((d: any) => ({
        uid: d.id,
        name: d.data().name || "",
        email: d.data().email || "",
      }));
    },

    async approveUser(uid: string, email = "", name = ""): Promise<void> {
      await init();
      await fsMod.updateDoc(fsMod.doc(db, "users", uid), { approved: true });
      // Let the learner know they're in (Apps Script emails them on type "approved").
      if (email) postNotify({ type: "approved", email, name, time: new Date().toISOString() });
    },

    async listFeedback(): Promise<FeedbackEntry[]> {
      await init();
      const q = fsMod.query(
        fsMod.collection(db, "feedback"),
        fsMod.orderBy("time", "desc"),
        fsMod.limit(50)
      );
      const snap = await fsMod.getDocs(q);
      return snap.docs.map((d: any) => ({
        gameId: d.data().gameId || "",
        rating: d.data().rating || 0,
        comment: d.data().comment || "",
        email: d.data().email || "",
      }));
    },

    async submitFeedback(gameId: string, rating: number, comment: string): Promise<void> {
      await init();
      const u = auth.currentUser;
      await fsMod.addDoc(fsMod.collection(db, "feedback"), {
        gameId,
        rating,
        comment: comment || "",
        uid: u?.uid || "",
        email: u?.email || "",
        time: fsMod.serverTimestamp(),
      });
    },

    // Admin-approval gate. On first sign-in, registers a pending account record
    // (users/{uid}) and notifies the admin; thereafter reports its approved flag.
    async accountStatus(user: CloudUser): Promise<{ approved: boolean }> {
      await init();
      // Refresh the cached user so its email is present (needed by isAdmin()).
      if (auth.currentUser) cache(toUser(auth.currentUser));
      const ref = fsMod.doc(db, "users", user.uid);
      const email = auth.currentUser?.email || "";
      const name = auth.currentUser?.displayName || user.name || "";
      try {
        const snap = await fsMod.getDoc(ref);
        let approved: boolean;
        if (snap.exists()) {
          approved = snap.data()?.approved === true;
        } else {
          // First sign-in. Grandfather an account that already has saved progress
          // (it predates the gate). NOTE: reading saves/{uid} is itself gated by
          // the approval rule, so a brand-new (unapproved) account's read is DENIED
          // and throws — we must treat that as "no save" and register as pending,
          // NOT let it abort the users-doc creation below.
          let hasSave = false;
          try {
            hasSave = (await fsMod.getDoc(fsMod.doc(db, "saves", user.uid))).exists();
          } catch {
            hasSave = false;
          }
          approved = hasSave;
          await fsMod.setDoc(
            ref,
            hasSave
              ? {
                  email,
                  name,
                  approved: true,
                  grandfathered: true,
                  createdAt: fsMod.serverTimestamp(),
                }
              : { email, name, approved: false, createdAt: fsMod.serverTimestamp() }
          );
        }
        cacheApproval(user.uid, approved);
        // Alert the admin on every pending sign-in (throttled), not just the first.
        if (!approved) maybeNotify(user.uid, email, name);
        return { approved };
      } catch {
        // Network/permission hiccup — fall back to the last-known value so an
        // already-approved user isn't locked out by a transient error, and still
        // try to alert the admin if this account looks unapproved.
        const approved = localStorage.getItem(APPROVAL + user.uid) === "1";
        if (!approved) maybeNotify(user.uid, email, name);
        return { approved };
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
