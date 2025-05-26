/**
 * Author: Michael Weibel <michael.weibel@gmail.com>
 * License: MIT
 */
"use strict";

import { Strategy } from 'passport-strategy';
import { inherits } from 'util';
import user from "./mockProfile.js";

function MockStrategy(this: any, options: { name: any; passAuthentication: any; userId?: any; }, verify: (identifier: any, profile: any, done: any) => Promise<void>) {
	this.name = options.name;
	this.passAuthentication = options.passAuthentication ? true : false;
	this.userId = options.userId || 1;
	this.verify = verify;
	this.user = new user();
}

inherits(MockStrategy, Strategy);

MockStrategy.prototype.authenticate = function authenticate() {
	if (this.passAuthentication) {
		var self = this;
		// The 'profile' passed to verify by some strategies is the authenticated profile.
		// Here, 'this.user' is the mock profile we want to establish as authenticated.
		// The 'this.user.id' might be undefined if 'this.user' is not fully populated.
		// The verify callback is what actually calls self.success() or self.fail().
		// The verify function is typically: (req, id, profile, done) or (id, profile, done) or similar.
		// Our mock verify is simpler: (profileOnStrategy, doneCb) => doneCb(null, profileOnStrategy)
		// where profileOnStrategy is 'this.user' after loginAs.
		// Let's log what verify receives. The current verify is (this.user.id, this.user, cb)

		// The actual verify function is dynamically set by loginAs to: (profile, done) => done(null, user)
		// So, 'this.user' from the strategy is passed as 'profile' to that verify.
		// And 'this.user.id' is passed as 'identifier'.

		this.verify(this.user ? this.user.id : 'dummy_identifier', this.user, function (err: any, userFromVerify: { steam_id: any; }, info: any) {


			if (err) {
				return self.error(err); // Propagate error
			}
			if (!userFromVerify) {
				return self.fail(info); // Authentication failed
			}
			self.success(userFromVerify); // Authentication successful
		});
	} else {
		this.fail('Unauthorized');
	}
}

export default MockStrategy;