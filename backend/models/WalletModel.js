// backend/models/WalletModel.js
import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["DEPOSIT", "WITHDRAWAL", "LOAN_DISBURSEMENT", "LOAN_REPAYMENT", "FUNDING", "FEE", "REFUND"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    relatedLoan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Loan",
      default: null,
    },
    remarks: {
      type: String,
      default: "",
      maxlength: 200,
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const walletSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    balance: {
      type: Number,
      default: 0,
      min: 0,
    },
    transactions: {
      type: [transactionSchema],
      default: [],
    },
  },
  { timestamps: true }
);

walletSchema.methods.credit = async function (amount, type = "DEPOSIT", relatedLoan = null, remarks = "") {
  if (amount <= 0) throw new Error("Amount must be positive");
  this.balance += amount;
  this.transactions.push({ type, amount, relatedLoan, remarks });
  return this.save();
};

walletSchema.methods.debit = async function (amount, type = "WITHDRAWAL", relatedLoan = null, remarks = "") {
  if (amount <= 0) throw new Error("Amount must be positive");
  if (amount > this.balance) throw new Error("Insufficient balance");
  this.balance -= amount;
  this.transactions.push({ type, amount, relatedLoan, remarks });
  return this.save();
};

walletSchema.methods.totalTransactions = function (type) {
  return this.transactions.filter(tx => tx.type === type).reduce((sum, tx) => sum + tx.amount, 0);
};

const Wallet = mongoose.models.Wallet || mongoose.model("Wallet", walletSchema);
export default Wallet;
