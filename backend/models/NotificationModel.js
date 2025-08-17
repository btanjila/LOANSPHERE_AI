//backend/models/NotificationModel.js
import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "LOAN_APPROVED",
        "LOAN_REJECTED",
        "LOAN_DISBURSED",
        "EMI_DUE",
        "EMI_PAID",
        "LENDER_FUNDED",
        "WALLET_UPDATE",
        "SYSTEM_ALERT",
      ],
      required: true,
    },
    message: {
      type: String,
      required: true,
      maxlength: 500,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    metadata: {
      type: Object, // flexible field to store extra details (loanId, amount, etc.)
      default: {},
    },
  },
  { timestamps: true }
);

// Index to fetch user notifications quickly
notificationSchema.index({ user: 1, isRead: 1 });

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
