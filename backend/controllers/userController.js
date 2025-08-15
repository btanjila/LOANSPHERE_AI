// backend/controllers/userController.js
import User from '../models/UserModel.js';
import Loan from '../models/Loan.js';
import jwt from 'jsonwebtoken';

// helper: generate access token
const generateAccessToken = (user) => {
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable not set');
  return jwt.sign(
    { id: user._id, role: user.role },
    JWT_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY || '1d' }
  );
};

// helper: generate refresh token
const generateRefreshToken = (user) => {
  const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
  if (!JWT_REFRESH_SECRET) throw new Error('JWT_REFRESH_SECRET environment variable not set');
  return jwt.sign(
    { id: user._id, role: user.role },
    JWT_REFRESH_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY || '7d' }
  );
};

// @desc    Authenticate user and get tokens (login)
// @route   POST /api/auth/login
// @access  Public
export const authUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Send refresh token as HttpOnly cookie (path matches your refresh endpoint)
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: (() => {
        const days = parseInt(process.env.REFRESH_TOKEN_EXPIRY?.replace('d','')) || 7;
        return days * 24 * 60 * 60 * 1000;
      })(),
      path: '/api/auth/refresh-token',
    });

    res.status(200).json({
      success: true,
      token: accessToken,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('❌ Auth Error:', error.message);
    res.status(500).json({ success: false, message: 'Server error while logging in' });
  }
};

// @desc    Get current logged-in user profile
// @route   GET /api/users/profile
// @access  Private
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password -kyc.aadhaarNumber -kyc.panNumber');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({ success: true, user });
  } catch (err) {
    console.error('❌ Get Profile Error:', err.message);
    res.status(500).json({ success: false, message: 'Server error while fetching profile' });
  }
};

// @desc    Calculate average CIBIL score for current user
// @route   GET /api/users/cibil
// @access  Private
export const getUserCIBILScore = async (req, res) => {
  try {
    // NOTE: loans use borrower field in the Loan model
    const loans = await Loan.find({ borrower: req.user._id }).lean();

    if (!loans || loans.length === 0) {
      return res.status(200).json({ success: true, cibilScore: 0 });
    }

    const validScores = loans
      .map((loan) => Number(loan.cibilScore))
      .filter((score) => Number.isFinite(score) && score >= 300 && score <= 900);

    if (validScores.length === 0) {
      return res.status(200).json({ success: true, cibilScore: 0 });
    }

    const avgScore = Math.round(validScores.reduce((sum, score) => sum + score, 0) / validScores.length);

    res.status(200).json({ success: true, cibilScore: avgScore });
  } catch (err) {
    console.error('❌ CIBIL Score Fetch Error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to calculate CIBIL score' });
  }
};

// @desc    Refresh access token using refresh token cookie
// @route   POST /api/auth/refresh-token
// @access  Public (uses refresh token cookie)
export const refreshToken = (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Refresh token missing' });
    }

    const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
    const JWT_SECRET = process.env.JWT_SECRET;

    if (!JWT_REFRESH_SECRET || !JWT_SECRET) {
      return res.status(500).json({ success: false, message: 'Server configuration error' });
    }

    jwt.verify(token, JWT_REFRESH_SECRET, (err, decoded) => {
      if (err) {
        console.error('Refresh token verify error:', err);
        return res.status(403).json({ success: false, message: 'Invalid refresh token' });
      }

      const newAccessToken = jwt.sign(
        { id: decoded.id, role: decoded.role },
        JWT_SECRET,
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRY || '1d' }
      );

      res.json({ success: true, token: newAccessToken });
    });
  } catch (error) {
    console.error('❌ Refresh Token Error:', error);
    res.status(500).json({ success: false, message: 'Failed to refresh token' });
  }
};

// @desc    Logout user and clear refresh token cookie
// @route   POST /api/auth/logout
// @access  Public (or Private depending on your design)
export const logoutUser = (req, res) => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth/refresh-token',
  });
  res.json({ success: true, message: 'Logged out successfully' });
};
