/**
 * ===================================================================================
 * New Pool Detector (pool_detector.js)
 * ===================================================================================
 *
 * Description:
 * This module acts as the "Primary Detection Layer" for our strategy. Its purpose
 * is to identify liquidity pools that have been newly created on the Solana network.
 *
 * It uses the DexPaprika public API, which allows sorting pools by creation date.
 *
 * ===================================================================================
 */

import axios from 'axios';
import logger from './logger.js';

// --- Configuration ---
// Using the DexPaprika API to discover new pools, sorted by creation time.
const NEW_POOLS_API_URL = 'https://api.dexpaprika.com/networks/solana/pools?order_by=created_at&sort=desc&limit=100';
// We will consider pools created in the last 24 hours as "new".
const RECENCY_THRESHOLD_MS = 24 * 60 * 60 * 1000;

/**
 * Detects newly created liquidity pools on Solana using the DexPaprika API.
 * @returns {Promise<Array>} A promise that resolves to an array of new pool objects.
 */
export const detectNewPools = async () => {
    logger.info('Detecting new pools from DexPaprika API...');
    try {
        const response = await axios.get(NEW_POOLS_API_URL);
        logger.info(`DexPaprika API response status: ${response.status}`);
        
        // Data is nested in the 'pools' property of the response
        const recentPools = response.data.pools;
        
        if (!Array.isArray(recentPools)) {
            logger.warn('DexPaprika API did not return an array of pools. Skipping detection.');
            logger.info(`Response data structure: ${JSON.stringify(Object.keys(response.data || {}))}`);
            return [];
        }

        logger.info(`Total pools from DexPaprika: ${recentPools.length}`);
        
        // Log a sample pool to see the data structure
        if (recentPools.length > 0) {
            logger.info(`Sample pool data: ${JSON.stringify(recentPools[0], null, 2)}`);
        }

        const now = Date.now();
        const newPools = recentPools.filter(pool => {
            // The API provides `created_at` as an ISO 8601 string (e.g., "2025-07-26T10:00:00Z")
            const creationTime = Date.parse(pool.created_at);
            return (now - creationTime) <= RECENCY_THRESHOLD_MS;
        });

        logger.info(`Found ${newPools.length} pools created in the last 24 hours.`);
        return newPools;

    } catch (error) {
        // Handle potential API errors
        const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
        logger.error(`Failed to fetch data from DexPaprika API: ${errorMessage}`);
        return [];
    }
};