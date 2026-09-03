/**
 * Unit tests for the Challonge API client.
 * Fully hermetic: no network, no database, no config file.
 */
import { jest } from "@jest/globals";

const mockFetch = jest.fn();
const mockAddTeamAuths = jest.fn();
const mockDbQuery = jest.fn();

jest.unstable_mockModule("node-fetch", () => ({
  __esModule: true,
  default: mockFetch
}));

jest.unstable_mockModule("config", () => ({
  __esModule: true,
  default: { has: () => false, get: () => undefined }
}));

jest.unstable_mockModule("../src/services/db.js", () => ({
  __esModule: true,
  db: { query: mockDbQuery }
}));

jest.unstable_mockModule("../src/utility/emitter.js", () => ({
  __esModule: true,
  default: { emit: jest.fn() }
}));

jest.unstable_mockModule("../src/utility/utils.js", () => ({
  __esModule: true,
  default: {
    decrypt: (value) => value,
    addChallongeTeamAuthsToArray: mockAddTeamAuths
  }
}));

const {
  Challonge,
  ChallongeApiError,
  parseSteamIds,
  parseTournamentRef,
  importChallongeTeams
} = await import("../src/services/challonge.js");

const API_KEY = "super-secret-challonge-key";

/** Queues a JSON response for the next fetch call. */
const respondWith = (body, status = 200) =>
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body)
  });

/** Builds a v2.1 participant resource. */
const v2Participant = (id, name, misc = null) => ({
  id: String(id),
  type: "participant",
  attributes: { name, seed: 1, misc }
});

describe("parseSteamIds", () => {
  it("splits on commas, semicolons, newlines and pipes", () => {
    const source =
      "76561198000000001,76561198000000002; 76561198000000003\n76561198000000004|76561198000000005";
    expect(parseSteamIds(source)).toEqual([
      "76561198000000001",
      "76561198000000002",
      "76561198000000003",
      "76561198000000004",
      "76561198000000005"
    ]);
  });

  it("trims surrounding whitespace", () => {
    expect(parseSteamIds("  76561198000000001  ")).toEqual(["76561198000000001"]);
  });

  it("rejects values that are not 17-digit Steam IDs", () => {
    expect(parseSteamIds("not-a-steam-id, 1234, 765611980000000012345")).toEqual([]);
  });

  it("de-duplicates repeated IDs", () => {
    expect(parseSteamIds("76561198000000001,76561198000000001")).toEqual([
      "76561198000000001"
    ]);
  });

  it("returns an empty array for null, undefined and empty input", () => {
    expect(parseSteamIds(null)).toEqual([]);
    expect(parseSteamIds(undefined)).toEqual([]);
    expect(parseSteamIds("")).toEqual([]);
  });
});

