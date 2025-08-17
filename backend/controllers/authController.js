// backend/controllers/authController.js
import User from '../models/UserModel.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';

/**
 * ===========================================================
 * Helper Functions
 * ===========================================================
 */

// Generate JWT Token
const generateToken = (userId, role) => {
  return jwt.sign({ id: userId, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  });
};

// Generate Refresh Token
const generateRefreshToken = (userId, role) => {
  return jwt.sign({ id: userId, role }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
};

/**
 * ===========================================================
 * Middlewares: Validations & Rate Limiters
 * ===========================================================
 */

// Registration Validation
export const registerValidationRules = [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password should be at least 6 characters long'),
  body('role')
    .optional()
    .isIn(['admin', 'borrower', 'lender'])
    .withMessage('Invalid role specified'),
];

// Login Validation
export const loginValidationRules = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

// Login Rate Limiter (Prevent brute force)
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: { success: false, message: 'Too many login attempts, please try again later.' },
});

/**
 * ===========================================================
 * Controller Functions
 * ===========================================================
 */

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
export const registerUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, email, password, role, phone, address } = req.body;

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists with this email.' });
    }

    // Create new user
    const user = await User.create({
      name,
      email,
      password,
      role: role || 'borrower',
      phone,
      address,
      cibilScore: 700, // default baseline score
    });

    // Tokens
    const token = generateToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id, user.role);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        address: user.address,
        cibilScore: user.cibilScore,
      },
      token,
      refreshToken,
    });
  } catch (error) {
    console.error('Register Error:', error.message);
    res.status(500).json({ success: false, message: 'Server Error during registration' });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const loginUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Account lock check
    if (user.lockUntil && user.lockUntil > Date.now()) {
      return res.status(403).json({ success: false, message: 'Account locked. Try again later.' });
    }

    // Validate password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      user.failedLoginAttempts += 1;

      if (user.failedLoginAttempts >= 5) {
        user.lockUntil = Date.now() + 15 * 60 * 1000; // lock for 15 mins
        await user.save();
        return res.status(403).json({ success: false, message: 'Account locked due to too many failed attempts.' });
      }

      await user.save();
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Reset failed attempts
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    // Tokens
    const token = generateToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id, user.role);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        cibilScore: user.cibilScore,
      },
      token,
      refreshToken,
    });
  } catch (error) {
    console.error('Login Error:', error.message);
    res.status(500).json({ success: false, message: 'Server Error during login' });
  }
};
