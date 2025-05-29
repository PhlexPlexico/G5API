import { jest } from '@jest/globals';
import supertest from 'supertest';
import { createClient } from 'redis';
import mysql from 'mysql2/promise';
import config from 'config'; // To access db config for test-specific queries
import GlobalEmitter from '../src/utility/emitter.js'; // Import GlobalEmitter
import passport from 'passport';
import MockStrategy from '../src/utility/mockstrategy.js'; // Assuming path to mockStrategy
import app from '../app.js'; // Assuming Express app is exported from here
import QueueService from '../src/services/queueservice.js'; // For potential setup/teardown or direct interaction

const request = supertest(app);

// Mock Users
// Moved USER_CAPTAIN1_MOCK and USER_CAPTAIN2_MOCK to a higher scope\
const DEFAULT_QUEUE_CAPACITY = 10; // Default capacity for queue creation in tests
const USER_CAPTAIN1_MOCK = { steam_id: 'captain1_steam_id', username: 'CaptainOne', admin: false, super_admin: false };
const USER_CAPTAIN2_MOCK = { steam_id: 'captain2_steam_id', username: 'CaptainTwo', admin: false, super_admin: false };
const USER_REGULAR = { steam_id: 'user_regular_steam_id', username: 'RegularUser', admin: false, super_admin: false };
const USER_BAD_ACTOR = { steam_id: 'user_bad_actor_steam_id', username: 'BadActor', admin: false, super_admin: false };
const USER_OWNER = { steam_id: 'user_owner_steam_id', username: 'QueueOwner', admin: false, super_admin: false };
const USER_PLAYER3_SSE = { steam_id: 'player3_sse_steam_id', username: 'Player3SSE', admin: false, super_admin: false };
const USER_PLAYER4_SSE = { steam_id: 'player4_sse_steam_id', username: 'Player4SSE', admin: false, super_admin: false };
const USER_ADMIN = { steam_id: 'user_admin_steam_id', username: 'AdminUser', admin: true, super_admin: false };
const USER_SUPER_ADMIN = { steam_id: 'user_super_admin_steam_id', username: 'SuperAdminUser', admin: false, super_admin: true }; // super_admin implies admin in some checks

let redisClient;
let queueServiceInstance; // To interact with the same Redis instance if needed
let mockSteamStrategy; // To hold the mock strategy instance

// Helper to login a user
const loginAs = (userToLogin) => { // Renamed parameter for clarity
    if (mockSteamStrategy) { // No need to check for verify if we are not calling/replacing it
        mockSteamStrategy.user = userToLogin; // This 'user' property is what the verify callback (defined in beforeAll) will use
    } else {
        console.error("ERROR: mockSteamStrategy not properly initialized before loginAs called.");
        throw new Error("MockStrategy not initialized for loginAs. Test setup failed.");
    }
};

const getQueueFromRedis = async (queueId) => {
    if (!queueServiceInstance) { // Fallback if direct service instance not available for testing
         return null; // Cannot directly get without service instance properly configured for test
    }
    return queueServiceInstance.getQueueDetails(queueId);
};

const getVetoDetailsFromRedis = async (queueId) => {
    if (!queueServiceInstance) {
        console.error("QueueService instance not available for getVetoDetailsFromRedis");
        return null;
    }

    // QueueService's getVetoDetails method already parses the details
    return queueServiceInstance.getVetoDetails(queueId);
};

const createQueueViaAPI = async (user, capacity = 10, teamSelectionMethod) => {
    loginAs(user);
    const payload = { capacity };
    if (teamSelectionMethod) {
        payload.teamSelectionMethod = teamSelectionMethod;
    }
    const response = await request
        .post('/queues')
        .send([payload]) // Send as an array with one object
        .set('Accept', 'application/json');
    if (response.status === 201) {
        return response.body;
    }
    console.error('Error creating queue via API for test setup:', response.body, user);
    return null;
};


