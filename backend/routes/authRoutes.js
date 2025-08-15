// backend/routes/authRoutes.js
import express from 'express';
import {
  registerUser,
  loginUser,
  loginLimiter,
  registerValidationRules,
  loginValidationRules,
} from '../controllers/authController.js';

import {
  refreshToken,
  logoutUser,
} from '../controllers/userController.js';

import { validateRequest } from '../middleware/validationMiddleware.js';

const router = express.Router();

/**
 * POST /api/auth/register
 * - validation rules -> validateRequest -> controller
 */
router.post('/register', registerValidationRules, validateRequest, registerUser);

/**
 * POST /api/auth/login
 * - rate limiter applied to slow brute-force attacks
 * - validation rules -> validateRequest -> controller
 */
router.post('/login', loginLimiter, loginValidationRules, validateRequest, loginUser);

/**
 * POST /api/auth/refresh-token
 * - uses refresh token cookie to issue a new access token
 */
router.post('/refresh-token', refreshToken);

/**
 * POST /api/auth/logout
 * - clear refresh token cookie
 */
router.post('/logout', logoutUser);

export default router;
