import type { CloudProvider, CloudUser, CloudDoc } from "./cloud";

// A zero-config "cloud" that simulates a backend in a SEPARATE localStorage
// namespace keyed by account. It exercises the full sign-in → pull → merge →
// push flow today (great for dev and demos). Swap in the Firebase provider for
// real cross-device sync by adding a config (see cloud-config.ts).

const NS = "nlecloud:";
const CURRENT = NS + "current";

function slug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "explorer";
}

export class LocalCloudProvider implements CloudProvider {
  readonly needsName = true;
  readonly label = "Save to this device's cloud";

  currentUser(): CloudUser | null {
    try {
      const raw = localStorage.getItem(CURRENT);
      return raw ? (JSON.parse(raw) as CloudUser) : null;
    } catch {
      return null;
    }
  }

  async signIn(name = "Explorer"): Promise<CloudUser> {
    const user: CloudUser = { uid: slug(name), name: name.trim() || "Explorer" };
    localStorage.setItem(CURRENT, JSON.stringify(user));
    return user;
  }

  async signOut(): Promise<void> {
    localStorage.removeItem(CURRENT);
  }

  async load(uid: string): Promise<CloudDoc | null> {
    try {
      const raw = localStorage.getItem(NS + "doc:" + uid);
      return raw ? (JSON.parse(raw) as CloudDoc) : null;
    } catch {
      return null;
    }
  }

  async save(uid: string, doc: CloudDoc): Promise<void> {
    localStorage.setItem(NS + "doc:" + uid, JSON.stringify(doc));
  }
}
