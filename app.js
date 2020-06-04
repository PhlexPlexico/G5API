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
//End Route Files

const passport = require("./utility/auth");
const jwt = require("jsonwebtoken");
const bearerToken = require("express-bearer-token");
const config = require("config");
const session = require("express-session");
const redis = require("redis");
// Messy but avoids any open file handles.
const redisClient =
  process.env.NODE_ENV !== "test"
    ? redis.createClient({
        password: config.get(process.env.NODE_ENV + ".redisPass"),
      })
    : require("redis-mock").createClient();
const redisStore = require("connect-redis")(session);
const app = express();

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
//app.use(express.static(path.join(__dirname, 'public')));
redisClient.on("error", (err) => {
  console.log("Redis error: ", err);
});
const redisCfg = {
  host: config.get(process.env.NODE_ENV + ".redisHost"),
  port: config.get(process.env.NODE_ENV + ".redisPort"),
  client: redisClient,
  ttl: config.get(process.env.NODE_ENV + ".redisTTL"),
};

app.use(helmet());
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

app.use(passport.initialize());
app.use(passport.session());
app.use(bearerToken());

// enabling CORS for all requests
app.use(cors());

// adding morgan to log HTTP requests
app.use(morgan("combined"));

// END API SETUP

// Begin Routes
app.use("/", indexRouter);
app.use("/users", usersRouter);
app.use("/teams", teamsRouter);
app.use("/servers", serversRouter);
app.use("/vetoes", vetoesRouter);
app.use("/matches", matchesRouter);
app.use("/mapstats", mapstatsRouter);
app.use("/playerstats", playerstatsRouter);
app.use("/seasons", seasonsRouter);
app.use("/match", legacyAPICalls);
app.use("/leaderboard", leaderboardRouter);
//END ROUTES

// Steam API Calls.
app.get(
  "/auth/steam",
  passport.authenticate("steam", { failureRedirect: "/" }),
  (req, res) => {
    res.redirect("/");
  }
);

// Deal with setting JWT cookie during sign in. We can now check cookie + OAuth to see if we're logged in.
app.get(
  "/auth/steam/return",
  (req, res, next) => {
    req.url = req.originalUrl;
    next();
  },
  passport.authenticate("steam", { failureRedirect: "/" }),
  (req, res) => {
    res.redirect("/");
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

process.on("exit", function () {
  redisClient.end();
});

module.exports = app;
