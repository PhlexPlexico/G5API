const passport = require("passport-strategy");
const util = require("util"); // The reply from Github OAuth2
const user = require("./mockProfile");
function Strategy(name, strategyCallback) {
  if (!name || name.length === 0) {
    throw new TypeError("DevStrategy requires a Strategy name");
  }
  passport.Strategy.call(this);
  this.name = name;
  this._identifier = user;
  // Callback supplied to OAuth2 strategies handling verification
  this._cb = strategyCallback;
}
util.inherits(Strategy, passport.Strategy);
Strategy.prototype.authenticate = function () {
  this._cb(null, this._identifier, (error, user) => {
    this.success(user);
  });
};
module.exports = {
  Strategy
};
