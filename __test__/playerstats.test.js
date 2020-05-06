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

// Note: Match 3 is the one being modified sequentially.
describe('Get playerstats', () => {
    it('Should get all player stats in the system.', async done => {
        const result = await request.get('/playerstats/');
        expect(result.statusCode).toEqual(404);
        done();
    });
    it('Should get the player stats of the mock user.', async done => {
        const result = await request.get('/playerstats/76561198025644194');
        expect(result.statusCode).toEqual(404);
        done();
    });
    it('Should get the player stats of the third match.', async done => {
        const result = await request.get('/playerstats/match/3');
        expect(result.statusCode).toEqual(404);
        done();
    });
});

