import { getWorkerEnv } from './env';

// ─── API response types ───────────────────────────────────────────────────────

export interface FDArea {
  id: number;
  name: string;
  code?: string;
}

export interface FDCompetition {
  id: number;
  name: string;
  code: string;
  type: string;
  emblem: string;
  area: FDArea;
}

export interface FDTeamRef {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
}

export interface FDTeam extends FDTeamRef {
  address?: string;
  website?: string;
  founded?: number;
  clubColors?: string;
  venue?: string;
  squad?: FDPlayer[];
}

export interface FDPlayer {
  id: number;
  name: string;
  position?: string;
  dateOfBirth?: string;
  nationality?: string;
  shirtNumber?: number;
}

export interface FDScore {
  winner: 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null;
  duration: string;
  fullTime: { home: number | null; away: number | null };
  halfTime: { home: number | null; away: number | null };
}

export interface FDGoal {
  minute: number | null;
  injuryTime?: number | null;
  type: string;
  team: { id: number; name: string } | null;
  scorer: { id: number; name: string } | null;
  assist: { id: number; name: string } | null;
}

export interface FDBooking {
  minute: number | null;
  team: { id: number; name: string } | null;
  player: { id: number; name: string } | null;
  card: 'YELLOW' | 'RED' | 'YELLOW_RED';
}

export interface FDSubstitution {
  minute: number | null;
  team: { id: number; name: string } | null;
  playerOut: { id: number; name: string } | null;
  playerIn: { id: number; name: string } | null;
}

export interface FDLineupEntry {
  player: { id: number; name: string; position?: string; shirtNumber?: number };
}

export interface FDLineup {
  team: { id: number };
  formation?: string;
  startXI: FDLineupEntry[];
  bench: FDLineupEntry[];
}

export interface FDMatch {
  id: number;
  competition: FDCompetition;
  utcDate: string;
  status: string;
  matchday?: number | null;
  stage: string;
  group?: string | null;
  venue?: string | null;
  homeTeam: FDTeamRef;
  awayTeam: FDTeamRef;
  score: FDScore;
  goals?: FDGoal[];
  bookings?: FDBooking[];
  substitutions?: FDSubstitution[];
  lineups?: FDLineup[];
}

// ─── Rate limiter ─────────────────────────────────────────────────────────────

// Free tier: 10 calls/min → one call every 6 seconds minimum
const MIN_INTERVAL_MS = 6200;
let lastRequestAt = 0;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function apiFetch(url: string, retries = 3): Promise<Response> {
  const env = getWorkerEnv();
  const wait = MIN_INTERVAL_MS - (Date.now() - lastRequestAt);
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();

  for (let attempt = 0; attempt < retries; attempt++) {
    if (attempt > 0) {
      await sleep(Math.min(1000 * 2 ** attempt, 30_000));
    }
    const res = await fetch(url, {
      headers: { 'X-Auth-Token': env.footballDataApiKey },
    });
    if (res.status === 429) {
      await sleep(60_000); // wait a full minute on rate limit
      continue;
    }
    if (res.status >= 500) continue;
    return res;
  }
  throw new Error(`apiFetch failed after ${retries} attempts: ${url}`);
}

// ─── API functions ────────────────────────────────────────────────────────────

export async function fetchCompetitionMatches(
  code: string,
  opts: { dateFrom?: string; dateTo?: string; status?: string } = {},
): Promise<{ competition: FDCompetition; matches: FDMatch[] }> {
  const params = new URLSearchParams();
  if (opts.dateFrom) params.set('dateFrom', opts.dateFrom);
  if (opts.dateTo) params.set('dateTo', opts.dateTo);
  if (opts.status) params.set('status', opts.status);
  const qs = params.size ? `?${params.toString()}` : '';
  const res = await apiFetch(
    `https://api.football-data.org/v4/competitions/${code}/matches${qs}`,
  );
  if (!res.ok) throw new Error(`fetchCompetitionMatches(${code}) ${res.status}`);
  const data = await res.json() as { competition: FDCompetition; matches: FDMatch[] };
  return data;
}

export async function fetchMatchDetail(matchId: number): Promise<FDMatch> {
  const res = await apiFetch(`https://api.football-data.org/v4/matches/${matchId}`);
  if (!res.ok) throw new Error(`fetchMatchDetail(${matchId}) ${res.status}`);
  return res.json() as Promise<FDMatch>;
}

export async function fetchCompetitionTeams(
  code: string,
): Promise<{ competition: FDCompetition; teams: FDTeam[] }> {
  const res = await apiFetch(
    `https://api.football-data.org/v4/competitions/${code}/teams`,
  );
  if (!res.ok) throw new Error(`fetchCompetitionTeams(${code}) ${res.status}`);
  const data = await res.json() as { competition: FDCompetition; teams: FDTeam[] };
  return data;
}
