/**
 * Calculate the Z-score for a given confidence level
 * @param confidenceLevel - The desired confidence level (e.g., 0.95 for 95%)
 */
export function getZScore(confidenceLevel: number = 0.95): number {
  // Common z-scores for typical confidence levels
  const zScores: Record<number, number> = {
    0.80: 1.28,
    0.85: 1.44,
    0.90: 1.645,
    0.95: 1.96,
    0.99: 2.576,
    0.999: 3.291
  };
  
  return zScores[confidenceLevel] || 1.96; // Default to 95% confidence level
}

/**
 * Calculate standard error for a proportion
 * @param p - The proportion (conversion rate)
 * @param n - The sample size
 */
export function standardError(p: number, n: number): number {
  return Math.sqrt((p * (1 - p)) / n);
}

/**
 * Error function approximation for normal distribution
 * @param x - Input value
 */
export function erf(x: number): number {
  // Constants
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;

  // Save the sign of x
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);

  // A&S formula 7.1.26
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return sign * y;
}

/**
 * Calculate statistical confidence for A/B test results
 * @param conversionsA - Number of conversions in variant A
 * @param visitorsA - Number of visitors in variant A
 * @param conversionsB - Number of conversions in variant B (control)
 * @param visitorsB - Number of visitors in variant B (control)
 * @returns Confidence level between 0 and 1
 */
export function calculateConfidence(
  conversionsA: number,
  visitorsA: number,
  conversionsB: number,
  visitorsB: number
): number {
  // Handle edge cases
  if (visitorsA === 0 || visitorsB === 0) return 0;
  
  // Calculate conversion rates
  const rateA = conversionsA / visitorsA;
  const rateB = conversionsB / visitorsB;
  
  // If rates are identical, no confidence in difference
  if (rateA === rateB) return 0;
  
  // Calculate pooled standard error
  const se = Math.sqrt(
    standardError(rateA, visitorsA) ** 2 +
    standardError(rateB, visitorsB) ** 2
  );
  
  // Calculate z-score
  const z = Math.abs(rateA - rateB) / se;
  
  // Convert to probability using normal distribution approximation
  const confidence = Math.min(
    0.9999,
    (1 + erf(z / Math.sqrt(2))) / 2
  );
  
  return confidence;
}

/**
 * Calculate minimum sample size needed for statistical significance
 * @param baselineRate - Expected baseline conversion rate
 * @param expectedLift - Expected minimum detectable effect
 * @param confidenceLevel - Desired confidence level (default: 0.95)
 * @param power - Statistical power (default: 0.8)
 */
export function calculateRequiredSampleSize(
  baselineRate: number,
  expectedLift: number,
  confidenceLevel: number = 0.95,
  power: number = 0.8
): number {
  const z = getZScore(confidenceLevel);
  const zPower = getZScore(power);
  
  const p1 = baselineRate;
  const p2 = baselineRate * (1 + expectedLift);
  
  const pooledRate = (p1 + p2) / 2;
  
  const sampleSize = Math.ceil(
    2 * pooledRate * (1 - pooledRate) * (
      (z + zPower) / (p2 - p1)
    ) ** 2
  );
  
  return sampleSize;
} 