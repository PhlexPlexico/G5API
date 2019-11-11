// Passport stuff.
const config = require('config');
const SteamStrategy = require('passport-steam').Strategy;
const passport = require('passport');
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

passport.use(new SteamStrategy({
    returnURL: config.get("Server.hostname")+":"+config.get("Server.port")+'/auth/steam/return',
    realm: config.get("Server.hostname")+":"+config.get("Server.port"),
    apiKey: config.get("Server.steamAPIKey"),
  },
  (identifier, profile, done) => {
    process.nextTick(function () {
      profile.identifier = identifier;
      return done(null, {
        id: profile.id,
        name: profile.displayName,
      });
    });
  }
));

module.exports = passport;