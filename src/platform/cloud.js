import { clearLocal, mutatedAt, onStorageWrite, restore, snapshot } from "./storage";
import { getProvider } from "./cloud-config";
class CloudSync {
    constructor(provider) {
        Object.defineProperty(this, "provider", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: provider
        });
        Object.defineProperty(this, "user", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "status", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: "off"
        });
        Object.defineProperty(this, "approval", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: "checking"
        });
        Object.defineProperty(this, "applying", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        }); // true while writing a downloaded snapshot
        Object.defineProperty(this, "pushTimer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        this.user = provider.currentUser();
        onStorageWrite(() => this.onLocalWrite());
        if (this.user) {
            this.status = "syncing";
            // Seed approval from the last-known value so a returning, approved user
            // doesn't flash the "checking" screen; merge() re-verifies in the network.
            if (!provider.accountStatus)
                this.approval = "approved";
            else {
                const cached = provider.cachedApproval?.(this.user.uid);
                this.approval = cached === true ? "approved" : "checking";
            }
            // Resume the session after the app has mounted its listeners.
            setTimeout(() => this.merge("resume"), 0);
        }
        else if (provider.resumeRedirect) {
            // We may be returning from a redirect-based sign-in — check for a result.
            setTimeout(() => void this.completeRedirect(), 0);
        }
    }
    /** Finish a sign-in that came back via full-page redirect (popup fallback). */
    async completeRedirect() {
        if (!this.provider.resumeRedirect)
            return;
        const user = await this.provider.resumeRedirect();
        if (!user)
            return;
        this.user = user;
        this.status = "syncing";
        this.emit();
        await this.merge("signin");
    }
    get needsName() {
        return this.provider.needsName;
    }
    get signInLabel() {
        return this.provider.label;
    }
    getUser() {
        return this.user;
    }
    getStatus() {
        return this.status;
    }
    /** Admin-approval state for the signed-in account (always "approved" when no
     *  approval gate is configured, e.g. the local/demo provider). */
    getApproval() {
        return this.approval;
    }
    /** Re-check approval (the pending screen's "Check again" button). */
    async recheck() {
        if (this.user)
            await this.merge("signin");
    }
    /** Whether a reminder can be sent (an approval gate is configured). */
    canRemind() {
        return !!this.provider.remind;
    }
    /** Re-send the admin notification (pending screen's "Remind" button). */
    async remind() {
        await this.provider.remind?.();
    }
    // --- Admin tools ---
    isAdmin() {
        return this.provider.isAdmin?.() ?? false;
    }
    async listPendingUsers() {
        return (await this.provider.listPendingUsers?.()) ?? [];
    }
    async approveUser(uid, email = "", name = "") {
        await this.provider.approveUser?.(uid, email, name);
    }
    async listFeedback() {
        return (await this.provider.listFeedback?.()) ?? [];
    }
    /** Record a learner's feedback for a game (no-op if unsupported). */
    async submitFeedback(gameId, rating, comment) {
        await this.provider.submitFeedback?.(gameId, rating, comment);
    }
    emit() {
        window.dispatchEvent(new CustomEvent("cloud-changed"));
    }
    async signIn(name) {
        try {
            this.status = "syncing";
            this.emit();
            this.user = await this.provider.signIn(name);
            if (this.user)
                await this.merge("signin");
            else
                this.status = "off";
        }
        catch {
            this.status = "error";
        }
        this.emit();
    }
    async signOut() {
        try {
            await this.provider.signOut();
        }
        catch {
            /* ignore */
        }
        this.user = null;
        this.status = "off";
        this.approval = "checking";
        // Clear this device so the next sign-in starts clean (cloud holds the backup).
        clearLocal();
        this.emit();
    }
    /**
     * Reconcile local and cloud.
     * - "signin" (user explicitly logs in): the cloud save is authoritative — you
     *   load YOUR account. Only push if the cloud has nothing yet.
     * - "resume" (silent session restore): last-write-wins by timestamp.
     */
    async merge(mode) {
        if (!this.user)
            return;
        this.status = "syncing";
        this.emit();
        try {
            // Admin-approval gate: a new account is registered as pending and cannot
            // sync (or play) until an admin approves it in the backend.
            if (this.provider.accountStatus) {
                const { approved } = await this.provider.accountStatus(this.user);
                this.approval = approved ? "approved" : "pending";
                if (!approved) {
                    this.status = "off"; // inactive account — no save sync
                    this.emit();
                    window.dispatchEvent(new CustomEvent("cloud-ready"));
                    return;
                }
            }
            else {
                this.approval = "approved";
            }
            const cloudDoc = await this.provider.load(this.user.uid);
            if (!cloudDoc) {
                // First time on this account — seed the cloud with local progress.
                await this.push();
            }
            else if (mode === "signin" || cloudDoc.updatedAt > mutatedAt()) {
                this.applying = true;
                restore({ data: cloudDoc.data }, cloudDoc.updatedAt);
                this.applying = false;
                window.dispatchEvent(new CustomEvent("cloud-synced")); // app re-renders
                this.status = "synced";
            }
            else {
                await this.push();
            }
        }
        catch {
            this.status = "error";
        }
        this.emit();
        // Signal that the account is fully settled (approval checked + data
        // restored/seeded). The gate waits for THIS — not the earlier "syncing"
        // status — before deciding pending vs. onboarding vs. app. Fired for both
        // sign-in and resume so a reload transitions out of the "checking" state.
        window.dispatchEvent(new CustomEvent("cloud-ready"));
    }
    onLocalWrite() {
        if (this.applying || !this.user)
            return;
        this.status = "syncing";
        this.emit();
        if (this.pushTimer)
            clearTimeout(this.pushTimer);
        this.pushTimer = setTimeout(() => void this.push(), 1500);
    }
    async push() {
        if (!this.user)
            return;
        try {
            const snap = snapshot();
            await this.provider.save(this.user.uid, {
                data: snap.data,
                updatedAt: mutatedAt() || Date.now(),
            });
            this.status = "synced";
        }
        catch {
            this.status = "error";
        }
        this.emit();
    }
}
let instance = null;
export function cloud() {
    if (!instance)
        instance = new CloudSync(getProvider());
    return instance;
}
