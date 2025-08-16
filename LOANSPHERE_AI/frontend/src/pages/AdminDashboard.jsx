// src/pages/AdminDashboard.jsx
import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Users, DollarSign, TrendingUp, Clock } from "lucide-react";
import axios from "axios";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";

const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

export default function AdminDashboard() {
  const { user, token } = useAuth();
  const [stats, setStats] = useState({});
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!token) return;
      try {
        setLoading(true);
        const res = await axios.get(`${BASE_URL}/admin/stats`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        // ✅ Your backend already returns the stats object
        setStats(res.data);

        // Optional: If you want chart data, transform stats here
        setChartData([
          { name: "Approved", loanCount: res.data.approvedLoans },
          { name: "Pending", loanCount: res.data.pendingLoans },
          { name: "Rejected", loanCount: res.data.rejectedLoans }
        ]);

      } catch (err) {
        console.error("❌ Failed to load dashboard data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [token]);

  if (!user || user.role !== "admin") return <Navigate to="/" replace />;

  const cards = [
    {
      title: "Total Users",
      value: stats.totalUsers || 0,
      icon: <Users className="h-6 w-6 text-blue-500" />
    },
    {
      title: "Total Loans",
      value: stats.totalLoans || 0,
      icon: <TrendingUp className="h-6 w-6 text-green-500" />
    },
    {
      title: "Approved Loans",
      value: stats.approvedLoans || 0,
      icon: <DollarSign className="h-6 w-6 text-yellow-500" />
    },
    {
      title: "Pending Loans",
      value: stats.pendingLoans || 0,
      icon: <Clock className="h-6 w-6 text-red-500" />
    }
  ];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>

      {loading ? (
        <p className="text-gray-600">Loading dashboard...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {cards.map((card, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl shadow-sm p-5 flex items-center gap-4 hover:shadow-md transition"
              >
                <div className="bg-gray-100 p-3 rounded-full">{card.icon}</div>
                <div>
                  <p className="text-gray-500 text-sm">{card.title}</p>
                  <p className="text-lg font-semibold">{card.value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">Loan Trends</h2>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="loanCount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500">No trend data available.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
