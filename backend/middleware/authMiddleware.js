//backend/middleware/authMiddleware.js
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/UserModel.js';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';

// Protect middleware
export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies?.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) return res.status(401).json({ message: 'Not authorized, no token' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (!mongoose.Types.ObjectId.isValid(decoded.id)) {
      return res.status(401).json({ message: 'Invalid token user ID' });
    }

    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(401).json({ message: 'User not found' });

    req.user = user;
    next();
  } catch (error) {
    console.error('Token error:', error.message);
    return res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

// Role-based authorization
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: `User role ${req.user?.role} not authorized` });
    }
    next();
  };
};

// Rate limiter
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, try again after 15 minutes',
});

// Validation
export const validateRegisterInput = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password min 8 chars')
    .matches(/\d/).withMessage('Password must contain a number')
    .matches(/[a-zA-Z]/).withMessage('Password must contain a letter')
];

export const validateLoginInput = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
];

export const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};
