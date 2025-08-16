// frontend/src/components/LoanList.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";

const LoanList = () => {
  const { token, user } = useAuth();
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLoans = async () => {
    if (!token) {
      toast.error("Authentication required. Please login again.");
      return;
    }
    try {
      const baseURL =
        process.env.REACT_APP_API_URL || "http://localhost:5000/api";
      const res = await axios.get(`${baseURL}/loans`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLoans(res.data);
    } catch (err) {
      console.error("Loan fetch error:", err);
      toast.error("❌ Failed to fetch loans");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoans();
    // eslint-disable-next-line
  }, []);

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4 text-center">
        {user?.role === "admin"
          ? "📜 All Loan Applications"
          : "📜 My Loan Applications"}
      </h2>

      {loading ? (
        <p className="text-center text-gray-600 animate-pulse">
          Loading loans...
        </p>
      ) : loans.length === 0 ? (
        <p className="text-center text-gray-500">No loans found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left text-gray-700 border border-gray-300 rounded-md">
            <thead className="bg-gray-200 text-xs uppercase tracking-wider text-gray-600">
              <tr>
                {user?.role === "admin" && (
                  <th className="px-4 py-3 border">Name</th>
                )}
                <th className="px-4 py-3 border">Amount</th>
                <th className="px-4 py-3 border">Tenure (months)</th>
                <th className="px-4 py-3 border">Interest Rate (%)</th>
                <th className="px-4 py-3 border">CIBIL Score</th>
                <th className="px-4 py-3 border">Status</th>
                <th className="px-4 py-3 border">Date</th>
              </tr>
            </thead>
            <tbody>
              {loans.map((loan) => (
                <tr key={loan._id} className="hover:bg-gray-100">
                  {user?.role === "admin" && (
                    <td className="px-4 py-2 border">
                      {loan.user?.name || "N/A"}
                    </td>
                  )}
                  <td className="px-4 py-2 border">₹{loan.amount}</td>
                  <td className="px-4 py-2 border">{loan.tenure}</td>
                  <td className="px-4 py-2 border">{loan.interestRate}%</td>
                  <td className="px-4 py-2 border">
                    {loan.creditScore || loan.cibilScore || "N/A"}
                  </td>
                  <td
                    className={`px-4 py-2 border font-medium ${
                      loan.status === "approved"
                        ? "text-green-600"
                        : loan.status === "rejected"
                        ? "text-red-600"
                        : "text-blue-600"
                    }`}
                  >
                    {loan.status}
                  </td>
                  <td className="px-4 py-2 border">
                    {new Date(loan.createdAt).toLocaleDateString("en-IN", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-center mt-4">
        <button
          onClick={fetchLoans}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md transition"
        >
          🔄 Refresh
        </button>
      </div>
    </div>
  );
};

export default LoanList;
