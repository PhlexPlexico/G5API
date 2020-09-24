const supertest = require('supertest')
const app = require('../app')
const request = supertest.agent(app)
let apiKey = "";
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
    it('Should get the API key of the third match.', async done => {
        const result = await request.get('/matches/3');
        expect(result.statusCode).toEqual(200);
        apiKey = result.body[0].api_key;
        done();
    });
});

describe('Insert stats', () => {
    it('Should insert a player stat into the third match', async done => {
        // Min required data.
        let statData = [{
            match_id: 3,
            map_id: 2,
            team_id: 4,
            steam_id: '12345678901011121',
            name: 'Actually Phlex',
            api_key: apiKey
        }];
        request
            .post('/playerstats/')
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .send(statData)
            .expect((result) => {
                expect(result.body.message).toMatch(/successfully/);
            })
            .expect(200)
            .end(done);
    });
});

describe('Update stats', () => {
    it('Should update a player stat in the third match', async done => {
        // Min required data.
        let statData = [{
            match_id: 3,
            map_id: 2,
            team_id: 4,
            steam_id: '12345678901011121',
            api_key: apiKey,
            kills: 4,
            headshot_kills: 2,
            damage: 139,
            firstkill_t: 1
        }];
        request
            .put('/playerstats/')
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .send(statData)
            .expect((result) => {
                expect(result.body.message).toMatch(/successfully/);
            })
            .expect(200)
            .end(done);
    });
});

describe('Bad Actor', () => {
    it('Should update a player stat in the third match with invalid API key.', async done => {
        // Min required data.
        let statData = [{
            match_id: 3,
            map_id: 2,
            team_id: 4,
            steam_id: '12345678901011121',
            api_key: '1234',
            kills: 4,
            headshot_kills: 2,
            damage: 139,
            firstkill_t: 1
        }];
        request
            .put('/playerstats/')
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .send(statData)
            .expect((result) => {
                expect(result.body.message).toMatch(/not authorized/);
            })
            .expect(403)
            .end(done);
    });
    it('Should insert an invalid player stat into the third match', async done => {
        // Min required data.
        let statData = [{
            match_id: 3,
            map_id: 2,
            team_id: 4,
            steam_id: '12345678901011121',
            name: 'Actually Phlex',
            api_key: 'NOTAGOODAPIKEY'
        }];
        request
            .post('/playerstats/create')
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .send(statData)
            .expect((result) => {
                expect(result.body.message).toMatch(/not authorized/);
            })
            .expect(401)
            .end(done);
    });
    it('Should attempt to delete a live match.', async done => {
        // Min required data.
        let deleteData = [{
            match_id: 3
        }];
        request
            .delete('/playerstats/')
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .send(deleteData)
            .expect((result) => {
                expect(result.body.message).toMatch(/currently live/);
            })
            .expect(401)
            .end(done);
    });
});