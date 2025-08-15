// backend/models/UserModel.js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: [true, 'Name is required'], 
      trim: true,
    },
    email: { 
      type: String, 
      required: [true, 'Email is required'], 
      unique: true, 
      lowercase: true, 
      match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address'],
    },
    password: { 
      type: String, 
      required: [true, 'Password is required'],
    },
    role: {
      type: String,
      enum: ['admin', 'borrower', 'lender'], // include lender role
      default: 'borrower',
      index: true,
    },
    phone: {
      type: String,
      default: null,
      match: [/^\d{10}$/, 'Please enter a valid 10-digit phone number'],
    },
    address: {
      type: String,
      default: null,
      trim: true,
    },
    cibilScore: {
      type: Number,
      default: 700, // baseline score
      min: 300,
      max: 900,
    },
    kyc: {
      aadhaarNumber: { type: String, default: null, select: false },
      panNumber: { type: String, default: null, select: false },
      isVerified: { type: Boolean, default: false },
    },
    profileImage: {
      type: String, // URL to profile image
      default: null,
    },
    failedLoginAttempts: {
     type: Number,
     default: 0,
    },
    lockUntil: {
     type: Number, // store timestamp
     default: null,
    },

  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.matchPassword = function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

// Update CIBIL Score example method (optional)
userSchema.methods.updateCIBILScore = function (scoreDelta) {
  this.cibilScore = Math.max(300, Math.min(900, this.cibilScore + scoreDelta));
  return this.save();
};

const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;
