// backend/routes/dashboardRoutes.js
import express from 'express';
import { getDashboardStats } from '../controllers/DashboardController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * GET /api/dashboard/stats
 * - Admin-only access
 * - Returns statistics data for dashboard
 */
router.get('/stats', protect, authorize(['admin']), getDashboardStats);

export default router;
