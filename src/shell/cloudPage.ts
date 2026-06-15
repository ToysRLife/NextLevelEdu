import { el, clear } from "@core/dom";
import { cloud } from "@platform/cloud";
import { isCloudConfigured } from "@platform/cloud-config";

const STATUS_TEXT: Record<string, string> = {
  off: "Not saving to the cloud",
  syncing: "Syncing…",
  synced: "✓ Saved to the cloud",
  error: "⚠️ Couldn't reach the cloud",
};

export function renderCloud(root: HTMLElement): void {
  const c = cloud();
  const user = c.getUser();
  const status = c.getStatus();

  const card = el("div", { class: "account-card" });

  if (!user) {
    card.append(
      el("div", { class: "account-emoji" }, "☁️"),
      el("h2", {}, "Save your progress"),
      el(
        "p",
        {},
        "Sign in so your worlds, badges, and streak follow you to any device — and so a grown-up can see how you're doing.",
      ),
    );
    if (c.needsName) {
      const input = el("input", {
        type: "text",
        class: "alias-input",
        placeholder: "Your explorer name",
        maxlength: "20",
      }) as HTMLInputElement;
      const go = el(
        "button",
        {
          class: "btn big",
          onclick: () => {
            const name = input.value.trim();
            if (name) void c.signIn(name);
          },
        },
        "☁️ Start saving",
      );
      card.append(input, go);
    } else {
      card.append(el("button", { class: "btn big", onclick: () => void c.signIn() }, c.signInLabel));
    }
    if (!isCloudConfigured()) {
      card.append(
        el(
          "p",
          { class: "account-note" },
          "Demo mode: saving to this device. Add a Firebase config (see cloud-config.ts) for real cross-device sync.",
        ),
      );
    }
  } else {
    card.append(
      el("div", { class: "account-emoji" }, status === "synced" ? "☁️✓" : status === "syncing" ? "🔄" : "☁️"),
      el("h2", {}, `Hi, ${user.name}!`),
      el("p", { class: `account-status ${status}` }, STATUS_TEXT[status] ?? ""),
      el(
        "div",
        { class: "account-actions" },
        el("button", { class: "btn", onclick: () => void c.push() }, "🔄 Sync now"),
        el("button", { class: "btn secondary", onclick: () => void c.signOut() }, "Sign out"),
      ),
      el(
        "p",
        { class: "account-note" },
        "Your progress is backed up automatically as you play. Sign in with the same name on another device to pick up where you left off.",
      ),
    );
  }

  clear(root);
  root.append(el("div", { class: "container" }, el("h2", { class: "section-title" }, "Account & Cloud Save"), card));
}
