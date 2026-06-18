const BASE = "/api";

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
}

export const api = {
  createLeague: (data) => req("POST", "/league/create", data),
  joinLeague: (data) => req("POST", "/league/join", data),
  startLeague: (id) => req("POST", `/league/${id}/start`),
  getLeague: (id) => req("GET", `/league/${id}`),
  getSquad: (leagueId, teamId) => req("GET", `/league/${leagueId}/squad/${teamId}`),
  getMarket: (leagueId) => req("GET", `/league/${leagueId}/market`),
  buyPlayer: (leagueId, data) => req("POST", `/league/${leagueId}/transfer/buy`, data),
  sellPlayer: (leagueId, data) => req("POST", `/league/${leagueId}/transfer/sell`, data),
  getEvents: (leagueId, userId) => req("GET", `/league/${leagueId}/events/${userId}`),
  completeEvent: (leagueId, data) => req("POST", `/league/${leagueId}/events/complete`, data),
  setTactics: (leagueId, data) => req("POST", `/league/${leagueId}/tactics`, data),
  getFixtures: (leagueId) => req("GET", `/league/${leagueId}/fixtures`),
  getTransfers: (leagueId) => req("GET", `/league/${leagueId}/transfers`),
  // Dev only
  triggerMatch: (leagueId) => req("POST", `/dev/trigger-match/${leagueId}`),
};
