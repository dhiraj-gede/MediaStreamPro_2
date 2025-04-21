import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { Request, Response, NextFunction } from 'express';
import { User } from '../models/mongoose/user';
import { logger } from '../utils/logger';
import config from '../config';

// GitHub OAuth credentials
const GITHUB_CLIENT_ID = config.auth.github.clientID;
const GITHUB_CLIENT_SECRET = config.auth.github.clientSecret;
const CALLBACK_URL = process.env.NODE_ENV === 'production'
  ? 'http://localhost:5000/auth/github/callback' // Update with actual production URL
  : 'http://localhost:5000/auth/github/callback';

/**
 * Configure Passport for authentication
 */
export function configurePassport(): void {
  // Serialize user to session
  passport.serializeUser((user, done) => {
    done(null, (user as any)._id);
  });

  // Deserialize user from session
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (error) {
      done(error, null);
    }
  });

  // Configure GitHub strategy
  console.log('We are here', GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, CALLBACK_URL);
  if (GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET) {

    passport.use(new GitHubStrategy({
      clientID: GITHUB_CLIENT_ID,
      clientSecret: GITHUB_CLIENT_SECRET,
      callbackURL: CALLBACK_URL,
      scope: ['user:email']
    },
      async function (accessToken: string, refreshToken: string, profile: any, done: any) {
        try {
          // Check if user exists in database
          let user = await User.findOne({ githubId: profile.id });

          if (!user) {
            // Create new user if not found
            user = await User.create({
              username: profile.username || `user-${profile.id}`,
              displayName: profile.displayName || profile.username || `User ${profile.id}`,
              email: profile.emails && profile.emails[0] ? profile.emails[0].value : `user-${profile.id}@example.com`,
              avatar: profile.photos && profile.photos[0] ? profile.photos[0].value : undefined,
              githubId: profile.id,
              isAdmin: false,
              lastLogin: new Date(),
            });
            logger.info(`Created new user with GitHub ID: ${profile.id}`);
          } else {
            // Update existing user
            user.lastLogin = new Date();
            await user.save();
            logger.info(`User with GitHub ID ${profile.id} logged in`);
          }

          return done(null, user);
        } catch (error) {
          logger.error('GitHub authentication error:', error);
          return done(error as Error);
        }
      }));
    logger.info('Passport configured with GitHub strategy');
  } else {
    logger.warn('GitHub OAuth credentials missing. GitHub authentication will not be available');
  }
}

/**
 * Middleware to check if user is authenticated
 */
export function isAuthenticated(req: Request, res: Response, next: NextFunction): void {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Authentication required' });
}

/**
 * Middleware to check if user is admin
 */
export function isAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.isAuthenticated() && (req.user as any).isAdmin) {
    return next();
  }
  res.status(403).json({ error: 'Admin privileges required' });
}