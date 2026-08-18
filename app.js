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

const nodemailer = require("nodemailer");

app.use(methodOverride("_method"));

const MONGO_URL = process.env.MONGO_URI;

async function connectDB() {
    if (!MONGO_URL) {
        throw new Error("MONGO_URI is missing");
    }

    if (mongoose.connection.readyState === 1) {
        return;
    }

    await mongoose.connect(MONGO_URL, {
        serverSelectionTimeoutMS: 5000
    });

    console.log("MongoDB Connected");
}

app.use(async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (err) {
        console.log("MongoDB Connection Error:", err.message);
        next(err);
    }
});

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

app.use(express.json());

app.use(methodOverride("_method"));

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);

app.use(
    session({
        secret: "secretkey",
        resave: false,
        saveUninitialized: false
    })
);

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

app.use(
    (req, res, next) => {
        res.locals.currentUser = req.user;
        next();
    }
);

const transporter =
    nodemailer.createTransport({
        service: "gmail",

        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

app.get(
    "/",
    (req, res) => {
        res.redirect("/login");
    }
);

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
            await bcrypt.hash(
                password,
                10
            );

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

app.get(
    "/logout",

    (req, res) => {

        req.logout(() => {
            res.redirect("/login");
        });

    }
);

function isLoggedIn(req, res, next) {

    if (!req.isAuthenticated()) {
        return res.redirect("/login");
    }

    next();
}

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

app.get(
    "/listings/search",

    isLoggedIn,

    wrapAsync(
        async (req, res) => {

            const { q } = req.query;

            if (!q || q.trim() === "") {
                return res.redirect("/listings");
            }

            const searchText =
                q.trim();

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

app.post(
    "/book/:id",

    isLoggedIn,

    wrapAsync(
        async (req, res) => {

            const listing =
                await Listing.findById(
                    req.params.id
                );

            if (!listing) {
                return res
                    .status(404)
                    .send("Listing not found");
            }

            const booking =
                new Booking({

                    user:
                        req.user._id,

                    listing:
                        req.params.id,

                    checkIn:
                        req.body.checkIn,

                    checkOut:
                        req.body.checkOut,

                    name:
                        req.body.name,

                    phone:
                        req.body.phone,

                    aadhaar:
                        req.body.aadhaar,

                    pincode:
                        req.body.pincode

                });

            await booking.save();

            const userEmail =
                req.user.email;

            const adminEmail =
                process.env.ADMIN_EMAIL;

            if (
                process.env.EMAIL_USER &&
                process.env.EMAIL_PASS
            ) {

                try {

                    await transporter.sendMail({

                        from:
                            process.env.EMAIL_USER,

                        to:
                            userEmail,

                        subject:
                            "Booking Confirmed - IndiaStayHub",

                        html: `

                            <div style="
                                max-width:650px;
                                margin:auto;
                                font-family:Arial,sans-serif;
                                background:#f8f9fa;
                                padding:25px;
                            ">

                                <div style="
                                    background:#ffffff;
                                    padding:25px;
                                    border-radius:12px;
                                    border:1px solid #ddd;
                                ">

                                    <h2 style="
                                        color:#198754;
                                        text-align:center;
                                    ">
                                        Booking Confirmed
                                    </h2>

                                    <p>
                                        Hello
                                        <b>${req.user.username}</b>,
                                    </p>

                                    <p>
                                        Your booking at
                                        <b>IndiaStayHub</b>
                                        has been successfully confirmed.
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
                                        <b>Property:</b>
                                        ${listing.title}
                                    </p>

                                    <p>
                                        <b>Location:</b>
                                        ${listing.location},
                                        ${listing.country}
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
                                        <b>Guest Name:</b>
                                        ${booking.name}
                                    </p>

                                    <p>
                                        <b>Phone:</b>
                                        ${booking.phone}
                                    </p>

                                    <p>
                                        <b>Pincode:</b>
                                        ${booking.pincode}
                                    </p>

                                    <p>
                                        <b>Payment Status:</b>
                                        ${booking.paymentStatus}
                                    </p>

                                    <hr>

                                    <p>
                                        Thank you for choosing
                                        <b>IndiaStayHub</b>.
                                    </p>

                                    <p>
                                        We hope you have a
                                        wonderful stay.
                                    </p>

                                </div>

                            </div>

                        `

                    });

                    console.log(
                        "User confirmation email sent"
                    );

                } catch (emailError) {

                    console.log(
                        "User Email Error:",
                        emailError.message
                    );

                }

                if (adminEmail) {

                    try {

                        await transporter.sendMail({

                            from:
                                process.env.EMAIL_USER,

                            to:
                                adminEmail,

                            subject:
                                "New Booking Received - IndiaStayHub",

                            html: `

                                <div style="
                                    max-width:650px;
                                    margin:auto;
                                    font-family:Arial,sans-serif;
                                    background:#f8f9fa;
                                    padding:25px;
                                ">

                                    <div style="
                                        background:#ffffff;
                                        padding:25px;
                                        border-radius:12px;
                                        border:1px solid #ddd;
                                    ">

                                        <h2 style="
                                            color:#0d6efd;
                                            text-align:center;
                                        ">
                                            New Booking Received
                                        </h2>

                                        <p>
                                            A new booking has been
                                            received on
                                            <b>IndiaStayHub</b>.
                                        </p>

                                        <hr>

                                        <h3>
                                            Guest Details
                                        </h3>

                                        <p>
                                            <b>Name:</b>
                                            ${booking.name}
                                        </p>

                                        <p>
                                            <b>Email:</b>
                                            ${req.user.email}
                                        </p>

                                        <p>
                                            <b>Phone:</b>
                                            ${booking.phone}
                                        </p>

                                        <p>
                                            <b>Aadhaar:</b>
                                            ${booking.aadhaar}
                                        </p>

                                        <p>
                                            <b>Pincode:</b>
                                            ${booking.pincode}
                                        </p>

                                        <hr>

                                        <h3>
                                            Property Details
                                        </h3>

                                        <p>
                                            <b>Property:</b>
                                            ${listing.title}
                                        </p>

                                        <p>
                                            <b>Location:</b>
                                            ${listing.location},
                                            ${listing.country}
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
                                            <b>Payment Status:</b>
                                            ${booking.paymentStatus}
                                        </p>

                                        <hr>

                                        <p>
                                            Please check the booking
                                            in the IndiaStayHub dashboard.
                                        </p>

                                    </div>

                                </div>

                            `

                        });

                        console.log(
                            "Admin booking email sent"
                        );

                    } catch (emailError) {

                        console.log(
                            "Admin Email Error:",
                            emailError.message
                        );

                    }
                }
            }

            res.redirect("/mybookings");
        }
    )
);

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

                return res.status(404).json({
                    success: false,
                    message:
                        "Booking not found"
                });

            }

            if (
                booking.user.toString() !==
                req.user._id.toString()
            ) {

                return res.status(403).json({
                    success: false,
                    message:
                        "Not authorized"
                });

            }

            const listing =
                await Listing.findById(
                    booking.listing
                );

            await Booking.findByIdAndDelete(
                req.params.id
            );

            if (
                process.env.EMAIL_USER &&
                process.env.EMAIL_PASS
            ) {

                try {

                    await transporter.sendMail({

                        from:
                            process.env.EMAIL_USER,

                        to:
                            req.user.email,

                        subject:
                            "Booking Cancelled - IndiaStayHub",

                        html: `

                            <div style="
                                max-width:650px;
                                margin:auto;
                                font-family:Arial,sans-serif;
                                background:#f8f9fa;
                                padding:25px;
                            ">

                                <div style="
                                    background:#ffffff;
                                    padding:25px;
                                    border-radius:12px;
                                    border:1px solid #ddd;
                                ">

                                    <h2 style="
                                        color:#dc3545;
                                        text-align:center;
                                    ">
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
                                        <b>Property:</b>
                                        ${listing
                                            ? listing.title
                                            : "Property unavailable"}
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

                            </div>

                        `

                    });

                    console.log(
                        "User cancellation email sent"
                    );

                } catch (emailError) {

                    console.log(
                        "Cancellation Email Error:",
                        emailError.message
                    );

                }

                if (process.env.ADMIN_EMAIL) {

                    try {

                        await transporter.sendMail({

                            from:
                                process.env.EMAIL_USER,

                            to:
                                process.env.ADMIN_EMAIL,

                            subject:
                                "Booking Cancelled - IndiaStayHub",

                            html: `

                                <div style="
                                    font-family:Arial;
                                    padding:25px;
                                ">

                                    <h2>
                                        Booking Cancelled
                                    </h2>

                                    <p>
                                        A booking has been
                                        cancelled.
                                    </p>

                                    <hr>

                                    <p>
                                        <b>Booking ID:</b>
                                        ${booking._id}
                                    </p>

                                    <p>
                                        <b>Guest:</b>
                                        ${booking.name}
                                    </p>

                                    <p>
                                        <b>Email:</b>
                                        ${req.user.email}
                                    </p>

                                    <p>
                                        <b>Phone:</b>
                                        ${booking.phone}
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
                                        <b>Property:</b>
                                        ${listing
                                            ? listing.title
                                            : "Property unavailable"}
                                    </p>

                                </div>

                            `

                        });

                        console.log(
                            "Admin cancellation email sent"
                        );

                    } catch (emailError) {

                        console.log(
                            "Admin cancellation email error:",
                            emailError.message
                        );

                    }
                }
            }

            res.status(200).json({

                success: true,

                message:
                    "Booking cancelled successfully"

            });

        }
    )
);

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

app.use(
    (err, req, res, next) => {

        console.log(err);

        res
            .status(500)
            .send(err.message);

    }
);

module.exports = app;
