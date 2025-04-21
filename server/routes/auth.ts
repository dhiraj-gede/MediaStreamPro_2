import { Router, Request, Response } from 'express';
import passport from 'passport';
import { isAuthenticated } from '../config/auth';
import { logger } from '../utils/logger';

const router = Router();

/**
 * @route   GET /auth/github
 * @desc    Authenticate with GitHub
 * @access  Public
 */
router.get('/auth/github', passport.authenticate('github', { scope: ['user:email'] }));

/**
 * @route   GET /auth/github/callback
 * @desc    GitHub auth callback
 * @access  Public
 */
router.get(
  '/auth/github/callback',
  passport.authenticate('github', {
    failureRedirect: '/auth/login?error=github-auth-failed',
  }),
  (req: Request, res: Response) => {
    logger.info(`User authenticated: ${(req.user as any)?.username}`);
    // Successful authentication, redirect to dashboard
    res.redirect('/dashboard');
  }
);

/**
 * @route   GET /auth/user
 * @desc    Get current user info
 * @access  Private
 */
router.get('/auth/user', isAuthenticated, (req: Request, res: Response) => {
  const user = req.user;
  res.json({
    id: (user as any)?._id,
    username: (user as any)?.username,
    displayName: (user as any)?.displayName,
    email: (user as any)?.email,
    avatar: (user as any)?.avatar,
    isAdmin: (user as any)?.isAdmin,
  });
});

/**
 * @route   GET /auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.get('/auth/logout', (req: Request, res: Response) => {
  req.logout((err) => {
    if (err) {
      logger.error('Logout error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

/**
 * @route   GET /auth/status
 * @desc    Check auth status
 * @access  Public
 */
router.get('/auth/status', (req: Request, res: Response) => {
  res.json({
    isAuthenticated: req.isAuthenticated(),
    user: req.isAuthenticated() ? {
      id: (req.user as any)?._id,
      username: (req.user as any)?.username,
      displayName: (req.user as any)?.displayName,
      avatar: (req.user as any)?.avatar,
    } : null,
  });
});

export function registerAuthRoutes(app: any): void {
  app.use(router);
  logger.info('Auth routes registered');
}