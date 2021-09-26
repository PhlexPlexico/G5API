const createError = require("http-errors");
const express = require("express");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
//Route Files
const indexRouter = require("./routes/index");
const leaderboardRouter = require("./routes/leaderboard");
const legacyAPICalls = require("./routes/legacy/api");
const matchesRouter = require("./routes/matches/matches");
const matchServerRouter = require("./routes/matches/matchserver");
const mapstatsRouter = require("./routes/mapstats");
const playerstatsRouter = require("./routes/playerstats");
const seasonsRouter = require("./routes/seasons");
const serversRouter = require("./routes/servers");
const teamsRouter = require("./routes/teams");
const usersRouter = require("./routes/users");
const vetoesRouter = require("./routes/vetoes");
const vetosidesRouter = require("./routes/vetosides");
const mapListRouter = require("./routes/maps");
//End Route Files

const swaggerUi = require("swagger-ui-express");
const swaggerJSDoc = require("swagger-jsdoc");

const passport = require("./utility/auth");
const bearerToken = require("express-bearer-token");
const config = require("config");
const session = require("express-session");
const redis = require("redis");



const app = express();

app.use(logger("dev"));
app.use(express.raw({type: 'application/octet-stream', limit: "2gb"}));
app.use(express.json({limit: "512kb"}));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use("/demo", express.static("public"));
app.use("/static/img/logos", express.static("public/img/logos"));

// Security defaults with helmet
app.use(helmet());
if(config.get("server.useRedis")){
  // Messy but avoids any open file handles.
  const redisClient =
  process.env.NODE_ENV !== "test"
    ? redis.createClient({
        password: config.get(process.env.NODE_ENV + ".redisPass"),
      })
    : require("redis-mock").createClient();
  const redisStore = require("connect-redis")(session);
  redisClient.on("error", (err) => {
    console.log("Redis error: ", err);
  });
  
  const redisCfg = {
    host: config.get(process.env.NODE_ENV + ".redisHost"),
    port: config.get(process.env.NODE_ENV + ".redisPort"),
    client: redisClient,
    ttl: config.get(process.env.NODE_ENV + ".redisTTL"),
  };
  app.use(
    session({
      secret: config.get("server.sharedSecret"),
      name: "G5API",
      resave: false,
      saveUninitialized: true,
      store: new redisStore(redisCfg),
      cookie: { maxAge: 3600000 },
    })
  );
} else {
  app.use(
    session({
      secret: config.get("server.sharedSecret"),
      name: "G5API",
      resave: false,
      saveUninitialized: true,
      cookie: { maxAge: 3600000 },
    })
  );
}
app.use(passport.initialize());
app.use(passport.session());
app.use(bearerToken());

// enabling CORS for all requests
app.use(
  cors({
    origin: config.get("server.clientHome"), // allow to server to accept request from different origin
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true, // allow session cookie from browser to pass through
  })
);

// adding morgan to log HTTP requests
app.use(morgan("combined"));

// swagger UI

const options = {
  definition: {
    openapi: "3.0.0", // Specification (optional, defaults to swagger: '2.0')
    info: {
      title: "G5API", // Title (required)
      version: "1.3.0", // Version (required)
    },
  },
  // Path to the API docs
  apis: [
    "./routes/leaderboard.js",
    "./routes/legacy/api.js",
    "./routes/matches/matches.js",
    "./routes/matches/matchserver.js",
    "./routes/mapstats.js",
    "./routes/playerstats.js",
    "./routes/seasons.js",
    "./routes/servers.js",
    "./routes/teams.js",
    "./routes/users.js",
    "./routes/vetoes.js",
    "./routes/vetosides.js",
  ],
};
const swaggerSpec = swaggerJSDoc(options);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// END API SETUP

// Begin Routes
app.use("/", indexRouter);
app.use("/users", usersRouter);
app.use("/teams", teamsRouter);
app.use("/servers", serversRouter);
app.use("/vetoes", vetoesRouter);
app.use("/vetosides", vetosidesRouter);
app.use("/matches", matchesRouter, matchServerRouter);
app.use("/mapstats", mapstatsRouter);
app.use("/playerstats", playerstatsRouter);
app.use("/seasons", seasonsRouter);
app.use("/match", legacyAPICalls);
app.use("/leaderboard", leaderboardRouter);
app.use("/maps", mapListRouter);
//END ROUTES

// Steam API Calls.
app.get(
  "/auth/steam",
  passport.authenticate("steam", { failureRedirect: "/" }),
  (req, res) => {
    res.redirect("/");
  }
);

app.get(
  "/auth/steam/return",
  (req, res, next) => {
    req.url = req.originalUrl;
    next();
  },
  passport.authenticate("steam", { failureRedirect: "/" }),
  (req, res) => {
    if (process.env.NODE_ENV == "test") {
      res.redirect("/");
    } else {
      res.redirect(config.get("server.clientHome"));
    }
  }
);
app.get("/logout", function (req, res) {
  req.logout();
  res.redirect("/");
});
// END Steam API Calls.

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.json({ error: err.message });
});

if(config.get("server.useRedis")){
  process.on("exit", function () {
    redisClient.end();
  });
}
module.exports = app;
