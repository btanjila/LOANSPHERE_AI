// backend/utils/loanRiskEvaluator.js

export function evaluateLoanRisk({ amount, tenure, cibilScore, purpose }) {
  let riskScore = 0;

  // Low CIBIL = High Risk
  if (cibilScore < 650) riskScore += 3;
  else if (cibilScore < 700) riskScore += 2;

  // High amount
  if (amount > 500000) riskScore += 2;
  else if (amount > 200000) riskScore += 1;

  // Long tenure
  if (tenure > 36) riskScore += 2;
  else if (tenure > 24) riskScore += 1;

  // Purpose-based risk
  const riskyPurposes = ['vacation', 'shopping', 'wedding', 'luxury'];
  if (riskyPurposes.includes(purpose?.toLowerCase())) riskScore += 2;

  // Final decision
  const isRejected = riskScore >= 5;

  return {
    isRejected,
    riskScore,
    reason: isRejected
      ? 'Loan auto-rejected due to high risk factors'
      : 'Low risk',
  };
}
