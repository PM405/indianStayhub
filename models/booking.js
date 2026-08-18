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

    checkIn: Date,
    checkOut: Date,

    name: String,
    phone: String,
    aadhaar: String,
    pincode: String,

    paymentStatus: {
        type: String,
        default: "Pending"
    },

    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Booking", bookingSchema);
