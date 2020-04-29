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

describe('Get all matches', () => {
    it('Should retrieve all matches, even if none.', async done => {
        const result = await request.get('/matches/');
        expect(result.statusCode).toEqual(404);
        done();
    });
});
describe('Create a match', () => {
    it('Should create a single match that is ready to be played with teams.', async done => {
      done();
    });
});