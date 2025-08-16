// backend/models/LendboxModel.js
import mongoose from 'mongoose';

const lendboxSchema = new mongoose.Schema({
  lender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 1000,
  },
  interestRate: {
    type: Number,
    required: true,
    min: 0,
  },
  tenure: {
    type: Number, // months
    required: true,
    min: 1,
  },
  status: {
    type: String,
    enum: ['available', 'funded', 'closed'],
    default: 'available',
  },
  remarks: {
    type: String,
    default: '',
  },
}, {
  timestamps: true,
});

const Lendbox = mongoose.models.Lendbox || mongoose.model('Lendbox', lendboxSchema);
export default Lendbox;
