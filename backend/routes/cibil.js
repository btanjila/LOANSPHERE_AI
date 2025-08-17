// backend/routes/cibil.js
import express from 'express';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/score', protect, (req, res) => {
  const score = Math.floor(Math.random() * 201) + 600; // 600..800
  res.json({ success: true, cibilScore: score });
});

export default router;
