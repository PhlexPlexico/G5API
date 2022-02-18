import { agent } from 'supertest';
import app from '../app.js';
const request = agent(app);
let vetoId;

describe("Test the veto routes", () => {
  beforeAll(() => {
    return request.get('/auth/steam/return')
      .expect(302);
  });
  it('Should retrieve all vetoes, even if none.', () => {
    return request.get('/vetoes/')
      .expect(404);
  });
  it('Should create a single veto that is tied to a match.', () => {
    // Min required data.
    let newVetoData = [
      {
        match_id: 3,
        team_name: "PRVSHLF2",
        map_name: "de_vertigo",
        pick_or_ban: "veto"
      }
    ];
    return request
      .post("/vetoes/")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(newVetoData)
      .expect((result) => {
        expect(result.body.message).toMatch(/successfully/);
      })
      .expect(200);
  });
  it('Should create another ban for a different team.', () => {
    // Min required data.
    let newVetoData = [
      {
        match_id: 3,
        team_name: "PRVSHLF3",
        map_name: "de_inferno",
        pick_or_ban: "veto"
      }
    ];
    return request
      .post("/vetoes/")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(newVetoData)
      .expect((result) => {
        expect(result.body.message).toMatch(/successfully/);
      })
      .expect(200);
  });
  it('Should create a last ban for a different team so it matches the veto_mappool in match.', () => {
    // Min required data.
    let newVetoData = [
      {
        match_id: 3,
        team_name: "PRVSHLF2",
        map_name: "de_mirage",
        pick_or_ban: "veto"
      }
    ];
    return request
      .post("/vetoes/")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(newVetoData)
      .expect((result) => {
        expect(result.body.message).toMatch(/successfully/);
      })
      .expect(200);
  });
  it('Should retrieve all vetoes, even if none.', () => {
    return request.get('/vetoes/3')
      .expect(200)
      .expect((result) => {
        expect(result.body.vetoes.length).toEqual(3);
      });
  });
  it('Should delete all match vetoes.', () => {
    let deleteVetoData = [
      {
        match_id: 3
      }
    ];
    return request
      .delete("/vetoes/")
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
        pick_or_ban: "veto"
      }
    ];
    return request
      .post("/vetoes/")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(newVetoData)
      .expect((result) => {
        expect(result.body.message).toMatch(/successfully/);
      })
      .expect(200);
  });
  it('Should create another ban for a different team.', () => {
    // Min required data.
    let newVetoData = [
      {
        match_id: 3,
        team_name: "PRVSHLF3",
        map_name: "de_inferno",
        pick_or_ban: "veto"
      }
    ];
    return request
      .post("/vetoes/")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(newVetoData)
      .expect((result) => {
        expect(result.body.message).toMatch(/successfully/);
      })
      .expect(200);
  });
  it('Should create a last ban for a different team so it matches the veto_mappool in match.', () => {
    // Min required data.
    let newVetoData = [
      {
        match_id: 3,
        team_name: "PRVSHLF2",
        map_name: "de_mirage",
        pick_or_ban: "veto"
      }
    ];
    return request
      .post("/vetoes/")
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
        match_id: 3
      }
    ];
    return request
      .put("/vetoes/")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(updVetoData)
      .expect((result) => {
        expect(result.body.message).toMatch(/successfully/);
      })
      .expect(200);
  });
});