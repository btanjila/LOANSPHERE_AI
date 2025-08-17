// backend/controllers/DashboardController.js
import Loan from '../models/LoanModel.js';
import User from '../models/UserModel.js';
import LendboxOffer from '../models/LendboxModel.js';

/**
 * @desc Admin Dashboard Stats
 * @route GET /api/dashboard/admin
 * @access Admin
 */
export const getAdminDashboard = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalBorrowers = await User.countDocuments({ role: 'borrower' });
    const totalLenders = await User.countDocuments({ role: 'lender' });

    const totalLoans = await Loan.countDocuments();
    const activeLoans = await Loan.countDocuments({ status: 'approved' });
    const pendingLoans = await Loan.countDocuments({ status: 'pending' });
    const rejectedLoans = await Loan.countDocuments({ status: 'rejected' });

    const totalLoanAmount = await Loan.aggregate([
      { $match: { status: 'approved' } },
      { $group: { _id: null, total: { $sum: '$amountRequested' } } },
    ]);

    const totalFundedAmount = await Loan.aggregate([
      { $match: { status: 'approved' } },
      { $group: { _id: null, total: { $sum: '$amountFunded' } } },
    ]);

    const lendboxOffers = await LendboxOffer.countDocuments();
    const pendingOffers = await LendboxOffer.countDocuments({ status: 'pending' });

    res.status(200).json({
      users: { totalUsers, totalBorrowers, totalLenders },
      loans: {
        totalLoans,
        activeLoans,
        pendingLoans,
        rejectedLoans,
        totalLoanAmount: totalLoanAmount[0]?.total || 0,
        totalFundedAmount: totalFundedAmount[0]?.total || 0,
      },
      lendbox: {
        totalOffers: lendboxOffers,
        pendingOffers,
      },
    });
  } catch (error) {
    console.error('Error fetching admin dashboard:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc Borrower Dashboard
 * @route GET /api/dashboard/borrower
 * @access Borrower
 */
export const getBorrowerDashboard = async (req, res) => {
  try {
    const userId = req.user._id;

    const myLoans = await Loan.find({ borrower: userId });
    const activeLoans = myLoans.filter((loan) => loan.status === 'approved');
    const pendingLoans = myLoans.filter((loan) => loan.status === 'pending');

    // Calculate outstanding balance
    const outstandingBalance = activeLoans.reduce(
      (acc, loan) => acc + (loan.amountRequested - loan.amountFunded),
      0
    );

    res.status(200).json({
      totalLoans: myLoans.length,
      activeLoans: activeLoans.length,
      pendingLoans: pendingLoans.length,
      outstandingBalance,
      myLoans,
    });
  } catch (error) {
    console.error('Error fetching borrower dashboard:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc Lender Dashboard
 * @route GET /api/dashboard/lender
 * @access Lender
 */
export const getLenderDashboard = async (req, res) => {
  try {
    const userId = req.user._id;

    const myOffers = await LendboxOffer.find({ lender: userId });
    const activeOffers = myOffers.filter((offer) => offer.status === 'approved');
    const pendingOffers = myOffers.filter((offer) => offer.status === 'pending');

    const totalInvested = activeOffers.reduce(
      (acc, offer) => acc + (offer.amount || 0),
      0
    );

    res.status(200).json({
      totalOffers: myOffers.length,
      activeOffers: activeOffers.length,
      pendingOffers: pendingOffers.length,
      totalInvested,
      myOffers,
    });
  } catch (error) {
    console.error('Error fetching lender dashboard:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
