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

const GOOGLE_CLIENT_ID='abc'
const GOOGLE_CLIENT_SECRET='abc'
const google_URL =  "https://www.immigrategpt.ca/api/auth/google/callback"

const FACEBOOK_CLIENT_ID='abc'
const FACEBOOK_CLIENT_SECRET='abc'
const facebook_URL = "www.immigrategpt.ca/api/auth/facebook/callback"

const Microsoft_clientID= "acb"
const Microsoft_clientSecret= "abc"
const Microsoft_URL = 'http://localhost:5000/api/auth/microsoft/callback'

// Google Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID:
        GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: google_URL,
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
      clientID: FACEBOOK_CLIENT_ID,
      clientSecret: FACEBOOK_CLIENT_SECRET,
      callbackURL: facebook_URL,
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
  clientID: Microsoft_clientID,
  clientSecret: Microsoft_clientSecret,
  responseType: 'code',
  responseMode: 'query',
  redirectUrl: Microsoft_URL,
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
