// frontend/src/components/LoanForm.jsx
import React, { useState } from "react";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";
import { HandCoins } from "lucide-react";

function LoanForm({ onLoanCreated }) {
  const { user, token } = useAuth();
  const [form, setForm] = useState({
    amount: "",
    tenure: "",
    interestRate: "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
  };

  const validateForm = () => {
    const newErrors = {};
    if (!form.amount || Number(form.amount) <= 0)
      newErrors.amount = "Amount must be positive.";
    if (
      !form.tenure ||
      Number(form.tenure) <= 0 ||
      !Number.isInteger(Number(form.tenure))
    )
      newErrors.tenure = "Tenure must be a positive whole number.";
    if (!form.interestRate || Number(form.interestRate) <= 0)
      newErrors.interestRate = "Interest rate must be positive.";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user || !token) {
      toast.error("You must be logged in as borrower.");
      return;
    }
    if (!validateForm()) return;

    setLoading(true);
    try {
      await api.post(
        "/loans",
        {
          amount: Number(form.amount),
          tenure: Number(form.tenure),
          interestRate: Number(form.interestRate),
          borrower: user._id || user.id,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success("✅ Loan application submitted successfully!");
      setForm({ amount: "", tenure: "", interestRate: "" });
      if (onLoanCreated) onLoanCreated();
    } catch (error) {
      console.error(
        "Loan submission error:",
        error.response?.data || error.message
      );
      toast.error(error.response?.data?.message || "Failed to apply for loan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-lg mx-auto bg-white p-6 md:p-8 rounded-xl shadow-md space-y-6 border border-gray-200"
    >
      <div className="flex items-center gap-3 mb-2">
        <HandCoins className="w-6 h-6 text-indigo-600" />
        <h2 className="text-2xl font-bold text-gray-700">Apply for a Loan</h2>
      </div>

      <FormInput
        label="Amount"
        name="amount"
        type="number"
        value={form.amount}
        onChange={handleChange}
        error={errors.amount}
        placeholder="Enter loan amount"
        disabled={loading}
      />

      <FormInput
        label="Tenure (months)"
        name="tenure"
        type="number"
        value={form.tenure}
        onChange={handleChange}
        error={errors.tenure}
        placeholder="Loan tenure in months"
        disabled={loading}
      />

      <FormInput
        label="Interest Rate (% per annum)"
        name="interestRate"
        type="number"
        step="0.01"
        value={form.interestRate}
        onChange={handleChange}
        error={errors.interestRate}
        placeholder="Interest rate"
        disabled={loading}
      />

      <button
        type="submit"
        disabled={loading}
        className={`w-full py-3 text-white font-semibold rounded-lg transition ${
          loading
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-indigo-600 hover:bg-indigo-700"
        }`}
      >
        {loading ? "Submitting..." : "Submit Loan"}
      </button>
    </form>
  );
}

const FormInput = ({ label, error, ...props }) => (
  <div>
    <label className="block text-gray-600 font-semibold mb-1">{label}</label>
    <input
      {...props}
      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
        error
          ? "border-red-500 focus:ring-red-300"
          : "border-gray-300 focus:ring-indigo-300"
      }`}
    />
    {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
  </div>
);

export default LoanForm;
