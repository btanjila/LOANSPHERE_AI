// backend/controllers/loanController.js
import mongoose from 'mongoose';
import Loan from '../models/Loan.js';
import User from '../models/UserModel.js';
import calculateEMI from '../utils/calculateEMI.js';
import { fetchCibilScore } from '../utils/cibilService.js';
import { evaluateLoanRisk } from '../utils/loanRiskEvaluator.js';
import { sendEmail } from '../utils/emailService.js';
import { disburseLoan, payEMI } from './walletController.js';
import Wallet from '../models/WalletModel.js';
/* ========================================================================
 * Small utilities
 * ====================================================================== */

/** Standard server error responder */
const respondServerError = (res, context, err) => {
  console.error(`❌ ${context} error:`, err);
  return res.status(500).json({ success: false, message: 'Server error' });
};

/** Robust number parsing (null-safe, with default) */
const num = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

/** Simple role guard */
const assertRole = (req, res, roles) => {
  const ok = roles.includes(req.user?.role);
  if (!ok) {
    res.status(403).json({ success: false, message: `Only ${roles.join('/')} allowed` });
  }
  return ok;
};

/** Normalize a Loan doc for frontend (strip secrets, keep aliases stable) */
const normalizeLoanForFrontend = (loanDocOrObj) => {
  if (!loanDocOrObj) return loanDocOrObj;

  const loan =
    typeof loanDocOrObj.toObject === 'function'
      ? loanDocOrObj.toObject()
      : { ...loanDocOrObj };

  // Frontend convenience: mirror borrower to user
  loan.user = loan.borrower || loan.user || null;

  // Normalize amount field if UI expects `amount`
  loan.amount =
    loan.amountRequested != null
      ? Number(loan.amountRequested)
      : num(loan.amount);

  // Remove any sensitive subfields
  const scrubUser = (u) => {
    if (!u || typeof u !== 'object') return u;
    const c = { ...u };
    delete c.password;
    delete c.refreshToken;
    if (c.kyc) {
      delete c.kyc.aadhaarNumber;
      delete c.kyc.panNumber;
    }
    return c;
  };

  if (loan.borrower && typeof loan.borrower === 'object') {
    loan.borrower = scrubUser(loan.borrower);
    loan.user = loan.borrower;
  }
  if (Array.isArray(loan.lenders)) {
    loan.lenders = loan.lenders.map((ln) => {
      const clean = { ...ln };
      if (clean.lender && typeof clean.lender === 'object') {
        clean.lender = scrubUser(clean.lender);
      }
      return clean;
    });
  }

  return loan;
};

/** Email sender with graceful fallback for object/legacy signatures */
const sendEmailSafe = async ({ to, subject, text, html }) => {
  if (!to || !subject) return;
  if (typeof sendEmail !== 'function') {
    console.warn('sendEmail is not a function');
    return;
  }
  try {
    // object signature
    await sendEmail({ to, subject, text, html });
    return;
  } catch {
    // legacy signature
  }
  try {
    const body = html ?? text ?? '';
    await sendEmail(to, subject, body);
  } catch (err) {
    console.error('Failed to send email (both attempts):', err);
  }
};

/* ========================================================================
 * Controllers
 * ====================================================================== */

/**
 * POST /api/loans
 * Borrower applies for a loan
 * body: { amount, tenure, interestRate, purpose }
 */
const applyLoan = async (req, res) => {
  try {
    if (!assertRole(req, res, ['borrower'])) return;

    const { amount, tenure, interestRate, purpose } = req.body || {};
    const parsedAmount = num(amount);
    const parsedTenure = num(tenure);
    const parsedInterest = num(interestRate, null);

    if (
      !parsedAmount || parsedAmount <= 0 ||
      !parsedTenure || parsedTenure <= 0 ||
      parsedInterest == null || parsedInterest < 0 ||
      !purpose || typeof purpose !== 'string' || !purpose.trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Valid amount (>0), tenure (>0 months), interestRate (>=0) and purpose (non-empty string) are required',
      });
    }

    // EMI calculation (returns { emi, totalPayment, emiSchedule })
    const emiDetails = calculateEMI(parsedAmount, parsedTenure, parsedInterest);

    // Try external CIBIL first, then fallback to profile/default
    let cibilScore = null;
    try {
      const fetched = await fetchCibilScore({
        name: req.user?.name,
        pan: req.user?.kyc?.panNumber,
        mobile: req.user?.phone,
        email: req.user?.email,
      });

      if (typeof fetched === 'number' && Number.isFinite(fetched)) {
        cibilScore = fetched;
      } else if (fetched && typeof fetched === 'object') {
        const possible =
          fetched.score ?? fetched.cibilScore ?? fetched.data?.score ?? fetched?.result?.score;
        if (typeof possible === 'number' && Number.isFinite(possible)) cibilScore = possible;
      }
    } catch (e) {
      console.warn('CIBIL service error (falling back):', e?.message || e);
    }
    if (cibilScore == null) cibilScore = num(req.user?.cibilScore, 700);

    // Risk evaluation (may auto-reject)
    const { isRejected, riskScore, reason } = evaluateLoanRisk({
      amount: parsedAmount,
      tenure: parsedTenure,
      cibilScore,
      purpose: purpose.trim(),
    });

    // Persist loan
    const loan = await Loan.create({
      borrower: req.user._id,
      amountRequested: parsedAmount,
      tenure: parsedTenure,
      interestRate: parsedInterest,
      purpose: purpose.trim(),
      emi: emiDetails.emi,
      totalPayment: emiDetails.totalPayment,
      emiSchedule: emiDetails.emiSchedule,
      cibilScore,
      status: isRejected ? 'rejected' : 'pending',
      amountFunded: 0,
      lenders: [],
      transactions: [],
    });

    // Fire-and-forget notify borrower
    (async () => {
      await sendEmailSafe({
        to: req.user.email,
        subject: isRejected ? 'Loan Application - Rejected' : 'Loan Application - Received',
        text: isRejected
          ? `Your loan application was automatically rejected. Reason: ${reason} (risk score ${riskScore}).`
          : `Your loan application has been received and is pending review.`,
      });
    })().catch(() => {});

    return res
      .status(201)
      .json({
        success: true,
        message: 'Loan application submitted successfully',
        loan: normalizeLoanForFrontend(loan),
      });
  } catch (error) {
    return respondServerError(res, 'Apply loan', error);
  }
};

