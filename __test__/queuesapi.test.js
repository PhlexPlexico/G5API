// JULES_VERIFICATION_TEST_COMMENT_20240315_100500
import { jest } from '@jest/globals';
import supertest from 'supertest';
import { createClient } from 'redis';
import passport from 'passport';
import MockStrategy from '../src/utility/mockstrategy.js'; // Assuming path to mockStrategy
import app from '../app.js'; // Assuming Express app is exported from here
import QueueService from '../src/services/queueservice.js'; // For potential setup/teardown or direct interaction

const request = supertest(app);

// Mock Users
const USER_REGULAR = { steam_id: 'user_regular_steam_id', username: 'RegularUser', admin: false, super_admin: false };
const USER_OWNER = { steam_id: 'user_owner_steam_id', username: 'QueueOwner', admin: false, super_admin: false };
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
        const testRedisUrl = process.env.TEST_REDIS_URL || 'redis://:super_secure@localhost:6379/1'; // Use a dedicated test DB
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

const createQueueViaAPI = async (user, capacity = 10) => {
    loginAs(user);
    const response = await request
        .post('/queues')
        .send([{ capacity: capacity }]) // Corrected: API expects an array: req.body[0].capacity
        .set('Accept', 'application/json');
    if (response.status === 201) {
        return response.body; // The created queue object
    }
    console.error('Error creating queue via API for test setup:', response.body, user);
    return null;
};


