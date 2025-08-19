// backend/routes/userRoutes.js
import express from 'express';
import {
  getUserProfile,
  updateUserProfile,
  changePassword,
  upsertKYC,
  getUserCIBILScore,
} from '../controllers/userController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Current user
router.get('/me', protect, getUserProfile);
router.put('/me', protect, updateUserProfile);
router.put('/me/password', protect, changePassword);
router.put('/me/kyc', protect, upsertKYC);

// Borrower-only CIBIL
router.get('/me/cibil', protect, authorize(['borrower']), getUserCIBILScore);

export default router;
