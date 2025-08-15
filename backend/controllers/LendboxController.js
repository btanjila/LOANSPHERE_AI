// backend/controllers/LendboxController.js
import Lendbox from '../models/LendboxModel.js';

// Lender creates a lendbox offer
const createLendboxOffer = async (req, res) => {
  try {
    let { amount, tenure, interestRate, remarks } = req.body;
    amount = Number(amount);
    tenure = Number(tenure);
    interestRate = Number(interestRate);

    if (
      !amount || amount <= 0 ||
      !tenure || tenure <= 0 ||
      !interestRate || interestRate < 0
    ) {
      return res.status(400).json({ success: false, message: 'Amount, tenure, and interest rate must be positive numbers' });
    }

    if (remarks && remarks.length > 500) {
      remarks = remarks.substring(0, 500); // truncate remarks to 500 chars
    }

    const offer = await Lendbox.create({
      lender: req.user._id,
      amount,
      tenure,
      interestRate,
      remarks,
      status: 'available'
    });

    res.status(201).json({ success: true, message: 'Lendbox offer created', offer });
  } catch (error) {
    console.error('Create lendbox offer error:', error);
    res.status(500).json({ success: false, message: 'Failed to create lendbox offer' });
  }
};

// Get lendbox offers: admin sees all, lender sees own
const getLendboxOffers = async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { lender: req.user._id };
    const offers = await Lendbox.find(filter)
      .populate('lender', 'name email phone')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: offers.length, offers });
  } catch (error) {
    console.error('Get lendbox offers error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch lendbox offers' });
  }
};

// Update lendbox offer status (admin only)
const updateLendboxStatus = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admins only' });
    }

    const { status } = req.body;
    const validStatuses = ['available', 'funded', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const offer = await Lendbox.findById(req.params.id);
    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }

    offer.status = status;
    await offer.save();

    res.json({ success: true, message: `Offer status updated to ${status}`, offer });
  } catch (error) {
    console.error('Update lendbox status error:', error);
    res.status(500).json({ success: false, message: 'Failed to update lendbox status' });
  }
};

// Delete lendbox offer (admin only)
const deleteLendboxOffer = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admins only' });
    }

    const offer = await Lendbox.findById(req.params.id);
    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offer not found' });
    }

    await offer.deleteOne();
    res.json({ success: true, message: 'Offer deleted successfully' });
  } catch (error) {
    console.error('Delete lendbox offer error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete lendbox offer' });
  }
};

export {
  createLendboxOffer,
  getLendboxOffers,
  updateLendboxStatus,
  deleteLendboxOffer,
};
