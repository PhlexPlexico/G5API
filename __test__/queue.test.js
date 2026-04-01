import { agent } from 'supertest';
import config from 'config';
import { jest } from '@jest/globals';
import app from '../app.js';
import { db } from '../src/services/db.js';
import {
  QueueService,
  QueueOwnerDatHostConfigMissingError
} from '../src/services/queue.js';
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
      await QueueService.addUserToQueue(slug, id, 'TestUser');
    }

    // Now trigger team creation from the service (would normally be called by the route once full)
    const result = await QueueService.createTeamsFromQueue(slug);
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);

    // Check DB for created teams; there should be at least 2 inserted with team_auth_names
    const teams = await db.query('SELECT id FROM team WHERE name LIKE ?', [`team_%`]);
    expect(teams.length).toBeGreaterThanOrEqual(2);
    const teamId = teams[0].id;
    const auths = await db.query('SELECT auth FROM team_auth_names WHERE team_id = ?', [teamId]);
    expect(auths.length).toBeGreaterThan(0);
  });

  it('should list queues via GET /queue/', async () => {
    const res = await request.get('/queue/').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    const names = res.body.map((q) => q.name);
    expect(names).toContain(global.__TEST_QUEUE_SLUG);
  });

  it('should get queue by slug via GET /queue/:slug', async () => {
    const slug = global.__TEST_QUEUE_SLUG;
    const res = await request.get(`/queue/${slug}`).expect(200);
    expect(res.body.name).toBe(slug);
    expect(res.body.maxSize).toBe(4);
    expect(typeof res.body.currentPlayers).toBe('number');
  });

  it('should get queue players via GET /queue/:slug/players', async () => {
    const slug = global.__TEST_QUEUE_SLUG;
    const res = await request.get(`/queue/${slug}/players`).expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it('should reject duplicate join via PUT /queue/:slug with action join', async () => {
    const slug = global.__TEST_QUEUE_SLUG;
    const res = await request
      .put(`/queue/${slug}`)
      .set('Content-Type', 'application/json')
      .send([{ action: 'join' }])
      .expect(500);
    expect(res.body.error).toBeDefined();
  });

  it('should leave queue and delete when last user via PUT leave', async () => {
    const createRes = await request
      .post('/queue/')
      .set('Content-Type', 'application/json')
      .send([{ maxPlayers: 2, private: false }])
      .expect(200);
    const leaveSlug = createRes.body.url.split('/').pop();
    await request
      .put(`/queue/${leaveSlug}`)
      .set('Content-Type', 'application/json')
      .send([{ action: 'leave' }])
      .expect(200);
    await request.get(`/queue/${leaveSlug}`).expect(404);
  });

  it('should delete queue via DELETE /queue/ with body slug', async () => {
    const createRes = await request
      .post('/queue/')
      .set('Content-Type', 'application/json')
      .send([{ maxPlayers: 5, private: false }])
      .expect(200);
    const deleteSlug = createRes.body.url.split('/').pop();
    await request
      .delete('/queue/')
      .set('Content-Type', 'application/json')
      .send([{ slug: deleteSlug }])
      .expect(200);
    await request.get(`/queue/${deleteSlug}`).expect(404);
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

  it('should throw a clear error when queue owner lacks DatHost config', async () => {
    const originalHas = config.has.bind(config);
    const originalGet = config.get.bind(config);
    let descriptor;
    try {
      jest.spyOn(config, 'has').mockImplementation((key) => {
        if (key === 'server.serverProvider') return true;
        return originalHas(key);
      });
      jest.spyOn(config, 'get').mockImplementation((key) => {
        if (key === 'server.serverProvider') return 'dathost';
        return originalGet(key);
      });

      descriptor = await QueueService.createQueue(
        '76561198025644195',
        'OwnerNoDatHostConfig',
        10,
        false,
        'cs2',
        120
      );

      await expect(
        QueueService.createMatchFromQueue(descriptor.name, [1, 2])
      ).rejects.toThrow(QueueOwnerDatHostConfigMissingError);
    } finally {
      if (descriptor?.name) {
        await QueueService.deleteQueue(descriptor.name, '76561198025644195');
      }
      jest.restoreAllMocks();
    }
  });
});
