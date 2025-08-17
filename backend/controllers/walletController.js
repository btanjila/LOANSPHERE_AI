//backend/controllers/walletController.js
import Wallet from "../models/WalletModel.js";
import Loan from "../models/Loan.js";

// ------------------- Wallet Functions -------------------

const getWallet = async (req, res) => {
  try {
    let wallet = await Wallet.findOne({ user: req.user._id });
    if (!wallet) wallet = await Wallet.create({ user: req.user._id });
    res.json({ success: true, wallet });
  } catch (err) {
    console.error("Get wallet error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const deposit = async (req, res) => {
  try {
    const { amount, type = "DEPOSIT", relatedLoan = null, remarks = "User deposit" } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: "Amount must be positive" });

    let wallet = await Wallet.findOne({ user: req.user._id });
    if (!wallet) wallet = await Wallet.create({ user: req.user._id });

    await wallet.credit(amount, type, relatedLoan, remarks);
    res.json({ success: true, message: `₹${amount} credited successfully`, wallet });
  } catch (err) {
    console.error("Deposit error:", err);
    res.status(500).json({ success: false, message: err.message || "Server error" });
  }
};

const withdraw = async (req, res) => {
  try {
    const { amount, type = "WITHDRAWAL", relatedLoan = null, remarks = "User withdrawal" } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: "Amount must be positive" });

    let wallet = await Wallet.findOne({ user: req.user._id });
    if (!wallet) return res.status(400).json({ success: false, message: "Wallet not found" });

    await wallet.debit(amount, type, relatedLoan, remarks);
    res.json({ success: true, message: `₹${amount} debited successfully`, wallet });
  } catch (err) {
    console.error("Withdraw error:", err);
    res.status(500).json({ success: false, message: err.message || "Server error" });
  }
};

const getTransactions = async (req, res) => {
  try {
    let wallet = await Wallet.findOne({ user: req.user._id });
    if (!wallet) wallet = await Wallet.create({ user: req.user._id });
    res.json({ success: true, transactions: wallet.transactions || [] });
  } catch (err) {
    console.error("Get transactions error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ------------------- Loan Integration -------------------

/**
 * Disburse loan amount to borrower wallet
 * Updates loan status = disbursed
 */
const disburseLoan = async (loanId) => {
  const loan = await Loan.findById(loanId).populate("borrower");
  if (!loan) throw new Error("Loan not found");
  if (loan.status !== "approved") throw new Error("Loan is not approved");

  let borrowerWallet = await Wallet.findOne({ user: loan.borrower._id });
  if (!borrowerWallet) borrowerWallet = await Wallet.create({ user: loan.borrower._id });

  await borrowerWallet.credit(
    loan.amountRequested,
    "LOAN_DISBURSEMENT",
    loan._id,
    "Loan disbursed to borrower"
  );

  loan.status = "disbursed";
  await loan.save();
  return { loan, borrowerWallet };
};

/**
 * Record EMI payment
 */
const payEMI = async (loanId, userId, amount) => {
  const loan = await Loan.findById(loanId).populate("borrower lenders.lender");
  if (!loan) throw new Error("Loan not found");
  if (loan.status !== "disbursed") throw new Error("Loan not disbursed yet");

  const borrowerWallet = await Wallet.findOne({ user: userId });
  if (!borrowerWallet) throw new Error("Wallet not found");

  await borrowerWallet.debit(amount, "LOAN_REPAYMENT", loan._id, "EMI payment");

  // Distribute to lenders
  for (let lenderEntry of loan.lenders) {
    const lenderWallet = await Wallet.findOne({ user: lenderEntry.lender._id }) || await Wallet.create({ user: lenderEntry.lender._id });
    const share = (lenderEntry.amount / loan.amountRequested) * amount;
    await lenderWallet.credit(share, "LOAN_REPAYMENT", loan._id, "EMI received from borrower");
  }

  // Mark EMI schedule as paid
  const nextEMI = loan.emiSchedule.find(line => !line.paid);
  if (nextEMI) {
    nextEMI.paid = true;
    nextEMI.paidOn = new Date();
  }
  await loan.save();
  return { loan, borrowerWallet };
};

export { getWallet, deposit, withdraw, getTransactions, disburseLoan, payEMI };
