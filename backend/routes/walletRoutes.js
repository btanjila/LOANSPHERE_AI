//backend/routes/walletRoutes.js
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { getWallet, deposit, withdraw, getTransactions } from "../controllers/walletController.js";

const router = express.Router();

router.use(protect);

router.get("/", getWallet);
router.post("/deposit", deposit);
router.post("/withdraw", withdraw);
router.get("/transactions", getTransactions);

export default router;
