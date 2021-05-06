require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const path = require("path");

const app = express();
app.use(express.static("public"));
//app.use(express.static(__dirname + '/public/'));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended: true}));

app.use(session({
  secret: process.env.SECRET_KEY,
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

/*                             Database Schemas                           */

mongoose.connect(process.env.MONGO_URL, {useNewUrlParser: true, useUnifiedTopology: true});

const postSchema = new mongoose.Schema({
  username: String,
  content: String,
  posted: Date
})
const Post = new mongoose.model("Post", postSchema);

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  bio: String,
  posts: [postSchema]
});
userSchema.plugin(passportLocalMongoose);
const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

/*                             Get Requests                         */

app.get("/", (req, res) => {
  res.render("index");
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/register", (req, res) => {
  res.render("register");
});

app.get("/social", (req, res) => {
  if(req.isAuthenticated()){
    res.render("social",{username:req.user.username});
    console.log(req.user);
  } else {
    res.redirect("/login");
  }
});

// app.get("/social", (req, res) => {
//     res.render("social",{username:"testing"});
// })

app.get("/profile/testing", (req, res) => {
  res.render("profile", {user:{username:"testing", posts:[{content:"hello there", posted:"2021-04-30"}, {content:"testing post", posted:"2021-04-25"}]}, currentUser:true});
});

app.get("/profile/:userName", (req, res) => {
  const userName = req.params.userName;
  if(req.isAuthenticated()){
    User.findOne({username: userName}, function(err, foundUser){
      if(err){
        console.log(err);
      } else {
        if(foundUser){
          if(userName === req.user.username){
            res.render("profile", {user:foundUser, currentUser:true});
          } else {
            res.render("profile", {user:foundUser, currentUser:false});
          }
        } else {
          res.send("This user does not exist");
        }
        // foundList.items.push(item);
        // foundList.save();
        // res.redirect("/" + listName);
      }
    })
    console.log(req.user);
  } else {
    res.redirect("/login");
  }
})

/*                             Post Requests                         */

app.post("/logout", (req, res) => {
  req.logout();
  res.redirect("/");
});

app.post("/profile", (req, res) => {
  //const username = req.user.username;
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
  const yyyy = today.getFullYear();
  const date = yyyy+"-"+mm+"-"+dd
  console.log(date);
  const post = new Post({
    username: req.user.username,
    content: req.body.postContent,
    posted: date
  });
  User.findOne({username:req.user.username}, function(err, foundUser){
    if(err){
      console.log(err);
    } else {
      if(foundUser){
        foundUser.posts.push(post);
        foundUser.save();
        res.redirect("/profile/"+req.user.username);
      } else {
        res.send("Error no user exists");
      }
    }
  });
});
///.*username.*/
app.post("/search", (req, res) => {
  if(req.isAuthenticated()){
    const searchedUsername = req.body.searchName;
    User.find({username:{ $regex: searchedUsername, $options: "i"}}, function(err, foundUsers){
    //User.find({username:/.*test.*/}, function(err, foundUsers){
      if(err){
        console.log(err);
      } else {
        res.render("search", {foundUsers: foundUsers, searchedUsername: searchedUsername});
      }
    });
  } else {
    res.redirect("/login");
  }
});

/*                            Login and Register                         */

app.post("/login", (req, res) => {
  const user = new User({
    username: req.body.username,
    password: req.body.password
  });

  passport.authenticate("local", function(err, user){
    if(err){
      console.log(err);
    } else {
      if(user) {
        req.login(user, function(err){
          res.redirect("/social");
          console.log("Successfully logged in");
        });
      } else {
        res.redirect("/login");
      }
    }
  })(req, res);
});

app.post("/register", (req, res) => {
  User.register({username: req.body.username, bio: ""}, req.body.password, function(err, user){
    if(err){
      console.log(err);
      res.redirect("/register");
    } else {
      passport.authenticate("local")(req, res, function(){
        res.redirect("/social");
        console.log("Successfully registered");
      });
    }
  });
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Server successfully started");
})
