const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        lowercase: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    numberOfFollowers: {
        type: Number,
        required: true,
        default: 0
    },
    following: {
        type: [String],
        default: [],
        required: true
    }
});

module.exports = mongoose.model("User", userSchema);