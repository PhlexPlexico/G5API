import { agent } from 'supertest';
import app from '../app.js';
const request = agent(app)
let apiKey = "";

describe("Test the playerstats routes", () => {
  beforeAll(async () => {
    await request.get('/auth/steam/return')
      .expect(302);
    return;
  });
  // Note: Match 3 is the one being modified sequentially.
  it('Should get all player stats in the system.', () => {
    return request.get('/playerstats/')
      .expect(404);
  });
  it('Should get the player stats of the mock user.', () => {
    return request.get('/playerstats/76561198025644194')
      .expect(404);
  });
  it('Should get the player stats of the third match.', () => {
    return request.get('/playerstats/match/3')
      .expect(404);
  });
  it('Should get the API key of the third match.', () => {
    return request.get('/matches/3')
      .expect((result) => {
        apiKey = result.body.match.api_key;
      })
      .expect(200);
  });
  it('Should insert a player stat into the third match', () => {
    // Min required data.
    let statData = [{
      match_id: 3,
      map_id: 2,
      team_id: 4,
      steam_id: '12345678901011121',
      name: 'Actually Phlex',
      api_key: apiKey
    }];
    return request
      .post('/playerstats/')
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(statData)
      .expect((result) => {
        expect(result.body.message).toMatch(/successfully/);
      })
      .expect(200);
  });
  it('Should update a player stat in the third match', () => {
    // Min required data.
    let statData = [{
      match_id: 3,
      map_id: 2,
      team_id: 4,
      steam_id: '12345678901011121',
      api_key: apiKey,
      kills: 4,
      headshot_kills: 2,
      damage: 139,
      firstkill_t: 1
    }];
    return request
      .put('/playerstats/')
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(statData)
      .expect((result) => {
        expect(result.body.message).toMatch(/successfully/);
      })
      .expect(200);
  });
  it('Should update a player stat in the third match with invalid API key.', () => {
    // Min required data.
    let statData = [{
      match_id: 3,
      map_id: 2,
      team_id: 4,
      steam_id: '12345678901011121',
      api_key: '1234',
      kills: 4,
      headshot_kills: 2,
      damage: 139,
      firstkill_t: 1
    }];
    return request
      .put('/playerstats/')
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(statData)
      .expect((result) => {
        expect(result.body.message).toMatch(/not authorized/);
      })
      .expect(403);
  });
  it('Should insert an invalid player stat into the third match', () => {
    // Min required data.
    let statData = [{
      match_id: 3,
      map_id: 2,
      team_id: 4,
      steam_id: '12345678901011121',
      name: 'Actually Phlex',
      api_key: 'NOTAGOODAPIKEY'
    }];
    return request
      .post('/playerstats/')
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(statData)
      .expect((result) => {
        expect(result.body.message).toMatch(/not authorized/);
      })
      .expect(403);
  });
  it('Should attempt to delete a live match.', () => {
    // Min required data.
    let deleteData = [{
      match_id: 3
    }];
    return request
      .delete('/playerstats/')
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(deleteData)
      .expect((result) => {
        expect(result.body.message).toMatch(/currently live/);
      })
      .expect(401);
  });
});