/* Passport stuff
This is not required to be modified. 
All this does is check if the user exists in the database and
if they don't will add them with basic user access.
*/
const config = require('config');
const SteamStrategy = require('passport-steam').Strategy;
const passport = require('passport');
const MockStrategy = require('./mockstrategy').Strategy;
const db = require('../db');
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

function strategyForEnvironment() {
  let strategy;
  switch(process.env.NODE_ENV) {
    case 'test':
      strategy = new MockStrategy('steam', returnStrategy);
      break;
    default:
      strategy = new SteamStrategy({
        returnURL: config.get("server.hostname")+":"+config.get("server.port")+'/auth/steam/return',
        realm: config.get("server.hostname")+":"+config.get("server.port"),
        apiKey: config.get("server.steamAPIKey"),
      }, returnStrategy);
  }
  return strategy;
}

function returnStrategy (identifier, profile, done) {
  process.nextTick(async () => {
    profile.identifier = identifier;
    try {
      let isAdmin = 0;
      let isSuperAdmin = 0;
      let superAdminList = config.get("super_admins.steam_ids").split(',');
      let adminList = config.get("admins.steam_ids").split(',');
      let sql = "SELECT * FROM user WHERE steam_id = ?";
      // If we are an admin, check!
      if (superAdminList.indexOf(profile.id.toString()) >= 0) {
        isSuperAdmin = 1;
      } else if (adminList.indexOf(profile.id.toString()) >= 0) {
        isAdmin = 1;
      }
      let curUser = await db.query(sql, [profile.id]);
      if (curUser.length < 1) {
        sql = "INSERT INTO user SET ?";
        let newUser = {
          steam_id: profile.id,
          name: profile.displayName,
          admin: isAdmin,
          super_admin: isSuperAdmin,
          created_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
        }
        await db.withTransaction(async () => {
          curUser = await db.query(sql, [newUser]);
        });
        sql = "SELECT * FROM user WHERE steam_id = ?";
        curUser = await db.query(sql, [profile.id]);
      }
      return done(null, {
        steam_id: profile.id,
        name: profile.displayName,
        super_admin: isSuperAdmin,
        admin: isAdmin,
        id: curUser[0].id
      });
    }
    catch ( err ) {
      console.log("ERRORERRORERRORERRORERRORERRORERRORERROR " + err + "ERRORERRORERRORERRORERRORERRORERRORERROR");
      return done(null, null);
    }
  });
}

passport.use(strategyForEnvironment());

module.exports = passport;