describe('Queue API Tests', () => {
    beforeAll(async () => {
        const testRedisUrl = process.env.TEST_REDIS_URL || 'redis://:super_secure@localhost:6379/1'; // Use a dedicated test DB
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
    });

    beforeEach(async () => {
        if (redisClient && redisClient.isOpen) {
        console.log('[Test Cleanup] Attempting to clear Redis data...');
        
        const queueKeys = await redisClient.keys('queue:*');
        if (queueKeys.length > 0) {
        console.log(`[Test Cleanup] Deleting queue keys: ${queueKeys.join(', ')}`);
        await redisClient.del(queueKeys);
        }
        
        const userOwnedQueuesKeys = await redisClient.keys('user:*:owned_queues');
        if (userOwnedQueuesKeys.length > 0) {
        console.log(`[Test Cleanup] Deleting user owned queues keys: ${userOwnedQueuesKeys.join(', ')}`);
        const delOwnedQueuesCount = await redisClient.del(userOwnedQueuesKeys);
        console.log(`[Test Cleanup] Result of deleting 'queues:active': ${delOwnedQueuesCount}`);
        }
        
        console.log("[Test Cleanup] Attempting to delete 'user:queues:counts' hash...");
        const delUserCountsResult = await redisClient.del('user:queues:counts');
        console.log(`[Test Cleanup] Result of deleting 'user:queues:counts': ${delUserCountsResult}`); // Should be 1 if key existed
        
        console.log("[Test Cleanup] Attempting to delete 'queues:active' set...");
        const delActiveQueuesResult = await redisClient.del('queues:active');
        console.log(`[Test Cleanup] Result of deleting 'queues:active': ${delActiveQueuesResult}`);
        
        const vetoKeys = await redisClient.keys('veto:*');
        if (vetoKeys.length > 0) {
        console.log(`[Test Cleanup] Deleting veto keys: ${vetoKeys.join(', ')}`);
        await redisClient.del(vetoKeys);
        }
        
        const poppedKeys = await redisClient.keys('popped_queue:*');
        if (poppedKeys.length > 0) {
        console.log(`[Test Cleanup] Deleting popped_queue keys: ${poppedKeys.join(', ')}`);
        await redisClient.del(poppedKeys);
        }
        console.log('[Test Cleanup] Redis data clearing attempt complete.');
        } else {
        console.log('[Test Cleanup] Redis client not open or not available in beforeEach.');
        }
    });

    // --- Phase 1: CRUD and Authorization Tests ---

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
                .send({ capacity: newCapacity });
            expect(response.status).toBe(200);
            const updatedQueue = await getQueueFromRedis(testQueue.id);
            expect(updatedQueue.capacity).toBe(newCapacity);
        });

        test('Test Case 2 (Admin Success): user_admin updates capacity to 12 -> Expect 200 OK', async () => {
            loginAs(USER_ADMIN);
            const newCapacity = 12;
            const response = await request
                .put(`/queues/${testQueue.id}`)
                .send({ capacity: newCapacity });
            expect(response.status).toBe(200);
            const updatedQueue = await getQueueFromRedis(testQueue.id);
            expect(updatedQueue.capacity).toBe(newCapacity);
        });
        
        test('Test Case 3 (Forbidden): user_regular attempts to update -> Expect 403 Forbidden', async () => {
            loginAs(USER_REGULAR);
            const newCapacity = 12;
            const response = await request
                .put(`/queues/${testQueue.id}`)
                .send({ capacity: newCapacity });
            expect(response.status).toBe(403);
        });

        test('Test Case 4 (Queue Not Found): Update non-existent queue -> Expect 404 Not Found', async () => {
            loginAs(USER_OWNER);
            const response = await request
                .put(`/queues/non_existent_queue_id`)
                .send({ capacity: 12 });
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
                .send({ capacity: 12 });
            expect(response.status).toBe(409); // Service method returns 409 for wrong state
        });

        test('Test Case 6 (Capacity Too Low): Attempt to update capacity to 1 (less than 2 members) -> Expect 409 Conflict', async () => {
            loginAs(USER_OWNER);
            const response = await request
                .put(`/queues/${testQueue.id}`)
                .send({ capacity: 1 }); // Current members: 2
            expect(response.status).toBe(409);
        });

        test('Test Case 7 (Invalid Capacity - zero): Attempt to update capacity to 0 -> Expect 400 Bad Request', async () => {
            loginAs(USER_OWNER);
            const response = await request
                .put(`/queues/${testQueue.id}`)
                .send({ capacity: 0 });
            expect(response.status).toBe(400);
        });
        
        test('Test Case 7 (Invalid Capacity - negative): Attempt to update capacity to -1 -> Expect 400 Bad Request', async () => {
            loginAs(USER_OWNER);
            const response = await request
                .put(`/queues/${testQueue.id}`)
                .send({ capacity: -1 });
            expect(response.status).toBe(400);
        });
         test('Test Case 7 (Invalid Capacity - non-integer): Attempt to update capacity to 10.5 -> Expect 400 Bad Request', async () => {
            loginAs(USER_OWNER);
            const response = await request
                .put(`/queues/${testQueue.id}`)
                .send({ capacity: 10.5 });
            expect(response.status).toBe(400);
        });
    });

    // --- Phase 2: Map Veto Logic and Routes ---
    describe('Map Veto (/queues/:queueId/veto)', () => {
        let testQueueFull; // Stores the queue object once created and filled
        let captain1SteamId;
        let captain2SteamId;
        const USER_CAPTAIN1_MOCK = { steam_id: 'captain1_steam_id', username: 'CaptainOne', admin: false, super_admin: false };
        const USER_CAPTAIN2_MOCK = { steam_id: 'captain2_steam_id', username: 'CaptainTwo', admin: false, super_admin: false };


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
                const response = await request.post(`/queues/${testQueueFull.id}/veto/start`);
                expect(response.status).toBe(200);
                expect(response.body.message).toContain('Veto process started successfully');
                const updatedVetoDetails = await getVetoDetailsFromRedis(testQueueFull.id);
                expect(updatedVetoDetails.status).toBe('in_progress');
            });
            
            test('Test Case 1b (Success): Captain 2 starts veto -> Expect 200 OK', async () => {
                loginAs(USER_CAPTAIN2_MOCK);
                const response = await request.post(`/queues/${testQueueFull.id}/veto/start`);
                expect(response.status).toBe(200);
                 expect(response.body.message).toContain('Veto process started successfully');
                const updatedVetoDetails = await getVetoDetailsFromRedis(testQueueFull.id);
                expect(updatedVetoDetails.status).toBe('in_progress');
            });

            test('Test Case 2 (Not a Captain): Regular user attempts to start -> Expect 403 Forbidden', async () => {
                loginAs(USER_REGULAR); // USER_REGULAR is not captain1 or captain2 in this context
                const response = await request.post(`/queues/${testQueueFull.id}/veto/start`);
                expect(response.status).toBe(403);
            });

            test('Test Case 3 (Already Started): Captain attempts to start again -> Expect 409 Conflict', async () => {
                loginAs(USER_CAPTAIN1_MOCK);
                await request.post(`/queues/${testQueueFull.id}/veto/start`); // Start it once
                
                const response = await request.post(`/queues/${testQueueFull.id}/veto/start`); // Try again
                expect(response.status).toBe(409);
            });

            test('Test Case 4 (Veto Not Initialized/Queue not popped): New queue, not popped -> Expect 404', async () => {
                const newQueue = await createQueueViaAPI(USER_OWNER, 2); // Fresh queue, not popped
                expect(newQueue).not.toBeNull();

                loginAs(USER_OWNER); // Try to start veto for this new, un-popped queue
                const response = await request.post(`/queues/${newQueue.id}/veto/start`);
                expect(response.status).toBe(404); // Veto details not found
            });
        });
        
        describe('POST /queues/:queueId/veto/ban (Full Veto Sequence)', () => {
            const DEFAULT_MAP_POOL_TEST = ['de_dust2', 'de_mirage', 'de_inferno', 'de_nuke', 'de_overpass', 'de_vertigo', 'de_ancient'];
            // This assumes DEFAULT_MAP_POOL in QueueService is the same or tests will fail.
            // For more robust tests, this could be fetched from the /veto endpoint first.

            beforeEach(async () => {
                // Ensure veto is started before each ban test by one of the captains
                loginAs(USER_CAPTAIN1_MOCK); // Captain 1 starts it
                const startResponse = await request.post(`/queues/${testQueueFull.id}/veto/start`);
                expect(startResponse.status).toBe(200);
                const vetoState = await getVetoDetailsFromRedis(testQueueFull.id);
                expect(vetoState.status).toBe('in_progress');
            });

            test('Full Veto Sequence and Error Cases', async () => {
                let currentVetoDetails;

                // Stage 1: Captain 2 (vetoInitiator) bans 2 maps
                // Ban 1 (C2)
                loginAs(USER_CAPTAIN2_MOCK);
                let banResponse = await request.post(`/queues/${testQueueFull.id}/veto/ban`).send({ mapName: DEFAULT_MAP_POOL_TEST[0] }); // Ban de_dust2
                expect(banResponse.status).toBe(200);
                currentVetoDetails = banResponse.body.vetoDetails;
                expect(currentVetoDetails.bansTeam2).toContain(DEFAULT_MAP_POOL_TEST[0]);
                expect(currentVetoDetails.availableMapsToBan).not.toContain(DEFAULT_MAP_POOL_TEST[0]);
                expect(currentVetoDetails.nextVetoerSteamId).toBe(captain2SteamId); // Still C2's turn

                // Attempt ban by C1 (not their turn)
                loginAs(USER_CAPTAIN1_MOCK);
                const wrongTurnRes = await request.post(`/queues/${testQueueFull.id}/veto/ban`).send({ mapName: DEFAULT_MAP_POOL_TEST[1] });
                expect(wrongTurnRes.status).toBe(403);

                // Ban 2 (C2)
                loginAs(USER_CAPTAIN2_MOCK);
                banResponse = await request.post(`/queues/${testQueueFull.id}/veto/ban`).send({ mapName: DEFAULT_MAP_POOL_TEST[1] }); // Ban de_mirage
                expect(banResponse.status).toBe(200);
                currentVetoDetails = banResponse.body.vetoDetails;
                expect(currentVetoDetails.bansTeam2).toContain(DEFAULT_MAP_POOL_TEST[1]);
                expect(currentVetoDetails.nextVetoerSteamId).toBe(captain1SteamId); // Turn changes to C1

                // Stage 2: Captain 1 bans 3 maps
                // Ban 3 (C1)
                loginAs(USER_CAPTAIN1_MOCK);
                banResponse = await request.post(`/queues/${testQueueFull.id}/veto/ban`).send({ mapName: DEFAULT_MAP_POOL_TEST[2] }); // Ban de_inferno
                expect(banResponse.status).toBe(200);
                currentVetoDetails = banResponse.body.vetoDetails;
                expect(currentVetoDetails.bansTeam1).toContain(DEFAULT_MAP_POOL_TEST[2]);
                expect(currentVetoDetails.nextVetoerSteamId).toBe(captain1SteamId);

                // Ban 4 (C1)
                banResponse = await request.post(`/queues/${testQueueFull.id}/veto/ban`).send({ mapName: DEFAULT_MAP_POOL_TEST[3] }); // Ban de_nuke
                expect(banResponse.status).toBe(200);
                currentVetoDetails = banResponse.body.vetoDetails;
                expect(currentVetoDetails.bansTeam1).toContain(DEFAULT_MAP_POOL_TEST[3]);
                expect(currentVetoDetails.nextVetoerSteamId).toBe(captain1SteamId);
                
                // Ban 5 (C1)
                banResponse = await request.post(`/queues/${testQueueFull.id}/veto/ban`).send({ mapName: DEFAULT_MAP_POOL_TEST[4] }); // Ban de_overpass
                expect(banResponse.status).toBe(200);
                currentVetoDetails = banResponse.body.vetoDetails;
                expect(currentVetoDetails.bansTeam1).toContain(DEFAULT_MAP_POOL_TEST[4]);
                expect(currentVetoDetails.nextVetoerSteamId).toBe(captain2SteamId); // Turn changes to C2

                // Stage 3: Captain 2 bans 1 map
                // Ban 6 (C2)
                loginAs(USER_CAPTAIN2_MOCK);
                banResponse = await request.post(`/queues/${testQueueFull.id}/veto/ban`).send({ mapName: DEFAULT_MAP_POOL_TEST[5] }); // Ban de_vertigo
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
                await request.post(`/queues/${testQueueFull.id}/veto/ban`).send({ mapName: DEFAULT_MAP_POOL_TEST[0] }); // Ban de_dust2
                
                // C2 attempts to ban de_dust2 again
                const banAgainResponse = await request.post(`/queues/${testQueueFull.id}/veto/ban`).send({ mapName: DEFAULT_MAP_POOL_TEST[0] });
                expect(banAgainResponse.status).toBe(400); // Map not available
            });

            test('Error Case: Attempt to ban when veto status is not in_progress', async () => {
                // Veto is 'in_progress' due to beforeEach. Let's complete it first.
                // Simulate completion by performing all bans quickly
                loginAs(USER_CAPTAIN2_MOCK); // C2 bans 2
                await request.post(`/queues/${testQueueFull.id}/veto/ban`).send({ mapName: DEFAULT_MAP_POOL_TEST[0] });
                await request.post(`/queues/${testQueueFull.id}/veto/ban`).send({ mapName: DEFAULT_MAP_POOL_TEST[1] });
                loginAs(USER_CAPTAIN1_MOCK); // C1 bans 3
                await request.post(`/queues/${testQueueFull.id}/veto/ban`).send({ mapName: DEFAULT_MAP_POOL_TEST[2] });
                await request.post(`/queues/${testQueueFull.id}/veto/ban`).send({ mapName: DEFAULT_MAP_POOL_TEST[3] });
                await request.post(`/queues/${testQueueFull.id}/veto/ban`).send({ mapName: DEFAULT_MAP_POOL_TEST[4] });
                loginAs(USER_CAPTAIN2_MOCK); // C2 bans 1
                await request.post(`/queues/${testQueueFull.id}/veto/ban`).send({ mapName: DEFAULT_MAP_POOL_TEST[5] });

                // Veto is now 'completed'
                const completedVetoDetails = await getVetoDetailsFromRedis(testQueueFull.id);
                expect(completedVetoDetails.status).toBe('completed');

                // Attempt ban
                loginAs(USER_CAPTAIN1_MOCK); // Try as C1
                const banResponse = await request.post(`/queues/${testQueueFull.id}/veto/ban`).send({ mapName: DEFAULT_MAP_POOL_TEST[6] }); // map7 is picked, try to ban it
                expect(banResponse.status).toBe(409); // Veto not in progress
            });
        });
    });

    // --- Phase 3: SSE Event Tests (Placeholders) ---
    describe('SSE Event Verification via Emitter Spying', () => {
        let emitterSpy; // Declare emitterSpy here, scoped to this describe block

        beforeEach(() => {
            // Ensure queueServiceInstance is available and is the correct instance used by the app.
            // This was part of the initial setup description for the test file.
            // Assuming 'queueServiceInstance' is correctly defined and initialized in an outer scope 
            // (e.g., in the main beforeAll or passed/imported appropriately if app structure demands)
            // and it's the instance the Express app uses.

            if (queueServiceInstance && typeof queueServiceInstance.getEventsEmitter === 'function') {
                const eventEmitter = queueServiceInstance.getEventsEmitter();
                if (eventEmitter && typeof eventEmitter.emit === 'function') {
                    emitterSpy = jest.spyOn(eventEmitter, 'emit');
                } else {
                    // Log an error or throw if the emitter isn't valid, to make debugging easier.
                    console.error("ERROR in SSE beforeEach: Could not get a valid event emitter from queueServiceInstance.");
                    // Optionally, throw an error to halt tests if this setup is critical for all SSE tests.
                    // throw new Error("SSE spy setup failed: Invalid event emitter from queueServiceInstance.");
                }
            } else {
                console.error("ERROR in SSE beforeEach: queueServiceInstance or its getEventsEmitter method is not available.");
                // Optionally, throw an error.
                // throw new Error("SSE spy setup failed: queueServiceInstance is not available or doesn't have getEventsEmitter.");
            }
        });

        afterEach(() => {
            if (emitterSpy) { // Add a check here
                emitterSpy.mockRestore();
            }
        });

        describe('PUT /queues/:queueId/join and /leave Events', () => {
            let testQueue;
            const USER_JOINER = { steam_id: 'user_joiner_steam_id', username: 'JoinerUser', admin: false, super_admin: false };

            beforeEach(async () => {
                testQueue = await createQueueViaAPI(USER_OWNER, 2); // Capacity 2 for simplicity
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
                        type: 'queue_status_changed',
                        queueId: queueForPop.id,
                        data: expect.objectContaining({
                            status: 'picking',
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
                            captain1: USER_OWNER.steam_id, 
                            captain2: USER_OWNER.steam_id, // Or however the system handles 1 player for 2 captain roles
                            allPlayers: expect.arrayContaining([USER_OWNER.steam_id]),
                        })
                    })
                );
                // Also, the 'teams_finalized' event should fire immediately for a 1-player queue (0 picks to make)
                // and then move to 'map_veto'
                 expect(emitterSpy).toHaveBeenCalledWith('queue_event',
                    expect.objectContaining({
                        type: 'teams_finalized',
                        queueId: queueForPop.id,
                        data: expect.objectContaining({
                            nextStep: 'map_veto',
                            captain1: USER_OWNER.steam_id,
                            captain2: USER_OWNER.steam_id,
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
                const response = await request.put(`/queues/${testQueue.id}`).send({ capacity: newCapacity });
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
                // Create a queue with capacity 4 by USER_OWNER
                loginAs(USER_OWNER);
                testQueueFull = await createQueueViaAPI(USER_OWNER, 4); // Owner is player 1
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
                expect(vetoDetailsInitial).toBeNull(); // Veto details should not exist yet

                // Determine who is the next picker from popped_queue details
                const poppedDetails = await redisClient.hGetAll(`popped_queue:${testQueueFull.id}:details`);
                const nextPickerSteamId = poppedDetails.next_picker;
                const availableToPick = JSON.parse(poppedDetails.available_players);
                expect(availableToPick.length).toBe(2); // 4 total - 2 captains = 2 pickable
                
                const playerToPick = availableToPick[0];
                const pickingCaptain = nextPickerSteamId === captain1SteamId ? USER_CAPTAIN1_MOCK_SSE : USER_CAPTAIN2_MOCK_SSE;

                loginAs(pickingCaptain);
                const pickResponse = await request.post(`/queues/${testQueueFull.id}/pick`).send({ playerSteamId: playerToPick });
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
                await request.post(`/queues/${testQueueFull.id}/pick`).send({ playerSteamId: playerToPick });
                emitterSpy.mockClear();

                // Pick 2 (last pick)
                poppedDetails = await redisClient.hGetAll(`popped_queue:${testQueueFull.id}:details`);
                nextPickerSteamId = poppedDetails.next_picker;
                availableToPick = JSON.parse(poppedDetails.available_players);
                playerToPick = availableToPick[0];
                pickingCaptain = nextPickerSteamId === captain1SteamId ? USER_CAPTAIN1_MOCK_SSE : USER_CAPTAIN2_MOCK_SSE;
                
                loginAs(pickingCaptain);
                const pickResponse = await request.post(`/queues/${testQueueFull.id}/pick`).send({ playerSteamId: playerToPick });
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
                            availablePlayers: expect.arrayWithSize(0)
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
                // Setup similar to Map Veto tests (Phase 2)
                loginAs(USER_OWNER); 
                testQueueVetoReady = await createQueueViaAPI(USER_OWNER, 2);
                loginAs(USER_REGULAR);
                await request.put(`/queues/${testQueueVetoReady.id}/join`); // Pops the queue

                const poppedDetails = await redisClient.hGetAll(`popped_queue:${testQueueVetoReady.id}:details`);
                cap1 = { ...USER_CAPTAIN1_MOCK, steam_id: poppedDetails.captain1 };
                cap2 = { ...USER_CAPTAIN2_MOCK, steam_id: poppedDetails.captain2 };
                
                emitterSpy.mockClear();
            });

            test('Captain starts veto -> Verifies "veto_started" event', async () => {
                loginAs(cap1);
                const response = await request.post(`/queues/${testQueueVetoReady.id}/veto/start`);
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
                loginAs(cap1); // Start veto
                await request.post(`/queues/${testQueueVetoReady.id}/veto/start`);
                emitterSpy.mockClear();

                loginAs(cap2); // Captain2's turn to ban
                const vetoDetails = await getVetoDetailsFromRedis(testQueueVetoReady.id);
                const mapToBan = vetoDetails.availableMapsToBan[0];
                
                const banResponse = await request.post(`/queues/${testQueueVetoReady.id}/veto/ban`).send({ mapName: mapToBan });
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
                loginAs(cap1); // C1 starts
                await request.post(`/queues/${testQueueVetoReady.id}/veto/start`);
                
                const vetoDetailsInitial = await getVetoDetailsFromRedis(testQueueVetoReady.id);
                const mapPool = vetoDetailsInitial.mapPool; // Should be 7 maps

                // C2 (cap2) bans 2 maps
                loginAs(cap2);
                await request.post(`/queues/${testQueueVetoReady.id}/veto/ban`).send({ mapName: mapPool[0] });
                await request.post(`/queues/${testQueueVetoReady.id}/veto/ban`).send({ mapName: mapPool[1] });
                // C1 (cap1) bans 3 maps
                loginAs(cap1);
                await request.post(`/queues/${testQueueVetoReady.id}/veto/ban`).send({ mapName: mapPool[2] });
                await request.post(`/queues/${testQueueVetoReady.id}/veto/ban`).send({ mapName: mapPool[3] });
                await request.post(`/queues/${testQueueVetoReady.id}/veto/ban`).send({ mapName: mapPool[4] });
                
                emitterSpy.mockClear(); // Clear before the final ban

                // C2 (cap2) bans 1 map (this is the last ban, map gets picked)
                loginAs(cap2);
                const finalBanResponse = await request.post(`/queues/${testQueueVetoReady.id}/veto/ban`).send({ mapName: mapPool[5] });
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
                testQueue = await createQueueViaAPI(USER_OWNER, 10);
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
