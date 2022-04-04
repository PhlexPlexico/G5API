import { agent } from 'supertest';
import app from '../app.js';
const request = agent(app);
let adminCheck = 0;

describe("Test the user routes", () => {
  beforeAll(async () => {
    await request.get('/auth/steam/return')
      .expect(302);
      return;
  });
  it("Should get 200 from all users", () => {
    return request
      .get('/users')
      .expect(200);
  });
  it('Should return all users.', () => {
    return request.get('/users')
      .expect('Content-Type', /json/)
      .expect(200);
  });
  it('Should setup a new user only if we are an admin or super_admin.', () => {
    let newUserData = [{
      id: 1,
      steam_id: 1234,
      name: "Test User",
      admin: 0,
      super_admin: 0
    }];
    return request.post('/users').
      set('Content-Type', 'application/json').
      set('Accept', 'application/json').
      send(newUserData).
      expect(200);
  });
  it('Should get a user with a given database ID.', () => {
    return request.get('/users/1')
      .expect('Content-Type', /json/)
      .expect((res) => {
        expect(res.body.user.id).toEqual(1);
      })
      .expect(200);
    adminCheck = result.body.user.admin + result.body.user.super_admin;
  });
  it('Should get a users steam url from database ID or Steam ID.', () => {
    return request.get('/users/1/steam')
      .expect('Content-Type', /json/)
      .expect(200)
      .expect((res) => {
        expect(res.body.url).toMatch(/steamcommunity/);
      });
  });
  it('Should update the existing test user to remove admin privileges.', () => {
    let updatedUserData = [{
      id: 1,
      steam_id: '76561198025644194',
      name: "Get Updated Kid",
      admin: 0,
      super_admin: 0
    }];
    return request.put('/users')
    .set('Content-Type', 'application/json')
    .set('Accept', 'application/json')
    .send(updatedUserData)
    .expect(200);
  });
  it('Should attempt to create a user without permission.', async () => {
    let newUserData = [{
      id: 1,
      steam_id: 10001,
      name: "Bad Act0r",
      admin: 1,
      super_admin: 1
    }];
    return request.post('/users')
    .set('Content-Type', 'application/json')
    .set('Accept', 'application/json')
    .send(newUserData)
    .expect(403);
  });
});