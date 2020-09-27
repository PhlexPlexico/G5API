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

describe('Get all matches', () => {
    it('Should retrieve all matches, even if none.', async done => {
        const result = await request.get('/matches/');
        expect(result.statusCode).toEqual(404);
        done();
    });
});
describe('Create a match', () => {
    it('Should create a single match that is ready to be played with teams.', async done => {
      // Min required data.
      let newMatchData = [
        {
          server_id: 3,
          team1_id: 4,
          team2_id: 3,
          max_maps: 1,
          title: "Map {MAPNUMBER} of {MAXMAPS}",
          veto_mappool: "de_dust2, de_cache, de_mirage",
          skip_veto: 0,
          ignore_server: true
        }
      ];
      request
        .post("/matches/")
        .set("Content-Type", "application/json")
        .set("Accept", "application/json")
        .send(newMatchData)
        .expect((result) => {
          expect(result.body.message).toMatch(/successfully/);
        })
        .expect(200)
        .end(done);
    });
});

describe('Update a match', () => {
  it('Should update a match with a start time.', async done => {
    let updatedMatchData = [
      {
        match_id: 1,
        start_time: new Date().toISOString().slice(0, 19).replace('T', ' '),
        plugin_version: '0.7.2'
      }
    ];
    request
      .put("/matches/")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(updatedMatchData)
      .expect(200)
      .expect((result) => {
        expect(result.body.message).toMatch(/successfully/);
      })
      .end(done);
  });
});

describe('Get Match Config', () => {
  it('Should retrieve the config for a match.', async done => {
    const result = await request.get("/matches/1/config")
    expect(result.statusCode).toEqual(200);
    expect(result.body.cvars.get5_web_api_url).toMatch(/http/);
    done();
  });
});

describe('Get first match info', () => {
  it('Should get the first match.', async done => {
    const result = await request.get('/matches/1');
    expect(result.statusCode).toEqual(200);
    expect(result.body[0].api_key).not.toBeUndefined();
    done();
  });
});

describe('Perform being a bad actor', () => {
  it('Should first update the first match to attempt to break things right after.', async done => {
      let updatedMatchData = [
        {
          match_id: 1,
          user_id: 2
        }
      ];
      request
        .put("/matches/")
        .set("Content-Type", "application/json")
        .set("Accept", "application/json")
        .send(updatedMatchData)
        .expect(200)
        .expect((result) => {
          expect(result.body.message).toMatch(/successfully/);
        })
        .end(done);
  });
  it('Should attempt to get the API key of the match.', async done => {
    const result = await request.get('/matches/1');
    expect(result.statusCode).toEqual(200);
    expect(result.body[0].api_key).toBeUndefined();
    done();
  });
  it('Should attempt to forfeit the match.', async done => {
    let updatedMatchData = [
      {
        match_id: 1,
        forfeit: 1
      }
    ];
    request
      .put("/matches/")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(updatedMatchData)
      .expect(403)
      .expect((result) => {
        expect(result.body.message).toMatch(/not authorized/);
      })
      .end(done);
  });
  it('Should attempt to delete the match.', async done => {
    let updatedMatchData = [
      {
        match_id: 1
      }
    ];
    request
      .delete("/matches/")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(updatedMatchData)
      .expect(403)
      .expect((result) => {
        expect(result.body.message).toMatch(/not authorized/);
      })
      .end(done);
  });
});

describe('Create two more matches for further testing.', () => {
  it('Should create a single match that is ready to be cancelled.', async done => {
    let newMatchData = [
      {
        server_id: 2,
        team1_id: 4,
        team2_id: 3,
        max_maps: 1,
        title: "Map {MAPNUMBER} of {MAXMAPS}",
        veto_mappool: "de_vertigo, de_inferno, de_mirage",
        skip_veto: 1,
        ignore_server: true
      },
    ];
    request
      .post("/matches/")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(newMatchData)
      .expect((result) => {
        expect(result.body.message).toMatch(/successfully/);
      })
      .expect(200)
      .end(done);
  });
  it('Should forfeit the match.', async done => {
    let updatedMatchData = [
      {
        match_id: 2,
        forfeit: 1,
        end_time: new Date().toISOString().slice(0, 19).replace('T', ' ')
      },
    ];
    request
      .put("/matches/")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(updatedMatchData)
      .expect(200)
      .expect((result) => {
        expect(result.body.message).toMatch(/successfully/);
      })
      .end(done);
  });
  it('Should delete the match.', async done => {
    let updatedMatchData = [
      {
        match_id: 2
      },
    ];
    request
      .delete("/matches/")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(updatedMatchData)
      .expect(200)
      .expect((result) => {
        expect(result.body.message).toMatch(/successfully/);
      })
      .end(done);
  });
  it('Should create a single match that is ready for further testing.', async done => {
    let newMatchData = [
      {
        server_id: 2,
        team1_id: 4,
        team2_id: 3,
        max_maps: 1,
        title: "Map {MAPNUMBER} of {MAXMAPS}",
        veto_mappool: "de_vertigo, de_inferno, de_mirage",
        skip_veto: 1,
        ignore_server: true
      },
    ];
    request
      .post("/matches/")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(newMatchData)
      .expect(200)
      .expect((result) => {
        expect(result.body.message).toMatch(/successfully/);
      })
      .end(done);
  });
});
