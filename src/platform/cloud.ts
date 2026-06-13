import { snapshot, restore, mutatedAt, onStorageWrite, clearLocal } from "./storage";
import { getProvider } from "./cloud-config";

// --- Cloud save: swappable provider behind the storage seam. ---------------
// The app never imports a specific backend. `getProvider()` returns a local
// (offline) provider by default, or the Firebase provider once a config is
// supplied — see cloud-config.ts. The engine below is identical either way.

export interface CloudUser {
  uid: string;
  name: string;
}

export interface CloudDoc {
  data: Record<string, string>;
  updatedAt: number;
}

export interface CloudProvider {
  /** True if sign-in needs a name from the user (the local provider does). */
  readonly needsName: boolean;
  /** A friendly label for the sign-in button, e.g. "Sign in with Google". */
  readonly label: string;
  signIn(name?: string): Promise<CloudUser | null>;
  signOut(): Promise<void>;
  currentUser(): CloudUser | null;
  load(uid: string): Promise<CloudDoc | null>;
  save(uid: string, doc: CloudDoc): Promise<void>;
  /** Optional: finish a sign-in that completed via a full-page redirect. */
  resumeRedirect?(): Promise<CloudUser | null>;
}

export type SyncStatus = "off" | "syncing" | "synced" | "error";

class CloudSync {
  private user: CloudUser | null;
  private status: SyncStatus = "off";
  private applying = false; // true while writing a downloaded snapshot
  private pushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly provider: CloudProvider) {
    this.user = provider.currentUser();
    onStorageWrite(() => this.onLocalWrite());
    if (this.user) {
      this.status = "syncing";
      // Resume the session after the app has mounted its listeners.
      setTimeout(() => this.merge("resume"), 0);
    } else if (provider.resumeRedirect) {
      // We may be returning from a redirect-based sign-in — check for a result.
      setTimeout(() => void this.completeRedirect(), 0);
    }
  }

  /** Finish a sign-in that came back via full-page redirect (popup fallback). */
  private async completeRedirect(): Promise<void> {
    if (!this.provider.resumeRedirect) return;
    const user = await this.provider.resumeRedirect();
    if (!user) return;
    this.user = user;
    this.status = "syncing";
    this.emit();
    await this.merge("signin");
  }

  get needsName(): boolean {
    return this.provider.needsName;
  }
  get signInLabel(): string {
    return this.provider.label;
  }
  getUser(): CloudUser | null {
    return this.user;
  }
  getStatus(): SyncStatus {
    return this.status;
  }

  private emit(): void {
    window.dispatchEvent(new CustomEvent("cloud-changed"));
  }

  async signIn(name?: string): Promise<void> {
    try {
      this.status = "syncing";
      this.emit();
      this.user = await this.provider.signIn(name);
      if (this.user) await this.merge("signin");
      else this.status = "off";
    } catch {
      this.status = "error";
    }
    this.emit();
  }

  async signOut(): Promise<void> {
    try {
      await this.provider.signOut();
    } catch {
      /* ignore */
    }
    this.user = null;
    this.status = "off";
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
  private async merge(mode: "signin" | "resume"): Promise<void> {
    if (!this.user) return;
    this.status = "syncing";
    this.emit();
    try {
      const cloudDoc = await this.provider.load(this.user.uid);
      if (!cloudDoc) {
        // First time on this account — seed the cloud with local progress.
        await this.push();
      } else if (mode === "signin" || cloudDoc.updatedAt > mutatedAt()) {
        this.applying = true;
        restore({ data: cloudDoc.data }, cloudDoc.updatedAt);
        this.applying = false;
        window.dispatchEvent(new CustomEvent("cloud-synced")); // app re-renders
        this.status = "synced";
      } else {
        await this.push();
      }
    } catch {
      this.status = "error";
    }
    this.emit();
    // Sign-in only: signal that the cloud data is fully settled (restored or
    // seeded). The gate waits for THIS — not the earlier "syncing" status — so a
    // returning user's persona is back before we decide app vs. onboarding.
    if (mode === "signin") window.dispatchEvent(new CustomEvent("cloud-ready"));
  }

  private onLocalWrite(): void {
    if (this.applying || !this.user) return;
    this.status = "syncing";
    this.emit();
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => void this.push(), 1500);
  }

  async push(): Promise<void> {
    if (!this.user) return;
    try {
      const snap = snapshot();
      await this.provider.save(this.user.uid, { data: snap.data, updatedAt: mutatedAt() || Date.now() });
      this.status = "synced";
    } catch {
      this.status = "error";
    }
    this.emit();
  }
}

let instance: CloudSync | null = null;
export function cloud(): CloudSync {
  if (!instance) instance = new CloudSync(getProvider());
  return instance;
}
