//backend/models/TransactionModel.js
import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // borrower or lender
      required: true,
    },
    loan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Loan", // optional if linked to a loan
    },
    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet", // optional, if wallet involved
    },
    type: {
      type: String,
      enum: [
        "LOAN_DISBURSEMENT", // when loan amount is given to borrower
        "LOAN_REPAYMENT",    // borrower repays EMI
        "LENDER_FUNDING",    // lender invests
        "WITHDRAWAL",        // withdraw from wallet
        "DEPOSIT",           // deposit into wallet
        "PENALTY",           // late fee, etc.
      ],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["PENDING", "SUCCESS", "FAILED"],
      default: "PENDING",
    },
    paymentMethod: {
      type: String,
      enum: ["BANK_TRANSFER", "CARD", "UPI", "WALLET"],
      default: "WALLET",
    },
    referenceId: {
      type: String, // UTR no., txn id, razorpay id, etc.
      unique: true,
      sparse: true,
    },
    remarks: {
      type: String,
      maxlength: 250,
    },
  },
  { timestamps: true }
);

// Index for faster queries
transactionSchema.index({ user: 1, loan: 1, type: 1 });

const Transaction = mongoose.model("Transaction", transactionSchema);

export default Transaction;