/**
 * POST /api/loans/:id/fund
 * Lender funds a loan (partial or full)
 * body: { amount }
 */
const fundLoan = async (req, res) => {
  try {
    if (!assertRole(req, res, ['lender'])) return;

    const addAmount = num(req.body?.amount);
    if (!addAmount || addAmount <= 0) return res.status(400).json({ success: false, message: 'Amount must be positive' });

    const loan = await Loan.findById(req.params.id);
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });
    if (!['approved', 'funding'].includes(loan.status)) return res.status(400).json({ success: false, message: 'Loan not open for funding' });

    const remaining = num(loan.amountRequested) - num(loan.amountFunded);
    if (addAmount > remaining) return res.status(400).json({ success: false, message: `Exceeds remaining: ${remaining}` });

    loan.amountFunded += addAmount;
    loan.lenders.push({ lender: req.user._id, amount: addAmount, dateFunded: new Date() });

    if (loan.amountFunded >= loan.amountRequested) {
      loan.status = 'disbursed';
      await loan.save();
      await disburseLoan(loan._id);
    } else if (loan.status === 'approved') {
      loan.status = 'funding';
      await loan.save();
    } else {
      await loan.save();
    }

    res.json({ success: true, message: 'Loan funded', loan: normalizeLoanForFrontend(loan) });
  } catch (error) {
    respondServerError(res, 'Fund loan', error);
  }
};


/**
 * POST /api/loans/repayment
 * Borrower records repayment (EMI)
 * body: { loanId, amount }
 */
const recordRepayment = async (req, res) => {
  try {
    if (!assertRole(req, res, ['borrower'])) return;

    const { loanId, amount } = req.body;
    const payAmount = num(amount);
    if (!loanId || payAmount <= 0) return res.status(400).json({ success: false, message: 'Loan ID and positive amount required' });

    const loan = await Loan.findById(loanId);
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });
    if (loan.borrower.toString() !== req.user._id.toString()) return res.status(403).json({ success: false, message: 'Unauthorized' });
    if (loan.status !== 'disbursed') return res.status(400).json({ success: false, message: 'Loan not active for repayment' });

    const schedule = loan.emiSchedule || [];
    const nextDueIndex = schedule.findIndex(e => !e.paid);
    if (nextDueIndex === -1) return res.status(400).json({ success: false, message: 'All EMIs already paid' });
    const nextDue = schedule[nextDueIndex];
    if (payAmount < num(nextDue.amount)) return res.status(400).json({ success: false, message: 'Amount less than EMI due' });

    schedule[nextDueIndex].paid = true;
    schedule[nextDueIndex].paidOn = new Date();
    loan.transactions.push({ type: 'repayment', amount: payAmount, date: new Date(), from: req.user._id, to: loan.borrower, remarks: `EMI month ${nextDueIndex + 1}` });
    loan.emiSchedule = schedule;

    await payEMI(loanId, req.user._id, payAmount);

    const allPaid = loan.emiSchedule.every(e => e.paid);
    if (allPaid) loan.status = 'closed';
    await loan.save();

    res.json({ success: true, message: 'Repayment recorded', loan: normalizeLoanForFrontend(loan) });
  } catch (error) {
    respondServerError(res, 'Record repayment', error);
  }
};

/**
 * GET /api/loans
 * Hybrid list: admin -> all loans, borrower -> own loans
 * Returns array directly (your frontend expects an array)
 */
const getLoansHybrid = async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { borrower: req.user._id };
    const loans = await Loan.find(filter)
      .populate('borrower', 'name email phone address')
      .populate('lenders.lender', 'name email phone address')
      .sort({ createdAt: -1 })
      .lean();

    const normalized = (loans || []).map(normalizeLoanForFrontend);
    return res.json(normalized);
  } catch (error) {
    return respondServerError(res, 'Get loans', error);
  }
};

