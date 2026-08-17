require("dotenv").config();

const express = require("express");
const app = express();


const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");

const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local");

const Listing = require("./models/listing");
const User = require("./models/user");
const Booking = require("./models/booking");

const wrapAsync = require("./utils/wrapAsync");
const ExpressError = require("./utils/ExpressError");

const nodemailer = require("nodemailer");


// DATABASE

const MONGO_URL = process.env.MONGO_URI;

async function main() {
    await mongoose.connect(MONGO_URL);
    console.log("Connected to DB");
}

main().catch(err => console.log(err));

// BASIC SETUP

app.engine("ejs", ejsMate);

app.set("view engine", "ejs");

app.set(
    "views",
    path.join(__dirname, "views")
);

app.use(
    express.urlencoded({
        extended: true
    })
);

app.use(methodOverride("_method"));

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


// SESSION

app.use(
    session({
        secret: "secretkey",
        resave: false,
        saveUninitialized: false
    })
);


// PASSPORT

app.use(passport.initialize());
app.use(passport.session());

passport.use(
    new LocalStrategy(
        async (username, password, done) => {

            try {

                const user =
                    await User.findOne({ username });

                if (!user) {
                    return done(null, false);
                }

                const match =
                    await bcrypt.compare(
                        password,
                        user.password
                    );

                if (match) {
                    return done(null, user);
                }

                return done(null, false);

            } catch (err) {

                return done(err);

            }

        }
    )
);

passport.serializeUser(
    (user, done) => {
        done(null, user.id);
    }
);

passport.deserializeUser(
    async (id, done) => {

        try {

            const user =
                await User.findById(id);

            done(null, user);

        } catch (err) {

            done(err);

        }

    }
);


// CURRENT USER

app.use(
    (req, res, next) => {

        res.locals.currentUser = req.user;

        next();

    }
);


// EMAIL

const transporter =
    nodemailer.createTransport({

        service: "gmail",

        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }

    });


// ROOT

app.get(
    "/",
    (req, res) => {

        res.redirect("/login");

    }
);


// REGISTER

app.get(
    "/register",
    (req, res) => {

        res.render("users/register");

    }
);

app.post(
    "/register",

    async (req, res) => {

        const {
            username,
            email,
            password
        } = req.body;

        const hash =
            await bcrypt.hash(password, 10);

        const user =
            new User({

                username,
                email,
                password: hash

            });

        await user.save();

        res.redirect("/login");

    }
);


// LOGIN

app.get(
    "/login",
    (req, res) => {

        res.render("users/login");

    }
);

app.post(
    "/login",

    passport.authenticate(
        "local",
        {
            failureRedirect: "/login"
        }
    ),

    (req, res) => {

        res.redirect("/listings");

    }
);


// LOGOUT

app.get(
    "/logout",
    (req, res) => {

        req.logout(() => {

            res.redirect("/login");

        });

    }
);


// AUTH

function isLoggedIn(req, res, next) {

    if (!req.isAuthenticated()) {

        return res.redirect("/login");

    }

    next();

}


// ALL LISTINGS

app.get(
    "/listings",

    isLoggedIn,

    wrapAsync(
        async (req, res) => {

            const allListings =
                await Listing.find({});

            res.render(
                "listings/index",
                {
                    allListings
                }
            );

        }
    )
);


// SEARCH

app.get(
    "/listings/search",

    isLoggedIn,

    wrapAsync(
        async (req, res) => {

            const { q } = req.query;

            if (!q || q.trim() === "") {

                return res.redirect("/listings");

            }

            const searchText = q.trim();

            const allListings =
                await Listing.find({

                    $or: [

                        {
                            title: {
                                $regex: searchText,
                                $options: "i"
                            }
                        },

                        {
                            location: {
                                $regex: searchText,
                                $options: "i"
                            }
                        },

                        {
                            country: {
                                $regex: searchText,
                                $options: "i"
                            }
                        }

                    ]

                });

            res.render(
                "listings/index",
                {
                    allListings
                }
            );

        }
    )
);


// LISTING BY ID

app.get(
    "/listings/:id",

    isLoggedIn,

    wrapAsync(
        async (req, res) => {

            const listing =
                await Listing.findById(
                    req.params.id
                );

            res.render(
                "listings/show",
                {
                    listing
                }
            );

        }
    )
);


// CREATE LISTING

app.post(
    "/listings",

    isLoggedIn,

    wrapAsync(
        async (req, res) => {

            const listing =
                new Listing(
                    req.body.listing
                );

            await listing.save();

            res.redirect("/listings");

        }
    )
);


// CREATE BOOKING

