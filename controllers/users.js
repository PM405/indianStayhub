const User = require("../models/user");

module.exports.renderSignupForm = (req, res) => {
  res.render("users/register");
};

module.exports.signup = async (req, res) => {
  try {
    let { username, email, password } = req.body;

    const newUser = new User({
      email,
      username,
    });

    const registeredUser = await User.register(newUser, password);

    console.log(registeredUser);

    req.flash("success", "Welcome to IndianStayHub!");

    res.redirect("/listings");
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/register");
  }
};

module.exports.renderLoginForm = (req, res) => {
  res.render("users/login");
};

module.exports.login = async (req, res) => {
  req.flash("success", "Welcome back!");
  res.redirect("/listings");
};

module.exports.logout = (req, res, next) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }

    req.flash("success", "Logged out successfully!");

    res.redirect("/listings");
  });
};