import { createClient } from "../supabase/server";

export async function getDashboardData() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      profile: null,
      favoritePlayers: [],
      liveMatches: []
    };
  }

  const [{ data: profile }, { data: favoritePlayers }, { data: liveMatches }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase
        .from("user_favorite_players")
        .select("player_id, players(id, name, position)")
        .eq("user_id", user.id),
      supabase
        .from("matches")
        .select("id, status, utc_date, home_score, away_score")
        .in("status", ["TIMED", "LIVE", "IN_PLAY", "PAUSED"])
        .order("utc_date", { ascending: true })
        .limit(8)
    ]);

  return {
    user,
    profile,
    favoritePlayers: favoritePlayers ?? [],
    liveMatches: liveMatches ?? []
  };
}

