// backend/routes/cibil.js
import express from 'express';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * GET /api/cibil/score
 * - Protected route (user must be logged in)
 * - Returns a mock CIBIL score (600 - 800) for demo/testing purposes
 *
 * NOTE:
 * Replace/mock logic as needed with real service or deterministic calculation.
 */
router.get('/score', protect, (req, res) => {
  const score = Math.floor(Math.random() * 201) + 600; // 600..800
  res.json({ success: true, cibilScore: score });
});

export default router;
