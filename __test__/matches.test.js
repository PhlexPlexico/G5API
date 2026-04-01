import { agent } from 'supertest';
import app from '../app.js';
const request = agent(app);

describe("Test the matches routes", () => {
  let defaultGameMatchId;
  let csgoGameMatchId;

  beforeAll(() => {
    return request.get('/auth/steam/return')
      .expect(302);
  });
  it('Should retrieve all matches, even if none.', () => {
    return request.get('/matches/')
      .expect(404);
  });
  it('Should reject use_dathost when server_id is also provided (400).', () => {
    return request
      .post("/matches/")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send([{
        use_dathost: true,
        server_id: 3,
        team1_id: 4,
        team2_id: 3,
        max_maps: 1,
        title: "Map {MAPNUMBER} of {MAXMAPS}",
        veto_mappool: "de_dust2 de_mirage",
        skip_veto: 0
      }])
      .expect(400)
      .expect((result) => {
        expect(result.body.message).toMatch(/use_dathost.*server_id/);
      });
  });
  it('Should reject use_dathost when DatHost is not configured (503).', () => {
    return request
      .post("/matches/")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send([{
        use_dathost: true,
        team1_id: 4,
        team2_id: 3,
        max_maps: 1,
        title: "Map {MAPNUMBER} of {MAXMAPS}",
        veto_mappool: "de_dust2 de_mirage",
        skip_veto: 0
      }])
      .expect(503)
      .expect((result) => {
        expect(result.body.message).toMatch(/DatHost|not configured/);
      });
  });
  it('Should create a single match that is ready to be played with teams.', () => {
    // Min required data.
    let newMatchData = [
      {
        server_id: 3,
        team1_id: 4,
        team2_id: 3,
        max_maps: 1,
        title: "Map {MAPNUMBER} of {MAXMAPS}",
        veto_mappool: "de_dust2, de_cache, de_mirage",
        skip_veto: 0,
        ignore_server: true
      }
    ];
    return request
      .post("/matches/")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(newMatchData)
      .expect((result) => {
        expect(result.body.message).toMatch(/successfully/);
      })
      .expect(200);
  });
  it('Should update a match with a start time and a test CVAR.', () => {
    let updatedMatchData = [
      {
        match_id: 1,
        start_time: new Date().toISOString().slice(0, 19).replace('T', ' '),
        plugin_version: '0.7.2',
        match_cvars: {
          "mp_autobalanceteams": "1",
          "mp_test_value": 0
        }
      }
    ];
    return request
      .put("/matches/")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(updatedMatchData)
      .expect(200)
      .expect((result) => {
        expect(result.body.message).toMatch(/successfully/);
      });
  });
  it('Should retrieve the config for a match.', () => {
    return request.get("/matches/1/config")
      .expect(200)
      .expect((result) => {
        expect(result.body.cvars.get5_web_api_url).toMatch(/http/);
      });
  });
  it('Should get the first match.', () => {
    return request.get('/matches/1')
      .expect(200)
      .expect((result) => {
        expect(result.body.match.api_key).not.toBeUndefined();
      });
  });
  it('Should first update the first match to attempt to break things right after.', () => {
    let updatedMatchData = [
      {
        match_id: 1,
        user_id: 2
      }
    ];
    return request
      .put("/matches/")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(updatedMatchData)
      .expect(200)
      .expect((result) => {
        expect(result.body.message).toMatch(/successfully/);
      });
  });
  it('Should attempt to get the API key of the match.', () => {
    return request.get('/matches/1')
      .expect(200)
      .expect((result) => {
        expect(result.body.match.api_key).toBeUndefined();
      });
  });
  it('Should attempt to forfeit the match.', () => {
    let updatedMatchData = [
      {
        match_id: 1,
        forfeit: 1
      }
    ];
    return request
      .put("/matches/")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(updatedMatchData)
      .expect(403)
      .expect((result) => {
        expect(result.body.message).toMatch(/not authorized/);
      });
  });
  it('Should attempt to delete the match.', () => {
    let updatedMatchData = [
      {
        match_id: 1
      }
    ];
    return request
      .delete("/matches/")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(updatedMatchData)
      .expect(403)
      .expect((result) => {
        expect(result.body.message).toMatch(/not authorized/);
      });
  });
  it('Should create a single match that is ready to be cancelled.', () => {
    let newMatchData = [
      {
        server_id: 2,
        team1_id: 4,
        team2_id: 3,
        max_maps: 1,
        title: "Map {MAPNUMBER} of {MAXMAPS}",
        veto_mappool: "de_vertigo, de_inferno, de_mirage",
        skip_veto: 1,
        ignore_server: true
      },
    ];
    return request
      .post("/matches/")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(newMatchData)
      .expect((result) => {
        expect(result.body.message).toMatch(/successfully/);
      })
      .expect(200);
  });
  it('Should forfeit the match.', () => {
    let updatedMatchData = [
      {
        match_id: 2,
        forfeit: 1,
        end_time: new Date().toISOString().slice(0, 19).replace('T', ' ')
      },
    ];
    return request
      .put("/matches/")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(updatedMatchData)
      .expect(200)
      .expect((result) => {
        expect(result.body.message).toMatch(/successfully/);
      });
  });
  it('Should delete the match.', () => {
    let updatedMatchData = [
      {
        match_id: 2
      },
    ];
    return request
      .delete("/matches/")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(updatedMatchData)
      .expect(200)
      .expect((result) => {
        expect(result.body.message).toMatch(/successfully/);
      });
  });
  it('Should create a single match that is ready for further testing.', () => {
    let newMatchData = [
      {
        server_id: 2,
        team1_id: 4,
        team2_id: 3,
        max_maps: 1,
        title: "Map {MAPNUMBER} of {MAXMAPS}",
        veto_mappool: "de_vertigo, de_inferno, de_mirage",
        skip_veto: 1,
        ignore_server: true
      },
    ];
    return request
      .post("/matches/")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(newMatchData)
      .expect(200)
      .expect((result) => {
        expect(result.body.message).toMatch(/successfully/);
      });
  });
  it('Should create a match without game and default to cs2.', () => {
    const newMatchData = [
      {
        server_id: 2,
        team1_id: 4,
        team2_id: 3,
        max_maps: 1,
        title: "Game default check",
        veto_mappool: "de_vertigo, de_inferno, de_mirage",
        skip_veto: 1,
        ignore_server: true
      }
    ];
    return request
      .post("/matches/")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(newMatchData)
      .expect(200)
      .expect((result) => {
        defaultGameMatchId = result.body.id;
        expect(result.body.message).toMatch(/successfully/);
      });
  });
  it('Should persist default game as cs2.', () => {
    return request
      .get(`/matches/${defaultGameMatchId}`)
      .expect(200)
      .expect((result) => {
        expect(result.body.match.game).toBe("cs2");
      });
  });
  it('Should create a match with game set to csgo.', () => {
    const newMatchData = [
      {
        server_id: 2,
        team1_id: 4,
        team2_id: 3,
        max_maps: 1,
        title: "Game csgo check",
        veto_mappool: "de_vertigo, de_inferno, de_mirage",
        skip_veto: 1,
        ignore_server: true,
        game: "csgo"
      }
    ];
    return request
      .post("/matches/")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(newMatchData)
      .expect(200)
      .expect((result) => {
        csgoGameMatchId = result.body.id;
        expect(result.body.message).toMatch(/successfully/);
      });
  });
  it('Should persist explicit game as csgo.', () => {
    return request
      .get(`/matches/${csgoGameMatchId}`)
      .expect(200)
      .expect((result) => {
        expect(result.body.match.game).toBe("csgo");
      });
  });
  it('Should reject invalid game values on create.', () => {
    const invalidMatchData = [
      {
        server_id: 2,
        team1_id: 4,
        team2_id: 3,
        max_maps: 1,
        title: "Invalid game create",
        veto_mappool: "de_vertigo, de_inferno, de_mirage",
        skip_veto: 1,
        ignore_server: true,
        game: "CS2"
      }
    ];
    return request
      .post("/matches/")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(invalidMatchData)
      .expect(400)
      .expect((result) => {
        expect(result.body.message).toMatch(/Invalid game value/);
      });
  });
  it('Should reject invalid game values on update.', () => {
    const invalidUpdate = [
      {
        match_id: defaultGameMatchId,
        game: "CSGO"
      }
    ];
    return request
      .put("/matches/")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(invalidUpdate)
      .expect(400)
      .expect((result) => {
        expect(result.body.message).toMatch(/Invalid game value/);
      });
  });
  it('Should update game to csgo on an existing match.', () => {
    const updateData = [
      {
        match_id: defaultGameMatchId,
        game: "csgo"
      }
    ];
    return request
      .put("/matches/")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(updateData)
      .expect(200)
      .expect((result) => {
        expect(result.body.message).toMatch(/successfully/);
      });
  });
  it('Should persist updated game after match update.', () => {
    return request
      .get(`/matches/${defaultGameMatchId}`)
      .expect(200)
      .expect((result) => {
        expect(result.body.match.game).toBe("csgo");
      });
  });
});