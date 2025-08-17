//models/Loan.js
import mongoose from 'mongoose';

// Lender subdocument
const lenderSchema = new mongoose.Schema({
  lender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: [100, 'Minimum contribution is 100'],
  },
  dateFunded: {
    type: Date,
    default: Date.now,
  },
}, { _id: false });

// Transaction subdocument (repayments, penalties, etc.)
const transactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['disbursement', 'repayment', 'penalty', 'refund'],
    required: true,
  },
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  to: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  remarks: { type: String, trim: true },
}, { _id: false });

const emiLineSchema = new mongoose.Schema({
  month: Number,
  dueDate: Date,
  principal: Number,
  interest: Number,
  amount: Number,    // principal + interest = total EMI
  paid: { type: Boolean, default: false },
  paidOn: Date,
}, { _id: false });

const loanSchema = new mongoose.Schema({
  borrower: {   // changed from user to borrower for clarity and consistency
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  lenders: {
    type: [lenderSchema],
    default: [],
  },
  amountRequested: {
    type: Number,
    required: [true, 'Loan amount is required'],
    min: [1000, 'Minimum loan request is 1000'],
  },
  amountFunded: {
    type: Number,
    default: 0,
  },
  tenure: {
    type: Number,
    required: true,
    min: 1,
  },
  interestRate: {
    type: Number,
    required: true,
    min: 0,
  },
  emi: {
    type: Number,
    default: 0,
  },
  totalPayment: {
    type: Number,
    default: 0,
  },
  emiSchedule: {
    type: [emiLineSchema],
    default: [],
  },
  purpose: {
    type: String,
    trim: true,
    default: 'N/A',
  },
  cibilScore: {
    type: Number,
    default: 700,
    min: 300,
    max: 900,
  },
  status: {
    type: String,
    enum: [
      'pending',
      'approved',
      'funding',
      'disbursed',
      'rejected',
      'closed',
    ],
    default: 'pending',
  },
  transactions: {
    type: [transactionSchema],
    default: [],
  },
  remarks: {
    type: String,
    trim: true,
  },
}, { timestamps: true });

// Compound indexes for queries
loanSchema.index({ status: 1, borrower: 1 });
loanSchema.index({ 'lenders.lender': 1 });

// ---------------- Helper functions ----------------
/**
 * Calculate EMI (monthly payment)
 * principal: Number
 * annualRate: Number (percentage, e.g. 12)
 * months: Number
 * returns Number rounded to 2 decimals
 */
function calculateEMI(principal, annualRate, months) {
  const P = Number(principal);
  const n = Number(months);
  const r = Number(annualRate) / 12 / 100; // monthly rate as decimal

  if (!P || !n) return 0;
  if (r === 0) {
    return Number((P / n).toFixed(2));
  }
  const pow = Math.pow(1 + r, n);
  const emi = (P * r * pow) / (pow - 1);
  return Number(emi.toFixed(2));
}

/**
 * Generate EMI schedule array
 * returns array of { month, dueDate, principal, interest, amount, paid:false }
 */
function generateSchedule(principal, annualRate, months, emi, startDate = new Date()) {
  const schedule = [];
  let remainingPrincipal = Number(principal);
  const r = Number(annualRate) / 12 / 100;
  // clone start date to avoid mutation
  let due = new Date(startDate);
  due.setHours(12, 0, 0, 0); // normalize to midday

  for (let m = 1; m <= months; m++) {
    // interest for the month
    const interest = Number((remainingPrincipal * r).toFixed(2));
    // principal portion = emi - interest
    let principalPortion = Number((emi - interest).toFixed(2));

    // last payment adjustment to avoid small residuals due to rounding
    if (m === months) {
      principalPortion = Number(remainingPrincipal.toFixed(2));
    }

    const amount = Number((principalPortion + interest).toFixed(2));
    schedule.push({
      month: m,
      dueDate: new Date(due),
      principal: principalPortion,
      interest,
      amount,
      paid: false,
      paidOn: null,
    });

    // reduce remaining principal
    remainingPrincipal = Number((remainingPrincipal - principalPortion).toFixed(2));

    // increment due date by 1 month
    due = new Date(due);
    due.setMonth(due.getMonth() + 1);
  }
  return schedule;
}

// ---------------- Virtuals ----------------
loanSchema.virtual('outstandingBalance').get(function () {
  // sum unpaid emi schedule amounts + (requested - funded if disbursal not happened)
  const unpaid = (this.emiSchedule || [])
    .filter(line => !line.paid)
    .reduce((s, line) => s + (line.amount || 0), 0);
  // if not disbursed, outstanding may be amountRequested - amountFunded
  let pendingFunding = 0;
  if (this.status === 'funding') {
    pendingFunding = Math.max(0, (this.amountRequested || 0) - (this.amountFunded || 0));
  }
  return Number((unpaid + pendingFunding).toFixed(2));
});

loanSchema.virtual('nextDueDate').get(function () {
  const next = (this.emiSchedule || []).find(line => !line.paid);
  return next ? next.dueDate : null;
});

// Ensure virtuals appear when toObject / toJSON called
loanSchema.set('toObject', { virtuals: true });
loanSchema.set('toJSON', { virtuals: true });

// ---------------- Pre-save hook ----------------
// Only generate EMI & schedule when creating a new loan or key fields changed AND when no payment made
loanSchema.pre('save', function (next) {
  try {
    const shouldRecalc = this.isNew ||
      this.isModified('amountRequested') ||
      this.isModified('tenure') ||
      this.isModified('interestRate');

    // If there are already recorded payments, avoid overwriting schedule
    const hasPayments = (this.transactions && this.transactions.length > 0) ||
                        ((this.emiSchedule || []).some(s => s.paid));

    if (shouldRecalc && !hasPayments) {
      const principal = this.amountRequested;
      const months = this.tenure;
      const annualRate = this.interestRate;
      const emiValue = calculateEMI(principal, annualRate, months);

      this.emi = emiValue;
      this.totalPayment = Number((emiValue * months).toFixed(2));

      // regenerate schedule
      this.emiSchedule = generateSchedule(principal, annualRate, months, emiValue, new Date());
    }
    // ensure numeric fields are rounded sensibly
    if (this.emi) this.emi = Number(Number(this.emi).toFixed(2));
    if (this.totalPayment) this.totalPayment = Number(Number(this.totalPayment).toFixed(2));
    if (this.amountFunded) this.amountFunded = Number(Number(this.amountFunded).toFixed(2));
    next();
  } catch (err) {
    next(err);
  }
});

// export model
const Loan = mongoose.models.Loan || mongoose.model('Loan', loanSchema);
export default Loan;
