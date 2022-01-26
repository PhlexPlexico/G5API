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

describe('Get Zero Seasons', () => {
    it('Should return 404 with no seasons.', async done => {
      const result = await request.get('/seasons/');
      expect(result.statusCode).toEqual(404);
      done();
    });
});

describe('Create Seasons', () => {
    it('Should create a new season.', async done => {
      // Min required data.
      let newSeasonData = [
        {
          name: "Phlex's Temp Season",
          start_date: new Date().toISOString().slice(0, 10).replace('T', ' ')
        }
      ];
      request
        .post("/seasons/")
        .set("Content-Type", "application/json")
        .set("Accept", "application/json")
        .send(newSeasonData)
        .expect((result) => {
          expect(result.body.message).toMatch(/successfully/);
        })
        .expect(200)
        .end(done);
    });
    it('Should create a new season again.', async done => {
        // Min required data.
        let newSeasonData = [
          {
            name: "Phlex's Bad Actor",
            start_date: new Date().toISOString().slice(0, 10).replace('T', ' ')
          }
        ];
        request
          .post("/seasons/")
          .set("Content-Type", "application/json")
          .set("Accept", "application/json")
          .send(newSeasonData)
          .expect((result) => {
            expect(result.body.message).toMatch(/successfully/);
          })
          .expect(200)
          .end(done);
      });
});

describe('Update the bad actor season', () => {
    it('Should update the bad actor to allow us to attempt to do malicious things.', async done => {
      let updateSeasonData = [
        {
          season_id: 2,
          user_id: 2
        }
      ];
      request
        .put("/seasons/")
        .set("Content-Type", "application/json")
        .set("Accept", "application/json")
        .send(updateSeasonData)
        .expect((result) => {
          expect(result.body.message).toMatch(/successfully/);
        })
        .expect(200)
        .end(done);
    });
    it('Should attempt to delete the second season.', async done => {
        let deleteSeasonData = [
            {
              season_id: 2
            }
          ];
          request
            .delete("/seasons/")
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .send(deleteSeasonData)
            .expect((result) => {
              expect(result.body.message).toMatch(/not authorized/);
            })
            .expect(403)
            .end(done);
    });
});

describe('Update a match with a season attached to it.', () => {
    it('Should return 404 with no seasons.', async done => {
        let updateSeasonData = [
            {
                match_id: 3,
                season_id: 1
            }
          ];
          request
            .put("/matches/")
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .send(updateSeasonData)
            .expect((result) => {
              expect(result.body.message).toMatch(/successfully/);
            })
            .expect(200)
            .end(done);
    });
});

describe('Delete the season', () => {
    it('Should delete the second season.', async done => {
        let deleteSeasonData = [
            {
              season_id: 1
            }
          ];
          request
            .delete("/seasons/")
            .set("Content-Type", "application/json")
            .set("Accept", "application/json")
            .send(deleteSeasonData)
            .expect((result) => {
              expect(result.body.message).toMatch(/successfully/);
            })
            .expect(200)
            .end(done);
    });
});