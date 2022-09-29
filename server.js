// .env configuration
const dotenv = require("dotenv");
dotenv.config();

// Express Configuration
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const port = process.env.PORT || 5000;
const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// Imports for routes and middlwares
const jwt = require("jsonwebtoken");
const User = require("./models/User");
const Post = require("./models/Post");
const Comment = require("./models/Comment");

// Middleware
const checkAuth = async (req, res, next) => {
    const { authorization } = req.headers;

    const token = authorization.split(" ")[1];

    if(!authorization || !token) {
        return res.status(403).json({msg: "Access Denied"});
    }

    try {
        const jwt_data = jwt.verify(token, process.env.JWT_SECRET_KEY);
        req.user_id = jwt_data.user_id;
        var findUser = await User.findById(req.user_id);
        if(findUser == null) return res.status(403).json({msg: "Access Denied"});
        next();
    } catch(err) {
        return res.status(403).json({msg: "Access Denied"});
    }
};

// Routes
app.post("/api/register", async (req, res) => {
    const {email, password, name} = req.body;

    if(!email || !password || !name) {
        return res.status(403).json({message: "Insufficient Data received."});
    }

    try {
        const newUser = new User({email, password, name});
        await newUser.save();
        return res.status(201).json({message: "User registered successfully", user_id: newUser._id});
    } catch(err) {
        console.log(err);
        if(err.code === 11000) {
            if(err.message.includes("email:")) {
                return res.status(409).json({message: "An account with this email already exists. Please log in."});
            } else {
                const err = { message: "Unexpected Database error." }
                throw err;
            }
        } else {
            return res.status(500).json({message: "Database Error", errorMessage: err.message});
        }
    }
});

app.post("/api/authenticate", async (req, res) => {
    const {email, password} = req.body;

    if(!email || !password) {
        return res.status(403).json({message: "Insufficient Data received."});
    }

    try {
        var userAccount = await User.findOne({email, password});
        var message, statusCode, token = null;
        if(userAccount == null) {
            statusCode = 401;
            message = "Invalid email or password.";
        } else {
            statusCode = 200;
            message = "User found in database";
            token = jwt.sign({user_id: userAccount._id}, process.env.JWT_SECRET_KEY);
        }
        return res.status(statusCode).json({message, token});
    } catch(err) {
        console.log(err);
        return res.status(500).json({message: "Database Error", errorMessage: err.message});
    }
});

app.post("/api/follow/:id", checkAuth, async (req, res) => {
    const {id} = req.params;
    const user_id = req.user_id;

    if(user_id === id) {
        return res.status(401).json({message: "User cannot follow/unfollow their own account."})
    }

    try {
        var findUser1 = await User.findById(id);
        var findUser2 = await User.findById(user_id);
        
        if(findUser1 == null) {
            return res.status(404).json({message: "User with the given id does not exist."});
        } else if(findUser2.following.includes(id)) {
            return res.status(409).json({message: "You're already following the given account."});
        } else {
            User.findByIdAndUpdate(id, {$inc : {'numberOfFollowers' : 1}}).exec();
            findUser2.following.push(id);
            User.findByIdAndUpdate(user_id, findUser2).exec();
            return res.status(200).json({message: "Follow Request Successful."});
        }
    } catch(err) {
        console.log(err);
        return res.status(500).json({message: "Database Error", errorMessage: err.message});
    }
});

app.post("/api/unfollow/:id", checkAuth, async (req, res) => {
    const {id} = req.params;
    const user_id = req.user_id;

    if(user_id === id) {
        return res.status(401).json({message: "User cannot follow/unfollow their own account."})
    }

    try {
        var findUser1 = await User.findById(id);
        var findUser2 = await User.findById(user_id);
        
        if(findUser1 == null) {
            return res.status(404).json({message: "User with the given id does not exist."});
        } else if(findUser2.following.includes(id)) {
            User.findByIdAndUpdate(id, {$inc : {'numberOfFollowers' : -1}}).exec();
            var index = findUser2.following.indexOf(id);
            findUser2.following.splice(index, 1);
            User.findByIdAndUpdate(user_id, findUser2).exec();
            return res.status(200).json({message: "Unfollow Request Successful."});
        } else {
            return res.status(404).json({message: "You're are not following the given account."});
        }
    } catch(err) {
        console.log(err);
        return res.status(500).json({message: "Database Error", errorMessage: err.message});
    }
});

app.get("/api/user", checkAuth, async (req, res) => {
    const user_id = req.user_id;

    try {
        var findUser = await User.findById(user_id);
        return res.status(200).json({message: "User Found.", userDetails: {
            name: findUser.name,
            numberOfFollowers: findUser.numberOfFollowers,
            following: findUser.following
        }});
    } catch(err) {
        console.log(err);
        return res.status(500).json({message: "Database Error", errorMessage: err.message});
    }
});

app.post("/api/posts", checkAuth, async (req, res) => {
    const user_id = req.user_id;
    const {title, description} = req.body;

    try{
        const newPost = new Post({title, description, createdBy: user_id})
        newPost.save();
        return res.status(201).json({message: "Post Created Successfully.", postDetails: {
            postID: newPost._id,
            title,
            description,
            createdTimestamp: newPost.createdAt.toLocaleString()
        }});
    } catch(err) {
        console.log(err);
        return res.status(500).json({message: "Database Error", errorMessage: err.message});
    }
});

