import { agent } from 'supertest';
import app from '../app.js';
const request = agent(app);
describe('Authenticate User', () => {
  it('Should create a user with mock values.', async done => {
    const result = await request.get('/auth/steam/return');
    expect(result.statusCode).toEqual(302);
    done();
  });
});

// Note: Match 3 is the one being modified sequentially.
describe('Get mapstats', () => {
    it('Should get all map stats in the system.', async done => {
        const result = await request.get('/mapstats/');
        expect(result.statusCode).toEqual(404);
        done();
    });
});

describe('Create Mapstats', () => {
    it('Should create stats of a map based on the third match.', async done => {
        let teamData = [{
            match_id: 3,
            map_number: 1,
            map_name: 'de_overpass',
            start_time: new Date().toISOString().slice(0, 19).replace("T", " ")
        }];
        request
            .post('/mapstats')
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .send(teamData)
            .expect((result) => {
                expect(result.body.message).toMatch(/successfully/);
            })
            .expect(200)
            .end(done);
    });
    it('Should create stats of a map based on the third match.', async done => {
        let teamData = [{
            match_id: 3,
            map_number: 1,
            map_name: 'de_dust2',
            start_time: new Date().toISOString().slice(0, 19).replace("T", " ")
        }];
        request
            .post('/mapstats')
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .send(teamData)
            .expect((result) => {
                expect(result.body.message).toMatch(/successfully/);
            })
            .expect(200)
            .end(done);
    });
});

describe('Update Mapstats', () => {
    it('Should update stats of a map based on the third match.', async done => {
        let teamData = [{
            map_stats_id: 1,
            end_time: new Date().toISOString().slice(0, 19).replace("T", " ")
        }];
        request
            .put('/mapstats')
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .send(teamData)
            .expect((result) => {
                expect(result.body.message).toMatch(/successfully/);
            })
            .expect(200)
            .end(done);
    });
});

describe('Delete Mapstats', () => {
    it('Should delete stats of a map based on the third match.', async done => {
        let teamData = [{
            map_stats_id: 1,
        }];
        request
            .delete('/mapstats')
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .send(teamData)
            .expect(200)
            .expect((result) => {
                expect(result.body.message).toMatch(/successfully/);
            })
            .end(done);
    });
});
