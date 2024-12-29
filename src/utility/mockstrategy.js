/**
 * Author: Michael Weibel <michael.weibel@gmail.com>
 * License: MIT
 */
"use strict";

import {Strategy as OpenIDStrategy} from '@passport-next/passport-openid';
import { inherits } from 'util';
import user from "./mockProfile.js";

function MockStrategy(options, verify) {
	this.name = options.name;
	this.passAuthentication = options.passAuthentication ? true : false;
	this.userId = options.userId || 1;
	this.verify = verify;
  this.user = new user();
}

inherits(MockStrategy, OpenIDStrategy);

MockStrategy.prototype.authenticate = function authenticate(req) {
	if (this.passAuthentication) {
		var self = this;
		this.verify(this.user.id, this.user, function(identifier, profile, done) {
			self.success(profile);
		});
	} else {
		this.fail('Unauthorized');
	}
}

export default MockStrategy;