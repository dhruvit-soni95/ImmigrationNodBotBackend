const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const LinkedInStrategy = require("passport-linkedin-oauth2").Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const User = require("../models/user"); // adjust the path to your model

// passport.serializeUser((user, done) => {
//   done(null, user.id);
// });

// passport.deserializeUser(async (id, done) => {
//   const user = await User.findById(id);
//   done(null, user);
// });

const generateUniqueRandomMobile = async () => {
  let mobile;
  let exists = true;

  while (exists) {
    // Generate random 10-digit number prefixed with "random:"
    const randomNumber = Math.floor(1000000000 + Math.random() * 9000000000); // 10-digit number
    mobile = "random:" + randomNumber;

    // Check if this mobile already exists
    const user = await User.findOne({ mobile });
    if (!user) {
      exists = false;
    }
  }

  return mobile;
};

// Google Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID:
        "abc",
      clientSecret: "abc",
      callbackURL: "/api/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        let user = await User.findOne({ email });

        if (!user) {
          const uniqueMobile = await generateUniqueRandomMobile();
          user = await User.create({
            email,
            name: profile.displayName,
            provider: "google",
            password: null,
            plan: "Free",
            mobile: uniqueMobile,
          });
        }

        done(null, user);
      } catch (err) {
        console.error("Google strategy error:", err);
        done(err, null);
      }
    }
  )
);



passport.use(
  new FacebookStrategy(
    {
      clientID: "abc",
      clientSecret: "abc",
      callbackURL: "/api/auth/facebook/callback",
      profileFields: ["id", "displayName", "emails"],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value || `${profile.id}@facebook.com`;
        let user = await User.findOne({ email });

        if (!user) {
          
          const uniqueMobile = await generateUniqueRandomMobile();
          // const mobile = await generateUniqueRandomMobile();
          user = await User.create({
            email,
            name: profile.displayName,
            provider: "facebook",
            password: null,
            plan: "Free",
            mobile: uniqueMobile,
          });
        }

        done(null, user);
      } catch (err) {
        console.error("Facebook strategy error:", err);
        done(err, null);
      }
    }
  )
);

// LinkedIn Strategy
passport.use(
  new LinkedInStrategy(
    {
      clientID: "your-linkedin-client-id-here",
      clientSecret: "your-linkedin-client-secret-here",
      callbackURL: "/api/auth/linkedin/callback",
      scope: ["r_emailaddress", "r_liteprofile"],
    },
    async (accessToken, tokenSecret, profile, done) => {
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
    }
  )
);
