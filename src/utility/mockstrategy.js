import { Strategy as _Strategy } from "passport-strategy";
import { inherits } from "util"; // The reply from Github OAuth2
import user from "./mockProfile.js";
class MockStrategy extends _Strategy{
  constructor(name, strategyCallback) {
    super(name);
    
    
    if (!name || !name.length) {
      throw new TypeError("DevStrategy requires a Strategy name");
    }
    
    _Strategy.call(this);
    this.name = name;
    this._identifier = user;
    // Callback supplied to OAuth2 strategies handling verification
    this._cb = strategyCallback;
  }
  authenticate() {
    this._cb(null, this._identifier, (error, user) => {
      this.success(user);
    });
  }
}
export {
  MockStrategy as default
};
