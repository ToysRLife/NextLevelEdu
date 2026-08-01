import { clear, el } from "@core/dom";
import { cloud } from "@platform/cloud";
// Shown when a signed-in account hasn't been approved by an admin yet (or while
// we're still checking). New accounts stay inactive — no games, worlds, or
// saving — until an admin flips their `approved` flag in the backend.
export function renderPendingApproval(root, state) {
    const c = cloud();
    const user = c.getUser();
    const card = el("div", { class: "login-card" });
    if (state === "checking") {
        card.append(el("div", { class: "login-hero spin" }, "🛰️"), el("h1", { class: "login-title" }, "Getting ready…"), el("p", { class: "login-sub" }, "Checking your account."));
    }
    else {
        card.append(el("div", { class: "login-hero" }, "⏳"), el("h1", { class: "login-title" }, "Almost there!"), el("p", { class: "login-sub" }, user ? `Thanks for signing in, ${user.name.split(" ")[0]}!` : "Thanks for signing in!"), el("p", { class: "login-note-lead" }, "Your account is waiting for a grown-up to approve it. Once it's approved, you'll be able to play all the games and build your worlds."), el("button", {
            class: "btn big",
            onclick: (e) => {
                const btn = e.currentTarget;
                btn.textContent = "🔄 Checking…";
                btn.toggleAttribute("disabled", true);
                void c.recheck();
            },
        }, "🔄 Check again"));
        if (c.canRemind()) {
            card.append(el("button", {
                class: "btn secondary",
                onclick: (e) => {
                    const btn = e.currentTarget;
                    void c.remind();
                    btn.textContent = "📨 Reminder sent!";
                    btn.toggleAttribute("disabled", true);
                    setTimeout(() => {
                        btn.textContent = "📨 Remind the grown-up";
                        btn.toggleAttribute("disabled", false);
                    }, 30000);
                },
            }, "📨 Remind the grown-up"));
        }
        card.append(el("button", { class: "btn secondary", onclick: () => void c.signOut() }, "Sign out"), el("p", { class: "login-foot" }, "An approval usually only takes a little while."));
    }
    clear(root);
    root.append(el("div", { class: "login-screen" }, card));
}
