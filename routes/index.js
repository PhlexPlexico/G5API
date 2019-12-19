var express = require('express');
var router = express.Router();


/** Ensures the user was authenticated through steam OAuth.
 * @function
 * @memberof module:routes/mapstats
 * @function
 * @inner */
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/auth/steam');
}

/* GET home page. */
router.get('/', ensureAuthenticated, function(req, res, next) {
  res.json({message: "Welcome to G5API!"});
});

module.exports = router;
