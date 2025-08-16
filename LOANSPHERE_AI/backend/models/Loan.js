// backend/models/Loan.js
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
    type: [
      {
        month: Number,
        dueDate: Date,
        principal: Number,
        interest: Number,
        amount: Number,    // principal + interest = total EMI
        paid: { type: Boolean, default: false },
        paidOn: Date,
      },
    ],
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

const Loan = mongoose.models.Loan || mongoose.model('Loan', loanSchema);
export default Loan;