describe("Challonge v2.1 client", () => {
  it("sends the API key in headers and never in the URL", async () => {
    respondWith({ data: [v2Participant(1, "Team One", "76561198000000001")] });

    const challonge = new Challonge(API_KEY, "v2.1");
    await challonge.listParticipants("mytournament");

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain("https://api.challonge.com/v2.1/tournaments/mytournament");
    expect(url).not.toContain(API_KEY);
    expect(init.headers["Authorization"]).toBe(API_KEY);
    expect(init.headers["Authorization-Type"]).toBe("v1");
    expect(init.headers["Content-Type"]).toBe("application/vnd.api+json");
    expect(init.headers["Accept"]).toBe("application/json");
  });

  it("normalizes participants, mapping misc onto steamIds", async () => {
    respondWith({
      data: [
        v2Participant(76, "Team One", "76561198000000001, 76561198000000002"),
        v2Participant(77, "Team Two", "76561198000000003")
      ]
    });

    const participants = await new Challonge(API_KEY, "v2.1").listParticipants("t1");

    expect(participants).toEqual([
      {
        id: "76",
        name: "Team One",
        seed: 1,
        steamIds: ["76561198000000001", "76561198000000002"]
      },
      { id: "77", name: "Team Two", seed: 1, steamIds: ["76561198000000003"] }
    ]);
  });

  it("follows pagination until a short page comes back", async () => {
    const fullPage = Array.from({ length: 100 }, (_, i) =>
      v2Participant(i + 1, `Team ${i + 1}`, "76561198000000001")
    );
    respondWith({ data: fullPage });
    respondWith({ data: [v2Participant(101, "Team 101", "76561198000000002")] });

    const participants = await new Challonge(API_KEY, "v2.1").listParticipants("t1");

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0][0]).toContain("page=1");
    expect(mockFetch.mock.calls[1][0]).toContain("page=2");
    expect(participants).toHaveLength(101);
  });

  it("falls back to v1 custom fields when no participant carries a misc roster", async () => {
    respondWith({ data: [v2Participant(76, "Team One", null)] });
    // The fallback v1 participants call.
    respondWith([
      {
        participant: {
          id: 76,
          display_name: "Team One",
          custom_field_response: { "12345": "76561198000000009" }
        }
      }
    ]);

    const participants = await new Challonge(API_KEY, "v2.1").listParticipants("t1");

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[1][0]).toContain("https://api.challonge.com/v1/");
    expect(participants[0].steamIds).toEqual(["76561198000000009"]);
  });

  it("does not call v1 when misc already supplied a roster", async () => {
    respondWith({ data: [v2Participant(76, "Team One", "76561198000000001")] });

    await new Challonge(API_KEY, "v2.1").listParticipants("t1");

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("reports scores using the JSON:API match body, flagging the winner", async () => {
    respondWith({ data: {} });

    await new Challonge(API_KEY, "v2.1").updateMatch("t1", "999", [
      { participantId: "76", score: 16, advancing: true },
      { participantId: "77", score: 9, advancing: false }
    ]);

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain("/v2.1/tournaments/t1/matches/999.json");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({
      data: {
        type: "Match",
        attributes: {
          match: [
            { participant_id: "76", score_set: "16", advancing: true },
            { participant_id: "77", score_set: "9", advancing: false }
          ]
        }
      }
    });
  });

  it("omits advancing entirely for a live score-only update", async () => {
    respondWith({ data: {} });

    await new Challonge(API_KEY, "v2.1").updateMatch("t1", "999", [
      { participantId: "76", score: 7 },
      { participantId: "77", score: 5 }
    ]);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.data.attributes.match[0]).not.toHaveProperty("advancing");
    expect(body.data.attributes.match[1]).not.toHaveProperty("advancing");
  });

  it("finalizes through change_state", async () => {
    respondWith({ data: {} });

    await new Challonge(API_KEY, "v2.1").finalizeTournament("t1");

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain("/v2.1/tournaments/t1/change_state.json");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({
      data: { type: "TournamentState", attributes: { state: "finalize" } }
    });
  });

  it("keeps only matches where both sides are the requested participants", async () => {
    respondWith({
      data: [
        {
          id: "1",
          type: "match",
          attributes: {
            state: "open",
            points_by_participant: [
              { participant_id: "76", scores: [] },
              { participant_id: "77", scores: [] }
            ]
          }
        },
        {
          id: "2",
          type: "match",
          attributes: {
            state: "open",
            points_by_participant: [
              { participant_id: "78", scores: [] },
              { participant_id: "79", scores: [] }
            ]
          }
        }
      ]
    });

    const matches = await new Challonge(API_KEY, "v2.1").listMatches("t1", {
      state: "open",
      participantIds: ["76", "77"]
    });

    expect(mockFetch.mock.calls[0][0]).toContain("state=open");
    expect(matches).toEqual([
      { id: "1", player1Id: "76", player2Id: "77", state: "open" }
    ]);
  });
});

describe("Challonge error handling", () => {
  it("throws ChallongeApiError on a non-2xx response", async () => {
    respondWith({ errors: ["Unauthorized"] }, 401);

    await expect(
      new Challonge(API_KEY, "v2.1").listParticipants("t1")
    ).rejects.toBeInstanceOf(ChallongeApiError);
  });

  it("never leaks the API key in the error message", async () => {
    respondWith({ errors: ["Rate limited"] }, 429);

    await expect(
      new Challonge(API_KEY, "v2.1").listParticipants("t1")
    ).rejects.toThrow(
      expect.objectContaining({
        message: expect.not.stringContaining(API_KEY)
      })
    );
  });

  it("refuses to construct without an API key", () => {
    expect(() => new Challonge("", "v2.1")).toThrow();
  });
});

describe("Challonge v1 client", () => {
  it("passes the key as a query parameter and reads display_name", async () => {
    respondWith([
      {
        participant: {
          id: 76,
          display_name: "Legacy Team",
          seed: 3,
          custom_field_response: {
            "1": "76561198000000001",
            "2": "76561198000000002",
            "3": null
          }
        }
      }
    ]);

    const participants = await new Challonge(API_KEY, "v1").listParticipants("t1");

    expect(mockFetch.mock.calls[0][0]).toContain(
      "https://api.challonge.com/v1/tournaments/t1/participants.json"
    );
    expect(mockFetch.mock.calls[0][0]).toContain(`api_key=${encodeURIComponent(API_KEY)}`);
    expect(participants).toEqual([
      {
        id: "76",
        name: "Legacy Team",
        seed: 3,
        steamIds: ["76561198000000001", "76561198000000002"]
      }
    ]);
  });

  it("reports scores with scores_csv and winner_id", async () => {
    respondWith({ match: {} });

    await new Challonge(API_KEY, "v1").updateMatch("t1", "999", [
      { participantId: "76", score: 16, advancing: true },
      { participantId: "77", score: 9, advancing: false }
    ]);

    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({
      match: { scores_csv: "16-9", winner_id: "76" }
    });
  });
});

