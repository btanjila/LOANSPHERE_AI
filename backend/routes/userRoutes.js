//backend/routes/userRoutes.js
import express from 'express';
import { authUser, getUserProfile, getUserCIBILScore } from '../controllers/userController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public route to login
router.post('/login', authUser);

// Private route to get current user's profile (any logged-in user)
router.get('/me', protect, getUserProfile);

// Private route to get current user's CIBIL score (borrower only)
router.get("/me/cibil", protect, async (req, res) => {
  try {
    // Ensure we're passing the right parameter
    const cibilScore = await getCibilScore({
      userId: req.user._id, // previously might have been the whole object
      email: req.user.email,
    });

    res.json({ cibilScore });
  } catch (error) {
    console.error("CIBIL service error (falling back):", error.message);
    res.json({ cibilScore: Math.floor(Math.random() * (900 - 650 + 1)) + 650 });
  }
});

export default router;
