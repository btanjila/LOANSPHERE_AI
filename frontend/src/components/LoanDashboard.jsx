// frontend/src/components/LoanDashboard.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { RefreshCw, Activity, Users, ClipboardList, CreditCard } from "lucide-react";

const Dashboard = () => {
  const { token, user } = useAuth();
  const [stats, setStats] = useState({
    totalLoans: 0,
    totalUsers: 0,
    pendingApprovals: 0,
    totalEMI: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const baseURL =
        process.env.REACT_APP_API_URL || "http://localhost:5000/api";
      const res = await axios.get(`${baseURL}/dashboard/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStats(res.data);
    } catch (error) {
      console.error("Dashboard fetch error:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === "admin" && token) {
      fetchStats();
    }
  }, [user, token]);

  const chartData = [
    { name: "Loans", value: stats.totalLoans },
    { name: "Users", value: stats.totalUsers },
    { name: "Pending", value: stats.pendingApprovals },
    { name: "EMI ₹", value: stats.totalEMI },
  ];

  if (!user)
    return (
      <p className="text-center mt-20 text-gray-600">
        Please login to see the dashboard.
      </p>
    );

  if (user.role !== "admin")
    return (
      <p className="text-center mt-20 text-red-600 font-semibold">
        Access denied. Admins only.
      </p>
    );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-blue-600 text-xl animate-pulse">
        <Activity className="w-8 h-8 mb-3 animate-spin" />
        Loading admin dashboard...
      </div>
    );
  }

  const cardIcons = [ClipboardList, Users, Activity, CreditCard];

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl md:text-4xl font-extrabold text-center text-indigo-700 mb-8">
        📊 Admin Dashboard
      </h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {chartData.map(({ name, value }, idx) => {
          const Icon = cardIcons[idx];
          return (
            <div
              key={name}
              className="bg-white shadow-lg rounded-xl p-6 border border-gray-200 flex flex-col items-center justify-center hover:shadow-xl transition"
            >
              <Icon className="w-8 h-8 text-indigo-600 mb-3" />
              <h2 className="text-lg font-semibold text-gray-700">{name}</h2>
              <p className="text-3xl text-indigo-600 font-bold mt-1">
                {value.toLocaleString()}
              </p>
            </div>
          );
        })}
      </div>

      {/* Chart */}
      <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg border border-gray-200">
        <h3 className="text-xl md:text-2xl font-semibold text-gray-800 mb-6">
          Overview Chart
        </h3>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 30, left: 0, bottom: 5 }}
          >
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#4F46E5" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Refresh Button */}
      <div className="text-center mt-6">
        <button
          onClick={fetchStats}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-5 rounded-lg transition inline-flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh Data
        </button>
      </div>

      <ToastContainer position="top-right" autoClose={4000} />
    </div>
  );
};

export default Dashboard;
