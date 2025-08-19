// backend/routes/dashboardRoutes.js
import express from 'express';
import {
  getAdminDashboard,
  getBorrowerDashboard,
  getLenderDashboard
} from '../controllers/DashboardController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Admin dashboard stats
router.get('/admin', protect, authorize(['admin']), getAdminDashboard);

// Borrower dashboard
router.get('/borrower', protect, authorize(['borrower']), getBorrowerDashboard);

// Lender dashboard
router.get('/lender', protect, authorize(['lender']), getLenderDashboard);

export default router;
