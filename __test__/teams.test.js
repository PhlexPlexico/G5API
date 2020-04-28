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


describe('Get teams', () => {
    it('Should get all teams in the system.', async done => {
        const result = await request.get('/teams/');
        expect(result.statusCode).toEqual(200);
        done();
    });
});

describe('Create Team', () => {
    it('Should create a single team under the mock user.', async done => {
        let teamData = [{
            name: 'TopShelf Testing',
            flag: 'CA',
            logo: null,
            tag: 'TPSHLF',
            public_team: 1,
            auth_name: {
                "76561198025644200": "Not Phlex"
            }
        }];
        request
            .post('/teams/create')
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .send(teamData)
            .expect(200)
            .expect((result) => {
                expect(result.body.message).toMatch(/successfully/);
            })
            .end(done);
    });
    it('Should create a single team that is not public.', async done => {
        let privateTeamData = [{
            name: 'Private Collection',
            flag: 'US',
            logo: null,
            tag: 'PRVSHLF',
            public_team: 0,
            auth_name: {
                "76561198025644200": "Not Phlex",
                "76561198025644194": "Actually Phlex"
            }
        }];
        request
            .post('/teams/create')
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .send(privateTeamData)
            .expect(200)
            .expect((result) => {
                expect(result.body.message).toMatch(/successfully/);
            })
            .end(done);
    });
});

describe('Get a single team.', () => {
    it('Should get the first team.', async done => {
            const result = await request.get('/teams/1');
            expect(result.statusCode).toEqual(200);
            done();
        });
});

describe('Update a team', () => {
    it('Should update a team to include a new user.',  done => {
        let updateTeamData = [{
            id: 1,
            name: 'Bottom Shelf',
            flag: 'US',
            logo: null,
            tag: 'BTMSHLF',
            public_team: 1,
            auth_name: {
                "12345": "New team member!"
            }
        }];
        request
            .put("/teams/update")
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .send(updateTeamData)
            .expect(200)
            .expect((result) => {
                expect(result.body.message).toMatch(/successfully/);
            })
            .end(done);
    });
    it('Should update the second team to change users.',  done => {
        let updateTeamData = [{
            id: 2,
            user_id: 2
        }];
        request
            .put("/teams/update")
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .send(updateTeamData)
            .expect(200)
            .expect((result) => {
                expect(result.body.message).toMatch(/successfully/);
            })
            .end(done);
    });
});