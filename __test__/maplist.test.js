import { agent } from 'supertest';
import app from '../app.js';
const request = agent(app);
let adminCheck = 0;
describe('Authenticate User', () => {
  it('Should create a user with mock values.', async done => {
    const result = await request.get('/auth/steam/return');
    expect(result.statusCode).toEqual(302);
    done();
  });
});

describe('Get Map Lists', () => {
  it('Should return all users.', async done => {
    const result = await request.get('/maps').
    expect('Content-Type', /json/);
    expect(result.statusCode).toEqual(200);
    done();
  });
});

describe('Get Specific User MapLists', () => {
  it('Should get a users map list with a given database ID.', async done => {
    const result = await request.get('/maps/1').
    expect('Content-Type', /json/);
    expect(result.statusCode).toEqual(200);
    expect(result.body.maplist[0].id).toEqual(1);
    done();
  });
});

describe('Create new map for list', () => {
  it('Should setup a new map for the map list.', async done => {
    let newMapData = [{
      user_id: 1,
      map_name: "de_cbble",
      map_display_name: "Cobblestoner"
    }];
    request.post('/maps').
    set('Content-Type', 'application/json').
    set('Accept', 'application/json').
    send(newMapData).
    expect(200, done);
  });
});

describe('Update Map list', () => {
  it('Should disable a map from a users\' list.', async done => {
    let updatedUserData = [{
      enabled: false,
      id: 1
    }];
    request.put('/maps').
    set('Content-Type', 'application/json').
    set('Accept', 'application/json').
    send(updatedUserData).
    expect(200, done);
  });
});

describe('Delete Map List', () => {
  it('Should attempt to delete a users entry for a map.', async done => {
    let newUserData = [{
      id: 2
    }];
    request.delete('/maps').
    set('Content-Type', 'application/json').
    set('Accept', 'application/json').
    send(newUserData).
    expect(200, done);
  });
});

