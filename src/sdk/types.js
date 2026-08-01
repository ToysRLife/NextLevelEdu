// The contract every game implements. The shell, gamification, hints, and
// analytics are written once against these types; a new game only fills in a
// GameModule. Platform services are injected, so games never touch storage,
// auth, or the reward economy directly — those swap to Supabase later.
export {};
