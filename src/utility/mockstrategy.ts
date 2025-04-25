/**
 * Author: Michael Weibel <michael.weibel@gmail.com>
 * License: MIT
 */
"use strict";

import { Strategy as OpenIDStrategy } from 'passport-openidconnect';
import { inherits } from 'util';
import user from "./mockProfile.js";

function MockStrategy(this: any, options: { name: any; passAuthentication: any; userId?: any; }, verify: (identifier: any, profile: any, done: any) => Promise<void>) {
	this.name = options.name;
	this.passAuthentication = options.passAuthentication ? true : false;
	this.userId = options.userId || 1;
	this.verify = verify;
  	this.user = new user();
}

inherits(MockStrategy, OpenIDStrategy);

MockStrategy.prototype.authenticate = function authenticate() {
	if (this.passAuthentication) {
		var self = this;
		this.verify(this.user.id, this.user, function(_identifier: any, profile: any, done: any) {
			self.success(profile);
		});
	} else {
		this.fail('Unauthorized');
	}
}

export default MockStrategy;