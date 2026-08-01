import { clear, el } from "@core/dom";
import { cloud } from "@platform/cloud";
import { isCloudConfigured } from "@platform/cloud-config";
import { GAME_MANIFESTS } from "../registry";

// Full-screen sign-in gate. Nothing in the app — not Missions, Worlds, or a
// single game — is reachable until the learner is signed in, so progress always
// has a home in the cloud. The app re-mounts automatically when sign-in
// succeeds (see the auth listener in app.ts), so this screen needs no callback.
export function renderLoginGate(root: HTMLElement): void {
  const c = cloud();

  const card = el(
    "div",
    { class: "login-card" },
    el("div", { class: "login-hero" }, "🚀"),
    el("h1", { class: "login-title" }, "NextLevel ", el("span", {}, "Edu")),
    el(
      "p",
      { class: "login-sub" },
      `Play ${GAME_MANIFESTS.length} science adventures, build your own worlds, and collect trophies.`
    ),
    el(
      "p",
      { class: "login-note-lead" },
      "Sign in to start — your progress follows you to every device."
    )
  );

  if (c.needsName) {
    // Local/demo provider (no Firebase config) — ask for an explorer name.
    const input = el("input", {
      type: "text",
      class: "alias-input",
      placeholder: "Your explorer name",
      maxlength: "20",
      onkeydown: (e: KeyboardEvent) => {
        if (e.key === "Enter") go.click();
      },
    });
    const go = el(
      "button",
      {
        class: "btn big",
        onclick: () => {
          const name = input.value.trim();
          if (name) void c.signIn(name);
        },
      },
      "🚀 Start exploring"
    );
    card.append(input, go);
  } else {
    card.append(el("button", { class: "btn big", onclick: () => void c.signIn() }, c.signInLabel));
  }

  if (!isCloudConfigured()) {
    card.append(el("p", { class: "account-note" }, "Demo mode: saving to this device only."));
  }

  card.append(
    el(
      "p",
      { class: "login-foot" },
      "For learning at home and in class. A grown-up can help you sign in."
    )
  );

  clear(root);
  root.append(el("div", { class: "login-screen" }, card));
}
