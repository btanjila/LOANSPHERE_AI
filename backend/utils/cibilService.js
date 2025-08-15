// utils/cibilService.js
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Fetch the CIBIL score for a given user.
 * Make sure to set CIBIL_API_URL and CIBIL_API_KEY in your .env
 * This simulates a real-world API call to a credit bureau.
 * In production, integrate with actual CIBIL or Equifax API.
 */
export async function fetchCibilScore(userId, panNumber) {
  try {
    if (!userId || !panNumber) {
      throw new Error('Missing required parameters for CIBIL check.');
    }

    const response = await axios.get(`${process.env.CIBIL_API_URL}/score`, {
      params: { pan: panNumber },
      headers: {
        'Authorization': `Bearer ${process.env.CIBIL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10s timeout for production resilience
    });

    if (!response.data || typeof response.data.score !== 'number') {
      throw new Error('Invalid CIBIL API response.');
    }

    console.log(`📊 Fetched CIBIL score for user ${userId}: ${response.data.score}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Failed to fetch CIBIL score for user ${userId}:`, error.message);
    throw error;
  }
}
