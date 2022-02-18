import { agent } from 'supertest';
import app from '../app.js';
const request = agent(app);

describe("Test the team routes", () => {
  beforeAll(() => {
    return request.get('/auth/steam/return')
      .expect(302);
  });
  it('Should return 404 as no teams exist.', () => {
    return request.get('/teams/')
      .expect(404);
  });
  it('Should create a single team under the mock user.', () => {
    let teamData = [{
      name: 'TopShelf Testing',
      flag: 'CA',
      logo: null,
      tag: 'TPSHLF',
      public_team: 1,
      auth_name: {
        "76561198025644200": {
          "name": "Not Phlex"
        }
      }
    }];
    return request
      .post('/teams/')
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(teamData)
      .expect(200)
      .expect((result) => {
        expect(result.body.message).toMatch(/successfully/);
      });
  });
  it('Should create a single team that is not public.', () => {
    let privateTeamData = [{
      name: 'Private Collection',
      flag: 'US',
      logo: null,
      tag: 'PRVSHLF',
      public_team: 0,
      auth_name: {
        "76561198025644200": {
          "name": "Not Phlex"
        },
        "76561198025644194": {
          "name": "Actually Phlex"
        }
      }
    }];
    return request
      .post('/teams/')
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(privateTeamData)
      .expect(200)
      .expect((result) => {
        expect(result.body.message).toMatch(/successfully/);
      });
  });
  it('Should create a single team for later tests.', () => {
    let privateTeamData = [{
      name: 'Private Collection #2',
      flag: 'US',
      logo: null,
      tag: 'PRVSHLF2',
      public_team: 1,
      auth_name: {
        "76561198025644200": {
          "name": "Not Phlex"
        },
        "76561198025644194": {
          "name": "Actually Phlex"
        }
      }
    }];
    return request
      .post('/teams/')
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(privateTeamData)
      .expect(200)
      .expect((result) => {
        expect(result.body.message).toMatch(/successfully/);
      });
  });
  it('Should create another single team for later tests.', () => {
    let privateTeamData = [{
      name: 'Private Collection #3',
      flag: 'CA',
      logo: null,
      tag: 'PRVSHLF3',
      public_team: 1,
      auth_name: {
        "76561198025644200": {
          "name": "Not Phlex",
          "captain": 0
        },
        "12345": {
          "name": "Actually Phlex",
          "captain": 0
        }
      }
    }];
    return request
      .post('/teams/')
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(privateTeamData)
      .expect(200)
      .expect((result) => {
        expect(result.body.message).toMatch(/successfully/);
      });
  });
  it('Should get the first team.', () => {
    return request.get('/teams/1')
      .expect(200);
  });
  it('Should update a team to include a new user.', () => {
    let updateTeamData = [{
      id: 1,
      name: 'Bottom Shelf',
      flag: 'US',
      logo: null,
      tag: 'BTMSHLF',
      public_team: 1,
      auth_name: {
        "12345": {
          "name": "New team member!"
        }
      }
    }];
    return request
      .put("/teams/")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(updateTeamData)
      .expect(200)
      .expect((result) => {
        expect(result.body.message).toMatch(/successfully/);
      });
  });
  it('Should update a team to update the new users name.', () => {
    let updateTeamData = [{
      id: 1,
      name: 'Bottom Shelf',
      flag: 'US',
      logo: null,
      tag: 'BTMSHLF',
      public_team: 1,
      auth_name: {
        "12345": {
          "name": "New team member EDITED!"
        }
      }
    }];
    return request
      .put("/teams/")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(updateTeamData)
      .expect(200)
      .expect((result) => {
        expect(result.body.message).toMatch(/successfully/);
      });
  });
  it('Should update the second team to change users.', () => {
    let updateTeamData = [{
      id: 2,
      user_id: 2
    }];
    return request
      .put("/teams/")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(updateTeamData)
      .expect(200)
      .expect((result) => {
        expect(result.body.message).toMatch(/successfully/);
      });
  });
  it('Should delete a first team.', () => {
    let deleteTeamData = [{
      team_id: 1
    }];
    return request
      .delete("/teams/")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(deleteTeamData)
      .expect(200)
      .expect((result) => {
        expect(result.body.message).toMatch(/successfully/);
      });
  });
  it('Should delete a team it doesn\'t own.', () => {
    let deleteTeamData = [{
      team_id: 2
    }];
    return request
      .delete("/teams/")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(deleteTeamData)
      .expect(403)
      .expect((result) => {
        expect(result.body.message).toMatch(/not authorized/);
      });
  });
  it('Should update the team it no longer owns.', () => {
    let updateTeamData = [{
      id: 2,
      user_id: 1
    }];
    return request
      .put("/teams/")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(updateTeamData)
      .expect(403)
      .expect((result) => {
        expect(result.body.message).toMatch(/not authorized/);
      });
  });
  it('Should delete a team it doesn\'t exist.', () => {
    let deleteTeamData = [{
      team_id: 99
    }];
    return request
      .delete("/teams/")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(deleteTeamData)
      .expect(404)
      .expect((result) => {
        expect(result.body.message).toMatch(/does not exist/);
      });
  });
});