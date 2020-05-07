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

describe('Get all vetoes', () => {
    it('Should retrieve all vetoes, even if none.', async done => {
        const result = await request.get('/vetoes/');
        expect(result.statusCode).toEqual(404);
        done();
    });
});

describe('Create a veto', () => {
    it('Should create a single veto that is tied to a match.', async done => {
      // Min required data.
      let newVetoData = [
        {
          match_id: 3,
          team_name: "PRVSHLF2",
          map_name: "de_vertigo",
          pick_or_ban: "veto"
        }
      ];
      request
        .post("/vetoes/create")
        .set("Content-Type", "application/json")
        .set("Accept", "application/json")
        .send(newVetoData)
        .expect((result) => {
          expect(result.body.message).toMatch(/successfully/);
        })
        .expect(200)
        .end(done);
    });
    it('Should create another ban for a different team.', async done => {
        // Min required data.
        let newVetoData = [
          {
            match_id: 3,
            team_name: "PRVSHLF3",
            map_name: "de_inferno",
            pick_or_ban: "veto"
          }
        ];
        request
          .post("/vetoes/create")
          .set("Content-Type", "application/json")
          .set("Accept", "application/json")
          .send(newVetoData)
          .expect((result) => {
            expect(result.body.message).toMatch(/successfully/);
          })
          .expect(200)
          .end(done);
      });
      it('Should create a last ban for a different team so it matches the veto_mappool in match.', async done => {
        // Min required data.
        let newVetoData = [
          {
            match_id: 3,
            team_name: "PRVSHLF2",
            map_name: "de_mirage",
            pick_or_ban: "veto"
          }
        ];
        request
          .post("/vetoes/create")
          .set("Content-Type", "application/json")
          .set("Accept", "application/json")
          .send(newVetoData)
          .expect((result) => {
            expect(result.body.message).toMatch(/successfully/);
          })
          .expect(200)
          .end(done);
      });
});

describe('Get match vetoes', () => {
    it('Should retrieve all vetoes, even if none.', async done => {
        const result = await request.get('/vetoes/3');
        expect(result.statusCode).toEqual(200);
        expect(result.body.length).toEqual(3);
        done();
    });
});

describe('Delete match vetoes', () => {
    it('Should delete all match vetoes.', async done => {
        let deleteVetoData = [
            {
              match_id: 3
            }
          ];
          request
            .delete("/vetoes/delete")
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .send(deleteVetoData)
            .expect(200)
            .expect((result) => {
              expect(result.body.message).toMatch(/successfully/);
            })
            .end(done);
    });
});

describe('Recreate vetoes', () => {
    it('Should create a single veto that is tied to a match.', async done => {
      // Min required data.
      let newVetoData = [
        {
          match_id: 3,
          team_name: "PRVSHLF2",
          map_name: "de_vertigo",
          pick_or_ban: "veto"
        }
      ];
      request
        .post("/vetoes/create")
        .set("Content-Type", "application/json")
        .set("Accept", "application/json")
        .send(newVetoData)
        .expect((result) => {
          expect(result.body.message).toMatch(/successfully/);
        })
        .expect(200)
        .end(done);
    });
    it('Should create another ban for a different team.', async done => {
        // Min required data.
        let newVetoData = [
          {
            match_id: 3,
            team_name: "PRVSHLF3",
            map_name: "de_inferno",
            pick_or_ban: "veto"
          }
        ];
        request
          .post("/vetoes/create")
          .set("Content-Type", "application/json")
          .set("Accept", "application/json")
          .send(newVetoData)
          .expect((result) => {
            expect(result.body.message).toMatch(/successfully/);
          })
          .expect(200)
          .end(done);
      });
      it('Should create a last ban for a different team so it matches the veto_mappool in match.', async done => {
        // Min required data.
        let newVetoData = [
          {
            match_id: 3,
            team_name: "PRVSHLF2",
            map_name: "de_mirage",
            pick_or_ban: "veto"
          }
        ];
        request
          .post("/vetoes/create")
          .set("Content-Type", "application/json")
          .set("Accept", "application/json")
          .send(newVetoData)
          .expect((result) => {
            expect(result.body.message).toMatch(/successfully/);
          })
          .expect(200)
          .end(done);
      });
});