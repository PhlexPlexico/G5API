/** Utilities class for help with basic functions.
 * @module utils
 */
class Utils {

 /** Function to get an HLTV rating for a user.
 * @function
 * @memberof module:routes/leaderboard
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
}

module.exports = Utils;