/* Passport stuff
This is not required to be modified. 
All this does is check if the user exists in the database and
if they don't will add them with basic user access.
*/
import config from "config";
import { Strategy as SteamStrategy } from "passport-steam";
import passport from 'passport';
import { Strategy as LocalStrategy } from "passport-local";
import { hashSync, compare } from "bcrypt";
import MockStrategy from "passport-mock-strategy";
import user from "./mockProfile.js";
import db from "../db.js";
import { generate } from "randomstring";
import Utils from "./utils.js";

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

function strategyForEnvironment() {
  let strategy;
  switch (process.env.NODE_ENV) {
    case "test":
      const newUser = new user();
      strategy = new MockStrategy({ name: "steam", user: newUser, passReqToCallback: true }, returnStrategy);
      break;
    default:
      strategy = new SteamStrategy(
        {
          returnURL:
            config.get("server.apiURL") +
            "/auth/steam/return",
          realm:
            config.get("server.apiURL"),
          apiKey: config.get("server.steamAPIKey"),
        },
        returnStrategy
      );
  }
  return strategy;
}

async function returnStrategy(identifier, profile, done) {
  process.nextTick(async () => {
    profile.identifier = identifier;
    try {
      let defaultMaps = [];
      let isAdmin = 0;
      let isSuperAdmin = 0;
      let superAdminList = config.get("super_admins.steam_ids").split(",");
      let adminList = config.get("admins.steam_ids").split(",");
      let sql = "SELECT * FROM user WHERE steam_id = ?";
      // If we are an admin, check!
      if (superAdminList.indexOf(profile.id.toString()) >= 0) {
        isSuperAdmin = 1;
      } else if (adminList.indexOf(profile.id.toString()) >= 0) {
        isAdmin = 1;
      }
      let curUser = await db.query(sql, profile.id);
      if (curUser.length < 1) {
        //Generate API key in user session to allow posting/getting/etc with
        //an account that's not in a session.
        let apiKey = generate({
          length: 64,
          capitalization: "uppercase",
        });
        sql = "INSERT INTO user SET ?";
        let newUser = {
          steam_id: profile.id,
          name: profile.displayName,
          admin: isAdmin,
          super_admin: isSuperAdmin,
          created_at: new Date().toISOString().slice(0, 19).replace("T", " "),
          small_image: profile.photos[0].value,
          medium_image: profile.photos[1].value,
          large_image: profile.photos[2].value,
          api_key: await Utils.encrypt(apiKey),
        };
        curUser = await db.query(sql, [newUser]);
        sql = "SELECT * FROM user WHERE steam_id = ?";
        curUser = await db.query(sql, [profile.id]);
        defaultMaps.push(['de_inferno', 'Inferno', curUser[0].id]);
        defaultMaps.push(['de_ancient', 'Ancient', curUser[0].id]);
        defaultMaps.push(['de_mirage', 'Mirage', curUser[0].id]);
        defaultMaps.push(['de_nuke', 'Nuke', curUser[0].id]);
        defaultMaps.push(['de_overpass', 'Overpass', curUser[0].id]);
        defaultMaps.push(['de_dust2', 'Dust II', curUser[0].id]);
        defaultMaps.push(['de_vertigo', 'Vertigo', curUser[0].id]);
        sql = "INSERT INTO map_list (map_name, map_display_name, user_id) VALUES ?";
        await db.query(sql, [defaultMaps]);
      } else {
        let updateUser = {
          small_image: profile.photos[0].value,
          medium_image: profile.photos[1].value,
          large_image: profile.photos[2].value,
          super_admin: isSuperAdmin,
          admin: isAdmin
        };
        sql = "UPDATE user SET ? WHERE steam_id=?";
        await db.query(sql, [updateUser, profile.id]);
        // Insert default maps.
        sql = "SELECT * FROM map_list WHERE user_id = ?";
        let checkMaps = await db.query(sql, [curUser[0].id]);
        if (checkMaps.length < 1) {
          let defaultMaps = [];
          defaultMaps.push(['de_inferno', 'Inferno', curUser[0].id]);
          defaultMaps.push(['de_ancient', 'Ancient', curUser[0].id]);
          defaultMaps.push(['de_mirage', 'Mirage', curUser[0].id]);
          defaultMaps.push(['de_nuke', 'Nuke', curUser[0].id]);
          defaultMaps.push(['de_overpass', 'Overpass', curUser[0].id]);
          defaultMaps.push(['de_dust2', 'Dust II', curUser[0].id]);
          defaultMaps.push(['de_vertigo', 'Vertigo', curUser[0].id]);
          sql = "INSERT INTO map_list (map_name, map_display_name, user_id) VALUES ?";
          await db.query(sql, [defaultMaps]);
        }
      }
      return done(null, {
        steam_id: profile.id,
        name: profile.displayName,
        super_admin: isSuperAdmin,
        admin: isAdmin,
        id: curUser[0].id,
        small_image: profile.photos[0].value,
        medium_image: profile.photos[1].value,
        large_image: profile.photos[2].value,
        api_key: curUser[0].id + ":" + Utils.decrypt(curUser[0].api_key),
      });
    } catch (err) {
      console.log(
        "ERRORERRORERRORERRORERRORERRORERRORERROR " +
        err +
        "ERRORERRORERRORERRORERRORERRORERRORERROR"
      );
      return done(null, null);
    }
  });
}

