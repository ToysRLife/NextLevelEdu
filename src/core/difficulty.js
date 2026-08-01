/**
 * Pick a value by the learner's difficulty tier. Games read `ctx.tier` and use
 * this to scale a knob (a tolerance, target size, time limit, count, …) —
 * gentler for "junior", standard for "explorer", tougher for "master".
 */
export function byTier(tier, junior, explorer, master) {
    return tier === "junior" ? junior : tier === "master" ? master : explorer;
}
