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

router.post('/register', registerValidationRules, validateRequest, registerUser);
router.post('/login', loginLimiter, loginValidationRules, validateRequest, loginUser);

// refresh-token and logout are typically protected via cookie or token
router.post('/refresh-token', refreshToken);
router.post('/logout', logoutUser);

export default router;
