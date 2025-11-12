import { agent } from 'supertest';
import app from '../app.js';
import { db } from '../src/services/db.js';
import { QueueService } from '../src/services/queue.js';
const request = agent(app);

describe('Queue routes', () => {
  beforeAll(() => {
    // Authenticate mock steam user (mock strategy)
    return request.get('/auth/steam/return').expect(302);
  });

  it('should create a queue and return URL', async () => {
    const payload = [ { maxPlayers: 4, private: false } ];
    const res = await request
      .post('/queue/')
      .set('Content-Type', 'application/json')
      .send(payload)
      .expect(200);

    expect(res.body.url).toMatch(/\/queue\//);
    // Save the slug for subsequent tests
    const slug = res.body.url.split('/').pop();
    expect(slug).toBeDefined();
    // store on global for other tests
    global.__TEST_QUEUE_SLUG = slug;
  });

  it('should add users to the queue and create teams when full', async () => {
    const slug = global.__TEST_QUEUE_SLUG;
    // Add 4 users; the first is the creator (already added) so add 3 more
    // Using the mockProfile steam id and some fake ids for others
    const extraUsers = ['76561198025644195','76561198025644196','76561198025644197'];
    // Add users directly to the queue service to simulate distinct steam IDs (route uses req.user)
    for (const id of extraUsers) {
      await QueueService.addUserToQueue(slug, id);
    }

    // Now trigger team creation from the service (would normally be called by the route once full)
    const result = await QueueService.createTeamsFromQueue(slug);
    expect(result).toBeDefined();
    expect(Array.isArray(result.teams)).toBe(true);
    expect(result.teams.length).toBe(2);

    // Check DB for created teams; there should be at least 2 inserted with team_auth_names
    const teams = await db.query('SELECT id FROM team WHERE name LIKE ?', [`team_%`]);
    expect(teams.length).toBeGreaterThanOrEqual(2);
    const teamId = teams[0].id;
    const auths = await db.query('SELECT auth FROM team_auth_names WHERE team_id = ?', [teamId]);
    expect(auths.length).toBeGreaterThan(0);
  });

  describe('rating normalization', () => {
    test('uses median when some ratings are present and adds jitter for missing', () => {
      const realRandom = Math.random;
      Math.random = () => 0.5;

      const players = [
        { steamId: '1', timestamp: 1, hltvRating: 2 },
        { steamId: '2', timestamp: 2, hltvRating: 4 },
        { steamId: '3', timestamp: 3, hltvRating: undefined },
      ];
      const out = QueueService.normalizePlayerRatings(players);
      expect(out.find(p => p.steamId === '3').hltvRating).toBeCloseTo(3);

      Math.random = realRandom;
    });

    test('all missing ratings fall back to 1.0 +/- jitter', () => {
      const realRandom = Math.random;
      Math.random = () => 0.25;

      const players = [
        { steamId: 'a', timestamp: 1, hltvRating: undefined },
        { steamId: 'b', timestamp: 2, hltvRating: undefined }
      ];
      const out = QueueService.normalizePlayerRatings(players);
      expect(out[0].hltvRating).toBeCloseTo(0.975);

      Math.random = realRandom;
    });
  });
});