app.post(
    "/book/:id",

    isLoggedIn,

    wrapAsync(
        async (req, res) => {

            const booking =
                new Booking({

                    user: req.user._id,

                    listing: req.params.id,

                    checkIn: req.body.checkIn,

                    checkOut: req.body.checkOut,

                    name: req.body.name,

                    phone: req.body.phone,

                    aadhaar: req.body.aadhaar,

                    pincode: req.body.pincode

                });

            await booking.save();


            if (
                process.env.EMAIL_USER &&
                process.env.EMAIL_PASS
            ) {

                try {

                    await transporter.sendMail({

                        from: process.env.EMAIL_USER,

                        to: req.user.email,

                        subject:
                            "Booking Confirmed - IndiaStayHub",

                        html: `

                            <div style="
                                font-family: Arial;
                                padding: 20px;
                                border: 1px solid #ddd;
                                border-radius: 10px;
                            ">

                                <h2>
                                    Booking Confirmed
                                </h2>

                                <p>
                                    Hello
                                    <b>${req.user.username}</b>,
                                </p>

                                <p>
                                    Your booking has been
                                    successfully confirmed.
                                </p>

                                <hr>

                                <h3>
                                    Booking Details
                                </h3>

                                <p>
                                    <b>Booking ID:</b>
                                    ${booking._id}
                                </p>

                                <p>
                                    <b>Check-In:</b>
                                    ${booking.checkIn}
                                </p>

                                <p>
                                    <b>Check-Out:</b>
                                    ${booking.checkOut}
                                </p>

                                <p>
                                    <b>Name:</b>
                                    ${booking.name}
                                </p>

                                <p>
                                    <b>Phone:</b>
                                    ${booking.phone}
                                </p>

                                <hr>

                                <p>
                                    Thank you for using
                                    <b>IndiaStayHub</b>.
                                </p>

                            </div>

                        `

                    });

                    console.log(
                        "Confirmation email sent"
                    );

                } catch (emailError) {

                    console.log(
                        "Email Error:",
                        emailError.message
                    );

                }

            }

            res.redirect("/mybookings");

        }
    )
);


// CANCEL BOOKING

app.delete(
    "/bookings/:id",

    isLoggedIn,

    wrapAsync(
        async (req, res) => {

            const booking =
                await Booking.findById(
                    req.params.id
                );

            if (!booking) {

                return res
                    .status(404)
                    .json({
                        message: "Booking not found"
                    });

            }

            if (
                booking.user.toString() !==
                req.user._id.toString()
            ) {

                return res
                    .status(403)
                    .json({
                        message: "Not authorized"
                    });

            }


            await Booking.findByIdAndDelete(
                req.params.id
            );


            if (
                process.env.EMAIL_USER &&
                process.env.EMAIL_PASS
            ) {

                try {

                    await transporter.sendMail({

                        from: process.env.EMAIL_USER,

                        to: req.user.email,

                        subject:
                            "Booking Cancelled - IndiaStayHub",

                        html: `

                            <div style="
                                font-family: Arial;
                                padding: 20px;
                                border: 1px solid #ddd;
                                border-radius: 10px;
                            ">

                                <h2>
                                    Booking Cancelled
                                </h2>

                                <p>
                                    Hello
                                    <b>${req.user.username}</b>,
                                </p>

                                <p>
                                    Your booking has been
                                    successfully cancelled.
                                </p>

                                <hr>

                                <h3>
                                    Booking Details
                                </h3>

                                <p>
                                    <b>Booking ID:</b>
                                    ${booking._id}
                                </p>

                                <p>
                                    <b>Check-In:</b>
                                    ${booking.checkIn}
                                </p>

                                <p>
                                    <b>Check-Out:</b>
                                    ${booking.checkOut}
                                </p>

                                <p>
                                    <b>Name:</b>
                                    ${booking.name}
                                </p>

                                <hr>

                                <p>
                                    Thank you for using
                                    <b>IndiaStayHub</b>.
                                </p>

                            </div>

                        `

                    });

                    console.log(
                        "Cancellation email sent"
                    );

                } catch (emailError) {

                    console.log(
                        "Cancellation email error:",
                        emailError.message
                    );

                }

            }


            res.json({
                success: true,
                message:
                    "Booking cancelled successfully"
            });

        }
    )
);


// MY BOOKINGS

app.get(
    "/mybookings",

    isLoggedIn,

    wrapAsync(
        async (req, res) => {

            const bookings =
                await Booking.find({

                    user: req.user._id

                })
                .populate("listing");

            res.render(
                "bookings/index",
                {
                    bookings
                }
            );

        }
    )
);


// ERROR HANDLER

app.use(
    (err, req, res, next) => {

        console.log(err);

        res
            .status(500)
            .send(err.message);

    }
);


// SERVER

module.exports = app;
