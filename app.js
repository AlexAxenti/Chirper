require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");

const app = express();
app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended: true}));

app.use(session({
  secret: process.env.SECRET_KEY,
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(process.env.MONGO_URL, {useNewUrlParser: true, useUnifiedTopology: true});

const userSchema = new mongoose.Schema({
  username: String,
  password: String
});
userSchema.plugin(passportLocalMongoose);
const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.get("/", (req, res) => {
  res.render("index");
})

app.get("/login", (req, res) => {
  res.render("login");
})

app.get("/register", (req, res) => {
  res.render("register");
})

app.get("/social", (req, res) => {
  if(req.isAuthenticated()){
    res.render("social");
    console.log(req.user);
  } else {
    res.redirect("/login");
  }
})

app.post("/logout", (req, res) => {
  req.logout();
  res.redirect("/");
})

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
  User.register({username: req.body.username}, req.body.password, function(err, user){
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
