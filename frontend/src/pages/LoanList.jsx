// src/pages/LoanList.js
import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

export default function LoanList() {
  const { user } = useAuth();
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLoans = async () => {
      try {
        const res = await api.get("/loans");
        setLoans(res.data);
      } catch (err) {
        console.error("Loan fetch failed:", err);
        toast.error("Failed to fetch loans");
      } finally {
        setLoading(false);
      }
    };

    if (user) fetchLoans();
  }, [user]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h2 className="text-xl font-semibold mb-4 flex items-center">📄 My Loan Applications</h2>
      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : loans.length === 0 ? (
        <p className="text-gray-500">No loans found.</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="min-w-full border border-gray-200">
            <thead>
              <tr className="bg-gray-100 text-gray-700">
                <th className="p-3 text-left">Amount</th>
                <th className="p-3 text-left">Tenure</th>
                <th className="p-3 text-left">CIBIL</th>
                <th className="p-3 text-left">EMI</th>
                <th className="p-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {loans.map((loan) => (
                <tr key={loan._id} className="border-t hover:bg-gray-50 transition">
                  <td className="p-3">₹{loan.amount}</td>
                  <td className="p-3">{loan.tenure} mo</td>
                  <td className="p-3">{loan.cibilScore || "N/A"}</td>
                  <td className="p-3">₹{loan.emi}</td>
                  <td className={`p-3 capitalize font-medium ${loan.status === "approved" ? "text-green-600" : loan.status === "rejected" ? "text-red-600" : "text-yellow-600"}`}>
                    {loan.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
