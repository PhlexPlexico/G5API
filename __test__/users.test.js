const supertest = require('supertest')
const app = require('../app')
const request = supertest(app);

describe('Get User', () => {
  it('Should return all users.', async done => {
    const res = await request.get('/users').
    expect('Content-Type', /json/);
    expect(res.statusCode).toEqual(200);
    done();
  });
});