passport.use(strategyForEnvironment());

// Local Strategies
passport.use('local-login', new LocalStrategy(async (username, password, done) => {
  try {
    if (!config.get("server.localLoginEnabled")) {
      return done(null, false, {message: "Sorry, local logins are disabled for this instance."});
    }
    let sql = "SELECT * FROM user WHERE username = ?";
    const curUser = await db.query(sql, username);
    if (curUser.length) {
      const isValidPassword = await compare(password, curUser[0].password);
      if (isValidPassword) {
        return done(null, {
          steam_id: curUser[0].steam_id,
          name: curUser[0].name,
          admin: curUser[0].admin,
          super_admin: curUser[0].super_admin,
          id: curUser[0].id,
          small_image: curUser[0].small_image,
          medium_image: curUser[0].medium_image,
          large_image: curUser[0].large_image,
          api_key: curUser[0].id + ":" + Utils.decrypt(curUser[0].api_key)
        });
      } else {
        return done(null, false, {message: "Invalid username or password."});
      }
    } else {
      return done(null, false, {message: "Invalid username or password."});
    }
  } catch (e) {
    console.error(e);
  }
  return done(null, null);
}));

passport.use('local-register',
  new LocalStrategy({ passReqToCallback: true }, (async (req, username, password, done) => {
    try {
      if (!config.get("server.localLoginEnabled")) {
        return done(null, false, {message: "Sorry, local logins are disabled for this instance."});
      }
      let sql = "SELECT * FROM user WHERE username = ? OR steam_id = ?";
      let defaultMaps = [];
      let superAdminList = config.get("super_admins.steam_ids").split(",");
      let adminList = config.get("admins.steam_ids").split(",");
      let isAdmin, isSuperAdmin = 0;
      if (!req.body.steam_id) {
        return done(null, false, {message: "Steam ID was not provided"});
      }
      let curUser = await db.query(sql, [username, req.body.steam_id]);
      if (curUser.length) {
        return done(null, false, {message: "Username or SteamID already exists."})
      } else {
        // Check if steam64 is correct.
        if(await Utils.convertToSteam64(req.body.steam_id) == "") {
          return done(null, false, {message: "Not a valid Steam64 ID."});
        }
        if (superAdminList.indexOf(req.body.steam_id) >= 0) {
          isSuperAdmin = 1;
        } else if (adminList.indexOf(req.body.steam_id) >= 0) {
          isAdmin = 1;
        }
        let apiKey = generate({
          length: 64,
          capitalization: "uppercase",
        });
        sql = "INSERT INTO user SET ?";
        let steamName = await Utils.getSteamName(req.body.steam_id);
        let newUser = {
          steam_id: req.body.steam_id,
          name: steamName,
          admin: isAdmin,
          super_admin: isSuperAdmin,
          created_at: new Date().toISOString().slice(0, 19).replace("T", " "),
          api_key: Utils.encrypt(apiKey),
          username: username,
          password: hashSync(password, 10)
        };
        newUser = await db.buildUpdateStatement(newUser);
        await db.query(sql, newUser);
        sql = "SELECT * FROM user WHERE steam_id = ?";
        curUser = await db.query(sql, [req.body.steam_id]);
        defaultMaps.push(['de_inferno', 'Inferno', curUser[0].id]);
        defaultMaps.push(['de_ancient', 'Ancient', curUser[0].id]);
        defaultMaps.push(['de_mirage', 'Mirage', curUser[0].id]);
        defaultMaps.push(['de_nuke', 'Nuke', curUser[0].id]);
        defaultMaps.push(['de_overpass', 'Overpass', curUser[0].id]);
        defaultMaps.push(['de_dust2', 'Dust II', curUser[0].id]);
        defaultMaps.push(['de_vertigo', 'Vertigo', curUser[0].id]);
        sql = "INSERT INTO map_list (map_name, map_display_name, user_id) VALUES ?";
        await db.query(sql, [defaultMaps]);
        return done(null, {
          steam_id: curUser[0].steam_id,
          name: curUser[0].name,
          admin: curUser[0].admin,
          super_admin: curUser[0].super_admin,
          id: curUser[0].id,
          small_image: curUser[0].small_image,
          medium_image: curUser[0].medium_image,
          large_image: curUser[0].large_image,
          api_key: curUser[0].id + ":" + Utils.decrypt(curUser[0].api_key)
        });
      }
    } catch (e) {
      console.error(e);
    }
    return done(null, null, 
      {message: "Unknown error. Please ensure the steam ID is not already in use."});
  })));

export default passport;
