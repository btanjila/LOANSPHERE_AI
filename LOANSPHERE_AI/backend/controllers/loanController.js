// backend/controllers/loanController.js

import Loan from '../models/Loan.js';
import User from '../models/UserModel.js';
import calculateEMI from '../utils/calculateEMI.js';
import { fetchCibilScore } from '../utils/cibilService.js';
import { evaluateLoanRisk } from '../utils/loanRiskEvaluator.js';
import { sendEmail } from '../utils/emailService.js';

/* ------------------------------------------------------------------
 * Small helpers
 * ------------------------------------------------------------------ */

/** Standard server error responder */
const respondServerError = (res, context, err) => {
  console.error(`${context} error:`, err);
  return res.status(500).json({ success: false, message: 'Server error' });
};

/** Robust number parsing (null-safe) */
const num = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

/** Quick role gate */
const assertRole = (req, res, roles) => {
  const ok = roles.includes(req.user?.role);
  if (!ok) {
    res.status(403).json({ success: false, message: `Only ${roles.join('/')} allowed` });
  }
  return ok;
};

/**
 * Normalize a Loan document (or plain object) for the frontend:
 *  - Adds `user` mirror of `borrower`
 *  - Normalizes `amount` to `amountRequested` if present
 *  - Strips sensitive nested fields
 */
const normalizeLoanForFrontend = (loanDocOrObj) => {
  if (!loanDocOrObj) return loanDocOrObj;

  const loan =
    typeof loanDocOrObj.toObject === 'function'
      ? loanDocOrObj.toObject()
      : { ...loanDocOrObj };

  // mirror borrower to user for frontend table convenience
  loan.user = loan.borrower || loan.user || null;

  // amount aliasing to keep UI stable
  loan.amount =
    loan.amountRequested != null
      ? Number(loan.amountRequested)
      : num(loan.amount);

  // safety: remove secrets if somehow present
  if (loan.user && typeof loan.user === 'object') {
    if ('password' in loan.user) delete loan.user.password;
    if ('refreshToken' in loan.user) delete loan.user.refreshToken;
  }

  // lenders list may include embedded users – trim sensitive subfields
  if (Array.isArray(loan.lenders)) {
    loan.lenders = loan.lenders.map((ln) => {
      const clean = { ...ln };
      if (clean.lender && typeof clean.lender === 'object') {
        const l = { ...clean.lender };
        delete l.password;
        delete l.refreshToken;
        clean.lender = l;
      }
      return clean;
    });
  }

  return loan;
};

/** Email sender that supports both object-style and legacy signature */
const sendEmailSafe = async ({ to, subject, text, html }) => {
  if (!to || !subject) return;
  if (typeof sendEmail !== 'function') {
    console.warn('sendEmail is not a function');
    return;
  }

  // Try modern/object call
  try {
    await sendEmail({ to, subject, text, html });
    return;
  } catch (errObjCall) {
    // Fall back to legacy signature: (to, subject, body)
  }

  try {
    const body = html ?? text ?? '';
    await sendEmail(to, subject, body);
  } catch (errSigCall) {
    console.error('Failed to send email (both attempts):', errSigCall);
  }
};

/* ------------------------------------------------------------------
 * Controllers
 * ------------------------------------------------------------------ */

/**
 * POST /api/loans
 * Borrower applies for a loan
 * body: { amount, tenure, interestRate, purpose }
 */
