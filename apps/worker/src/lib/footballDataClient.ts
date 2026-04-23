import { getWorkerEnv } from "./env";

export async function fetchCompetitionMatches(code: string) {
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

  return response.json();
}

