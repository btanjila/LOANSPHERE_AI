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

// Borrower routes
router.post('/', protect, authorize(['borrower']), applyLoan);
router.get('/cibil', protect, authorize(['borrower']), calculateCIBIL);
router.get('/myloans', protect, authorize(['borrower']), getUserLoans);
router.post('/repayment', protect, authorize(['borrower']), recordRepayment);

// Lender route
router.post('/:id/fund', protect, authorize(['lender']), fundLoan);

// Admin routes
router.put('/:id/approve', protect, authorize(['admin']), approveLoan);
router.put('/:id/reject', protect, authorize(['admin']), rejectLoan);
router.put('/:id/pending', protect, authorize(['admin']), markPending);
router.delete('/:id', protect, authorize(['admin']), deleteLoan);

// Hybrid
router.get('/', protect, getLoansHybrid);
router.get('/:id', protect, getLoanByIdHybrid);

export default router;
