// backend/controllers/authController.js
import jwt from 'jsonwebtoken';
import User from '../models/UserModel.js';
import { body } from 'express-validator';
import rateLimit from 'express-rate-limit';

/**
 * NOTE:
 * - Ensure dotenv.config() is run early in your server entry (server.js) so process.env is populated.
 * - Ensure cookie-parser middleware is enabled in server.js (app.use(cookieParser())) so refresh token cookie can be read.
 */

const allowedRoles = ['admin', 'borrower', 'lender'];

/* -------------------------
  Validation rules (express-validator)
   ------------------------- */
export const registerValidationRules = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[a-z]/).withMessage('Password must contain a lowercase letter')
    .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
    .matches(/\d/).withMessage('Password must contain a number')
    .matches(/[!@#$%^&*]/).withMessage('Password must contain a special character'),
  body('role').optional().isIn(allowedRoles).withMessage('Invalid role'),
];

export const loginValidationRules = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

/* -------------------------
  Rate limiter (for login)
   ------------------------- */
export const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5,
  message: {
    success: false,
    message: 'Too many login attempts, please try again after 10 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/* -------------------------
  Helpers: generate tokens
   ------------------------- */
const generateAccessToken = (user) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET env var not set');
  // short lived access token
  return jwt.sign({ id: user._id, role: user.role }, secret, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRY || '1d',
  });
};

const generateRefreshToken = (user) => {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error('JWT_REFRESH_SECRET env var not set');
  // longer lived refresh token
  return jwt.sign({ id: user._id, role: user.role }, secret, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRY || '7d',
  });
};

/* -------------------------
  Controller: Register
   ------------------------- */
export const registerUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    }

    const normalizedEmail = email.toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    const userRole = allowedRoles.includes(role) ? role : 'borrower';

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: userRole,
    });

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // send refresh token as httpOnly cookie
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: (process.env.REFRESH_COOKIE_MAX_AGE && Number(process.env.REFRESH_COOKIE_MAX_AGE)) || 7 * 24 * 60 * 60 * 1000,
      path: '/api/auth/refresh-token',
    };
    res.cookie('refreshToken', refreshToken, cookieOptions);

    return res.status(201).json({
      success: true,
      token: accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('❌ Register Error:', error);
    // If generate token failed due to missing env, return 500
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* -------------------------
  Controller: Login
   ------------------------- */
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required' });

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    // Account lockout (optional fields in user model)
    if (user && user.lockUntil && user.lockUntil > Date.now()) {
      return res.status(423).json({
        success: false,
        message: 'Account temporarily locked due to multiple failed login attempts. Try again later.',
      });
    }

    if (!user || !(await user.matchPassword(password))) {
      // increment failed attempts if user exists (optional)
      if (user) {
        user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
        if (user.failedLoginAttempts >= 5) {
          user.lockUntil = Date.now() + 15 * 60 * 1000; // 15 min lock
        }
        await user.save();
      }
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // successful login: reset failed attempts (optional)
    if (user.failedLoginAttempts || user.lockUntil) {
      user.failedLoginAttempts = 0;
      user.lockUntil = null;
      await user.save();
    }

    // generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: (process.env.REFRESH_COOKIE_MAX_AGE && Number(process.env.REFRESH_COOKIE_MAX_AGE)) || 7 * 24 * 60 * 60 * 1000,
      path: '/api/auth/refresh-token',
    };
    res.cookie('refreshToken', refreshToken, cookieOptions);

    return res.json({
      success: true,
      token: accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('❌ Login Error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* -------------------------
  Controller: Refresh access token
  POST /api/auth/refresh-token (reads cookie)
   ------------------------- */
export const refreshToken = (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ success: false, message: 'Refresh token missing' });

    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret) {
      console.error('JWT_REFRESH_SECRET not set for refresh endpoint');
      return res.status(500).json({ success: false, message: 'Server configuration error' });
    }

    jwt.verify(token, secret, (err, decoded) => {
      if (err) {
        return res.status(403).json({ success: false, message: 'Invalid refresh token' });
      }

      const accessSecret = process.env.JWT_SECRET;
      if (!accessSecret) {
        console.error('JWT_SECRET not set when generating access token');
        return res.status(500).json({ success: false, message: 'Server configuration error' });
      }

      const newAccessToken = jwt.sign({ id: decoded.id, role: decoded.role }, accessSecret, {
        expiresIn: process.env.ACCESS_TOKEN_EXPIRY || '1d',
      });

      return res.json({ success: true, token: newAccessToken });
    });
  } catch (error) {
    console.error('❌ Refresh Token Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to refresh token' });
  }
};

/* -------------------------
  Controller: Logout - clear refresh cookie
   ------------------------- */
export const logoutUser = (req, res) => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth/refresh-token',
  });
  return res.json({ success: true, message: 'Logged out successfully' });
};

export default {
  registerUser,
  loginUser,
  refreshToken,
  logoutUser,
  registerValidationRules,
  loginValidationRules,
  loginLimiter,
};