describe("importChallongeTeams", () => {
  it("inserts every new team in a single statement and skips duplicates", async () => {
    const participants = [
      { id: "76", name: "Team One", seed: 1, steamIds: ["76561198000000001"] },
      { id: "77", name: "Team Two", seed: 2, steamIds: ["76561198000000002"] }
    ];
    mockDbQuery
      // Existing lookup: team 77 was already imported.
      .mockResolvedValueOnce([{ challonge_team_id: 77 }])
      // The bulk insert.
      .mockResolvedValueOnce({})
      // Reading the inserted IDs back.
      .mockResolvedValueOnce([{ id: 5, challonge_team_id: 76 }]);

    const imported = await importChallongeTeams(1, participants);

    expect(imported).toBe(1);
    const insertCall = mockDbQuery.mock.calls[1];
    expect(insertCall[0]).toContain("INSERT INTO team");
    expect(insertCall[1][0]).toEqual([[1, "Team One", "Team One", "76"]]);
    expect(mockAddTeamAuths).toHaveBeenCalledTimes(1);
    expect(mockAddTeamAuths).toHaveBeenCalledWith(5, ["76561198000000001"]);
  });

  it("does nothing when every participant is already imported", async () => {
    mockDbQuery.mockResolvedValueOnce([{ challonge_team_id: 76 }]);

    const imported = await importChallongeTeams(1, [
      { id: "76", name: "Team One", seed: 1, steamIds: [] }
    ]);

    expect(imported).toBe(0);
    expect(mockDbQuery).toHaveBeenCalledTimes(1);
    expect(mockAddTeamAuths).not.toHaveBeenCalled();
  });
});

describe("parseTournamentRef", () => {
  it("treats a bare slug as having no community", () => {
    expect(parseTournamentRef("testing")).toEqual({ id: "testing", communityId: null });
  });

  it("does not mistake a hyphenated slug for a community", () => {
    expect(parseTournamentRef("my-tournament")).toEqual({
      id: "my-tournament",
      communityId: null
    });
  });

  it("pulls the community out of a subdomain bracket URL", () => {
    expect(parseTournamentRef("https://pleb.challonge.com/testing")).toEqual({
      id: "testing",
      communityId: "pleb"
    });
  });

  it("handles a plain challonge.com URL with no community", () => {
    expect(parseTournamentRef("https://challonge.com/abc123")).toEqual({
      id: "abc123",
      communityId: null
    });
  });

  it("leaves numeric IDs alone", () => {
    expect(parseTournamentRef("10961673")).toEqual({
      id: "10961673",
      communityId: null
    });
  });
});

describe("community tournament resolution", () => {
  it("sends community_id when the identifier is a subdomain URL", async () => {
    respondWith({ data: [v2Participant(1, "Team One", "76561198000000001")] });

    await new Challonge(API_KEY, "v2.1").listParticipants(
      "https://pleb.challonge.com/testing"
    );

    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain("/v2.1/tournaments/testing/participants.json");
    expect(url).toContain("community_id=pleb");
  });

  it("keeps a hyphenated slug literal when it resolves as-is", async () => {
    // The resolution probe succeeds, so the bare slug is used.
    respondWith({ data: { id: "1", type: "tournament", attributes: { name: "T" } } });
    respondWith({ data: [v2Participant(1, "Team One", "76561198000000001")] });

    await new Challonge(API_KEY, "v2.1").listParticipants("my-tournament");

    const url = mockFetch.mock.calls[1][0];
    expect(url).toContain("/tournaments/my-tournament/participants.json");
    expect(url).not.toContain("community_id");
  });

  it("falls back to the community reading when the bare slug 404s", async () => {
    respondWith({ errors: { detail: "does not exist" } }, 404);
    respondWith({ data: [v2Participant(1, "Team One", "76561198000000001")] });

    await new Challonge(API_KEY, "v2.1").listParticipants("pleb-testing");

    const url = mockFetch.mock.calls[1][0];
    expect(url).toContain("/tournaments/testing/participants.json");
    expect(url).toContain("community_id=pleb");
  });

  it("caches the resolution so it probes only once", async () => {
    respondWith({ errors: { detail: "does not exist" } }, 404);
    respondWith({ data: [v2Participant(1, "Team One", "76561198000000001")] });
    respondWith({ data: [v2Participant(1, "Team One", "76561198000000001")] });

    const challonge = new Challonge(API_KEY, "v2.1");
    await challonge.listParticipants("pleb-testing");
    await challonge.listParticipants("pleb-testing");

    // Probe + two participant calls, not two probes.
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("addresses a community tournament as subdomain-slug under v1", async () => {
    respondWith([{ participant: { id: 1, display_name: "T", custom_field_response: {} } }]);

    await new Challonge(API_KEY, "v1").listParticipants(
      "https://pleb.challonge.com/testing"
    );

    expect(mockFetch.mock.calls[0][0]).toContain(
      "/v1/tournaments/pleb-testing/participants.json"
    );
  });
});
