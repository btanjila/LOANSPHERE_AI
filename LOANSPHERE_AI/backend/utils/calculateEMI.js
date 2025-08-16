// backend/utils/calculateEMI.js
import dayjs from 'dayjs';

/**
 * Calculates EMI (Equated Monthly Installment) and returns EMI, total payment, and detailed EMI schedule.
 * @param {number} principal - The loan amount.
 * @param {number} months - Repayment tenure in months.
 * @param {number} annualRate - Annual interest rate in percentage (default 10%).
 * @returns {Object} emi, totalPayment, emiSchedule array.
 */
const calculateEMI = (principal, months, annualRate = 10) => {
  const r = annualRate / 12 / 100; // monthly interest rate
  const emi = (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
  const emiRounded = parseFloat(emi.toFixed(2));

  const totalPayment = parseFloat((emiRounded * months).toFixed(2));

  let balance = principal;
  const emiSchedule = [];

  // Start from today's date
  const startDate = dayjs();

  for (let i = 1; i <= months; i++) {
    const interestForMonth = parseFloat((balance * r).toFixed(2));
    const principalForMonth = parseFloat((emiRounded - interestForMonth).toFixed(2));
    balance = parseFloat((balance - principalForMonth).toFixed(2));

    emiSchedule.push({
      month: i,
      dueDate: startDate.add(i, 'month').toDate(),  // store as Date object
      principal: principalForMonth,
      interest: interestForMonth,
      amount: parseFloat((principalForMonth + interestForMonth).toFixed(2)),
      paid: false,
      paidOn: null,
      balance: balance > 0 ? balance : 0,
    });
  }

  return {
    emi: emiRounded,
    totalPayment,
    emiSchedule,
  };
};

export default calculateEMI;
