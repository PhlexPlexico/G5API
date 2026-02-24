import { Router } from "express";
var router = Router();

/** Utility class for various methods used throughout.
 * @const */
import Utils from "../utility/utils.js";

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

export default router;
