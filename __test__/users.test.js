const supertest = require('supertest')
const app = require('../app')
const request = supertest.agent(app);
let adminCheck = 0;
describe('Authenticate User', () => {
  it('Should create a user with mock values.', async done => {
    const result = await request.get('/auth/steam/return');
    expect(result.statusCode).toEqual(302);
    done();
  });
});

describe('Get All Users', () => {
  it('Should return all users.', async done => {
    const result = await request.get('/users').
    expect('Content-Type', /json/);
    expect(result.statusCode).toEqual(200);
    done();
  });
});

describe('Get Specific User', () => {
  it('Should get a user with a given database ID.', async done => {
    const result = await request.get('/users/1').
    expect('Content-Type', /json/);
    expect(result.statusCode).toEqual(200);
    expect(result.body[0].id).toEqual(1);
    adminCheck = result.body[0].admin + result.body[0].super_admin;
    done();
  });
});

describe('Get Steam URL', () => {
  it('Should get a users steam url from database ID or Steam ID.', async done => {
    const result = await request.get('/users/1/steam').
    expect('Content-Type', /json/);
    expect(result.statusCode).toEqual(200);
    expect(result.body.url).toMatch(/steamcommunity/);
    done();
  });
});

describe('Setup New User', () => {
  it('Should setup a new user only if we are an admin or super_admin.', async done => {
    let newUserData = [{
      id: 1, 
      steam_id: 1234, 
      name: "Test User", 
      admin: 0,
      super_admin: 0
    }];
    request.post('/users/create').
    set('Content-Type', 'application/json').
    set('Accept', 'application/json').
    send(newUserData).
    expect(200, done);
  });
});

describe('Update User', () => {
  it('Should update the existing test user to remove admin privileges.', async done => {
    let updatedUserData = [{
      id: 1,
      steam_id: '76561198025644194',
      name: "Get Updated Kid",
      admin: 0,
      super_admin: 0
    }];
    request.put('/users/update').
    set('Content-Type', 'application/json').
    set('Accept', 'application/json').
    send(updatedUserData).
    expect(200, done);
  });
});

describe('Attempt New User', () => {
  it('Should attempt to create a user without permission.', async done => {
    let newUserData = [{
      id: 1,
      steam_id: 10001,
      name: "Bad Act0r",
      admin: 1,
      super_admin: 1
    }];
    request.post('/users/create').
    set('Content-Type', 'application/json').
    set('Accept', 'application/json').
    send(newUserData).
    expect(401, done);
  });
});

