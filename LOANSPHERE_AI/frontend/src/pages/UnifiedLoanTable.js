// src/pages/UnifiedLoanTable.js
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";
import api from "../utils/api";

const LOANS_PER_PAGE = 5;

export default function UnifiedLoanTable() {
  const { user } = useAuth();
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const showBorrowerColumn = user?.role === "admin";

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim().toLowerCase());
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Modal functions
  const openLoanModal = (loan) => {
    setSelectedLoan(loan);
    setIsModalOpen(true);
  };
  const closeLoanModal = () => {
    setSelectedLoan(null);
    setIsModalOpen(false);
  };

  // Normalize loans
  const normalizeLoan = (raw) => {
    const borrowerObj = raw.user || raw.borrower || raw.borrower?.user || null;
    const amount = raw.amount ?? raw.amountRequested ?? 0;
    const totalEmis = raw.tenure ?? 0;
    const emiPaidCount = raw.emiPaid ?? 0;
    const emiOverdueCount =
      raw.emis?.filter((e) => !e.paid && new Date(e.dueDate) < new Date()).length ?? 0;

    return {
      _id: raw._id || raw.id || raw._doc?._id,
      user: borrowerObj,
      borrower: borrowerObj,
      purpose: raw.purpose ?? raw._doc?.purpose ?? "",
      amount,
      tenure: totalEmis,
      interestRate: raw.interestRate ?? 0,
      emi: raw.emi ?? 0,
      cibilScore: raw.cibilScore ?? raw._doc?.cibilScore ?? null,
      status: (raw.status ?? "pending").toString(),
      emiPaidCount,
      emiOverdueCount,
      totalEmis,
      emis: raw.emis || [],
      raw,
    };
  };

  // Fetch loans
  const fetchLoans = useCallback(async () => {
    setLoading(true);
    try {
      const url = user?.role !== "admin" ? "/loans/myloans" : "/loans";
      const res = await api.get(url);
      const rawArray = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data.loans)
        ? res.data.loans
        : Array.isArray(res.data.data)
        ? res.data.data
        : [];
      setLoans(rawArray.map(normalizeLoan).filter(Boolean));
    } catch (err) {
      console.error("Fetch loans error:", err);
      toast.error("Failed to fetch loans");
      setLoans([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  // Update loan status
  const updateLoanStatus = async (id, newStatus) => {
    if (!window.confirm(`Change loan status to "${newStatus}"?`)) return;
    try {
      setLoadingId(id);
      const mapping = {
        approved: "approve",
        rejected: "reject",
        pending: "pending",
        funding: "funding",
        disbursed: "disbursed",
        closed: "closed",
      };
      await api.put(`/loans/${id}/${mapping[newStatus]}`);
      toast.success(`Loan marked as ${newStatus}`);
      await fetchLoans();
    } catch (err) {
      console.error("Update loan status error:", err);
      toast.error("Failed to update loan status");
    } finally {
      setLoadingId(null);
    }
  };

  // Delete loan
  const deleteLoan = async (id) => {
    if (!window.confirm("Are you sure you want to delete this loan?")) return;
    try {
      setLoadingId(id);
      await api.delete(`/loans/${id}`);
      toast.success("Loan deleted");
      await fetchLoans();
    } catch (err) {
      console.error("Delete loan error:", err);
      toast.error("Failed to delete loan");
    } finally {
      setLoadingId(null);
    }
  };

  // Sorting
  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") direction = "desc";
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  // Filter + search
  const filteredLoans = useMemo(() => {
    return loans.filter((loan) => {
      const statusMatch = statusFilter === "all" || loan.status === statusFilter;
      const term = debouncedSearchTerm;
      const name = (loan.user?.name || loan.borrower?.name || "").toLowerCase();
      const purpose = (loan.purpose || "").toLowerCase();
      return statusMatch && (term === "" || name.includes(term) || purpose.includes(term));
    });
  }, [loans, statusFilter, debouncedSearchTerm]);

  // Sort loans
  const sortedLoans = useMemo(() => {
    if (!sortConfig.key) return filteredLoans;
    return [...filteredLoans].sort((a, b) => {
      let aVal = a[sortConfig.key] ?? 0;
      let bVal = b[sortConfig.key] ?? 0;
      if (sortConfig.key === "name") {
        aVal = (a.user?.name || "").toLowerCase();
        bVal = (b.user?.name || "").toLowerCase();
      }
      if (sortConfig.key === "cibilScore") {
        aVal = a.cibilScore ?? 0;
        bVal = b.cibilScore ?? 0;
      }
      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredLoans, sortConfig]);

  // Pagination
  const indexOfLast = currentPage * LOANS_PER_PAGE;
  const indexOfFirst = indexOfLast - LOANS_PER_PAGE;
  const currentLoans = useMemo(
    () => sortedLoans.slice(indexOfFirst, indexOfLast),
    [sortedLoans, indexOfFirst, indexOfLast]
  );
  const totalPages = Math.max(1, Math.ceil(sortedLoans.length / LOANS_PER_PAGE));

  const fmtCurrency = (value) => {
    if (value == null || isNaN(Number(value))) return "N/A";
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value);
  };

  const totalColumns = useMemo(() => {
    let cols = 7 + 1; // Purpose, Amount, Tenure, Interest%, EMI, CIBIL, Status + EMI Progress
    if (showBorrowerColumn) cols += 1;
    if (user?.role === "admin") cols += 1; // Actions
    return cols;
  }, [showBorrowerColumn, user]);

  // ===== Components =====
  const OverdueBadge = () => (
    <span className="text-xs bg-red-600 text-white px-1 rounded">⚠ Overdue</span>
  );

  const getCIBILBadge = (score) => {
    if (score == null) return <span className="text-gray-500">N/A</span>;

    let color = "bg-gray-400";
    let label = "Very Poor (<650)";
    if (score >= 750) {
      color = "bg-green-500";
      label = "Excellent (750+)";
    } else if (score >= 700) {
      color = "bg-yellow-400";
      label = "Good (700-749)";
    } else if (score >= 650) {
      color = "bg-orange-500";
      label = "Fair (650-699)";
    } else {
      color = "bg-red-600";
      label = "Poor (<650)";
    }

    return (
      <div className="flex flex-col items-center cursor-pointer" title={`CIBIL Score: ${score} — ${label}`}>
        <span className={`${color} text-white px-2 py-0.5 rounded text-sm font-semibold`}>{score}</span>
        <div className="w-16 h-2 bg-gray-300 rounded overflow-hidden mt-1">
          <div className={`${color} h-2`} style={{ width: `${Math.min(100, (score / 900) * 100)}%` }} />
        </div>
      </div>
    );
  };

  const EmiProgressBar = ({ loan }) => {
    const { totalEmis, emiPaidCount, emiOverdueCount } = loan;
    const safeTotal = totalEmis || 1;
    const upcomingCount = safeTotal - emiPaidCount - emiOverdueCount;
    const paidWidth = (emiPaidCount / safeTotal) * 100;
    const overdueWidth = (emiOverdueCount / safeTotal) * 100;
    const upcomingWidth = (upcomingCount / safeTotal) * 100;

    const barSegments = [
      { width: paidWidth, color: "bg-green-500", count: emiPaidCount, label: "Paid" },
      { width: overdueWidth, color: "bg-red-500", count: emiOverdueCount, label: "Overdue" },
      { width: upcomingWidth, color: "bg-gray-200", count: upcomingCount, label: "Upcoming" },
    ];

    return (
      <div className="w-full" title={`Paid: ${emiPaidCount}, Overdue: ${emiOverdueCount}, Upcoming: ${upcomingCount}`}>
        <div className="flex h-4 w-full rounded overflow-hidden border relative text-xs font-semibold text-white">
          {barSegments.map(
            (seg, idx) =>
              seg.width > 0 && (
                <div
                  key={idx}
                  className={`${seg.color} relative flex items-center justify-center`}
                  style={{ width: `${seg.width}%` }}
                  title={`${seg.count} EMI${seg.count > 1 ? "s" : ""} ${seg.label.toLowerCase()}`}
                />
              )
          )}
        </div>
      </div>
    );
  };

  const EmiLegend = () => (
    <div className="flex gap-4 mb-4 items-center">
      <div className="flex items-center gap-1">
        <div className="w-4 h-4 bg-green-500 border" /> <span>Paid</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-4 h-4 bg-red-500 border" /> <span>Overdue</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-4 h-4 bg-gray-200 border" /> <span>Upcoming</span>
      </div>
    </div>
  );

  const LoanActions = ({ loan }) => (
    <div className="flex gap-2 items-center">
      <select
        value={loan.status}
        onChange={(e) => updateLoanStatus(loan._id, e.target.value)}
        disabled={loadingId === loan._id || loading}
        className="border rounded p-1"
      >
        <option value="approved">Approve</option>
        <option value="rejected">Reject</option>
        <option value="pending">Pending</option>
        <option value="funding">Funding</option>
        <option value="disbursed">Disbursed</option>
        <option value="closed">Closed</option>
      </select>
      <button
        onClick={() => deleteLoan(loan._id)}
        disabled={loadingId === loan._id || loading}
        className="ml-2 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
      >
        {loadingId === loan._id ? "..." : "Delete"}
      </button>
      <button
        onClick={() => openLoanModal(loan)}
        className="ml-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
      >
        View EMI
      </button>
    </div>
  );

  const title = user?.role === "admin" ? "All Loans" : "My Loans";
  const searchPlaceholder =
    user?.role === "admin" ? "Search by borrower or purpose" : "Search your loans";

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">{title}</h2>

      <div className="flex flex-wrap gap-4 mb-4">
        <select
          className="border rounded p-2"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="funding">Funding</option>
          <option value="disbursed">Disbursed</option>
          <option value="closed">Closed</option>
        </select>

        <input
          type="search"
          placeholder={searchPlaceholder}
          className="border rounded p-2 flex-1 min-w-[250px]"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <EmiLegend />

      <div className="overflow-x-auto border rounded shadow">
        <table className="w-full text-sm table-auto">
          <thead className="bg-gray-100">
            <tr>
              {showBorrowerColumn && (
                <th className="p-2 border cursor-pointer" onClick={() => handleSort("name")}>
                  Borrower
                </th>
              )}
              <th className="p-2 border">Purpose</th>
              <th className="p-2 border cursor-pointer" onClick={() => handleSort("amount")}>
                Amount
              </th>
              <th className="p-2 border cursor-pointer" onClick={() => handleSort("tenure")}>
                Tenure
              </th>
              <th className="p-2 border cursor-pointer" onClick={() => handleSort("interestRate")}>
                Interest %
              </th>
              <th className="p-2 border cursor-pointer" onClick={() => handleSort("emi")}>
                EMI
              </th>
              <th className="p-2 border cursor-pointer" onClick={() => handleSort("cibilScore")}>
                CIBIL
              </th>
              <th className="p-2 border cursor-pointer" onClick={() => handleSort("status")}>
                Status
              </th>
              {user?.role === "admin" && <th className="p-2 border">Actions</th>}
              <th className="p-2 border">EMI Progress</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={totalColumns} className="text-center p-4">
                  Loading...
                </td>
              </tr>
            ) : currentLoans.length === 0 ? (
              <tr>
                <td colSpan={totalColumns} className="text-center py-6 text-gray-500">
                  No matching loans.
                </td>
              </tr>
            ) : (
              currentLoans.map((loan) => {
                const isOverdue = loan.emiOverdueCount > 0;
                return (
                  <tr key={loan._id} className={`${isOverdue ? "bg-red-50" : ""} hover:bg-gray-50`}>
                    {showBorrowerColumn && <td className="p-2 border">{loan.user?.name || "N/A"}</td>}
                    <td className="p-2 border">{loan.purpose || "N/A"}</td>
                    <td className="p-2 border">{fmtCurrency(loan.amount)}</td>
                    <td className="p-2 border">{loan.tenure}</td>
                    <td className="p-2 border">{loan.interestRate}%</td>
                    <td className="p-2 border">{fmtCurrency(loan.emi)}</td>
                    <td className="p-2 border">{getCIBILBadge(loan.cibilScore)}</td>
                    <td className="p-2 border capitalize font-semibold flex items-center gap-1">
                      {loan.status} {isOverdue && <OverdueBadge />}
                    </td>
                    {user?.role === "admin" && (
                      <td className="p-2 border">
                        <LoanActions loan={loan} />
                      </td>
                    )}
                    <td className="p-2 border w-44">
                      <EmiProgressBar loan={loan} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal for EMI schedule */}
      {isModalOpen && selectedLoan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-h-[80vh] overflow-y-auto shadow-lg">
            <h3 className="text-lg font-bold mb-4">
              EMI Schedule for {selectedLoan.user?.name || "Borrower"}
            </h3>
            <ul className="text-sm space-y-1">
              {selectedLoan.emis?.map((emi, idx) => (
                <li key={idx} className="flex justify-between border-b py-1">
                  <span>Month {emi.month}</span>
                  <span>
                    {fmtCurrency(emi.principal + emi.interest)}{" "}
                    {!emi.paid && new Date(emi.dueDate) < new Date() && (
                      <span className="text-red-600 font-semibold">Overdue</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <button
              onClick={closeLoanModal}
              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Pagination */}
      <div className="mt-4 flex justify-center items-center gap-2 flex-wrap">
        <button
          disabled={currentPage === 1}
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          Prev
        </button>
        {Array.from({ length: totalPages }, (_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentPage(idx + 1)}
            className={`px-3 py-1 border rounded ${
              currentPage === idx + 1 ? "bg-blue-600 text-white" : ""
            }`}
          >
            {idx + 1}
          </button>
        ))}
        <button
          disabled={currentPage === totalPages}
          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
