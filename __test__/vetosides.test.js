const supertest = require('supertest')
const app = require('../app')
const request = supertest.agent(app);
let vetoId;

describe('Authenticate User', () => {
  it('Should create a user with mock values.', async done => {
    const result = await request.get('/auth/steam/return');
    expect(result.statusCode).toEqual(302);
    done();
  });
});

describe('Get all veto side data', () => {
    it('Should retrieve all vetoes, even if none.', async done => {
        const result = await request.get('/vetosides/');
        expect(result.statusCode).toEqual(404);
        done();
    });
});

describe('Create a veto', () => {
    it('Should create a single veto side that is tied to a match and veto.', async done => {
      // Min required data.
      let newVetoData = [
        {
          match_id: 3,
          team_name: "PRVSHLF2",
          map_name: "de_vertigo",
          side: "CT"
        }
      ];
      request
        .post("/vetosides/")
        .set("Content-Type", "application/json")
        .set("Accept", "application/json")
        .send(newVetoData)
        .expect((result) => {
          expect(result.body.message).toMatch(/successfully/);
        })
        .expect(200)
        .end(done);
    });
    it('Should create another side selection for a different team.', async done => {
        // Min required data.
        let newVetoData = [
          {
            match_id: 3,
            team_name: "PRVSHLF3",
            map_name: "de_inferno",
            side: "T"
          }
        ];
        request
          .post("/vetosides/")
          .set("Content-Type", "application/json")
          .set("Accept", "application/json")
          .send(newVetoData)
          .expect((result) => {
            expect(result.body.message).toMatch(/successfully/);
          })
          .expect(200)
          .end(done);
      });
      it('Should create a last side selection for a different team.', async done => {
        // Min required data.
        let newVetoData = [
          {
            match_id: 3,
            team_name: "PRVSHLF2",
            map_name: "de_mirage",
            side: "T"
          }
        ];
        request
          .post("/vetosides/")
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
    it('Should retrieve all veto sides, even if none.', async done => {
        const result = await request.get('/vetosides/3');
        expect(result.statusCode).toEqual(200);
        expect(result.body.vetoes.length).toEqual(3);
        done();
    });
});

describe('Delete match vetoes', () => {
    it('Should delete all match side selection data.', async done => {
        let deleteVetoData = [
            {
              match_id: 3
            }
          ];
          request
            .delete("/vetosides/")
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
          side: "CT"
        }
      ];
      request
        .post("/vetosides/")
        .set("Content-Type", "application/json")
        .set("Accept", "application/json")
        .send(newVetoData)
        .expect((result) => {
          expect(result.body.message).toMatch(/successfully/);
        })
        .expect(200)
        .end(done);
    });
    it('Should create another side selection for a different team.', async done => {
        // Min required data.
        let newVetoData = [
          {
            match_id: 3,
            team_name: "PRVSHLF3",
            map_name: "de_inferno",
            side: "T"
          }
        ];
        request
          .post("/vetosides/")
          .set("Content-Type", "application/json")
          .set("Accept", "application/json")
          .send(newVetoData)
          .expect((result) => {
            expect(result.body.message).toMatch(/successfully/);
          })
          .expect(200)
          .end(done);
      });
      it('Should create a last side selection for a match.', async done => {
        // Min required data.
        let newVetoData = [
          {
            match_id: 3,
            team_name: "PRVSHLF2",
            map_name: "de_mirage",
            side: "T"
          }
        ];
        request
          .post("/vetosides/")
          .set("Content-Type", "application/json")
          .set("Accept", "application/json")
          .send(newVetoData)
          .expect((result) => {
            expect(result.body.message).toMatch(/successfully/);
            vetoId = result.body.id;
          })
          .expect(200)
          .end(done);
      });
      it('Should update the match to include the ID.', async done => {
        // Min required data.
        let updVetoData = [
          {
            veto_id: vetoId,
            match_id: 3,
            side: "CT"
          }
        ];
        request
          .put("/vetosides/")
          .set("Content-Type", "application/json")
          .set("Accept", "application/json")
          .send(updVetoData)
          .expect((result) => {
            expect(result.body.message).toMatch(/successfully/);
          })
          .expect(200)
          .end(done);
      });
});
