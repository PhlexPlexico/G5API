// Passport stuff.
const config = require('config');
const SteamStrategy = require('passport-steam').Strategy;
const passport = require('passport');
const db = require('./db');
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
    process.nextTick(async () => {
      profile.identifier = identifier;
      try {
        let sql = "SELECT * FROM user WHERE steam_id = ?";
        const allUsers = await db.query(sql, [profile.id]);
        if (allUsers.length < 1) {
          sql = "INSERT INTO user SET ?";
          let newUser = {
            steam_id: profile.id,
            name: profile.displayName,
            admin: 0,
            super_admin: 0,
            created_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
          }
          await db.withTransaction(db, async () => {
            await db.query(sql, [newUser]);
          });
        }
      } catch ( err ) {
        console.log("ERRORERRORERRORERRORERRORERRORERRORERROR " + err + "ERRORERRORERRORERRORERRORERRORERRORERROR");
        return done(null, null);
      }
      return done(null, {
        id: profile.id,
        name: profile.displayName,
      });
    });
  }
));

module.exports = passport;