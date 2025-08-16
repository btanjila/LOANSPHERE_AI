// backend/server.js
import dotenv from 'dotenv';
dotenv.config();

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
import { errorHandler } from './middleware/errorMiddleware.js';

connectDB();

console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'Loaded' : 'NOT Loaded');
console.log('NODE_ENV:', process.env.NODE_ENV);

const app = express();
import adminRoutes from './routes/adminRoutes.js';
app.use('/api/admin', adminRoutes);

// Middlewares
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

// API Routes
app.use('/api/loans', loanRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/cibil', cibilRoutes);
app.use('/api/lendbox', lendboxRoutes);

// error handler (must be after routes)
app.use(errorHandler);

// Endpoint log
console.log('\n📋 Registered API Endpoints:'.yellow);
console.log('➡️  GET     /api/loans');
console.log('➡️  POST    /api/loans');
console.log('➡️  GET     /api/users/me');
console.log('➡️  GET     /api/users/me/cibil');
console.log('➡️  PUT     /api/loans/:id/approve');
console.log('➡️  PUT     /api/loans/:id/reject');
console.log('➡️  PUT     /api/loans/:id/pending');
console.log('➡️  POST    /api/auth/login');
console.log('➡️  POST    /api/auth/register');
console.log('➡️  GET     /api/dashboard/stats');
console.log('➡️  GET     /');

// 404 Fallback
app.use((req, res) => {
  console.log(`❌ 404 Not Found: ${req.originalUrl}`.red);
  res.status(404).json({ message: 'Route not found' });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`.green.bold);
});
