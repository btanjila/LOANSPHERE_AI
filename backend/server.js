// backend/server.js
import dotenv from 'dotenv';
import express from 'express';
import colors from 'colors';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import connectDB from './config/db.js';

import loanRoutes from './routes/loanRoutes.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import cibilRoutes from './routes/cibil.js';
import lendboxRoutes from './routes/lendboxRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { errorHandler } from './middleware/errorMiddleware.js';

dotenv.config();
connectDB();

const app = express();

// ✅ Middlewares (order matters)
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Root route
app.get('/', (req, res) => {
  res.send('📡 LoanSphere API Server Running...');
});

// ✅ API Routes
app.use('/api/loans', loanRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/cibil', cibilRoutes);
app.use('/api/lendbox', lendboxRoutes);
app.use('/api/admin', adminRoutes);

// ✅ Error handler
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  console.log(`❌ 404 Not Found: ${req.originalUrl}`.red);
  res.status(404).json({ message: 'Route not found' });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`.green.bold);
});
