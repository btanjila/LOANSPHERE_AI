// backend/routes/loanRoutes.js
import express from 'express';
import {
  applyLoan,
  fundLoan,
  recordRepayment,
  getLoansHybrid,
  getLoanByIdHybrid,
  approveLoan,
  rejectLoan,
  markPending,
  deleteLoan,
  calculateCIBIL,
  getUserLoans
} from '../controllers/loanController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * =================================
 * 📌 BORROWER ROUTES
 * =================================
 */

// Apply for a new loan
router.post('/', protect, authorize(['borrower']), applyLoan);

// View CIBIL score
router.get('/cibil', protect, authorize(['borrower']), calculateCIBIL);

// View all loans by the borrower
router.get('/myloans', protect, authorize(['borrower']), getUserLoans);

// Record EMI repayment
router.post('/repayment', protect, authorize(['borrower']), recordRepayment);

/**
 * =================================
 * 📌 LENDER ROUTES
 * =================================
 */

// Fund an existing loan
router.post('/:id/fund', protect, authorize(['lender']), fundLoan);

/**
 * =================================
 * 📌 ADMIN ROUTES
 * =================================
 */

// Approve loan (also updates CIBIL + sends email)
router.put('/:id/approve', protect, authorize(['admin']), approveLoan);

// Reject loan
router.put('/:id/reject', protect, authorize(['admin']), rejectLoan);

// Mark loan as pending
router.put('/:id/pending', protect, authorize(['admin']), markPending);

// Delete loan
router.delete('/:id', protect, authorize(['admin']), deleteLoan);

/**
 * =================================
 * 📌 HYBRID ROUTES (Admin sees all, borrower sees only their own)
 * =================================
 */

// Get all loans (role-specific results)
router.get('/', protect, getLoansHybrid);

// Get loan by ID (must be admin or owner borrower)
router.get('/:id', protect, getLoanByIdHybrid);

export default router;
