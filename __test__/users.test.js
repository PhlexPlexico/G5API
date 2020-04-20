const supertest = require('supertest')
const app = require('../app')
const request = supertest(app);

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
    expect(result.body[0].id).toEqual(1)
    done();
  });
});