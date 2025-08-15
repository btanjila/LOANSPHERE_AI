// backend/controllers/DashboardController.js
import Loan from '../models/Loan.js';
import User from '../models/UserModel.js';

export const getDashboardStats = async (req, res) => {
  try {
    // Only admin users allowed
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied: Admins only' });
    }

    // Fetch all stats concurrently
    const [
      totalUsers,
      totalLoans,
      approvedLoans,
      rejectedLoans,
      pendingLoans,
      disbursedLoans,
      totalAmountApprovedAgg,
      totalAmountDisbursedAgg,
    ] = await Promise.all([
      User.countDocuments(),
      Loan.countDocuments(),
      Loan.countDocuments({ status: 'approved' }),
      Loan.countDocuments({ status: 'rejected' }),
      Loan.countDocuments({ status: 'pending' }),
      Loan.countDocuments({ status: 'disbursed' }),
      Loan.aggregate([
        { $match: { status: 'approved' } },
        { $group: { _id: null, total: { $sum: '$amountRequested' } } },
      ]),
      Loan.aggregate([
        { $match: { status: 'disbursed' } },
        { $group: { _id: null, total: { $sum: '$amountRequested' } } },
      ]),
    ]);

    const totalAmountApproved = totalAmountApprovedAgg[0]?.total || 0;
    const totalAmountDisbursed = totalAmountDisbursedAgg[0]?.total || 0;

    return res.status(200).json({
      totalUsers,           // Total registered users
      totalLoans,           // Total loans in system
      approvedLoans,        // Loans approved by admin
      rejectedLoans,        // Loans rejected by admin
      pendingLoans,         // Loans pending approval
      disbursedLoans,       // Loans fully funded and disbursed
      totalAmountApproved,  // Sum of approved loan amounts
      totalAmountDisbursed, // Sum of disbursed loan amounts
    });
  } catch (error) {
    console.error('📊 Dashboard stats error:', error);
    return res.status(500).json({ message: 'Failed to load dashboard stats' });
  }
};
