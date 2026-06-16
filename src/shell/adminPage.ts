import { clear, el } from "@core/dom";
import { cloud } from "@platform/cloud";
import { GAME_MANIFESTS } from "../registry";

// In-app admin console: approve pending learners and review game feedback.
// Only reachable when cloud().isAdmin() (and the writes are enforced by the
// Firestore rules' isAdmin() too, so this page can't be abused by editing the
// client).
export function renderAdmin(root: HTMLElement): void {
  const c = cloud();
  const container = el("div", { class: "container" });
  clear(root);
  root.append(container);

  if (!c.isAdmin()) {
    container.append(
      el("h2", { class: "section-title" }, "Admin"),
      el("p", { class: "admin-note" }, "This page is for admins only.")
    );
    return;
  }

  const gameTitle = (id: string) => GAME_MANIFESTS.find((m) => m.id === id)?.title ?? id;
  const ratingEmoji = (r: number) => (r >= 3 ? "😍" : r === 2 ? "🙂" : r === 1 ? "😕" : "—");

  const pendingWrap = el(
    "div",
    { class: "admin-section" },
    el("div", { class: "admin-loading" }, "Loading pending learners…")
  );
  const feedbackWrap = el(
    "div",
    { class: "admin-section" },
    el("div", { class: "admin-loading" }, "Loading feedback…")
  );

  container.append(
    el(
      "div",
      { class: "admin-head" },
      el("h2", { class: "section-title" }, "🛠️ Admin"),
      el("button", { class: "btn small secondary", onclick: () => void load() }, "↻ Refresh")
    ),
    el("h3", { class: "admin-h3" }, "Pending approvals"),
    pendingWrap,
    el("h3", { class: "admin-h3" }, "Recent feedback"),
    feedbackWrap
  );

  async function load(): Promise<void> {
    // --- Pending users ---
    clear(pendingWrap);
    pendingWrap.append(el("div", { class: "admin-loading" }, "Loading pending learners…"));
    let pending;
    try {
      pending = await c.listPendingUsers();
    } catch {
      clear(pendingWrap);
      pendingWrap.append(
        el(
          "p",
          { class: "admin-note" },
          "Couldn't load pending users (check your connection / rules)."
        )
      );
      pending = null;
    }
    if (pending) {
      clear(pendingWrap);
      if (!pending.length) {
        pendingWrap.append(
          el("p", { class: "admin-note" }, "🎉 No one is waiting — all caught up!")
        );
      } else {
        pending.forEach((u) => {
          const row = el(
            "div",
            { class: "admin-row" },
            el(
              "div",
              { class: "admin-who" },
              el("strong", {}, u.name || "(no name)"),
              el("span", { class: "admin-email" }, u.email || u.uid)
            ),
            el(
              "button",
              {
                class: "btn small",
                onclick: async (e: Event) => {
                  const b = e.currentTarget as HTMLButtonElement;
                  b.textContent = "Approving…";
                  b.toggleAttribute("disabled", true);
                  try {
                    await c.approveUser(u.uid, u.email, u.name);
                    row.classList.add("done");
                    row.replaceChildren(
                      el(
                        "div",
                        { class: "admin-who" },
                        el("strong", {}, `✓ ${u.name || u.email} approved`)
                      )
                    );
                  } catch {
                    b.textContent = "Approve";
                    b.toggleAttribute("disabled", false);
                    b.after(el("span", { class: "admin-err" }, " failed — try again"));
                  }
                },
              },
              "✓ Approve"
            )
          );
          pendingWrap.append(row);
        });
      }
    }

    // --- Feedback ---
    clear(feedbackWrap);
    feedbackWrap.append(el("div", { class: "admin-loading" }, "Loading feedback…"));
    let feedback;
    try {
      feedback = await c.listFeedback();
    } catch {
      clear(feedbackWrap);
      feedbackWrap.append(el("p", { class: "admin-note" }, "Couldn't load feedback."));
      feedback = null;
    }
    if (feedback) {
      clear(feedbackWrap);
      if (!feedback.length) {
        feedbackWrap.append(el("p", { class: "admin-note" }, "No feedback yet."));
      } else {
        feedback.forEach((f) => {
          feedbackWrap.append(
            el(
              "div",
              { class: "admin-fb" },
              el("span", { class: "fb-rating" }, ratingEmoji(f.rating)),
              el(
                "div",
                { class: "fb-body" },
                el("div", { class: "fb-game" }, gameTitle(f.gameId)),
                f.comment ? el("div", { class: "fb-comment" }, `“${f.comment}”`) : null,
                f.email ? el("div", { class: "fb-email" }, f.email) : null
              )
            )
          );
        });
      }
    }
  }

  void load();
}
