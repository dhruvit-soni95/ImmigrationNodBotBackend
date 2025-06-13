const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const LinkedInStrategy = require("passport-linkedin-oauth2").Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const User = require("../models/user"); // adjust the path to your model

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
      clientID: "78dxmfhlj5uitq",
      clientSecret: "WPL_AP1.woi2Xah0UOBfTR7R.iyrSeQ==",
      callbackURL: "https://www.immigrategpt.ca/api/auth/linkedin/callback",
      // scope: ["r_emailaddress", "r_liteprofile"],
      scope: ['r_emailaddress', 'r_liteprofile'],
      state: true
    },
    async (accessToken, tokenSecret, profile, done) => {
      const email = profile.emails[0].value;
      let user = await User.findOne({ email });

      if (!user) {
          const uniqueMobile = await generateUniqueRandomMobile();
        user = await User.create({
          email,
          name: profile.displayName,
          provider: "linkedin",
          password: null,
          plan: "Free",
          mobile: uniqueMobile,
        });
      }

      done(null, user);
    }
  )
);


const { OIDCStrategy } = require('passport-azure-ad');


passport.use(new OIDCStrategy({
  identityMetadata: 'https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration',
  clientID: "abc",
  clientSecret: "abc",
  responseType: 'code',
  responseMode: 'query',
  redirectUrl: 'http://localhost:5000/api/auth/microsoft/callback',
  allowHttpForRedirectUrl: true,
  scope: ['openid', 'profile', 'email'],
  passReqToCallback: false,
}, async (issuer, sub, profile, accessToken, refreshToken, params, done) => {
  try {
    const email = profile._json.preferred_username;
    const name = profile.displayName || 'Microsoft User';

    // Implement your user retrieval/creation logic here
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        email,
        name,
        provider: 'microsoft',
        password: null,
        plan: 'Free',
        // Add other necessary fields
      });
    }

    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));
