const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    listing: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Listing"
    },

    // Booking details
    checkIn: Date,
    checkOut: Date,

    //  NEW FIELDS ADD
    name: String,
    phone: String,
    aadhaar: String,
    pincode: String,

    // Payment
    paymentStatus: {
        type: String,
        default: "Pending"
    },

    // Time
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Booking", bookingSchema);