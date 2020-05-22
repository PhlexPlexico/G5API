const supertest = require("supertest");
const app = require("../app");
const request = supertest.agent(app);
const password = "SUPER SECRET DON'T TELL";
describe("Authenticate User", () => {
  it("Should create a user with mock values.", async (done) => {
    const result = await request.get("/auth/steam/return");
    expect(result.statusCode).toEqual(302);
    done();
  });
});

describe("Get All Game Servers", () => {
  it("Should return all servers depending on permission of user.", async (done) => {
    const result = await request.get("/servers").expect("Content-Type", /json/);
    expect(result.statusCode).toEqual(200);
    done();
  });
});

describe("Setup New Server", () => {
  it("Should setup a new server with the given values.", async (done) => {
    let newServerData = [
      {
        ip_string: "192.168.0.1",
        port: 27015,
        display_name: "Phlex's Temp Server",
        rcon_password: password,
        public_server: 1,
      },
    ];
    request
      .post("/servers/create")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(newServerData)
      .expect((result) => {
        expect(result.body.message).toMatch(/successfully/);
      })
      .expect(200)
      .end(done);
  });
  it("Should setup a new server with the given values.", async (done) => {
    let newServerData = [
      {
        ip_string: "192.168.0.1",
        port: 27016,
        display_name: "Phlex's Temp Server #2",
        rcon_password: password,
        public_server: 1,
      },
    ];
    request
      .post("/servers/create")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(newServerData)
      .expect(200)
      .expect((result) => {
        expect(result.body.message).toMatch(/successfully/);
      })
      .end(done);
  });
  it("Should setup a new server so we can play with it later.", async (done) => {
    let newServerData = [
      {
        ip_string: "192.168.0.1",
        port: 27020,
        display_name: "Phlex's Not So Temp Server",
        rcon_password: password,
        public_server: 1,
      },
    ];
    request
      .post("/servers/create")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(newServerData)
      .expect(200)
      .expect((result) => {
        expect(result.body.message).toMatch(/successfully/);
      })
      .end(done);
  });
});

describe("Get Server Info", () => {
  it("Request the information of the inserted server.", async (done) => {
    const result = await request
      .get("/servers/1")
      .expect("Content-Type", /json/);
    expect(result.statusCode).toEqual(200);
    // Test to decrypt the password, if it matches then we decrypt/encrypt properly!
    expect(result.body[0].rcon_password).toBe(password);
    done();
  });
});

describe("Get My Server Info", () => {
  it("Request the information of all users servers.", async (done) => {
    const result = await request
      .get("/servers/myservers")
      .expect("Content-Type", /json/);
    expect(result.statusCode).toEqual(200);
    expect(result.body.length).toBeGreaterThanOrEqual(2);
    done();
  });
});

describe("Update Server", () => {
  it("Should transfer ownership to the second user.", async (done) => {
    let updatedServerData = [
      {
        display_name: "Phlex's Temp Server #2 EDITED",
        user_id: 2,
        server_id: 2,
      },
    ];
    request
      .put("/servers/update")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(updatedServerData)
      .expect(200)
      .expect((result) => {
        expect(result.body.message).toMatch(/successfully/);
      })
      .end(done);
  });
});

describe("Delete Server", () => {
  it("Should delete the information of the first server.", async (done) => {
    let deleteData = [{ server_id: 1 }];
    request
      .delete("/servers/delete")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(deleteData)
      .expect((result) => {
        expect(result.body.message).toMatch(/successfully/);
      })
      .expect(200)
      .end(done);
  });
});

describe("Being a bad actor", () => {
  it("Request the information of the second server, now no longer owned by us.", async (done) => {
    const result = await request
      .get("/servers/2")
      .expect("Content-Type", /json/);
    expect(result.statusCode).toEqual(401);
    expect(result.body.message).toMatch(/not authorized/);
    done();
  });

  it("Should try and fail to edit server 2.", async (done) => {
    let updatedServerData = [
      {
        display_name: "Phlex's Temp Server #2 EDITED BAD ACT0R",
        user_id: 1,
        server_id: 2,
      },
    ];
    request
      .put("/servers/update")
      .set("Content-Type", "application/json")
      .set("Accept", "application/json")
      .send(updatedServerData)
      .expect(401)
      .expect((result) => {
        expect(result.body.message).toMatch(/not authorized/);
      })
      .end(done);
  });
});
