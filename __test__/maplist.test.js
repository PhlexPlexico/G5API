import { agent } from 'supertest';
import app from '../app.js';
const request = agent(app);
let adminCheck = 0;

describe("Test the maplist routes", () => {
  beforeAll(async () => {
    await request.get('/auth/steam/return')
      .expect(302);
    return;
  });
  it('Should return all users.', () => {
    return request.get('/maps')
      .expect('Content-Type', /json/)
      .expect(200);
  });
  it('Should get a users map list with a given database ID.', () => {
    return request.get('/maps/1')
      .expect('Content-Type', /json/)
      .expect((result) => {
        expect(result.body.maplist[0].id).toEqual(1);
      })
      .expect(200);
  });
  it('Should setup a new map for the map list.', () => {
    let newMapData = [{
      user_id: 1,
      map_name: "de_cbble",
      map_display_name: "Cobblestoner"
    }];
    return request.post('/maps')
      .set('Content-Type', 'application/json')
      .set('Accept', 'application/json')
      .send(newMapData)
      .expect(200);
  });
  it('Should disable a map from a users\' list.', () => {
    let updatedUserData = [{
      enabled: false,
      id: 1
    }];
    return request.put('/maps')
      .set('Content-Type', 'application/json')
      .set('Accept', 'application/json')
      .send(updatedUserData)
      .expect(200);
  });
  it('Should attempt to delete a users entry for a map.', () => {
    let newUserData = [{
      id: 2
    }];
    return request.delete('/maps')
      .set('Content-Type', 'application/json')
      .set('Accept', 'application/json')
      .send(newUserData)
      .expect(200);
  });
});