app.delete("/api/posts/:postID", checkAuth, (req, res) => {
    const {postID} = req.params;
    const user_id = req.user_id;

    try {
        const findPost = Post.findById(postID);
        if(findPost == null) {
            return res.status(404).json({message: "Post with the given id does not exist."});
        } else if(findPost.createdBy !== user_id) {
            return res.status(401).json({message: "Post with the given id does not belong to the current user."});
        } else {
            Post.findByIdAndDelete(postID).exec();
            return res.status(202).json({message: "Post Deleted Successfully."});
        }
    } catch(err) {
        console.log(err);
        return res.status(500).json({message: "Database Error", errorMessage: err.message});
    }
});

app.post("/api/like/:postID", checkAuth, (req, res) => {
    const {postID} = req.params;
    const user_id = req.user_id;

    try {
        var findPost = Post.findById(postID);
        if(findPost == null) {
            return res.status(404).json({message: "Post with the given id does not exist."});
        } else if(findPost.likedBy.includes(user_id)) {
            return res.status(409).json({message: "You've already liked the given post."});
        } else {
            findPost.likedBy.push(user_id);
            findPost.numberOfLikes += 1;
            Post.findByIdAndUpdate(postID, findPost);
            return res.status(200).json({message: "Post Liked Successfully."});
        }
    } catch(err) {
        console.log(err);
        return res.status(500).json({message: "Database Error", errorMessage: err.message});
    }
});

app.post("/api/unlike/:postID", checkAuth, (req, res) => {
    const {postID} = req.params;
    const user_id = req.user_id;

    try {
        var findPost = Post.findById(postID);
        if(findPost == null) {
            return res.status(404).json({message: "Post with the given id does not exist."});
        } else if(findPost.likedBy.includes(user_id)) {
            var index = findPost.likedBy.indexOf(user_id);
            findPost.likedBy.splice(index, 1);
            findPost.numberOfLikes -= 1;
            Post.findByIdAndUpdate(postID, findPost);
            return res.status(200).json({message: "Post Unliked Successfully."});
        } else {
            return res.status(404).json({message: "You've not liked the given post."});
        }
    } catch(err) {
        console.log(err);
        return res.status(500).json({message: "Database Error", errorMessage: err.message});
    }
});

app.post("/api/comment/:postID", checkAuth, (req, res) => {
    const {postID} = req.params;
    const user_id = req.user_id;
    const {comment} = req.body;

    if(!comment) {
        return res.status(403).json({message: "Insufficient Data received."});
    }    

    try {
        var findPost = Post.findById(postID);
        if(findPost == null) {
            return res.status(404).json({message: "Post with the given id does not exist."});
        } else {
            var newComment = new Comment({commentBy: user_id, comment});
            findPost.comments.push(newComment);
            Post.findByIdAndUpdate(postID, findPost).exec();
            return res.status(200).json({message: "Comment Posted Successfully.", commentID: newComment._id});
        }
    } catch(err) {
        console.log(err);
        return res.status(500).json({message: "Database Error", errorMessage: err.message});
    }
});

app.get("/api/posts/:postID", (req, res) => {
    const {postID} = req.params;

    try {
        var findPost = Post.findById(postID);
        if(findPost == null) {
            return res.status(404).json({message: "Post with the given id does not exist."});
        } else {
            var comments = [];
            for(var i = 0; i < findPost.comments.length; i++) {
                comments.push(findPost.comments.comment);
            }
            return res.status(200).json({message: "Post Found.", postDetails: {
                title: findPost.title,
                description: findPost.description,
                numberOfLikes: findPost.numberOfLikes,
                comments,
                createdTimestamp: findPost.createdAt.toLocaleString()
            }});
        }
    } catch(err) {
        console.log(err);
        return res.status(500).json({message: "Database Error", errorMessage: err.message});
    }
});

app.get("/api/all_posts", checkAuth, async (req, res) => {
    const user_id = req.user_id;

    try {
        var findPosts = await Post.find({createdBy: user_id});
        var posts = [];
        for(var i = 0; i < findPosts.length; i++) {
            var comments = [];
            for(var j = 0; j < findPosts[i].comments.length; j++) { comments.push(findPosts[i].comments.comment); }
            var postFormatted  = {
                id: findPosts[i]._id,
                title: findPosts[i].title,
                description: findPosts[i].description,
                numberOfLikes: findPosts[i].numberOfLikes,
                comments,
                createdTimestamp: findPosts[i].createdAt.toLocaleString()
            }
            posts.push(postFormatted);
        }
        if(findPosts.length > 0) {
            return res.status(200).json({message: "Posts found successfully.", posts});
        } else {
            return res.status(200).json({message: "User has not made any posts yet."});
        }
    } catch(err) {
        console.log(err);
        return res.status(500).json({message: "Database Error", errorMessage: err.message});
    }
}); 

// Server Start and MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, 
    () => {
        console.log("connected to mongodb");
        app.listen(port, () => console.log(`Server listening on http://localhost:${port}/`));
    },
    e => console.log(e.message)
);

