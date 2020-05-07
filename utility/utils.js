/** Utilities class for help with basic functions.
 * @module utils
 */

 /** AES Module for Encryption/Decryption
 * @const
 */
const aes = require('aes-js');

/** Crypto for assigning random  */
const crypto = require('crypto');

/** Config to get database key.
 * @const
 */
const config = require('config');


class Utils {

 /** Function to get an HLTV rating for a user.
 * @function
 * @memberof module:utils
 * @param {integer} [kills=0] - Amount of kills.
 * @param {integer} [roundsplayed=0] - Amount of rounds played.
 * @param {integer} [deaths=0] - Amount of deaths.
 * @param {integer} [k1=0] - Amount of 1-kill rounds.
 * @param {integer} [k2=0] - Amount of 2-kill rounds.
 * @param {integer} [k3=0] - Amount of 3-kill rounds.
 * @param {integer} [k4=0] - Amount of 4-kill rounds.
 * @param {integer} [k5=0] - Amount of 5-kill rounds.
 * @function
 * @static */
  static getRating (
    kills=0,
    roundsplayed=0,
    deaths=0,
    k1=0,
    k2=0,
    k3=0,
    k4=0,
    k5=0
  ) {
    try {
      let AverageKPR = 0.679;
      let AverageSPR = 0.317;
      let AverageRMK = 1.277;
      let KillRating = roundsplayed === 0 ? 0 : kills / roundsplayed / AverageKPR;
      let SurvivalRating = roundsplayed === 0 ? 0 : (roundsplayed - deaths) / roundsplayed / AverageSPR;
      let killcount = (k1 + 4 * k2 + 9 * k3 + 16 * k4 + 25 * k5);
      let RoundsWithMultipleKillsRating = roundsplayed === 0 ? 0 : killcount / roundsplayed / AverageRMK;
      let rating =
        (KillRating + 0.7 * SurvivalRating + RoundsWithMultipleKillsRating) /
        2.7;
      
      return rating.toFixed(2);
    } catch (err) {
      console.log("HELPER getRating Failed -- " + err);
      return 0;
    }
  };

  /** Inner function - Supports encryption and decryption for the database keys to get server RCON passwords.
 * @name decrypt
 * @function
 * @inner
 * @memberof module:utils
 * @param {string} source - The source to be decrypted.
 */
  static decrypt(source) {
    try{
      if(source === null)
        return;
      let byteSource = aes.utils.hex.toBytes(source.substring(32));
      let IV = aes.utils.hex.toBytes(source.substring(0,32));
      let key = aes.utils.utf8.toBytes(config.get("Server.dbKey"));
      let aesCbc = new aes.ModeOfOperation.ofb(key, IV);
      let decryptedBytes = aesCbc.decrypt(byteSource);
      let decryptedText = aes.utils.utf8.fromBytes(decryptedBytes);
      return decryptedText;
    } catch ( err ){
      console.log(err);
      // fail silently.
      return null;
    }
}

/** Inner function - Supports encryption and decryption for the database keys to get server RCON passwords.
 * @name encrypt
 * @function
 * @inner
 * @memberof module:utils
 * @param {string} source - The source to be decrypted.
 */
  static encrypt(source) {
    try{
      if(source === null)
        return;
      
      let byteSource = aes.utils.utf8.toBytes(source);
      let IV = crypto.randomBytes(16);
      let key = aes.utils.utf8.toBytes(config.get("Server.dbKey"));
      let aesCbc = new aes.ModeOfOperation.ofb(key, IV);
      let encryptedBytes = aesCbc.encrypt(byteSource);
      let encryptedHex = aes.utils.hex.fromBytes(encryptedBytes);
      let hexIV = aes.utils.hex.fromBytes(IV);
      encryptedHex = hexIV + encryptedHex;
      return encryptedHex;
    } catch ( err ){
      console.log(err);
      throw err
    }
  }
  /** Ensures the user was authenticated through steam OAuth.
  * @function
  * @memberof module:utils
  * @inner */
  static ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) { return next(); }
    res.redirect('/auth/steam');
  }

  /** Checks if a user is an admin in the system during their session.
  * @function
  * @memberof module:utils
  * @inner
  * @name adminCheck
  * @param {user} User - the users session object. 
  */
  static adminCheck(user) {
    if(user) 
      return (user.super_admin === 0 && user.admin === 0) ? false : true;
    else
      return false;
  }

  /** Checks if a user is a super admin in the system during their session.
  * @function
  * @memberof module:utils
  * @inner
  * @name superAdminCheck
  * @param {user} User - the users session object. 
  */
  static superAdminCheck(user) {
    if(user) 
      return (user.super_admin === 0) ? false : true;
    else
      return false;
  }

}

module.exports = Utils;