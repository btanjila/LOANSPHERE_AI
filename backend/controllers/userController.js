// backend/controllers/userController.js
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/UserModel.js';
import Loan from '../models/Loan.js';

/* ============================================================
 * Helpers
 * ============================================================ */

const ACCESS_EXP = process.env.ACCESS_TOKEN_EXPIRY || '1d';
const REFRESH_EXP = process.env.REFRESH_TOKEN_EXPIRY || '7d';

const must = (val, msg) => {
  if (val === undefined || val === null || val === '') {
    const e = new Error(msg || 'Missing required field');
    e.statusCode = 400;
    throw e;
  }
};

const generateAccessToken = (user) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not set');
  return jwt.sign({ id: user._id, role: user.role }, secret, { expiresIn: ACCESS_EXP });
};

const generateRefreshToken = (user) => {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error('JWT_REFRESH_SECRET not set');
  return jwt.sign({ id: user._id, role: user.role }, secret, { expiresIn: REFRESH_EXP });
};

const setRefreshCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: (() => {
      // e.g. "7d" => days*24*60*60*1000
      const days = parseInt((process.env.REFRESH_TOKEN_EXPIRY || '7d').replace('d', ''), 10) || 7;
      return days * 24 * 60 * 60 * 1000;
    })(),
    path: '/api/auth/refresh-token',
  });
};

/* ============================================================
 * Auth (legacy login kept for compatibility with your userRoutes)
 * If you already use authController.loginUser, you can keep both;
 * they share the same behavior and token policy.
 * ============================================================ */

// @desc    Authenticate user and get tokens (legacy login)
// @route   POST /api/users/login  (or /api/auth/login in your older routes)
// @access  Public
export const authUser = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    must(email, 'Email is required');
    must(password, 'Password is required');

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    // lockout window
    if (user && user.lockUntil && user.lockUntil > Date.now()) {
      return res.status(423).json({
        success: false,
        message: 'Account temporarily locked due to multiple failed attempts. Try again later.',
      });
    }

    if (!user || !(await user.matchPassword(password))) {
      if (user) {
        user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
        if (user.failedLoginAttempts >= 5) {
          user.lockUntil = Date.now() + 15 * 60 * 1000; // 15 minutes
        }
        await user.save();
      }
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // success → reset counters
    if (user.failedLoginAttempts || user.lockUntil) {
      user.failedLoginAttempts = 0;
      user.lockUntil = null;
      await user.save();
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    setRefreshCookie(res, refreshToken);

    return res.status(200).json({
      success: true,
      token: accessToken,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        cibilScore: user.cibilScore,
      },
    });
  } catch (err) {
    console.error('❌ authUser error:', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Server error while logging in',
    });
  }
};

/* ============================================================
 * Profile
 * ============================================================ */

// @desc    Get current logged-in user profile
// @route   GET /api/users/me
// @access  Private
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password -kyc.aadhaarNumber -kyc.panNumber');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.status(200).json({ success: true, user });
  } catch (err) {
    console.error('❌ getUserProfile error:', err);
    return res.status(500).json({ success: false, message: 'Server error while fetching profile' });
  }
};

