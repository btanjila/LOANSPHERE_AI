// src/pages/LoanPage.jsx
import React from "react";
import { useAuth } from "../context/AuthContext";
import LoanForm from "./LoanPage";
import UnifiedLoanTable from "./UnifiedLoanTable";

export default function LoanPage() {
  const { user } = useAuth();

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-6">
      {/* Borrower sees the loan form */}
      {user?.role === "borrower" && <LoanForm />}

      {/* Everyone sees the unified loan table */}
      <UnifiedLoanTable />
    </div>
  );
}
