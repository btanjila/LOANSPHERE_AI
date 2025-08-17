// backend/routes/userRoutes.js
import express from 'express';
import { authUser, getUserProfile, getUserCIBILScore } from '../controllers/userController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validationMiddleware.js';

const router = express.Router();

router.post('/login', authUser);
router.get('/me', protect, getUserProfile);
router.get('/me/cibil', protect, authorize(['borrower']), getUserCIBILScore);

export default router;
