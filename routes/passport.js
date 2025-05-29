const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const LinkedInStrategy = require("passport-linkedin-oauth2").Strategy;
const User = require("../models/user"); // adjust the path to your model

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  const user = await User.findById(id);
  done(null, user);
});

// Google Strategy
passport.use(new GoogleStrategy({
  clientID: "abc",
  clientSecret: "abc",
  callbackURL: "/api/auth/google/callback",
}, async (accessToken, refreshToken, profile, done) => {
  const email = profile.emails[0].value;
  let user = await User.findOne({ email });

  if (!user) {
    user = await User.create({
      email,
      name: profile.displayName,
      provider: "google",
      password: null,
      plan: "Free",
    });
  }

  done(null, user);
}));


// LinkedIn Strategy
passport.use(new LinkedInStrategy({
  clientID: "your-linkedin-client-id-here",
  clientSecret: "your-linkedin-client-secret-here",
  callbackURL: "/api/auth/linkedin/callback",
  scope: ["r_emailaddress", "r_liteprofile"],
}, async (accessToken, tokenSecret, profile, done) => {
  const email = profile.emails[0].value;
  let user = await User.findOne({ email });

  if (!user) {
    user = await User.create({
      email,
      name: profile.displayName,
      provider: "linkedin",
      password: null,
      plan: "Free",
    });
  }

  done(null, user);
}));