const applyLoan = async (req, res) => {
  try {
    if (!assertRole(req, res, ['borrower'])) return;

    const { amount, tenure, interestRate, purpose } = req.body;
    const parsedAmount = num(amount);
    const parsedTenure = num(tenure);
    const parsedInterest = num(interestRate, null);

    if (
      !parsedAmount || parsedAmount <= 0 ||
      !parsedTenure || parsedTenure <= 0 ||
      parsedInterest == null || parsedInterest < 0 ||
      !purpose || typeof purpose !== 'string'
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Valid amount (>0), tenure (>0 months), interestRate (>=0) and purpose (string) are required',
      });
    }

    // EMI calculation
    const emiDetails = calculateEMI(parsedAmount, parsedTenure, parsedInterest);

    // Try external CIBIL, then fall back to user-stored/default
    let cibilScore = null;
    try {
      const fetched = await fetchCibilScore({
        name: req.user?.name,
        pan: req.user?.kyc?.panNumber,
        mobile: req.user?.phone,
        email: req.user?.email,
      });

      if (typeof fetched === 'number' && !Number.isNaN(fetched)) {
        cibilScore = fetched;
      } else if (fetched && typeof fetched === 'object') {
        const possible = fetched.score ?? fetched.cibilScore ?? fetched.data?.score;
        if (typeof possible === 'number' && !Number.isNaN(possible)) cibilScore = possible;
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
      purpose,
    });

    // Persist loan
    const loan = await Loan.create({
      borrower: req.user._id,
      amountRequested: parsedAmount,
      tenure: parsedTenure,
      interestRate: parsedInterest,
      purpose: (purpose || '').trim(),
      emi: emiDetails.emi,
      totalPayment: emiDetails.totalPayment,
      emiSchedule: emiDetails.emiSchedule,
      cibilScore,
      status: isRejected ? 'rejected' : 'pending',
      amountFunded: 0,
      lenders: [],
      transactions: [],
    });

    // Fire-and-forget notify
    (async () => {
      await sendEmailSafe({
        to: req.user.email,
        subject: isRejected ? 'Loan Application - Rejected' : 'Loan Application - Received',
        text: isRejected
          ? `Your loan application was automatically rejected. Reason: ${reason} (risk score ${riskScore}).`
          : `Your loan application has been received and is pending review.`,
      });
    })().catch(() => {});

    const loanObj = normalizeLoanForFrontend(loan);
    return res
      .status(201)
      .json({ success: true, message: 'Loan application submitted successfully', loan: loanObj });
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
    if (!addAmount || addAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Funding amount must be a positive number' });
    }

    const loan = await Loan.findById(req.params.id);
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });

    if (!['approved', 'funding'].includes(loan.status)) {
      return res.status(400).json({ success: false, message: 'Loan not open for funding' });
    }

    const newAmountFunded = num(loan.amountFunded) + addAmount;
    if (newAmountFunded > num(loan.amountRequested)) {
      return res.status(400).json({ success: false, message: 'Funding exceeds requested amount' });
    }

    loan.lenders = Array.isArray(loan.lenders) ? loan.lenders : [];
    loan.lenders.push({ lender: req.user._id, amount: addAmount, dateFunded: new Date() });
    loan.amountFunded = newAmountFunded;

    if (loan.amountFunded >= num(loan.amountRequested)) {
      // Fully funded → mark disbursed and create disbursement tx
      loan.status = 'disbursed';
      loan.transactions = Array.isArray(loan.transactions) ? loan.transactions : [];
      loan.transactions.push({
        type: 'disbursement',
        amount: num(loan.amountRequested),
        date: new Date(),
        from: null,
        to: loan.borrower,
        remarks: 'Loan fully funded and disbursed',
      });
    } else {
      loan.status = 'funding';
    }

    await loan.save();

    // notify borrower (non-blocking)
    (async () => {
      try {
        await loan.populate({ path: 'borrower', select: 'email name' });
        const borrowerEmail = loan.borrower?.email;
        if (borrowerEmail) {
          await sendEmailSafe({
            to: borrowerEmail,
            subject: 'Loan Funding Update',
            text:
              loan.status === 'disbursed'
                ? `Your loan has been fully funded and disbursed.`
                : `Your loan has received a new funding of ₹${addAmount.toLocaleString('en-IN')}. Total funded: ₹${loan.amountFunded.toLocaleString('en-IN')}.`,
          });
        }
      } catch (e) {
        console.warn('Funding notification suppressed:', e?.message || e);
      }
    })().catch(() => {});

    const loanObj = normalizeLoanForFrontend(loan);
    return res.json({ success: true, message: 'Loan funded successfully', loan: loanObj });
  } catch (error) {
    return respondServerError(res, 'Fund loan', error);
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

    if (!loanId || !payAmount || payAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Loan ID and positive amount are required' });
    }

    const loan = await Loan.findById(loanId);
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });

    // owner check
    const borrowerIdStr =
      loan.borrower && typeof loan.borrower.toString === 'function'
        ? loan.borrower.toString()
        : `${loan.borrower}`;

    if (borrowerIdStr !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    if (loan.status !== 'disbursed') {
      return res.status(400).json({ success: false, message: 'Loan not active for repayment' });
    }

    const schedule = Array.isArray(loan.emiSchedule) ? loan.emiSchedule : [];
    const nextDueIndex = schedule.findIndex((emi) => !emi.paid);
    if (nextDueIndex === -1) {
      return res.status(400).json({ success: false, message: 'All installments already paid' });
    }

    const nextDue = schedule[nextDueIndex];
    if (payAmount < num(nextDue.amount)) {
      return res.status(400).json({ success: false, message: 'Amount less than EMI due' });
    }

    // mark paid
    schedule[nextDueIndex].paid = true;
    schedule[nextDueIndex].paidOn = new Date();
    loan.emiSchedule = schedule;

    // record tx
    loan.transactions = Array.isArray(loan.transactions) ? loan.transactions : [];
    loan.transactions.push({
      type: 'repayment',
      amount: payAmount,
      date: new Date(),
      from: loan.borrower,
      to: null,
      remarks: 'EMI repayment',
    });

    // close if all paid
    const allPaid = loan.emiSchedule.every((emi) => emi.paid);
    if (allPaid) loan.status = 'closed';

    await loan.save();

    const loanObj = normalizeLoanForFrontend(loan);
    return res.json({ success: true, message: 'Repayment recorded', loan: loanObj });
  } catch (error) {
    return respondServerError(res, 'Record repayment', error);
  }
};