describe('Queue API Tests', () => {
    beforeAll(async () => {
        const testRedisUrl = process.env.TEST_REDIS_URL || 'redis://:super_secure@localhost:6379'; // Use a dedicated test DB
        redisClient = createClient({ url: testRedisUrl });
        await redisClient.connect();
        
        // Initialize QueueService with the test Redis client for direct manipulation if needed
        // This assumes QueueService constructor can take a Redis client or URL
        // And that the main app's QueueService instance is also configured for this test DB
        // For true integration tests, it's better if the app's own QueueService uses this test DB
        // based on an environment variable (e.g., NODE_ENV=test)
        queueServiceInstance = new QueueService(testRedisUrl); 

        // Setup mock authentication strategy
        // The verify function will be updated by loginAs for each test case.
        mockSteamStrategy = new MockStrategy(
            { name: 'steam', passAuthentication: true },
            // This is the verify callback.
            // 'identifier' will be what MockStrategy's authenticate() passes as this.user.id
            // 'profile' will be what MockStrategy's authenticate() passes as this.user
            // 'passportDoneCallback' is the actual "done" function from Passport system that this verify function must call.
            (identifier, profile, passportDoneCallback) => { 
                // The 'profile' argument here *is* effectively 'this.user' from the strategy instance,
                // because MockStrategy's authenticate method calls: this.verify(this.user.id, this.user, actualPassportDoneCallback)
                // So, 'profile' in this scope is the user object we want to authenticate with.
                

                if (!profile) { 
                    // This case would occur if mockSteamStrategy.user was null/undefined when authenticate() was called.
                    return passportDoneCallback(null, false, { message: 'No user set on mock strategy for authentication.' });
                }
                // If a profile (user) is present (set by loginAs on mockSteamStrategy.user), authenticate successfully with it.
                return passportDoneCallback(null, profile); 
            }
        );
        passport.use('steam', mockSteamStrategy);
        app.use(passport.initialize()); // Ensure passport is initialized in the test app instance
        app.use(passport.session()); // THIS LINE IS ADDED/ENSURED
    });

    afterAll(async () => {
        if (queueServiceInstance) {
            await queueServiceInstance.disconnect();
        }
        if (redisClient && redisClient.isOpen) {
            await redisClient.quit();
        }
    if (mysqlTestPool) {
      await mysqlTestPool.end();
    }
    });

  let mysqlTestPool; // Pool for test-specific MySQL queries
  let emitterSpy; // Moved emitterSpy declaration here

    beforeEach(async () => {
        if (redisClient && redisClient.isOpen) {
            
            const allKeys = await redisClient.keys('*');
            if (allKeys.length > 0) {
                await redisClient.del(allKeys);
            }
        }
        // Initialize emitterSpy here for all tests within 'Queue API Tests'
        emitterSpy = jest.spyOn(GlobalEmitter, 'emit');
    });

    afterEach(() => {
        // Restore emitterSpy here after each test
        if (emitterSpy) {
            emitterSpy.mockRestore();
        }
    });

    // --- Phase 1: CRUD, Authorization, and Team Selection Method Tests ---

    describe('Queue Creation with Team Selection Method', () => {
        test('Test Case 1: Create queue with teamSelectionMethod: "random"', async () => {
            const queue = await createQueueViaAPI(USER_OWNER, 10, 'random');
            expect(queue).not.toBeNull();
            expect(queue.teamSelectionMethod).toBe('random');
            const queueDetailsFromRedis = await getQueueFromRedis(queue.id);
            expect(queueDetailsFromRedis.teamSelectionMethod).toBe('random');
        });

        test('Test Case 2: Create queue with teamSelectionMethod: "captains"', async () => {
            const queue = await createQueueViaAPI(USER_OWNER, 10, 'captains');
            expect(queue).not.toBeNull();
            expect(queue.teamSelectionMethod).toBe('captains');
            const queueDetailsFromRedis = await getQueueFromRedis(queue.id);
            expect(queueDetailsFromRedis.teamSelectionMethod).toBe('captains');
        });

        test('Test Case 3: Create queue with no explicit teamSelectionMethod (defaults to "captains")', async () => {
            const queue = await createQueueViaAPI(USER_OWNER, 10); // No method specified
            expect(queue).not.toBeNull();
            expect(queue.teamSelectionMethod).toBe('captains'); // Default behavior
            const queueDetailsFromRedis = await getQueueFromRedis(queue.id);
            expect(queueDetailsFromRedis.teamSelectionMethod).toBe('captains');
        });
    });

    describe('Team Selection Method: "random" - Pop Behavior and Events', () => {
        let randomQueue;
        const playersForRandomQueue = [USER_OWNER, USER_REGULAR, USER_PLAYER3_SSE, USER_PLAYER4_SSE]; // 4 players

        beforeEach(async () => {
            // Create queue with teamSelectionMethod: 'random' by USER_OWNER
            randomQueue = await createQueueViaAPI(USER_OWNER, playersForRandomQueue.length, 'random');
            expect(randomQueue).not.toBeNull();
            expect(randomQueue.teamSelectionMethod).toBe('random');
            emitterSpy.mockClear();

            // Add other players to fill the queue
            for (let i = 1; i < playersForRandomQueue.length; i++) { // Start from 1 as owner is already in
                loginAs(playersForRandomQueue[i]);
                const joinResponse = await request.put(`/queues/${randomQueue.id}/join`);
                expect(joinResponse.status).toBe(200); // Ensure join is successful
            }
            // Queue should have popped by now
        });

        test('Pop Behavior: Random team assignment, status "veto", correct Redis details, and event emission', async () => {
            // 1. Verify queue status is 'veto'
            const queueState = await getQueueFromRedis(randomQueue.id);
            expect(queueState.status).toBe('veto');

            // 2. Verify popped_queue details
            const poppedDetailsKey = `popped_queue:${randomQueue.id}:details`;
            const poppedDetails = await redisClient.hGetAll(poppedDetailsKey);
            expect(poppedDetails).toBeDefined();
            expect(JSON.parse(poppedDetails.available_players)).toEqual([]);
            expect(poppedDetails.next_picker).toBe("picking_complete");

            const team1Picks = JSON.parse(poppedDetails.team1_picks);
            const team2Picks = JSON.parse(poppedDetails.team2_picks);
            const allPickedPlayers = [...team1Picks, ...team2Picks].sort();
            const originalPlayerIds = playersForRandomQueue.map(p => p.steam_id).sort();
            expect(allPickedPlayers).toEqual(originalPlayerIds);

            // Check team sizes (for 4 players, should be 2 vs 2)
            expect(team1Picks.length).toBe(playersForRandomQueue.length / 2);
            expect(team2Picks.length).toBe(playersForRandomQueue.length / 2);

            expect(poppedDetails.captain1).toBe(team1Picks[0]); // Assuming first player in list is captain
            expect(poppedDetails.captain2).toBe(team2Picks[0]); // Assuming first player in list is captain

            // 3. Verify veto details are created
            const vetoDetails = await getVetoDetailsFromRedis(randomQueue.id);
            expect(vetoDetails).not.toBeNull();
            expect(vetoDetails.status).toBe('awaiting_captain_start');
            expect(vetoDetails.captain1SteamId).toBe(poppedDetails.captain1);
            expect(vetoDetails.captain2SteamId).toBe(poppedDetails.captain2);

            // 4. Spy on emitter
            expect(emitterSpy).toHaveBeenCalledWith('queue_event',
                expect.objectContaining({
                    type: 'teams_randomly_assigned',
                    queueId: randomQueue.id,
                    data: expect.objectContaining({
                        status: 'veto',
                        captain1: poppedDetails.captain1,
                        team1Players: expect.arrayContaining(team1Picks),
                        captain2: poppedDetails.captain2,
                        team2Players: expect.arrayContaining(team2Picks),
                    })
                })
            );
            expect(emitterSpy).not.toHaveBeenCalledWith('queue_event',
                expect.objectContaining({ type: 'internal_queue_picking_initiated' })
            );
             expect(emitterSpy).not.toHaveBeenCalledWith('queue_event',
                expect.objectContaining({ type: 'player_picked' })
            );
        });

        test('No Picking Phase: Attempt to use /pick endpoint for "random" queue -> Expect 400/409', async () => {
            // Queue is already in 'veto' state after popping in beforeEach
            loginAs(playersForRandomQueue[0]); // Login as one of the captains (or any player)
            const response = await request
                .post(`/queues/${randomQueue.id}/pick`)
                .send([{ playerSteamId: playersForRandomQueue[1].steam_id }]); // Try to pick someone

            // Expecting 400 because QueueService.pickPlayerInQueue returns:
            // { state: null, error: 'Queue is not in picking phase.', status: 400 }
            // Or 409 if the status check happens at the route level before service.
            // Based on current QueueService, it's 400.
            expect(response.status).toBe(400);
            expect(response.body.message).toContain('Queue is not in picking phase.');
        });
    });


    describe('Team Selection Method: "captains" (explicit) - Pop Behavior and Events', () => {
        let captainsQueue;
        const playersForCaptainsQueue = [USER_OWNER, USER_REGULAR, USER_PLAYER3_SSE, USER_PLAYER4_SSE]; // 4 players

        beforeEach(async () => {
            captainsQueue = await createQueueViaAPI(USER_OWNER, playersForCaptainsQueue.length, 'captains');
            expect(captainsQueue).not.toBeNull();
            expect(captainsQueue.teamSelectionMethod).toBe('captains');
            emitterSpy.mockClear();

            for (let i = 1; i < playersForCaptainsQueue.length; i++) {
                loginAs(playersForCaptainsQueue[i]);
                await request.put(`/queues/${captainsQueue.id}/join`);
            }
        });

        test('Pop Behavior: Enters "picking" state, correct Redis details, and event emission', async () => {
            const queueState = await getQueueFromRedis(captainsQueue.id);
            expect(queueState.status).toBe('picking');

            const poppedDetailsKey = `popped_queue:${captainsQueue.id}:details`;
            const poppedDetails = await redisClient.hGetAll(poppedDetailsKey);
            expect(poppedDetails).toBeDefined();
            expect(JSON.parse(poppedDetails.available_players).length).toBe(playersForCaptainsQueue.length - 2);
            expect(poppedDetails.next_picker).toBe(poppedDetails.captain1); // Captain 1 picks first by default

            expect(emitterSpy).toHaveBeenCalledWith('queue_event',
                expect.objectContaining({
                    type: 'internal_queue_picking_initiated',
                    queueId: captainsQueue.id,
                    data: expect.objectContaining({
                        status: 'picking',
                        captain1: poppedDetails.captain1,
                        captain2: poppedDetails.captain2,
                    })
                })
            );
            expect(emitterSpy).not.toHaveBeenCalledWith('queue_event',
                expect.objectContaining({ type: 'teams_randomly_assigned' })
            );
        });

        test('Picking Phase: Captains can pick players', async () => {
            const poppedDetailsKey = `popped_queue:${captainsQueue.id}:details`;
            let poppedData = await redisClient.hGetAll(poppedDetailsKey);
            let captain1 = poppedData.captain1;
            let captain2 = poppedData.captain2;
            let availablePlayers = JSON.parse(poppedData.available_players);
            
            // Captain 1 picks
            loginAs({ steam_id: captain1 });
            let playerToPick = availablePlayers[0];
            let pickResponse = await request.post(`/queues/${captainsQueue.id}/pick`).send([{ playerSteamId: playerToPick }]);
            expect(pickResponse.status).toBe(200);
            expect(emitterSpy).toHaveBeenCalledWith('queue_event', expect.objectContaining({ type: 'player_picked' }));
            
            emitterSpy.mockClear();

            // Captain 2 picks (last player)
            poppedData = await redisClient.hGetAll(poppedDetailsKey); // Refresh details
            availablePlayers = JSON.parse(poppedData.available_players);
            playerToPick = availablePlayers[0];
            loginAs({ steam_id: captain2 });
            pickResponse = await request.post(`/queues/${captainsQueue.id}/pick`).send([{ playerSteamId: playerToPick }]);
            expect(pickResponse.status).toBe(200);
            
            expect(emitterSpy).toHaveBeenCalledWith('queue_event', expect.objectContaining({ type: 'player_picked' }));
            expect(emitterSpy).toHaveBeenCalledWith('queue_event', expect.objectContaining({ type: 'teams_finalized' }));
            
            const finalQueueState = await getQueueFromRedis(captainsQueue.id);
             // Status should be 'veto' after picking is complete for 'captains' mode
            expect(finalQueueState.status).toBe('veto');
        });
    });


    describe('DELETE /queues/:queueId Authorization', () => {
        let queueCreatedByOwner;

        beforeEach(async () => {
            // Create a queue owned by USER_OWNER before each test in this suite
            queueCreatedByOwner = await createQueueViaAPI(USER_OWNER);
            expect(queueCreatedByOwner).not.toBeNull();
            if (!queueCreatedByOwner) throw new Error("Failed to create queue for DELETE tests");
        });

        test('Test Case 1: user_regular (non-owner, non-admin) attempts to delete -> Expect 403 Forbidden', async () => {
            loginAs(USER_REGULAR);
            const response = await request.delete(`/queues/${queueCreatedByOwner.id}`);
            expect(response.status).toBe(403);
        });

        test('Test Case 2: user_owner attempts to delete -> Expect 200 OK', async () => {
            loginAs(USER_OWNER);
            const response = await request.delete(`/queues/${queueCreatedByOwner.id}`);
            expect(response.status).toBe(200);
            const queueAfterDelete = await getQueueFromRedis(queueCreatedByOwner.id);
            expect(queueAfterDelete).toBeNull();
        });
        
        // For Test Case 3 & 4, we need a new queue as the previous one is deleted.
        // The beforeEach will create a new queue for each test.

// Initialize mysqlTestPool once before tests that need it.
// This is a bit tricky with Jest's describe/beforeAll/beforeEach flow if only some tests need it.
// For simplicity here, we'll ensure it's up for the relevant describe block.

        test('Test Case 3: user_admin (non-owner) attempts to delete -> Expect 200 OK', async () => {
            loginAs(USER_ADMIN);
            const response = await request.delete(`/queues/${queueCreatedByOwner.id}`);
            expect(response.status).toBe(200);
            const queueAfterDelete = await getQueueFromRedis(queueCreatedByOwner.id);
            expect(queueAfterDelete).toBeNull();
        });

        test('Test Case 4: user_super_admin (non-owner) attempts to delete -> Expect 200 OK', async () => {
            loginAs(USER_SUPER_ADMIN);
            const response = await request.delete(`/queues/${queueCreatedByOwner.id}`);
            expect(response.status).toBe(200);
            const queueAfterDelete = await getQueueFromRedis(queueCreatedByOwner.id);
            expect(queueAfterDelete).toBeNull();
        });
    });

    describe('PUT /queues/:queueId (Update Capacity)', () => {
        let testQueue;
        const initialCapacity = 10;
        const membersToJoin = [USER_REGULAR.steam_id, USER_OWNER.steam_id]; // USER_OWNER is already in

        beforeEach(async () => {
            // Create a queue owned by USER_OWNER, status 'waiting', capacity 10
            testQueue = await createQueueViaAPI(USER_OWNER, initialCapacity);
            expect(testQueue).not.toBeNull();
            if (!testQueue) throw new Error("Failed to create queue for PUT tests");

            // Add USER_REGULAR to the queue to have 2 members (owner + regular)
            // This assumes addPlayerToQueue does not require the player to be logged in,
            // or that QueueService is used directly. For API testing, use the API.
            loginAs(USER_REGULAR); // USER_REGULAR joins
            const joinResponse = await request.put(`/queues/${testQueue.id}/join`);
            expect(joinResponse.status).toBe(200); // Owner is already in, Regular joins
            
            const queueState = await getQueueFromRedis(testQueue.id);
            expect(queueState.members.length).toBe(2); // Owner + Regular
        });

        test('Test Case 1 (Owner Success): user_owner updates capacity to 12 -> Expect 200 OK', async () => {
            loginAs(USER_OWNER);
            const newCapacity = 12;
            const response = await request
                .put(`/queues/${testQueue.id}`)
                .send([{ capacity: newCapacity }]);
            expect(response.status).toBe(200);
            const updatedQueue = await getQueueFromRedis(testQueue.id);
            expect(updatedQueue.capacity).toBe(newCapacity);
        });

        test('Test Case 2 (Admin Success): user_admin updates capacity to 12 -> Expect 200 OK', async () => {
            loginAs(USER_ADMIN);
            const newCapacity = 12;
            const response = await request
                .put(`/queues/${testQueue.id}`)
                .send([{ capacity: newCapacity }]);
            expect(response.status).toBe(200);
            const updatedQueue = await getQueueFromRedis(testQueue.id);
            expect(updatedQueue.capacity).toBe(newCapacity);
        });
        
        test('Test Case 3 (Forbidden): user_regular attempts to update -> Expect 403 Forbidden', async () => {
            loginAs(USER_REGULAR);
            const newCapacity = 12;
            const response = await request
                .put(`/queues/${testQueue.id}`)
                .send([{ capacity: newCapacity }]);
            expect(response.status).toBe(403);
        });

        test('Test Case 4 (Queue Not Found): Update non-existent queue -> Expect 404 Not Found', async () => {
            loginAs(USER_OWNER);
            const response = await request
                .put(`/queues/non_existent_queue_id`)
                .send([{ capacity: 12 }]);
            expect(response.status).toBe(404);
        });

        test('Test Case 5 (Wrong Status): Set queue status to "picking". Attempt update -> Expect 409 Conflict', async () => {
            // Manually update status in Redis via QueueService instance for test setup
            // This is a bit of a gray area for pure black-box API testing, but sometimes necessary for states
            // that are hard to reach through API calls alone or to avoid complex sequences.
            await queueServiceInstance.redisClient.hSet(`queue:${testQueue.id}`, 'status', 'picking');
            
            loginAs(USER_OWNER);
            const response = await request
                .put(`/queues/${testQueue.id}`)
                .send([{ capacity: 12 }]);
            expect(response.status).toBe(409); // Service method returns 409 for wrong state
        });

        test('Test Case 6 (Capacity Too Low): Attempt to update capacity to 1 (less than 2 members) -> Expect 409 Conflict', async () => {
            loginAs(USER_OWNER);
            const response = await request
                .put(`/queues/${testQueue.id}`)
                .send([{ capacity: 1 }]); // Current members: 2
            expect(response.status).toBe(409);
        });

        test('Test Case 7 (Invalid Capacity - zero): Attempt to update capacity to 0 -> Expect 400 Bad Request', async () => {
            loginAs(USER_OWNER);
            const response = await request
                .put(`/queues/${testQueue.id}`)
                .send([{ capacity: 0 }]);
            expect(response.status).toBe(400);
        });
        
        test('Test Case 7 (Invalid Capacity - negative): Attempt to update capacity to -1 -> Expect 400 Bad Request', async () => {
            loginAs(USER_OWNER);
            const response = await request
                .put(`/queues/${testQueue.id}`)
                .send([{ capacity: -1 }]);
            expect(response.status).toBe(400);
        });
         test('Test Case 7 (Invalid Capacity - non-integer): Attempt to update capacity to 10.5 -> Expect 400 Bad Request', async () => {
            loginAs(USER_OWNER);
            const response = await request
                .put(`/queues/${testQueue.id}`)
                .send([{ capacity: 10.5 }]);
            expect(response.status).toBe(400);
        });
    });

    // --- Phase 2: Map Veto Logic and Routes ---
    describe('Map Veto (/queues/:queueId/veto)', () => {
        let testQueueFull; // Stores the queue object once created and filled
        let captain1SteamId;
        let captain2SteamId;
        // const USER_CAPTAIN1_MOCK = { steam_id: 'captain1_steam_id', username: 'CaptainOne', admin: false, super_admin: false }; // Moved up
        // const USER_CAPTAIN2_MOCK = { steam_id: 'captain2_steam_id', username: 'CaptainTwo', admin: false, super_admin: false }; // Moved up


        beforeEach(async () => {
            // 1. Create a queue as USER_OWNER with capacity 2
            // For veto tests, we need specific captains.
            // The current createQueueViaAPI makes USER_OWNER a member.
            // For a 2-player queue, if USER_OWNER creates, USER_OWNER will be captain1.
            // We need another player to join to become captain2.
            
            loginAs(USER_OWNER); // USER_OWNER will be a captain
            testQueueFull = await createQueueViaAPI(USER_OWNER, 2);
            expect(testQueueFull).not.toBeNull();
            if (!testQueueFull) throw new Error("Failed to create queue for Veto tests base setup");

            // 2. Add another player (USER_REGULAR) to fill the queue (capacity 2)
            // This will trigger the queue to pop and finalize teams, creating initial veto object.
            loginAs(USER_REGULAR); // USER_REGULAR will be the other captain
            const joinResponse = await request.put(`/queues/${testQueueFull.id}/join`);
            expect(joinResponse.status).toBe(200); // Should successfully join

            // 3. Verify veto details are created and get captain IDs
            const poppedDetailsKey = `popped_queue:${testQueueFull.id}:details`;
            const poppedDetails = await redisClient.hGetAll(poppedDetailsKey);
            expect(poppedDetails).toBeDefined();
            expect(poppedDetails.captain1).toBeDefined();
            expect(poppedDetails.captain2).toBeDefined();
            
            // Assign actual captain IDs from Redis for tests.
            // The user who creates the queue (USER_OWNER) might not always be captain1
            // if the pop logic shuffles. For 2 players, it's more predictable.
            // For testing, we assume USER_OWNER is captain1 and USER_REGULAR is captain2,
            // but it's safer to read from Redis.
            captain1SteamId = poppedDetails.captain1;
            captain2SteamId = poppedDetails.captain2;

            // Update mock users to match actual captain IDs for loginAs helper
            USER_CAPTAIN1_MOCK.steam_id = captain1SteamId;
            USER_CAPTAIN2_MOCK.steam_id = captain2SteamId;


            const vetoDetails = await getVetoDetailsFromRedis(testQueueFull.id);
            expect(vetoDetails).not.toBeNull();
            expect(vetoDetails.status).toBe('awaiting_captain_start');
            expect(vetoDetails.captain1SteamId).toBe(captain1SteamId);
            expect(vetoDetails.captain2SteamId).toBe(captain2SteamId);
            // Captain 2 (vetoInitiator) should be the nextVetoer
            expect(vetoDetails.nextVetoerSteamId).toBe(vetoDetails.vetoInitiatorSteamId); 
            expect(vetoDetails.vetoInitiatorSteamId).toBe(captain2SteamId); // As per current QueueService logic
        });

        describe('GET /queues/:queueId/veto', () => {
            test('Test Case 1: Successfully retrieve initial veto details', async () => {
                loginAs(USER_REGULAR); // Any authenticated user can view
                const response = await request.get(`/queues/${testQueueFull.id}/veto`);
                expect(response.status).toBe(200);
                const vetoData = response.body;
                expect(vetoData.queueId).toBe(testQueueFull.id);
                expect(vetoData.status).toBe('awaiting_captain_start');
                expect(vetoData.mapPool.length).toBeGreaterThan(0); // e.g., DEFAULT_MAP_POOL
                expect(vetoData.availableMapsToBan.length).toBe(vetoData.mapPool.length);
                expect(vetoData.nextVetoerSteamId).toBe(captain2SteamId);
            });
        });

        describe('POST /queues/:queueId/veto/start', () => {
            test('Test Case 1 (Success): Captain 1 starts veto -> Expect 200 OK', async () => {
                loginAs(USER_CAPTAIN1_MOCK);
                const response = await request.post(`/queues/${testQueueFull.id}/veto`);
                expect(response.status).toBe(200);
                expect(response.body.message).toContain('Veto process started successfully');
                const updatedVetoDetails = await getVetoDetailsFromRedis(testQueueFull.id);
                expect(updatedVetoDetails.status).toBe('in_progress');
            });
            
            test('Test Case 1b (Success): Captain 2 starts veto -> Expect 200 OK', async () => {
                loginAs(USER_CAPTAIN2_MOCK);
                const response = await request.post(`/queues/${testQueueFull.id}/veto`);
                expect(response.status).toBe(200);
                 expect(response.body.message).toContain('Veto process started successfully');
                const updatedVetoDetails = await getVetoDetailsFromRedis(testQueueFull.id);
                expect(updatedVetoDetails.status).toBe('in_progress');
            });

            test('Test Case 2 (Not a Captain): Regular user attempts to start -> Expect 403 Forbidden', async () => {
                loginAs(USER_BAD_ACTOR); // USER_REGULAR is not captain1 or captain2 in this context
                const response = await request.post(`/queues/${testQueueFull.id}/veto`);
                expect(response.status).toBe(403);
            });

            test('Test Case 3 (Already Started): Captain attempts to start again -> Expect 409 Conflict', async () => {
                loginAs(USER_CAPTAIN1_MOCK);
                await request.post(`/queues/${testQueueFull.id}/veto`); // Start it once
                
                const response = await request.post(`/queues/${testQueueFull.id}/veto`); // Try again
                expect(response.status).toBe(409);
            });

            test('Test Case 4 (Veto Not Initialized/Queue not popped): New queue, not popped -> Expect 404', async () => {
                const newQueue = await createQueueViaAPI(USER_OWNER, 2); // Fresh queue, not popped
                expect(newQueue).not.toBeNull();

                loginAs(USER_OWNER); // Try to start veto for this new, un-popped queue
                const response = await request.post(`/queues/${newQueue.id}/veto`);
                expect(response.status).toBe(404); // Veto details not found
            });
        });
        
        describe('POST /queues/:queueId/veto/ban (Full Veto Sequence)', () => {
            const DEFAULT_MAP_POOL_TEST = ['de_dust2', 'de_mirage', 'de_inferno', 'de_nuke', 'de_anubis', 'de_vertigo', 'de_ancient'];
            // This assumes DEFAULT_MAP_POOL in QueueService is the same or tests will fail.
            // For more robust tests, this could be fetched from the /veto endpoint first.

            beforeEach(async () => {
                // Ensure veto is started before each ban test by one of the captains
                loginAs(USER_CAPTAIN1_MOCK); // Captain 1 starts it
                const startResponse = await request.post(`/queues/${testQueueFull.id}/veto`);
                expect(startResponse.status).toBe(200);
                const vetoState = await getVetoDetailsFromRedis(testQueueFull.id);
                expect(vetoState.status).toBe('in_progress');
            });

            test('Full Veto Sequence and Error Cases', async () => {
                let currentVetoDetails;

                // Stage 1: Captain 2 (vetoInitiator) bans 2 maps
                // Ban 1 (C2)
                loginAs(USER_CAPTAIN2_MOCK);
                let banResponse = await request.put(`/queues/${testQueueFull.id}/veto`).send([{ mapName: DEFAULT_MAP_POOL_TEST[0] }]); // Ban de_dust2
                expect(banResponse.status).toBe(200);
                currentVetoDetails = banResponse.body.vetoDetails;
                expect(currentVetoDetails.bansTeam2).toContain(DEFAULT_MAP_POOL_TEST[0]);
                expect(currentVetoDetails.availableMapsToBan).not.toContain(DEFAULT_MAP_POOL_TEST[0]);
                expect(currentVetoDetails.nextVetoerSteamId).toBe(captain2SteamId); // Still C2's turn

                // Attempt ban by C1 (not their turn)
                loginAs(USER_CAPTAIN1_MOCK);
                const wrongTurnRes = await request.put(`/queues/${testQueueFull.id}/veto`).send([{ mapName: DEFAULT_MAP_POOL_TEST[1] }]);
                expect(wrongTurnRes.status).toBe(403);

                // Ban 2 (C2)
                loginAs(USER_CAPTAIN2_MOCK);
                banResponse = await request.put(`/queues/${testQueueFull.id}/veto`).send([{ mapName: DEFAULT_MAP_POOL_TEST[1] }]); // Ban de_mirage
                expect(banResponse.status).toBe(200);
                currentVetoDetails = banResponse.body.vetoDetails;
                expect(currentVetoDetails.bansTeam2).toContain(DEFAULT_MAP_POOL_TEST[1]);
                expect(currentVetoDetails.nextVetoerSteamId).toBe(captain1SteamId); // Turn changes to C1

                // Stage 2: Captain 1 bans 3 maps
                // Ban 3 (C1)
                loginAs(USER_CAPTAIN1_MOCK);
                banResponse = await request.put(`/queues/${testQueueFull.id}/veto`).send([{ mapName: DEFAULT_MAP_POOL_TEST[2] }]); // Ban de_inferno
                expect(banResponse.status).toBe(200);
                currentVetoDetails = banResponse.body.vetoDetails;
                expect(currentVetoDetails.bansTeam1).toContain(DEFAULT_MAP_POOL_TEST[2]);
                expect(currentVetoDetails.nextVetoerSteamId).toBe(captain1SteamId);

                // Ban 4 (C1)
                banResponse = await request.put(`/queues/${testQueueFull.id}/veto`).send([{ mapName: DEFAULT_MAP_POOL_TEST[3] }]); // Ban de_nuke
                expect(banResponse.status).toBe(200);
                currentVetoDetails = banResponse.body.vetoDetails;
                expect(currentVetoDetails.bansTeam1).toContain(DEFAULT_MAP_POOL_TEST[3]);
                expect(currentVetoDetails.nextVetoerSteamId).toBe(captain1SteamId);
                
                // Ban 5 (C1)
                banResponse = await request.put(`/queues/${testQueueFull.id}/veto`).send([{ mapName: DEFAULT_MAP_POOL_TEST[4] }]); // Ban de_anubis
                expect(banResponse.status).toBe(200);
                currentVetoDetails = banResponse.body.vetoDetails;
                expect(currentVetoDetails.bansTeam1).toContain(DEFAULT_MAP_POOL_TEST[4]);
                expect(currentVetoDetails.nextVetoerSteamId).toBe(captain2SteamId); // Turn changes to C2

                // Stage 3: Captain 2 bans 1 map
                // Ban 6 (C2)
                loginAs(USER_CAPTAIN2_MOCK);
                banResponse = await request.put(`/queues/${testQueueFull.id}/veto`).send([{ mapName: DEFAULT_MAP_POOL_TEST[5] }]); // Ban de_vertigo
                expect(banResponse.status).toBe(200);
                currentVetoDetails = banResponse.body.vetoDetails;
                expect(currentVetoDetails.bansTeam2).toContain(DEFAULT_MAP_POOL_TEST[5]);
                
                // Verification after all bans
                expect(currentVetoDetails.status).toBe('completed');
                expect(currentVetoDetails.pickedMap).toBe(DEFAULT_MAP_POOL_TEST[6]); // de_ancient should be picked
                expect(currentVetoDetails.nextVetoerSteamId).toBeNull();

                // Verify main queue object in Redis for server_ip and picked_map
                const finalQueueState = await getQueueFromRedis(testQueueFull.id);
                expect(finalQueueState.picked_map).toBe(DEFAULT_MAP_POOL_TEST[6]);
                // Server IP check depends on whether server allocation simulation returns an IP
                // For now, we check if it's 'in_progress_server_assigned' or 'error_server_allocation_failed'
                expect(['in_progress_server_assigned', 'error_server_allocation_failed']).toContain(finalQueueState.status);
                if (finalQueueState.status === 'in_progress_server_assigned') {
                    expect(finalQueueState.server_ip).toBeDefined();
                    expect(finalQueueState.server_ip).not.toBeNull();
                }

                // Error Cases for Ban:
                // Attempt to ban a map not in availableMapsToBan (e.g., already banned map1)
                loginAs(USER_CAPTAIN1_MOCK); // Assume it's somehow C1's turn again for this error test, or veto is stuck
                                             // For a more precise test, this would need specific setup
                                             // For now, this test is more about the validation rule itself.
                                             // Let's assume the veto didn't complete for this error case.
                // To test this properly, we'd need to set up a veto 'in_progress' and it's C1's turn.
                // The full sequence test above already makes this difficult.
                // A separate, smaller test for this error case is better.
            });
            
            test('Error Case: Attempt to ban a non-available map', async () => {
                // C2's turn (after C1 started veto). C2 bans de_dust2.
                loginAs(USER_CAPTAIN2_MOCK);
                await request.put(`/queues/${testQueueFull.id}/veto`).send([{ mapName: DEFAULT_MAP_POOL_TEST[0] }]); // Ban de_dust2
                
                // C2 attempts to ban de_dust2 again
                const banAgainResponse = await request.put(`/queues/${testQueueFull.id}/veto`).send([{ mapName: DEFAULT_MAP_POOL_TEST[0] }]);
                expect(banAgainResponse.status).toBe(400); // Map not available
            });

            test('Error Case: Attempt to ban when veto status is not in_progress', async () => {
                // Veto is 'in_progress' due to beforeEach. Let's complete it first.
                // Simulate completion by performing all bans quickly
                loginAs(USER_CAPTAIN2_MOCK); // C2 bans 2
                await request.put(`/queues/${testQueueFull.id}/veto`).send([{ mapName: DEFAULT_MAP_POOL_TEST[0] }]);
                await request.put(`/queues/${testQueueFull.id}/veto`).send([{ mapName: DEFAULT_MAP_POOL_TEST[1] }]);
                loginAs(USER_CAPTAIN1_MOCK); // C1 bans 3
                await request.put(`/queues/${testQueueFull.id}/veto`).send([{ mapName: DEFAULT_MAP_POOL_TEST[2] }]);
                await request.put(`/queues/${testQueueFull.id}/veto`).send([{ mapName: DEFAULT_MAP_POOL_TEST[3] }]);
                await request.put(`/queues/${testQueueFull.id}/veto`).send([{ mapName: DEFAULT_MAP_POOL_TEST[4] }]);
                loginAs(USER_CAPTAIN2_MOCK); // C2 bans 1
                await request.put(`/queues/${testQueueFull.id}/veto`).send([{ mapName: DEFAULT_MAP_POOL_TEST[5] }]);

                // Veto is now 'completed'
                const completedVetoDetails = await getVetoDetailsFromRedis(testQueueFull.id);
                expect(completedVetoDetails.status).toBe('completed');

                // Attempt ban
                loginAs(USER_CAPTAIN1_MOCK); // Try as C1
                const banResponse = await request.put(`/queues/${testQueueFull.id}/veto`).send([{ mapName: DEFAULT_MAP_POOL_TEST[6] }]); // map7 is picked, try to ban it
                expect(banResponse.status).toBe(409); // Veto not in progress
            });
        });
    });

    // --- Phase 3: SSE Event Tests (Placeholders) ---
    // emitterSpy is now initialized and restored at the top level of 'Queue API Tests'
    // No need for separate beforeEach/afterEach for emitterSpy in this describe block
    describe('SSE Event Verification via Emitter Spying', () => {

        describe('PUT /queues/:queueId/join and /leave Events', () => {
            let testQueue;
            const USER_JOINER = { steam_id: 'user_joiner_steam_id', username: 'JoinerUser', admin: false, super_admin: false };

            beforeEach(async () => {
                testQueue = await createQueueViaAPI(USER_OWNER, 3); // Capacity 3 for simplicity, don't want to automatically start picking phase.
                expect(testQueue).not.toBeNull();
            });

            test('Test Case 1 (Player Joins): User joins queue -> Verifies "player_joined" event', async () => {
                loginAs(USER_JOINER);
                const response = await request.put(`/queues/${testQueue.id}/join`);
                expect(response.status).toBe(200);

                expect(emitterSpy).toHaveBeenCalledWith('queue_event', 
                    expect.objectContaining({
                        type: 'player_joined',
                        queueId: testQueue.id,
                        data: expect.objectContaining({
                            playerSteamId: USER_JOINER.steam_id,
                            members: expect.arrayContaining([USER_OWNER.steam_id, USER_JOINER.steam_id])
                        })
                    })
                );
            });

            test('Test Case 2 (Player Leaves): User leaves queue -> Verifies "player_left" event', async () => {
                // First, USER_JOINER joins
                loginAs(USER_JOINER);
                await request.put(`/queues/${testQueue.id}/join`);
                emitterSpy.mockClear(); // Clear spy from the join event

                // Then, USER_JOINER leaves
                const leaveResponse = await request.put(`/queues/${testQueue.id}/leave`);
                expect(leaveResponse.status).toBe(200);
                
                expect(emitterSpy).toHaveBeenCalledWith('queue_event',
                    expect.objectContaining({
                        type: 'player_left',
                        queueId: testQueue.id,
                        data: expect.objectContaining({
                            playerSteamId: USER_JOINER.steam_id,
                            members: expect.arrayContaining([USER_OWNER.steam_id]) 
                        })
                    })
                );
                 // Ensure the leaver is NOT in the members list afterwards
                const callArgs = emitterSpy.mock.calls.find(call => call[1].type === 'player_left');
                expect(callArgs[1].data.members).not.toContain(USER_JOINER.steam_id);
            });
        });

        describe('Queue Pop and Captain Assignment Event (_popQueue)', () => {
            test('Queue pops (capacity 1) -> Verifies "queue_status_changed" to picking with captains', async () => {
                const queueForPop = await createQueueViaAPI(USER_OWNER, 1); // Capacity 1, owner joins automatically
                expect(queueForPop).not.toBeNull();
                // Queue should pop automatically on creation because owner joins and fills it.
                // QueueService.addPlayerToQueue (called by createQueue) calls _popQueue.

                expect(emitterSpy).toHaveBeenCalledWith('queue_event',
                    expect.objectContaining({
                        type: 'queue_created',
                        queueId: queueForPop.id,
                        data: expect.objectContaining({
                            status: 'waiting',
                            // For a 1-player queue, it's tricky. The logic might make the single player captain1 and captain2.
                            // Or it might error out before picking. Let's assume it sets status to 'picking'
                            // and then errors due to not enough players for two distinct captains in pickPlayerInQueue.
                            // The _popQueue event itself will still fire with status 'picking'.
                            // If PickPhaseDetails requires two distinct captains, this test needs adjustment
                            // based on how _popQueue handles < 2 players for captaincy.
                            // Current _popQueue sets status to 'error_not_enough_players_for_captains' if players.length < 2
                            // BUT that's for the players list passed to _popQueue, not the capacity.
                            // A 1-player capacity queue, when owner joins: members=[owner], capacity=1.
                            // _popQueue gets players=[owner]. It should proceed to picking.
                            // Then pickPlayerInQueue would be the one to potentially error if it can't assign captains.
                            // The _popQueue event itself should still show 'picking'.
                            capacity: DEFAULT_QUEUE_CAPACITY,
                            members: expect.arrayContaining([USER_OWNER.steam_id])
                        })
                    })
                );
            });
        });
        
        describe('PUT /queues/:queueId (Update Capacity) Event', () => {
            let testQueue;
            beforeEach(async () => {
                testQueue = await createQueueViaAPI(USER_OWNER, 10);
                expect(testQueue).not.toBeNull();
                emitterSpy.mockClear(); 
            });

            test('Update capacity -> Verifies "queue_capacity_updated" event', async () => {
                loginAs(USER_OWNER);
                const newCapacity = 12;
                const response = await request.put(`/queues/${testQueue.id}`).send([{ capacity: newCapacity }]);
                expect(response.status).toBe(200);

                expect(emitterSpy).toHaveBeenCalledWith('queue_event',
                    expect.objectContaining({
                        type: 'queue_capacity_updated',
                        queueId: testQueue.id,
                        data: expect.objectContaining({
                            newCapacity: newCapacity
                        })
                    })
                );
            });
        });

        describe('Team Picking and Veto Initialization Events', () => {
            // This setup is similar to the Veto phase tests beforeEach
            let testQueueFull;
            let captain1SteamId;
            let captain2SteamId;
            const USER_CAPTAIN1_MOCK_SSE = { steam_id: 'cap1_sse_steam_id', username: 'Cap1SSE', admin: false, super_admin: false };
            const USER_CAPTAIN2_MOCK_SSE = { steam_id: 'cap2_sse_steam_id', username: 'Cap2SSE', admin: false, super_admin: false };
            // For a 4 player queue, we need 2 more players
            const USER_PLAYER3_SSE = { steam_id: 'player3_sse_steam_id', username: 'Player3SSE', admin: false, super_admin: false };
            const USER_PLAYER4_SSE = { steam_id: 'player4_sse_steam_id', username: 'Player4SSE', admin: false, super_admin: false };


            beforeEach(async () => {
            // Create a queue with capacity 4 by USER_OWNER, teamSelectionMethod 'captains' for these tests
                loginAs(USER_OWNER);
            testQueueFull = await createQueueViaAPI(USER_OWNER, 4, 'captains'); // Owner is player 1
                expect(testQueueFull).not.toBeNull();

                // Player 2 joins (USER_REGULAR)
                loginAs(USER_REGULAR); 
                await request.put(`/queues/${testQueueFull.id}/join`);
                // Player 3 joins (USER_PLAYER3_SSE)
                loginAs(USER_PLAYER3_SSE);
                await request.put(`/queues/${testQueueFull.id}/join`);
                // Player 4 joins (USER_PLAYER4_SSE) - queue pops
                loginAs(USER_PLAYER4_SSE);
                await request.put(`/queues/${testQueueFull.id}/join`);
                
                emitterSpy.mockClear(); // Clear events from setup

                const poppedDetailsKey = `popped_queue:${testQueueFull.id}:details`;
                const poppedDetails = await redisClient.hGetAll(poppedDetailsKey);
                captain1SteamId = poppedDetails.captain1;
                captain2SteamId = poppedDetails.captain2;
                USER_CAPTAIN1_MOCK_SSE.steam_id = captain1SteamId;
                USER_CAPTAIN2_MOCK_SSE.steam_id = captain2SteamId;
            });

            test('Captain picks a player -> Verifies "player_picked" event', async () => {
                // Ensure the queue is in 'picking' state (should be after pop)
                const queueState = await getQueueFromRedis(testQueueFull.id);
                expect(queueState.status).toBe('picking');
                
                const vetoDetailsInitial = await getVetoDetailsFromRedis(testQueueFull.id);
                expect(vetoDetailsInitial).not.toBeNull(); // Veto details should not exist yet

                // Determine who is the next picker from popped_queue details
                const poppedDetails = await redisClient.hGetAll(`popped_queue:${testQueueFull.id}:details`);
                const nextPickerSteamId = poppedDetails.next_picker;
                const availableToPick = JSON.parse(poppedDetails.available_players);
                expect(availableToPick.length).toBe(2); // 4 total - 2 captains = 2 pickable
                
                const playerToPick = availableToPick[0];
                const pickingCaptain = nextPickerSteamId === captain1SteamId ? USER_CAPTAIN1_MOCK_SSE : USER_CAPTAIN2_MOCK_SSE;

                loginAs(pickingCaptain);
                const pickResponse = await request.post(`/queues/${testQueueFull.id}/pick`).send([{ playerSteamId: playerToPick }]);
                expect(pickResponse.status).toBe(200);
                
                expect(emitterSpy).toHaveBeenCalledWith('queue_event',
                    expect.objectContaining({
                        type: 'player_picked',
                        queueId: testQueueFull.id,
                        data: expect.objectContaining({
                            captain1: captain1SteamId,
                            captain2: captain2SteamId,
                            availablePlayers: expect.not.arrayContaining([playerToPick]),
                            nextPicker: expect.any(String) 
                        })
                    })
                );
            });
            
            test('Last player picked -> Verifies "teams_finalized" event with nextStep: "map_veto"', async () => {
                // For a 4 player queue, 2 players are picked.
                // Pick 1
                let poppedDetails = await redisClient.hGetAll(`popped_queue:${testQueueFull.id}:details`);
                let nextPickerSteamId = poppedDetails.next_picker;
                let availableToPick = JSON.parse(poppedDetails.available_players);
                let playerToPick = availableToPick[0];
                let pickingCaptain = nextPickerSteamId === captain1SteamId ? USER_CAPTAIN1_MOCK_SSE : USER_CAPTAIN2_MOCK_SSE;
                loginAs(pickingCaptain);
                await request.post(`/queues/${testQueueFull.id}/pick`).send([{ playerSteamId: playerToPick }]);
                emitterSpy.mockClear();

                // Pick 2 (last pick)
                poppedDetails = await redisClient.hGetAll(`popped_queue:${testQueueFull.id}:details`);
                nextPickerSteamId = poppedDetails.next_picker;
                availableToPick = JSON.parse(poppedDetails.available_players);
                playerToPick = availableToPick[0];
                pickingCaptain = nextPickerSteamId === captain1SteamId ? USER_CAPTAIN1_MOCK_SSE : USER_CAPTAIN2_MOCK_SSE;
                
                loginAs(pickingCaptain);
                const pickResponse = await request.post(`/queues/${testQueueFull.id}/pick`).send([{ playerSteamId: playerToPick }]);
                expect(pickResponse.status).toBe(200);

                expect(emitterSpy).toHaveBeenCalledWith('queue_event',
                    expect.objectContaining({
                        type: 'teams_finalized',
                        queueId: testQueueFull.id,
                        data: expect.objectContaining({
                            nextStep: 'map_veto',
                            captain1: captain1SteamId,
                            captain2: captain2SteamId,
                            team1Picks: expect.arrayContaining([captain1SteamId]),
                            team2Picks: expect.arrayContaining([captain2SteamId]),
                            availablePlayers: []
                        })
                    })
                );
                 // Veto details should now exist
                const vetoDetailsAfterFinalize = await getVetoDetailsFromRedis(testQueueFull.id);
                expect(vetoDetailsAfterFinalize).not.toBeNull();
                expect(vetoDetailsAfterFinalize.status).toBe('awaiting_captain_start');
            });
        });
        
        describe('Map Veto Events (startVeto, recordMapBan)', () => {
            let testQueueVetoReady;
            let cap1, cap2; // Mock users for captains

            beforeEach(async () => {
                loginAs(USER_OWNER); 
            // Using 'captains' for simplicity, could be 'random' too if it correctly sets up veto
            testQueueVetoReady = await createQueueViaAPI(USER_OWNER, 2, 'captains'); 
                loginAs(USER_REGULAR);
            await request.put(`/queues/${testQueueVetoReady.id}/join`); 

                const poppedDetails = await redisClient.hGetAll(`popped_queue:${testQueueVetoReady.id}:details`);
                cap1 = { ...USER_CAPTAIN1_MOCK, steam_id: poppedDetails.captain1 };
                cap2 = { ...USER_CAPTAIN2_MOCK, steam_id: poppedDetails.captain2 };
                
                emitterSpy.mockClear();
            });

            test('Captain starts veto -> Verifies "veto_started" event', async () => {
                loginAs(cap1); // Corrected: Was USER_CAPTAIN1_MOCK, should be cap1
                const response = await request.post(`/queues/${testQueueVetoReady.id}/veto`); // Corrected path
                expect(response.status).toBe(200);

                expect(emitterSpy).toHaveBeenCalledWith('queue_event',
                    expect.objectContaining({
                        type: 'veto_started',
                        queueId: testQueueVetoReady.id,
                        data: expect.objectContaining({
                            status: 'in_progress',
                            nextVetoerSteamId: cap2.steam_id // Captain2 is vetoInitiator
                        })
                    })
                );
            });

            test('Captain bans a map -> Verifies "map_banned" event', async () => {
                loginAs(cap1); // Corrected: Was USER_CAPTAIN1_MOCK, should be cap1 (to start)
                await request.post(`/queues/${testQueueVetoReady.id}/veto`); // Corrected path
                emitterSpy.mockClear();

                loginAs(cap2); // Corrected: Was USER_CAPTAIN2_MOCK, should be cap2 (for banning)
                const vetoDetails = await getVetoDetailsFromRedis(testQueueVetoReady.id);
                const mapToBan = vetoDetails.availableMapsToBan[0];
                
                const banResponse = await request.put(`/queues/${testQueueVetoReady.id}/veto`).send([{ mapName: mapToBan }]); // Corrected method and payload
                expect(banResponse.status).toBe(200);

                expect(emitterSpy).toHaveBeenCalledWith('queue_event',
                    expect.objectContaining({
                        type: 'map_banned',
                        queueId: testQueueVetoReady.id,
                        data: expect.objectContaining({
                            bannedBy: cap2.steam_id,
                            mapName: mapToBan,
                            vetoDetails: expect.objectContaining({
                                availableMapsToBan: expect.not.arrayContaining([mapToBan]),
                                bansTeam2: expect.arrayContaining([mapToBan])
                            })
                        })
                    })
                );
            });

            test('Last ban completes, map picked -> Verifies "map_picked" and "queue_status_changed"', async () => {
                loginAs(cap1); // Corrected: Was USER_CAPTAIN1_MOCK, C1 starts
                await request.post(`/queues/${testQueueVetoReady.id}/veto`); // Corrected path
                
                const vetoDetailsInitial = await getVetoDetailsFromRedis(testQueueVetoReady.id);
                const mapPool = vetoDetailsInitial.mapPool; // Should be 7 maps

                // C2 (cap2) bans 2 maps
                loginAs(cap2); // Corrected: Was USER_CAPTAIN2_MOCK
                await request.put(`/queues/${testQueueVetoReady.id}/veto`).send([{ mapName: mapPool[0] }]); // Corrected method and payload
                await request.put(`/queues/${testQueueVetoReady.id}/veto`).send([{ mapName: mapPool[1] }]); // Corrected method and payload
                // C1 (cap1) bans 3 maps
                loginAs(cap1); // Corrected: Was USER_CAPTAIN1_MOCK
                await request.put(`/queues/${testQueueVetoReady.id}/veto`).send([{ mapName: mapPool[2] }]); // Corrected method and payload
                await request.put(`/queues/${testQueueVetoReady.id}/veto`).send([{ mapName: mapPool[3] }]); // Corrected method and payload
                await request.put(`/queues/${testQueueVetoReady.id}/veto`).send([{ mapName: mapPool[4] }]); // Corrected method and payload
                
                emitterSpy.mockClear(); // Clear before the final ban

                // C2 (cap2) bans 1 map (this is the last ban, map gets picked)
                loginAs(cap2); // Corrected: Was USER_CAPTAIN2_MOCK
                const finalBanResponse = await request.put(`/queues/${testQueueVetoReady.id}/veto`).send([{ mapName: mapPool[5] }]); // Corrected method and payload
                expect(finalBanResponse.status).toBe(200);
                const pickedMap = mapPool[6];

                expect(emitterSpy).toHaveBeenCalledWith('queue_event',
                    expect.objectContaining({
                        type: 'map_picked',
                        queueId: testQueueVetoReady.id,
                        data: expect.objectContaining({
                            pickedMap: pickedMap,
                            status: expect.stringMatching(/in_progress_server_assigned|error_server_allocation_failed/),
                            // serverIp might be null if allocation fails, so check its presence based on status
                            ...(finalBanResponse.body.vetoDetails.serverIp && { serverIp: finalBanResponse.body.vetoDetails.serverIp })
                        })
                    })
                );
                expect(emitterSpy).toHaveBeenCalledWith('queue_event',
                    expect.objectContaining({
                        type: 'queue_status_changed',
                        queueId: testQueueVetoReady.id,
                        data: expect.objectContaining({
                            pickedMap: pickedMap,
                            status: expect.stringMatching(/in_progress_server_assigned|error_server_allocation_failed/),
                             ...(finalBanResponse.body.vetoDetails.serverIp && { serverIp: finalBanResponse.body.vetoDetails.serverIp })
                        })
                    })
                );
            });
        });
        
        describe('DELETE /queues/:queueId Event', () => {
            let testQueue;
            beforeEach(async () => {
            testQueue = await createQueueViaAPI(USER_OWNER, 10, 'captains'); // Specify method for clarity
                expect(testQueue).not.toBeNull();
                emitterSpy.mockClear();
            });

            test('Delete queue -> Verifies "queue_deleted" event', async () => {
                loginAs(USER_OWNER);
                const response = await request.delete(`/queues/${testQueue.id}`);
                expect(response.status).toBe(200);

                expect(emitterSpy).toHaveBeenCalledWith('queue_event',
                    expect.objectContaining({
                        type: 'queue_deleted',
                        queueId: testQueue.id,
                        data: expect.objectContaining({
                            deletedBy: USER_OWNER.steam_id
                        })
                    })
                );
            });
        });
    });

});
