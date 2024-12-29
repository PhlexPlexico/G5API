/**
 * Author: Michael Weibel <michael.weibel@gmail.com>
 * License: MIT
 */
"use strict";

import { Strategy } from 'passport';
import { inherits } from 'util';

function MockStrategy(options, validate) {
  options = options || {};
  options.profile =  (options.user === undefined) ? true : options.user;

  function authenticate(req, identifier, profile, done) {
    validate(req, identifier, profile, done);
  }
  this.name = 'steam';
}

inherits(MockStrategy, Strategy);

export default MockStrategy;