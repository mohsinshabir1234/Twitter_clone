const express = require("express");
const app = express();
const path = require("path");
const mongoose = require("mongoose");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const session = require("express-session");

mongoose
  .connect("mongodb://localhost:27017/twitter", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.log("Error connecting to MongoDB:", err));

const db = mongoose.connection;
db.on("error", console.error.bind(console, "Error connecting to MongoDB"));

app.set("view engine", "ejs");

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
});

const tweetSchema = new mongoose.Schema({
  tweet: {
    type: String,
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  comment: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      // },
    },
  ],
});

const User = mongoose.model("User", userSchema);
const Tweet = mongoose.model("Tweet", tweetSchema);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: "secret",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    async (email, password, done) => {
      try {
        const user = await User.findOne({ email });
        if (!user || user.password !== password) {
          return done(null, false, { message: "Invalid email or password" });
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});
app.post("/like", (req, res) => {});
app.get("/", (req, res) => {
  res.render(path.join(__dirname, "/views/login.ejs"));
});

app.get("/signup", (req, res) => {
  res.render(path.join(__dirname, "/views/signup.ejs"));
});

app.post("/signup", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const newUser = new User({ username, email, password });
    await newUser.save();
    res.redirect("/loginsignup?signupSuccess=true");
  } catch (err) {
    console.error("Error signing up:", err);
  }
});

app.post("/unlike/:tweetId", async (req, res) => {
  try {
    const { tweetId } = req.params;
    const { userId } = req.body;

    const tweet = await Tweet.findById(tweetId);
    if (!tweet) {
      return res.status(404).json({ message: "Tweet not found" });
    }

    const likeIndex = tweet.likes.findIndex(
      (like) => like.user.toString() === userId
    );
    if (likeIndex === -1) {
      return res.status(400).json({ message: "You haven't liked this tweet" });
    }

    tweet.likes.splice(likeIndex, 1);
    await tweet.save();

    res.status(200).json({ message: "Tweet unliked successfully", tweet });
  } catch (error) {
    console.error("Error unliking tweet:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/loginsignup", (req, res) => {
  const hasSignedUp = req.query.signupSuccess === "true";
  res.render(path.join(__dirname, "/views/loginsignup.ejs"), { hasSignedUp });
});

app.get("/search/users", async (req, res) => {
  try {
    const { query } = req.query;

    const matchingUsers = await User.find({
      $or: [
        { username: { $regex: new RegExp(query, "i") } },
        { email: { $regex: new RegExp(query, "i") } },
      ],
    });

    res.render("searchResult", { users: matchingUsers });
  } catch (error) {
    console.error("Error searching for users:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/login", (req, res) => {
  res.render(path.join(__dirname, "/views/login.ejs"));
});

app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/index",
    failureRedirect: "/login",
  })
);
app.get("/index", async (req, res) => {
  try {
    const getAlltweets = await Tweet.find();
    res.render(path.join(__dirname, "/views/index"), {
      user: req.user,
      alltweets: getAlltweets,
    });
  } catch (error) {
    res.status(500).send("Error in retreving tweets from database");
  }
});

app.get("/profilepage", (req, res) => {
  if (req.isAuthenticated()) {
    res.render(path.join(__dirname, "/views/profilepage.ejs"), {
      user: req.user,
    });
  } else {
    res.redirect("/login");
  }
});

app.get("/search", (req, res) => {
  res.render(path.join(__dirname, "/views/search.ejs"));
});
app.get("/edit/username", async (req, res) => {
  res.render(path.join(__dirname, "/views/editUsername.ejs"));
});

app.post("/edit/username", async (req, res) => {
  try {
    const newUsername = req.body.newUsername;
    const userId = req.user._id;
    console.log(userId);
    const resp = await User.findByIdAndUpdate(userId, {
      username: newUsername,
    });
    console.log(resp);
    res.redirect("/profilepage");
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal error");
  }
});

app.get("/edit/email", async (req, res) => {
  res.render(path.join(__dirname, "/views/editEmail.ejs"));
});

app.post("/edit/email", async (req, res) => {
  try {
    const newEmail = req.body.newEmail;
    console.log(newEmail);
    const userId = req.user._id;
    await User.findByIdAndUpdate(userId, { email: newEmail });
    res.redirect("/profilepage");
  } catch (error) {
    console.log(error);
    res.status(500).send("Error updating email");
  }
});

app.get("/edit/password", (req, res) => {
  res.render(path.join(__dirname, "/views/passwordChange"));
});

app.post("/edit/password", async (req, res) => {
  try {
    const newPassword = req.body.newPassword;
    const userid = req.user._id;
    await User.findByIdAndUpdate(userid, { password: newPassword });
    res.redirect("/profilepage");
  } catch (error) {
    console.log(error);
    res.sendStatus(500).send("Error updating password!");
  }
});

app.post("/post_tweet", async (req, res) => {
  try {
    const { tweet } = req.body;
    const { user } = req.user;
    const newTweet = new Tweet({ tweet, user });
    await newTweet.save();
    const allTweets = await Tweet.find();
    res.render(path.join(__dirname, "/views/tweetspage.ejs"), { allTweets });
  } catch (error) {
    console.error("Error posting tweets: ", error);
  }
});

const PORT = process.env.PORT || 2000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
