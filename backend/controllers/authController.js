// backend/controllers/authController.js
import User from '../models/UserModel.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';

/* ============================= Helpers ============================= */
const ACCESS_EXP = process.env.JWT_EXPIRES_IN || '1h';
const REFRESH_EXP = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

const signAccess = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: ACCESS_EXP });

const signRefresh = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_EXP });

const pickUser = (u) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  phone: u.phone ?? null,
  address: u.address ?? null,
  cibilScore: u.cibilScore ?? null,
});

/* ====================== Validation + Limiter ======================= */
export const registerValidationRules = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be ≥ 6 chars'),
  body('role').optional().isIn(['admin', 'borrower', 'lender']).withMessage('Invalid role'),
  body('phone').optional().isString(),
  body('address').optional().isString(),
];

export const loginValidationRules = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts, try again later.' },
});

/* ========================= Controllers ============================ */

// POST /api/auth/register
export const registerUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, errors: errors.array() });

    const { name, email, password, role, phone, address } = req.body;
    const normalizedEmail = String(email).trim().toLowerCase();

    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashed,
      role: role || 'borrower',
      phone: phone ?? null,
      address: address ?? null,
      cibilScore: 700, // default baseline
    });

    const token = signAccess(user._id, user.role);
    const refreshToken = signRefresh(user._id, user.role);

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: pickUser(user),
      token,
      refreshToken,
    });
  } catch (err) {
    console.error('Register Error:', err);
    return res.status(500).json({ success: false, message: 'Server Error during registration' });
  }
};

// POST /api/auth/login
export const loginUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, errors: errors.array() });

    const { email, password } = req.body;
    const normalizedEmail = String(email).trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Optional lockout support if your schema has these fields
    if (user.lockUntil && user.lockUntil > Date.now()) {
      return res.status(403).json({ success: false, message: 'Account locked. Try again later.' });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      if (typeof user.failedLoginAttempts === 'number') {
        user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
        if (user.failedLoginAttempts >= 5) {
          user.lockUntil = Date.now() + 15 * 60 * 1000;
        }
        await user.save();
      }
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Reset attempts
    if (typeof user.failedLoginAttempts === 'number') {
      user.failedLoginAttempts = 0;
      user.lockUntil = null;
      await user.save();
    }

    const token = signAccess(user._id, user.role);
    const refreshToken = signRefresh(user._id, user.role);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      user: pickUser(user),
      token,
      refreshToken,
    });
  } catch (err) {
    console.error('Login Error:', err);
    return res.status(500).json({ success: false, message: 'Server Error during login' });
  }
};

// POST /api/auth/refresh  { refreshToken }
export const refreshAuthToken = async (req, res) => {
  try {
    const { refreshToken } = req.body || {};
    if (!refreshToken) {
      return res.status(400).json({ success: false, message: 'Refresh token required' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const newAccess = signAccess(decoded.id, decoded.role);
    return res.status(200).json({ success: true, message: 'Token refreshed', token: newAccess });
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
  }
};