/**
 * GET /api/loans/:id
 * Get single loan with access control (admin or owner borrower)
 */
const getLoanByIdHybrid = async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id)
      .populate('borrower', 'name email phone address')
      .populate('lenders.lender', 'name email phone address');

    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });

    const borrowerId =
      loan.borrower && (loan.borrower._id ?? loan.borrower);
    const borrowerIdStr =
      borrowerId && typeof borrowerId.toString === 'function'
        ? borrowerId.toString()
        : String(borrowerId);

    if (req.user.role !== 'admin' && borrowerIdStr !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    return res.json({ success: true, loan: normalizeLoanForFrontend(loan) });
  } catch (error) {
    return respondServerError(res, 'Get loan by ID', error);
  }
};

/**
 * PUT /api/loans/:id  (body: { status })
 * Admin updates loan status (with light transition guards)
 */
const updateLoanStatus = async (req, res) => {
  try {
    if (!assertRole(req, res, ['admin'])) return;

    const { status } = req.body || {};
    const validStatuses = ['pending', 'approved', 'rejected', 'funding', 'disbursed', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const loan = await Loan.findById(req.params.id)
      .populate('borrower', 'email name');

    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });

    // Guard basic illegal transitions
    if (loan.status === 'rejected' && status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Rejected loans can only move back to pending' });
    }
    if (status === 'disbursed' && num(loan.amountFunded) < num(loan.amountRequested)) {
      return res.status(400).json({ success: false, message: 'Cannot mark disbursed before fully funded' });
    }

    loan.status = status;
    await loan.save();

    // notify borrower (non-blocking)
    (async () => {
      try {
        const borrowerEmail = loan.borrower?.email;
        if (borrowerEmail) {
          await sendEmailSafe({
            to: borrowerEmail,
            subject: `Loan status updated: ${status}`,
            text: `Your loan status has been updated to ${status}.`,
          });
        }
      } catch (e) {
        console.warn('Status notification suppressed:', e?.message || e);
      }
    })().catch(() => {});

    return res.json({
      success: true,
      message: `Loan status updated to ${status}`,
      loan: normalizeLoanForFrontend(loan),
    });
  } catch (error) {
    return respondServerError(res, 'Update loan status', error);
  }
};

/** Admin convenience wrappers (match your routes) */
const approveLoan = (req, res) => { req.body.status = 'approved'; return updateLoanStatus(req, res); };
const rejectLoan = (req, res) => { req.body.status = 'rejected'; return updateLoanStatus(req, res); };
const markPending = (req, res) => { req.body.status = 'pending'; return updateLoanStatus(req, res); };

/**
 * DELETE /api/loans/:id
 * Admin deletes a loan
 */
const deleteLoan = async (req, res) => {
  try {
    if (!assertRole(req, res, ['admin'])) return;

    const loan = await Loan.findById(req.params.id);
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });

    await loan.deleteOne();
    return res.json({ success: true, message: 'Loan deleted successfully' });
  } catch (error) {
    return respondServerError(res, 'Delete loan', error);
  }
};

/**
 * GET /api/loans/myloans
 * Borrower -> their own loans (returns array)
 */
const getUserLoans = async (req, res) => {
  try {
    const loans = await Loan.find({ borrower: req.user._id })
      .populate('borrower', 'name email phone address')
      .populate('lenders.lender', 'name email phone address')
      .sort({ createdAt: -1 })
      .lean();

    const normalized = (loans || []).map(normalizeLoanForFrontend);
    return res.json(normalized);
  } catch (error) {
    return respondServerError(res, 'Get user loans', error);
  }
};

/**
 * GET /api/loans/cibil
 * Calculate average CIBIL for current borrower (fallback to user.cibilScore)
 */
const calculateCIBIL = async (req, res) => {
  try {
    const loans = await Loan.find({ borrower: req.user._id }).lean();
    if (!loans || loans.length === 0) {
      return res.json({ success: true, cibilScore: num(req.user?.cibilScore, 0) });
    }
    const valid = loans
      .map((l) => num(l.cibilScore, NaN))
      .filter((n) => Number.isFinite(n) && n >= 300 && n <= 900);

    const avg = valid.length ? Math.round(valid.reduce((s, n) => s + n, 0) / valid.length) : 0;
    return res.json({ success: true, cibilScore: avg });
  } catch (error) {
    return respondServerError(res, 'Calculate CIBIL', error);
  }
};

/* ========================================================================
 * Exports
 * ====================================================================== */
export {
  applyLoan,
  fundLoan,
  recordRepayment,
  getLoansHybrid,
  getLoanByIdHybrid,
  updateLoanStatus,
  approveLoan,
  rejectLoan,
  deleteLoan,
  getUserLoans,
  calculateCIBIL,
  markPending,
  normalizeLoanForFrontend,
  disburseLoan,
  payEMI
};