// @desc    Update basic profile fields (name, phone, address, profileImage)
// @route   PUT /api/users/me
// @access  Private
export const updateUserProfile = async (req, res) => {
  try {
    const { name, phone, address, profileImage } = req.body || {};

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (name !== undefined) user.name = String(name).trim();
    if (phone !== undefined) user.phone = String(phone).trim();
    if (address !== undefined) user.address = String(address).trim();
    if (profileImage !== undefined) user.profileImage = String(profileImage).trim();

    await user.save();

    const sanitized = user.toObject();
    delete sanitized.password;
    if (sanitized.kyc) {
      delete sanitized.kyc.aadhaarNumber;
      delete sanitized.kyc.panNumber;
    }

    return res.json({ success: true, message: 'Profile updated', user: sanitized });
  } catch (err) {
    console.error('❌ updateUserProfile error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
};

// @desc    Change password (oldPassword -> newPassword)
// @route   PUT /api/users/me/password
// @access  Private
export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body || {};
    must(oldPassword, 'Old password is required');
    must(newPassword, 'New password is required');

    const user = await User.findById(req.user._id).select('+password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const ok = await bcrypt.compare(oldPassword, user.password);
    if (!ok) {
      return res.status(400).json({ success: false, message: 'Old password is incorrect' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
    }

    user.password = newPassword; // will be hashed by pre-save hook
    await user.save();

    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error('❌ changePassword error:', err);
    return res.status(500).json({ success: false, message: 'Failed to change password' });
  }
};

// @desc    Upsert KYC (Aadhaar/PAN + verification flag)
// @route   PUT /api/users/me/kyc
// @access  Private
export const upsertKYC = async (req, res) => {
  try {
    const { aadhaarNumber, panNumber, isVerified } = req.body || {};
    const user = await User.findById(req.user._id).select('+kyc.aadhaarNumber +kyc.panNumber');

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // note: aadhaar/pan are select:false in model; we explicitly selected above
    if (!user.kyc) user.kyc = {};

    if (aadhaarNumber !== undefined) user.kyc.aadhaarNumber = String(aadhaarNumber).trim();
    if (panNumber !== undefined) user.kyc.panNumber = String(panNumber).trim();

    if (typeof isVerified === 'boolean') {
      user.kyc.isVerified = isVerified;
    }

    await user.save();

    // Never return raw numbers
    const sanitized = user.toObject();
    if (sanitized.kyc) {
      delete sanitized.kyc.aadhaarNumber;
      delete sanitized.kyc.panNumber;
    }

    return res.json({ success: true, message: 'KYC updated', user: sanitized });
  } catch (err) {
    console.error('❌ upsertKYC error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update KYC' });
  }
};

/* ============================================================
 * CIBIL
 * ============================================================ */

// @desc    Calculate average CIBIL score from the user's loans
// @route   GET /api/users/me/cibil
// @access  Private
export const getUserCIBILScore = async (req, res) => {
  try {
    // Your Loan model uses `borrower` field for ownership
    const loans = await Loan.find({ borrower: req.user._id }).lean();

    if (!loans || loans.length === 0) {
      // fallback to profile score
      const me = await User.findById(req.user._id).lean();
      return res.status(200).json({ success: true, cibilScore: me?.cibilScore ?? 0 });
    }

    const valid = loans
      .map((l) => Number(l.cibilScore))
      .filter((n) => Number.isFinite(n) && n >= 300 && n <= 900);

    const avg = valid.length
      ? Math.round(valid.reduce((s, n) => s + n, 0) / valid.length)
      : 0;

    return res.status(200).json({ success: true, cibilScore: avg });
  } catch (err) {
    console.error('❌ getUserCIBILScore error:', err);
    return res.status(500).json({ success: false, message: 'Failed to calculate CIBIL score' });
  }
};

/* ============================================================
 * Token refresh & logout (used by your authRoutes)
 * ============================================================ */

// @desc    Refresh access token using refresh token cookie
// @route   POST /api/auth/refresh-token
// @access  Public (relies on HttpOnly cookie)
export const refreshToken = (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Refresh token missing' });
    }

    const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
    const ACCESS_SECRET = process.env.JWT_SECRET;
    if (!REFRESH_SECRET || !ACCESS_SECRET) {
      console.error('JWT secrets not configured');
      return res.status(500).json({ success: false, message: 'Server configuration error' });
    }

    jwt.verify(token, REFRESH_SECRET, (err, decoded) => {
      if (err) {
        return res.status(403).json({ success: false, message: 'Invalid refresh token' });
      }

      const newAccessToken = jwt.sign(
        { id: decoded.id, role: decoded.role },
        ACCESS_SECRET,
        { expiresIn: ACCESS_EXP }
      );

      return res.json({ success: true, token: newAccessToken });
    });
  } catch (err) {
    console.error('❌ refreshToken error:', err);
    return res.status(500).json({ success: false, message: 'Failed to refresh token' });
  }
};

// @desc    Logout (clear refresh cookie)
// @route   POST /api/auth/logout
// @access  Public
export const logoutUser = (req, res) => {
  try {
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth/refresh-token',
    });
    return res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    console.error('❌ logoutUser error:', err);
    return res.status(500).json({ success: false, message: 'Failed to logout' });
  }
};

/* ============================================================
 * Default export (optional, if you import as an object elsewhere)
 * ============================================================ */
export default {
  authUser,
  getUserProfile,
  updateUserProfile,
  changePassword,
  upsertKYC,
  getUserCIBILScore,
  refreshToken,
  logoutUser,
};
