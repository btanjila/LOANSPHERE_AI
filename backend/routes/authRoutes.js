// backend/routes/authRoutes.js
import express from 'express';
import {
  registerUser,
  loginUser,
  registerValidationRules,
  loginValidationRules,
  loginLimiter,
  refreshAuthToken,
} from '../controllers/authController.js';

const router = express.Router();

// Register
router.post('/register', registerValidationRules, registerUser);

// Login (+ limiter)
router.post('/login', loginLimiter, loginValidationRules, loginUser);

// Refresh access token using refreshToken in body
router.post('/refresh', refreshAuthToken);

export default router;
