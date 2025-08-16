// src/pages/EMITracker.jsx
import React, { useEffect, useState, useCallback } from "react";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

export default function EMITracker() {
  const { user } = useAuth();
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch all loans for this borrower
  const fetchLoans = useCallback(async () => {
    if (!user?._id) return;
    setLoading(true);
    try {
      const res = await api.get("/loans");
      const userLoans = res.data.filter((loan) => loan.user?._id === user._id);
      setLoans(userLoans);
    } catch (err) {
      console.error("❌ Fetch EMI Error:", err);
      toast.error("Failed to fetch EMI data");
    } finally {
      setLoading(false);
    }
  }, [user?._id]);

  // Mark specific EMI as paid
  const handleMarkPaid = async (loanId, emiId) => {
    try {
      await api.put(`/loans/${loanId}/emi/${emiId}/pay`);
      toast.success("✅ EMI marked as paid");
      fetchLoans(); // refresh table after payment
    } catch (err) {
      console.error("❌ EMI Payment Error:", err);
      toast.error("Failed to mark EMI as paid");
    }
  };

  useEffect(() => {
    if (user?.role === "borrower") {
      fetchLoans();
    }
  }, [user, fetchLoans]);

  if (!user || user.role !== "borrower") return null;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">📊 EMI Tracker</h2>

      {loading ? (
        <p className="text-gray-600">Loading EMIs...</p>
      ) : loans.length === 0 ? (
        <p className="text-gray-600">No loans found.</p>
      ) : (
        loans.map((loan, idx) => (
          <div
            key={loan._id}
            className="bg-white rounded-xl shadow-md mb-8 p-4 border"
          >
            <h3 className="text-lg font-semibold mb-2">
              Loan #{idx + 1} - ₹{loan.amount.toLocaleString()} for{" "}
              {loan.tenure} months
            </h3>
            <p className="text-sm text-gray-600 mb-2">
              Interest Rate: {loan.interestRate}% | EMI: ₹
              {loan.emi?.toLocaleString() || "N/A"}
            </p>

            {loan.emiSchedule?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full table-auto border border-gray-300 text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 border">Month</th>
                      <th className="px-4 py-2 border">Due Date</th>
                      <th className="px-4 py-2 border">Principal</th>
                      <th className="px-4 py-2 border">Interest</th>
                      <th className="px-4 py-2 border">Balance</th>
                      <th className="px-4 py-2 border">Status</th>
                      <th className="px-4 py-2 border">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loan.emiSchedule.map((emi) => (
                      <tr
                        key={emi._id}
                        className="text-center hover:bg-gray-50"
                      >
                        <td className="px-4 py-2 border">{emi.month}</td>
                        <td className="px-4 py-2 border">
                          {emi.dueDate
                            ? new Date(emi.dueDate).toLocaleDateString()
                            : "N/A"}
                        </td>
                        <td className="px-4 py-2 border">
                          ₹{emi.principal?.toLocaleString() || "0"}
                        </td>
                        <td className="px-4 py-2 border">
                          ₹{emi.interest?.toLocaleString() || "0"}
                        </td>
                        <td className="px-4 py-2 border">
                          ₹{emi.balance?.toLocaleString() || "0"}
                        </td>
                        <td className="px-4 py-2 border">
                          {emi.status === "Paid" ? (
                            <span className="text-green-600 font-semibold">
                              Paid
                            </span>
                          ) : (
                            <span className="text-red-500 font-semibold">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 border">
                          {emi.status !== "Paid" && (
                            <button
                              onClick={() =>
                                handleMarkPaid(loan._id, emi._id)
                              }
                              className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                            >
                              Mark as Paid
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500">
                No EMI schedule available for this loan.
              </p>
            )}
          </div>
        ))
      )}
    </div>
  );
}
