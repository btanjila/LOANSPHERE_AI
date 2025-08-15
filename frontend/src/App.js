// src/App.js
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Layout
import MainLayout from "./layouts/MainLayout";
// Route guard
import PrivateRoute from "./components/PrivateRoute";

// Pages
import Login from "./pages/Login";
import Register from "./pages/Register";
import Unauthorized from "./pages/Unauthorized";
import Dashboard from './pages/AdminDashboard';
import LoanPage from "./pages/LoanPage"; // unified loan table
import EMITracker from "./pages/EMITracker";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <Router>
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar />

      <Routes>
        {/* Public */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/unauthorized" element={<Unauthorized />} />

        {/* Protected layout */}
        <Route
          element={
            <PrivateRoute roles={["admin", "borrower"]}>
              <MainLayout />
            </PrivateRoute>
          }
        >
          {/* Dashboard (admin only) */}
          <Route
            path="/dashboard"
            element={
              <PrivateRoute roles={["admin"]}>
                <Dashboard />
              </PrivateRoute>
            }
          />

          {/* Unified loan page for both roles */}
          <Route path="/loans" element={<LoanPage />} />

          {/* EMI Tracker */}
          <Route path="/emi-tracker" element={<EMITracker />} />

          {/* Profile */}
          <Route path="/profile" element={<Profile />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}
