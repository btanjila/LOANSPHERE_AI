// backend/controllers/userController.js
import bcrypt from 'bcryptjs';
import User from '../models/UserModel.js';
import Loan from '../models/Loan.js';

const ensure = (v, msg) => {
  if (v === undefined || v === null || v === '') {
    const e = new Error(msg || 'Missing required field');
    e.statusCode = 400;
    throw e;
  }
};

// GET /api/users/me
export const getUserProfile = async (req, res) => {
  try {
    const me = await User.findById(req.user.id)
      .select('-password -kyc.aadhaarNumber -kyc.panNumber');
    if (!me) return res.status(404).json({ success: false, message: 'User not found' });
    return res.json({ success: true, user: me });
  } catch (err) {
    console.error('getUserProfile error:', err);
    return res.status(500).json({ success: false, message: 'Server error while fetching profile' });
  }
};

// PUT /api/users/me
export const updateUserProfile = async (req, res) => {
  try {
    const { name, phone, address, profileImage } = req.body || {};
    const user = await User.findById(req.user.id);
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
    console.error('updateUserProfile error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
};

// PUT /api/users/me/password
export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body || {};
    ensure(oldPassword, 'Old password is required');
    ensure(newPassword, 'New password is required');

    const user = await User.findById(req.user.id).select('+password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const ok = await bcrypt.compare(oldPassword, user.password);
    if (!ok) return res.status(400).json({ success: false, message: 'Old password is incorrect' });

    if (String(newPassword).length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error('changePassword error:', err);
    return res.status(500).json({ success: false, message: 'Failed to change password' });
  }
};

// PUT /api/users/me/kyc
export const upsertKYC = async (req, res) => {
  try {
    const { aadhaarNumber, panNumber, isVerified } = req.body || {};
    const user = await User.findById(req.user.id).select('+kyc.aadhaarNumber +kyc.panNumber');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (!user.kyc) user.kyc = {};
    if (aadhaarNumber !== undefined) user.kyc.aadhaarNumber = String(aadhaarNumber).trim();
    if (panNumber !== undefined) user.kyc.panNumber = String(panNumber).trim();
    if (typeof isVerified === 'boolean') user.kyc.isVerified = isVerified;

    await user.save();

    const sanitized = user.toObject();
    if (sanitized.kyc) {
      delete sanitized.kyc.aadhaarNumber;
      delete sanitized.kyc.panNumber;
    }

    return res.json({ success: true, message: 'KYC updated', user: sanitized });
  } catch (err) {
    console.error('upsertKYC error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update KYC' });
  }
};

// GET /api/users/me/cibil   (borrower only, via authorize middleware)
export const getUserCIBILScore = async (req, res) => {
  try {
    const loans = await Loan.find({ borrower: req.user.id }).lean();

    if (!loans || loans.length === 0) {
      const me = await User.findById(req.user.id).lean();
      return res.status(200).json({ success: true, cibilScore: me?.cibilScore ?? 0 });
    }

    const valid = loans
      .map((l) => Number(l.cibilScore))
      .filter((n) => Number.isFinite(n) && n >= 300 && n <= 900);

    const avg = valid.length ? Math.round(valid.reduce((s, n) => s + n, 0) / valid.length) : 0;
    return res.status(200).json({ success: true, cibilScore: avg });
  } catch (err) {
    console.error('getUserCIBILScore error:', err);
    return res.status(500).json({ success: false, message: 'Failed to calculate CIBIL score' });
  }
};
