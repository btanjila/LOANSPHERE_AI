// backend/controllers/LendboxController.js
import LendboxOffer from '../models/LendboxModel.js';
import Loan from '../models/Loan.js';

/**
 * @desc Create a new Lendbox offer
 * @route POST /api/lendbox
 * @access Lender/Admin
 */
export const createLendboxOffer = async (req, res) => {
  try {
    const { loanId, amount, interestRate, duration } = req.body;

    if (!loanId || !amount || !interestRate || !duration) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const loan = await Loan.findById(loanId);
    if (!loan) {
      return res.status(404).json({ message: 'Loan not found' });
    }

    const offer = await LendboxOffer.create({
      loan: loanId,
      lender: req.user._id,
      amount,
      interestRate,
      duration,
      status: 'pending',
    });

    res.status(201).json({ message: 'Offer created successfully', offer });
  } catch (error) {
    console.error('Error creating Lendbox offer:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc Get all Lendbox offers (Admin can see all, Lender sees own)
 * @route GET /api/lendbox
 * @access Admin/Lender
 */
export const getLendboxOffers = async (req, res) => {
  try {
    let offers;
    if (req.user.role === 'admin') {
      offers = await LendboxOffer.find()
        .populate('loan', 'amountRequested status')
        .populate('lender', 'name email');
    } else {
      offers = await LendboxOffer.find({ lender: req.user._id })
        .populate('loan', 'amountRequested status')
        .populate('lender', 'name email');
    }

    res.status(200).json(offers);
  } catch (error) {
    console.error('Error fetching Lendbox offers:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc Update Lendbox offer status (approve/reject)
 * @route PUT /api/lendbox/:id
 * @access Admin
 */
export const updateLendboxStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const offer = await LendboxOffer.findById(req.params.id);

    if (!offer) {
      return res.status(404).json({ message: 'Offer not found' });
    }

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    offer.status = status;
    await offer.save();

    // Update Loan funding when approved
    if (status === 'approved') {
      const loan = await Loan.findById(offer.loan);
      if (loan) {
        loan.amountFunded += offer.amount;
        if (loan.amountFunded >= loan.amountRequested) {
          loan.status = 'funded';
        }
        await loan.save();
      }
    }

    res.status(200).json({ message: 'Offer status updated successfully', offer });
  } catch (error) {
    console.error('Error updating Lendbox status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc Delete a Lendbox offer
 * @route DELETE /api/lendbox/:id
 * @access Lender/Admin
 */
export const deleteLendboxOffer = async (req, res) => {
  try {
    const offer = await LendboxOffer.findById(req.params.id);

    if (!offer) {
      return res.status(404).json({ message: 'Offer not found' });
    }

    // Only admin or owner lender can delete
    if (req.user.role !== 'admin' && offer.lender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this offer' });
    }

    await offer.deleteOne();

    res.status(200).json({ message: 'Offer deleted successfully' });
  } catch (error) {
    console.error('Error deleting Lendbox offer:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
