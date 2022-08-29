import config from "config";
import connectRedis from "connect-redis";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import bearerToken from "express-bearer-token";
import session from "express-session";
import helmet from "helmet";
import createError from "http-errors";
import logger from "morgan";
import morgan from "morgan";
import { createClient } from "redis";
import swaggerJSDoc from "swagger-jsdoc";

import { serve, setup } from "swagger-ui-express";

// Route Files
import indexRouter from "./routes/index.js";
import leaderboardRouter from "./routes/leaderboard.js";
import legacyAPICalls from "./routes/legacy/api.js";
import mapListRouter from "./routes/maps.js";
import mapstatsRouter from "./routes/mapstats.js";
import matchesRouter from "./routes/matches/matches.js";
import matchServerRouter from "./routes/matches/matchserver.js";
import playerstatsRouter from "./routes/playerstats.js";
import seasonsRouter from "./routes/seasons.js";
import serversRouter from "./routes/servers.js";
import teamsRouter from "./routes/teams.js";
import usersRouter from "./routes/users.js";
import vetoesRouter from "./routes/vetoes.js";
import vetosidesRouter from "./routes/vetosides.js";
import passport from "./utility/auth.js";
// End Route Files

import { EventEmitter } from "events";

const app = express();
const globalEmitter = new EventEmitter();

app.use(logger("dev"));
app.use(express.raw({ type: "application/octet-stream", limit: "2gb" }));
app.use(express.json({ limit: "512kb" }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use("/demo", express.static("public"));
app.use("/backups", express.static("public/backups"));
app.use("/static/img/logos", express.static("public/img/logos"));
app.set("eventEmitter", globalEmitter);

// Security defaults with helmet
app.use(helmet());
if (config.get("server.useRedis")) {
  // Messy but avoids any open file handles.
  const redisClient = createClient({
    legacyMode: true,
    url: config.get("server.redisUrl"),
  });

  const redisStore = connectRedis(session);
  await redisClient.connect();
  redisClient.on("error", (err) => {
    console.log("Redis error: ", err);
  });

  const redisCfg = {
    client: redisClient,
    ttl: config.get("server.redisTTL"),
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
    origin: config.get("server.clientHome"), // allow to server to accept request
    // from different origin
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
      version: "1.7.0", // Version (required)
    },
  },
  // Path to the API docs
  apis: [
    "./routes/leaderboard.js",
    "./routes/legacy/api.js",
    "./routes/matches/matches.js",
    "./routes/matches/matchserver.js",
    "./routes/maps.js",
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

app.use("/api-docs", serve, setup(swaggerSpec));

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
// END ROUTES

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
app.get("/logout", (req, res) => {
  req.logout();
  res.redirect("/");
});
// END Steam API Calls.

// Local Passport Calls
app.post(
  "/login",
  passport.authenticate("local-login", {
    failWithError: true,
    failureMessage: true,
  }),
  (req, res) => {
    return res.json({ message: "Success!" });
  },
  (err, req, res, next) => {
    console.log(err);
    err.message = req.session.messages[req.session.messages.length - 1];
    return res.json(err);
  }
);

app.post(
  "/register",
  passport.authenticate("local-register", {
    failWithError: true,
    failureMessage: true,
  }),
  (req, res) => {
    return res.json({ message: "Success!" });
  },
  (err, req, res, next) => {
    err.message = req.session.messages[req.session.messages.length - 1];
    return res.json(err);
  }
);

// END Local Passport Calls

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

if (config.get("server.useRedis")) {
  process.on("exit", function () {
    redisClient.end();
  });
}
export default app;
