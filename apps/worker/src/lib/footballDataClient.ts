import { getWorkerEnv } from "./env";

type CompetitionMatchesResponse = {
  matches?: unknown[];
};

export async function fetchCompetitionMatches(
  code: string
): Promise<CompetitionMatchesResponse> {
  const env = getWorkerEnv();
  const response = await fetch(
    `https://api.football-data.org/v4/competitions/${code}/matches`,
    {
      headers: {
        "X-Auth-Token": env.footballDataApiKey
      }
    }
  );

  if (!response.ok) {
    throw new Error(`football-data.org request failed: ${response.status}`);
  }

  return (await response.json()) as CompetitionMatchesResponse;
}
