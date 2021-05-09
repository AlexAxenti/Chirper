require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const path = require("path");

const app = express();
//app.use(express.static("public"));
app.use(express.static(path.join(__dirname,'/public')));
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
  likes: Number,
  posted: String
});
const Post = new mongoose.model("Post", postSchema);

const bioSchema = new mongoose.Schema({
  description: String,
  location: String,
  accountCreated: Date
});
const Bio = new mongoose.model("Bio", bioSchema);

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  bio: bioSchema,
  friendRequests: [String],
  friends: [String],
  posts: [{type: mongoose.Schema.Types.ObjectId, ref: "Post"}]
  //posts: [postSchema]
});
userSchema.plugin(passportLocalMongoose, {usernameLowerCase: true});
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
//
// app.get("/profile/testing", (req, res) => {
//   res.render("profile", {user:{username:"testing", posts:[{content:"hello there", posted:"2021-04-30"}, {content:"testing post", posted:"2021-04-25"}]}, currentUser:true});
// });

app.get("/profile/:userName", (req, res) => {
  const userName = req.params.userName;
  if(req.isAuthenticated()){
    var isFriend = false;
    if(req.user.friends.includes(userName)){
      isFriend = true;
    }
    User.findOne({username: userName}, function(err, foundUser){
      if(err){
        console.log(err);
      } else {
        if(foundUser){
          var userPostIds = foundUser.posts;
          Post.find({
            _id: { $in: userPostIds }
          }, function(err, posts){
            if(err){
              console.log(err)
            } else {
              if(userName === req.user.username){
                res.render("profile", {user:foundUser, posts: posts, currentUser:true, isFriend: isFriend});
              } else {
                res.render("profile", {user:foundUser, posts: posts, currentUser:false, isFriend: isFriend});
              }
            }
          })
        } else {
          res.send("This user does not exist");
        }
      }
    })
  } else {
    res.redirect("/login");
  }
})

app.get("/profile/:userName/friends", (req, res) => {
  const userName = req.params.userName;
  if(req.isAuthenticated()){
    User.findOne({username: userName}, function(err, foundUser){
      if(err){
        console.log(err);
      } else {
        if(foundUser){
          res.render("friendlist", {user: foundUser});
        } else {
          res.send("User not found");
        }
      }
    });
  }

});

/*                             Post Requests                         */

app.post("/profile", (req, res) => {
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
  const yyyy = today.getFullYear();
  const hr = today.getHours();
  const mt = today.getMinutes();
  const date = yyyy+"-"+mm+"-"+dd + " " + hr + ":" + mt;
  console.log(date);
  const post = new Post({
    username: req.user.username,
    content: req.body.postContent,
    posted: date
  });
  post.save();
  User.findOne({username:req.user.username}, function(err, foundUser){
    if(err){
      console.log(err);
    } else {
      if(foundUser){
        foundUser.posts.push(post._id);
        foundUser.save();
        res.redirect("/profile/"+req.user.username);
      } else {
        res.send("Error no user exists");
      }
    }
  });
});

app.post("/profile/bio", (req, res) => {
  if(req.isAuthenticated()){
    const newDescription = req.body.description;
    const newLocation = req.body.location;
    User.findOneAndUpdate({username:req.user.username}, {bio:{description: newDescription, location: newLocation}}, function(err, foundUser){
      if(err){
        console.log(err);
      } else {
        res.redirect("/profile/"+req.user.username);
      }
    });
  } else {
    res.redirect("/login");
  }
});

app.post("/profile/addfriend", (req, res) => {
  if(req.isAuthenticated()){
    const addedUsername = req.body.addedFriend;
    const loggedInUsername = req.user.username;
    User.findOne({username:addedUsername}, function(err, foundUser){
      if(err){
        console.log(err);
      } else {
        if(req.user.friendRequests.includes(addedUsername)){
          req.user.friends.push(addedUsername);
          req.user.friendRequests.splice(req.user.friendRequests.indexOf(addedUsername), 1);
          req.user.save();

          foundUser.friends.push(loggedInUsername);
          foundUser.save();
        } else if(!foundUser.friendRequests.includes(loggedInUsername) &&
                  !foundUser.friends.includes(loggedInUsername)){
          foundUser.friendRequests.push(loggedInUsername);
          foundUser.save();
        }
        res.redirect("/profile/"+addedUsername);
      }
    });
  } else {
    res.redirect("/login");
  }
});

app.post("/profile/acceptfriend", (req, res) => {
  if(req.isAuthenticated()){
    const acceptedUsername = req.body.acceptedFriend;
    User.findOne({username: acceptedUsername}, function(err, foundUser){
      if(err){
        console.log(err);
      } else {
        req.user.friendRequests.splice(req.user.friendRequests.indexOf(acceptedUsername), 1);
        if(!req.user.friends.includes(acceptedUsername)){
          req.user.friends.push(acceptedUsername);
          req.user.save();
        }
        if(!foundUser.friends.includes(req.user.username)){
          foundUser.friends.push(req.user.username);
          foundUser.save();
        }
        res.redirect("/profile/"+req.user.username);
      }
    });
  } else {
    res.redirect("/login");
  }
});

app.post("/search", (req, res) => {
  if(req.isAuthenticated()){
    const searchedUsername = req.body.searchName;
    User.find({username:{ $regex: searchedUsername, $options: "i"}}, function(err, foundUsers){
    //User.find({username:/.*test.*/}, function(err, foundUsers){
      if(err){
        console.log(err);
      } else {
        foundUsers.sort(function(a, b) {
          return a.username.length - b.username.length;
        })
        res.render("search", {foundUsers: foundUsers, searchedUsername: searchedUsername});
      }
    });
  } else {
    res.redirect("/login");
  }
});

/*                           User Authentication Stuff                         */

app.post("/login", (req, res) => {
  const username = req.body.username.toLowerCase();
  // const user = new User({
  //   username: username,
  //   password: req.body.password
  // });

  passport.authenticate("local", function(err, user){
    //console.log(user);
    if(err){
      console.log(err);
    } else {
      if(user) {
        req.login(user, function(err){
          res.redirect("/social");
          console.log("Successfully logged in");
        });
      } else {
        //console.log(user);
        res.redirect("/login");
      }
    }
  })(req, res);
});

app.post("/register", (req, res) => {
  const username = req.body.username.toLowerCase();
  const initialDescription = "Hi, I'm " + username;
  User.register({
    username: username,
    bio: {
      description: initialDescription,
      location: "",
      accountCreated: new Date()
    }
  }, req.body.password, function(err, user){
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

app.post("/logout", (req, res) => {
  req.logout();
  res.redirect("/");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Server successfully started");
})
