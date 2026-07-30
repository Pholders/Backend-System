const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
const NotificationPreferences = require('../models/NotificationPreferences');
const bcrypt = require('bcrypt');

/**
 * Passport Configuration for Authentication
 * Supports both Local (username/password) and Google OAuth strategies
 */

// Local Strategy (Email + Password)
passport.use(
  'local',
  new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password',
    },
    async (email, password, done) => {
      try {
        const user = await User.findByEmail(email);
        
        if (!user) {
          return done(null, false, { message: 'Incorrect email.' });
        }

        // Check if user has password_hash (local auth)
        if (!user.password_hash) {
          return done(null, false, { message: 'Please use OAuth login for this account.' });
        }

        // Compare passwords
        const isPasswordMatch = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordMatch) {
          return done(null, false, { message: 'Incorrect password.' });
        }

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

// Google OAuth 2.0 Strategy - Only register if credentials are provided
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    'google',
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/users/auth/google/callback',
        passReqToCallback: true,
      },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        // Check if user already exists by OAuth provider ID
        let user = await User.findByOAuthProvider('google', profile.id);

        if (user) {
          // Update profile picture if available
          if (profile.photos && profile.photos[0]) {
            await User.update(user.id, {
              oauth_profile_picture: profile.photos[0].value
            });
            user.oauth_profile_picture = profile.photos[0].value;
          }
          return done(null, user);
        }

        // Check if user exists by email
        user = await User.findByEmail(profile.emails[0].value);

        if (user) {
          // Link OAuth to existing account (Google has verified the email,
          // so we can auto-mark the account as verified if it wasn't already)
          await User.update(user.id, {
            oauth_provider: 'google',
            oauth_provider_id: profile.id,
            oauth_profile_picture: profile.photos && profile.photos[0] ? profile.photos[0].value : null
          });
          if (user.email_verified === false) {
            const verified = await User.markEmailVerified(user.id);
            if (verified) user = verified;
          }
          return done(null, user);
        }

        // Create new user
        const newUser = await User.createOAuthUser({
          first_name: profile.name.givenName || '',
          last_name: profile.name.familyName || '',
          email: profile.emails[0].value,
          oauth_provider: 'google',
          oauth_provider_id: profile.id,
          oauth_profile_picture: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
          // OAuth users don't have these required fields yet, will need to complete profile
          phone: null,
          id_passport_number: null,
          nationality: null,
        });

        // Ensure notification preferences row exists for the new patient.
        try {
          await NotificationPreferences.ensureForPatient(newUser.id);
        } catch (prefsError) {
          console.error('⚠️ Failed to create notification preferences:', prefsError.message);
        }

        return done(null, newUser);
      } catch (error) {
        return done(error);
      }
    }
  )
  );
} else {
  console.warn('⚠️  WARNING: Google OAuth credentials not configured!');
  console.warn('   Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env to enable Google OAuth');
  console.warn('   Google OAuth routes will not work until credentials are configured');
}

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

module.exports = passport;
