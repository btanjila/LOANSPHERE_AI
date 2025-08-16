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

/**
 * POST /api/lendbox
 * - Borrowers (and admin) can create offers
 */
router.post('/', protect, authorize(['borrower', 'admin']), createLendboxOffer);

/**
 * GET /api/lendbox
 * - Authenticated users can view offers
 */
router.get('/', protect, getLendboxOffers);

/**
 * PUT /api/lendbox/:id/status
 * - Admin can change status of an offer
 */
router.put('/:id/status', protect, authorize(['admin']), updateLendboxStatus);

/**
 * DELETE /api/lendbox/:id
 * - Admin can remove an offer
 */
router.delete('/:id', protect, authorize(['admin']), deleteLendboxOffer);

export default router;
