// A zero-config "cloud" that simulates a backend in a SEPARATE localStorage
// namespace keyed by account. It exercises the full sign-in → pull → merge →
// push flow today (great for dev and demos). Swap in the Firebase provider for
// real cross-device sync by adding a config (see cloud-config.ts).
const NS = "nlecloud:";
const CURRENT = `${NS}current`;
function slug(name) {
    return (name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "explorer");
}
export class LocalCloudProvider {
    constructor() {
        Object.defineProperty(this, "needsName", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
        Object.defineProperty(this, "label", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: "Save to this device's cloud"
        });
    }
    currentUser() {
        try {
            const raw = localStorage.getItem(CURRENT);
            return raw ? JSON.parse(raw) : null;
        }
        catch {
            return null;
        }
    }
    async signIn(name = "Explorer") {
        const user = { uid: slug(name), name: name.trim() || "Explorer" };
        localStorage.setItem(CURRENT, JSON.stringify(user));
        return user;
    }
    async signOut() {
        localStorage.removeItem(CURRENT);
    }
    async load(uid) {
        try {
            const raw = localStorage.getItem(`${NS}doc:${uid}`);
            return raw ? JSON.parse(raw) : null;
        }
        catch {
            return null;
        }
    }
    async save(uid, doc) {
        localStorage.setItem(`${NS}doc:${uid}`, JSON.stringify(doc));
    }
}
