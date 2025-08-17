// backend/routes/adminRoutes.js
import express from 'express';
import Loan from '../models/Loan.js';
import User from '../models/UserModel.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/stats', protect, authorize(['admin']), async (req, res) => {
  try {
    const totalLoans = await Loan.countDocuments();
    const approvedLoans = await Loan.countDocuments({ status: 'approved' });
    const pendingLoans = await Loan.countDocuments({ status: 'pending' });
    const rejectedLoans = await Loan.countDocuments({ status: 'rejected' });

    const totalUsers = await User.countDocuments();
    const borrowers = await User.countDocuments({ role: 'borrower' });
    const admins = await User.countDocuments({ role: 'admin' });

    const amountStats = await Loan.aggregate([
      {
        $group: {
          _id: null,
          totalRequested: { $sum: '$amountRequested' },
          totalFunded: { $sum: '$amountFunded' },
        },
      },
    ]);

    const { totalRequested = 0, totalFunded = 0 } = amountStats[0] || {};

    res.json({
      totalLoans,
      approvedLoans,
      pendingLoans,
      rejectedLoans,
      totalUsers,
      borrowers,
      admins,
      totalRequested,
      totalFunded,
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

export default router;
