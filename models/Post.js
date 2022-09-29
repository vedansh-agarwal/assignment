const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema({
    commentBy: {
        type: String,
        required: true
    },
    comment: {
        type: String,
        required: true
    },
});

const postSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        required: true,
        default: () => Date.now(),
        immutable: true
    },
    comments: {
        type: [commentSchema],
        required: true,
        default: []
    },
    numberOfLikes: {
        type: Number,
        default: 0,
        required: true
    },
    likedBy: {
        type: [String],
        default: [],
        required: true
    },
    createdBy: {
        type: String,
        required: true
    }
});

module.exports = mongoose.model("Post", postSchema);