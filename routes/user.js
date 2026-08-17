const express = require("express");
const router = express.Router();
const passport = require("passport");

const userController = require("../controllers/users");

// Signup
router
  .route("/register")
  .get(userController.renderSignupForm)
  .post(userController.signup);

// Login
router
  .route("/login")
  .get(userController.renderLoginForm)
  .post(
    passport.authenticate("local", {
      failureRedirect: "/login",
      failureFlash: true,
    }),
    userController.login
  );

// Logout
router.get("/logout", userController.logout);

module.exports = router;