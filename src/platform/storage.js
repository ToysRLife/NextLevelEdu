// Thin namespaced wrapper over localStorage. All persistence flows through
// here so it can be mirrored to the cloud (see platform/cloud.ts) without any
// game or shell code knowing about it.
const PREFIX = "nle:";
const MUTATED_KEY = `${PREFIX}_mutatedAt`; // last local change time (not synced itself)
const listeners = new Set();
function notify() {
    for (const l of listeners)
        l();
}
/** Subscribe to local writes (the cloud sync engine debounces a push on these). */
export function onStorageWrite(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
}
export function read(key, fallback) {
    try {
        const raw = localStorage.getItem(PREFIX + key);
        return raw === null ? fallback : JSON.parse(raw);
    }
    catch {
        return fallback;
    }
}
export function write(key, value) {
    try {
        localStorage.setItem(PREFIX + key, JSON.stringify(value));
        localStorage.setItem(MUTATED_KEY, String(Date.now()));
    }
    catch {
        // Storage full or unavailable — fail silently; gameplay must not break.
    }
    notify();
}
export function remove(key) {
    try {
        localStorage.removeItem(PREFIX + key);
        localStorage.setItem(MUTATED_KEY, String(Date.now()));
    }
    catch {
        /* ignore */
    }
    notify();
}
/** Wipe all local app state. Used on sign-out so the next person who signs in
 *  on this device starts clean (their real progress comes down from the cloud). */
export function clearLocal() {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PREFIX))
            toRemove.push(k);
    }
    for (const k of toRemove)
        localStorage.removeItem(k);
    notify();
}
/** Timestamp of the last local change — used for last-write-wins sync. */
export function mutatedAt() {
    const r = localStorage.getItem(MUTATED_KEY);
    return r ? Number(r) : 0;
}
/** Capture all app state (everything under the nle: prefix) for cloud upload. */
export function snapshot() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PREFIX) && k !== MUTATED_KEY) {
            const v = localStorage.getItem(k);
            if (v != null)
                data[k.slice(PREFIX.length)] = v;
        }
    }
    return { data };
}
/** Replace local app state with a downloaded snapshot, stamping its time. */
export function restore(snap, at) {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PREFIX) && k !== MUTATED_KEY)
            toRemove.push(k);
    }
    for (const k of toRemove)
        localStorage.removeItem(k);
    for (const [k, v] of Object.entries(snap.data))
        localStorage.setItem(PREFIX + k, v);
    try {
        localStorage.setItem(MUTATED_KEY, String(at));
    }
    catch {
        /* ignore */
    }
    notify();
}
