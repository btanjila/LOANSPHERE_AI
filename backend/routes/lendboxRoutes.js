// backend/routes/lendboxRoutes.js
import express from 'express';
import {
  createLendboxOffer,
  getLendboxOffers,
  updateLendboxStatus,
  deleteLendboxOffer,
} from '../controllers/LendboxController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Borrowers and admins can create offers
router.post('/', protect, authorize(['borrower', 'admin']), createLendboxOffer);

// Authenticated users can view offers
router.get('/', protect, getLendboxOffers);

// Admin can change status or delete
router.put('/:id/status', protect, authorize(['admin']), updateLendboxStatus);
router.delete('/:id', protect, authorize(['admin']), deleteLendboxOffer);

export default router;
