const supertest = require('supertest')
const app = require('../app')
const request = supertest.agent(app);

describe('Authenticate User', () => {
  it('Should create a user with mock values.', async done => {
    const result = await request.get('/auth/steam/return');
    expect(result.statusCode).toEqual(302);
    done();
  });
});

