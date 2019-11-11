const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

//Route Files
const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');
const teamsRouter = require('./routes/teams');
const serversRouter = require('./routes/servers');
const vetoesRouter = require('./routes/vetoes');
const matchesRouter = require('./routes/matches');
const mapstatsRouter = require('./routes/mapstats');
const playerstatsRouter = require('./routes/playerstats');
const legacyAPICalls = require('./routes/legacy/api');
//End Route Files

const passport = require('./auth');


const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
//app.use(express.static(path.join(__dirname, 'public')));

// API Setup
// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({ extended: true }));
app.use(helmet());
app.use(passport.initialize());
app.use(passport.session());

// enabling CORS for all requests
app.use(cors());

// adding morgan to log HTTP requests
app.use(morgan('combined'));

// END API SETUP

// Begin Routes
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/teams', teamsRouter);
app.use('/servers', serversRouter);
app.use('/vetoes', vetoesRouter);
app.use('/matches', matchesRouter);
app.use('/mapstats', mapstatsRouter);
app.use('/playerstats', playerstatsRouter);
app.use('/match', legacyAPICalls);

//END ROUTES

// Steam API Calls.
app.get('/auth/steam', passport.authenticate('steam', { failureRedirect: '/' }), (req, res) => {
  res.redirect('/');
});

app.get('/auth/steam/return', passport.authenticate('steam', { failureRedirect: '/' }), (req, res, next) => {
      req.url = req.originalUrl;
      next();
  }, 
  passport.authenticate('steam', { failureRedirect: '/' }),
  (req, res) => {
    res.redirect('/');
});
// END Steam API Calls.

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
