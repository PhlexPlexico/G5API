import { agent } from 'supertest';
import app from '../app.js';
const request = agent(app);

describe("Test the mapstats routes", () => {
  beforeAll(async () => {
    await request.get('/auth/steam/return')
      .expect(302);
    return;
  });
  // Note: Match 3 is the one being modified sequentially.
  it('Should get all map stats in the system.', () => {
    return request.get('/mapstats/')
      .expect(404);
  });
  it('Should create stats of a map based on the third match.', () => {
    let teamData = [{
      match_id: 3,
      map_number: 1,
      map_name: 'de_anubis',
      start_time: new Date().toISOString().slice(0, 19).replace("T", " ")
    }];
    return request
      .post('/mapstats')
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(teamData)
      .expect((result) => {
        expect(result.body.message).toMatch(/successfully/);
      })
      .expect(200);
  });
  it('Should create stats of a map based on the third match.', () => {
    let teamData = [{
      match_id: 3,
      map_number: 1,
      map_name: 'de_dust2',
      start_time: new Date().toISOString().slice(0, 19).replace("T", " ")
    }];
    return request
      .post('/mapstats')
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(teamData)
      .expect((result) => {
        expect(result.body.message).toMatch(/successfully/);
      })
      .expect(200);
  });
  it('Should update stats of a map based on the third match.', () => {
    let teamData = [{
      map_stats_id: 1,
      end_time: new Date().toISOString().slice(0, 19).replace("T", " ")
    }];
    return request
      .put('/mapstats')
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(teamData)
      .expect((result) => {
        expect(result.body.message).toMatch(/successfully/);
      })
      .expect(200);
  });
  it('Should delete stats of a map based on the third match.', () => {
    let teamData = [{
      map_stats_id: 1,
    }];
    return request
      .delete('/mapstats')
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(teamData)
      .expect(200)
      .expect((result) => {
        expect(result.body.message).toMatch(/successfully/);
      });
  });
});


describe('Delete Mapstats', () => {
  
});
