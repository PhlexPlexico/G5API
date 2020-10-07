var express = require("express");
var router = express.Router();

/** Utility class for various methods used throughout.
 * @const */
const Utils = require("../utility/utils");

/* GET home page. */
router.get("/", Utils.ensureAuthenticated, function (req, res, next) {
  res.json({ message: "Welcome to G5API!" });
  return;
});

router.get("/isloggedin", function (req, res, next) {
  if (req.user) {
    res.json(req.user);
  } else {
    res.json(false);
  }
});

module.exports = router;
