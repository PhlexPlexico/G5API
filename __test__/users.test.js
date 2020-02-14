const supertest = require('supertest')
const app = require('../app')
const request = supertest(app);

describe('Get User', () => {
  it('Should return all users.', async done => {
    const result = await request.get('/users').
    expect('Content-Type', /json/);
    expect(result.statusCode).toEqual(200);
    done();
  });
});

describe('Authenticate User', () => {
  it('Should create a user with mock values.', async done => {
    const result = await request.get('/auth/steam/return');
    expect(result.statusCode).toEqual(302);
    done();
  });
});