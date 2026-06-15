import { el, clear } from "@core/dom";
import { savePersona } from "./profile";

// First-run gate: the learner chooses an explorer alias + a preset avatar.
// (Later the avatar becomes an AI-generated anime portrait; the source photo is
// discarded immediately. No backend is needed for this step.)
const AVATARS = ["🧑‍🚀", "👩‍🚀", "🧑‍🔬", "👩‍🔬", "🦸", "🦸‍♀️", "🤖", "👽", "🦊", "🐼", "🦉", "🦄"];
const ALIAS_IDEAS = ["Nova", "Comet", "Star Pilot", "Captain Atom", "Professor Spark", "Cosmo"];

export function renderOnboarding(root: HTMLElement, onDone: () => void): void {
  let alias = "";
  let emoji = AVATARS[0];

  const aliasInput = el("input", {
    type: "text",
    class: "alias-input",
    maxlength: "18",
    placeholder: "Pick your explorer name",
    oninput: (e: Event) => {
      alias = (e.target as HTMLInputElement).value.trim();
      startBtn.toggleAttribute("disabled", alias.length === 0);
    },
  }) as HTMLInputElement;

  const avatarGrid = el(
    "div",
    { class: "avatar-grid" },
    ...AVATARS.map((a) =>
      el(
        "button",
        {
          class: "avatar-option" + (a === emoji ? " active" : ""),
          onclick: () => {
            emoji = a;
            avatarGrid.querySelectorAll("button").forEach((b) =>
              b.classList.toggle("active", b.textContent === a),
            );
          },
        },
        a,
      ),
    ),
  );

  const ideas = el(
    "div",
    { class: "alias-ideas" },
    ...ALIAS_IDEAS.map((idea) =>
      el(
        "button",
        {
          class: "chip",
          onclick: () => {
            alias = idea;
            aliasInput.value = idea;
            startBtn.removeAttribute("disabled");
          },
        },
        idea,
      ),
    ),
  );

  const startBtn = el(
    "button",
    {
      class: "btn big",
      disabled: "true",
      onclick: () => {
        if (!alias) return;
        savePersona({ alias, emoji });
        onDone();
      },
    },
    "🚀 Start Exploring",
  ) as HTMLButtonElement;

  const card = el(
    "div",
    { class: "onboard-card" },
    el("div", { class: "onboard-hero" }, "👋"),
    el("h1", {}, "Welcome, Explorer!"),
    el("p", { class: "onboard-sub" }, "Master science to build worlds of your own. First, who are you?"),
    el("div", { class: "control-label" }, "Choose your avatar"),
    avatarGrid,
    el("div", { class: "control-label" }, "Your explorer name"),
    aliasInput,
    ideas,
    startBtn,
  );

  clear(root);
  root.append(el("div", { class: "onboard-screen" }, card));
}
