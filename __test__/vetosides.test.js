import { agent } from 'supertest';
import app from '../app.js';
const request = agent(app);
let vetoId;

describe("Test the vetosides routes", () => {
  beforeAll(async () => {
    await request.get('/auth/steam/return')
      .expect(302);
    return;
  });
  it('Should retrieve all vetoes, even if none.', () => {
    return request.get('/vetosides/')
      .expect(404);
  });
  it('Should create a single veto side that is tied to a match and veto.', () => {
    // Min required data.
    let newVetoData = [
      {
        match_id: 3,
        team_name: "PRVSHLF2",
        map_name: "de_vertigo",
        side: "CT"
      }
    ];
    return request
      .post("/vetosides/")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(newVetoData)
      .expect((result) => {
        expect(result.body.message).toMatch(/successfully/);
      })
      .expect(200);
  });
  it('Should create another side selection for a different team.', () => {
    // Min required data.
    let newVetoData = [
      {
        match_id: 3,
        team_name: "PRVSHLF3",
        map_name: "de_inferno",
        side: "T"
      }
    ];
    return request
      .post("/vetosides/")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(newVetoData)
      .expect((result) => {
        expect(result.body.message).toMatch(/successfully/);
      })
      .expect(200);
  });
  it('Should create a last side selection for a different team.', () => {
    // Min required data.
    let newVetoData = [
      {
        match_id: 3,
        team_name: "PRVSHLF2",
        map_name: "de_mirage",
        side: "T"
      }
    ];
    return request
      .post("/vetosides/")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(newVetoData)
      .expect((result) => {
        expect(result.body.message).toMatch(/successfully/);
      })
      .expect(200);
  });
  it('Should retrieve all veto sides, even if none.', () => {
    return request.get('/vetosides/3')
    .expect((result) => {
      console.log(result.body);
      expect(result.body.vetoes.length).toEqual(3);
    })
    .expect(200);
  });
  it('Should delete all match side selection data.', () => {
    let deleteVetoData = [
      {
        match_id: 3
      }
    ];
    return request
      .delete("/vetosides/")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(deleteVetoData)
      .expect(200)
      .expect((result) => {
        expect(result.body.message).toMatch(/successfully/);
      });
  });
  it('Should create a single veto that is tied to a match.', () => {
    // Min required data.
    let newVetoData = [
      {
        match_id: 3,
        team_name: "PRVSHLF2",
        map_name: "de_vertigo",
        side: "CT"
      }
    ];
    return request
      .post("/vetosides/")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(newVetoData)
      .expect((result) => {
        expect(result.body.message).toMatch(/successfully/);
      })
      .expect(200);
  });
  it('Should create another side selection for a different team.', () => {
    // Min required data.
    let newVetoData = [
      {
        match_id: 3,
        team_name: "PRVSHLF3",
        map_name: "de_inferno",
        side: "T"
      }
    ];
    return request
      .post("/vetosides/")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(newVetoData)
      .expect((result) => {
        expect(result.body.message).toMatch(/successfully/);
      })
      .expect(200);
  });
  it('Should create a last side selection for a match.', () => {
    // Min required data.
    let newVetoData = [
      {
        match_id: 3,
        team_name: "PRVSHLF2",
        map_name: "de_mirage",
        side: "T"
      }
    ];
    return request
      .post("/vetosides/")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(newVetoData)
      .expect((result) => {
        expect(result.body.message).toMatch(/successfully/);
        vetoId = result.body.id;
      })
      .expect(200);
  });
  it('Should update the match to include the ID.', () => {
    // Min required data.
    let updVetoData = [
      {
        veto_id: vetoId,
        match_id: 3,
        side: "CT"
      }
    ];
    return request
      .put("/vetosides/")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(updVetoData)
      .expect((result) => {
        expect(result.body.message).toMatch(/successfully/);
      })
      .expect(200);
  });
});