/**
 * GET /api/loans
 * Hybrid list: admin -> all loans, borrower -> own loans
 * Returns array directly (frontend expects array)
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
 * Get single loan with access control (admin or borrower owner)
 */
const getLoanByIdHybrid = async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id)
      .populate('borrower', 'name email phone address')
      .populate('lenders.lender', 'name email phone address')
      .lean();

    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });

    const borrowerId = loan.borrower && (loan.borrower._id ?? loan.borrower);
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
 * Admin updates loan status
 */
const updateLoanStatus = async (req, res) => {
  try {
    if (!assertRole(req, res, ['admin'])) return;

    const { status } = req.body;
    const validStatuses = ['pending', 'approved', 'rejected', 'funding', 'disbursed', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const loan = await Loan.findById(req.params.id);
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });

    // guard illegal transitions a bit
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
        await loan.populate({ path: 'borrower', select: 'email name' });
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

    const loanObj = normalizeLoanForFrontend(loan);
    return res.json({ success: true, message: `Loan status updated to ${status}`, loan: loanObj });
  } catch (error) {
    return respondServerError(res, 'Update loan status', error);
  }
};

/** Admin convenience wrappers (match your routes) */
const approveLoan = (req, res) => {
  req.body.status = 'approved';
  return updateLoanStatus(req, res);
};
const rejectLoan = (req, res) => {
  req.body.status = 'rejected';
  return updateLoanStatus(req, res);
};
const markPending = (req, res) => {
  req.body.status = 'pending';
  return updateLoanStatus(req, res);
};

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
    const total = loans.reduce((sum, l) => sum + num(l.cibilScore, 0), 0);
    const avg = Math.round(total / loans.length);
    return res.json({ success: true, cibilScore: avg });
  } catch (error) {
    return respondServerError(res, 'Calculate CIBIL', error);
  }
};

/* ------------------------------------------------------------------
 * Exports
 * ------------------------------------------------------------------ */
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
};
