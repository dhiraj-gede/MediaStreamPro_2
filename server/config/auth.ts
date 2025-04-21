import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { logger } from '../utils/logger';
import { User } from '../models/mongoose/user';

// GitHub OAuth configurations
// These values should be set as environment variables
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const CALLBACK_URL = process.env.GITHUB_CALLBACK_URL || 'http://localhost:5000/auth/github/callback';

// Initialize passport with GitHub OAuth strategy
export function configurePassport(): void {
  // Serialize user ID to the session
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  // Deserialize user from the session
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });

  // Set up GitHub strategy
  passport.use(
    new GitHubStrategy(
      {
        clientID: GITHUB_CLIENT_ID,
        clientSecret: GITHUB_CLIENT_SECRET,
        callbackURL: CALLBACK_URL,
        scope: ['user:email'],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Check if user already exists
          let user = await User.findOne({ githubId: profile.id });

          if (!user) {
            // Create new user if not found
            user = await User.create({
              githubId: profile.id,
              username: profile.username,
              displayName: profile.displayName || profile.username,
              email: profile.emails?.[0]?.value || '',
              avatar: profile.photos?.[0]?.value || '',
              accessToken,
              refreshToken,
            });
            logger.info(`Created new user: ${user.username}`);
          } else {
            // Update existing user with latest info
            user.username = profile.username || user.username;
            user.displayName = profile.displayName || profile.username || user.displayName;
            user.email = profile.emails?.[0]?.value || user.email;
            user.avatar = profile.photos?.[0]?.value || user.avatar;
            user.accessToken = accessToken;
            
            if (refreshToken) {
              user.refreshToken = refreshToken;
            }
            
            await user.save();
            logger.info(`Updated existing user: ${user.username}`);
          }

          return done(null, user);
        } catch (error) {
          logger.error('GitHub authentication error:', error);
          return done(error as Error, null);
        }
      }
    )
  );

  logger.info('Passport configured with GitHub strategy');
}

// Middleware to check if user is authenticated
export function isAuthenticated(req: any, res: any, next: any): void {
  if (req.isAuthenticated()) {
    return next();
  }
  
  res.status(401).json({ error: 'Unauthorized. Please log in.' });
}

// Middleware to check if user is an admin
export function isAdmin(req: any, res: any, next: any): void {
  if (req.isAuthenticated() && req.user.isAdmin) {
    return next();
  }
  
  res.status(403).json({ error: 'Forbidden. Admin access required.' });
}