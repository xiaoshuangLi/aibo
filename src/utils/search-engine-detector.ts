import axios from 'axios';
import { config } from '../config';

/**
 * Search Engine Detection and Fallback System
 * 
 * This module provides automatic detection of Google search engine accessibility
 * and falls back to Bing China when Google is not accessible.
 * 
 * The detection happens once at startup and caches the result for subsequent use.
 */

// Cache for detected search engine
let detectedSearchEngine: 'google' | 'bing' | null = null;
let detectionPromise: Promise<'google' | 'bing'> | null = null;

/**
 * Tests if Google search is accessible by making a simple request
 * @returns Promise<boolean> - true if Google is accessible, false otherwise
 */
async function testGoogleAccessibility(): Promise<boolean> {
  try {
    const response = await axios.get('https://www.google.com', {
      timeout: 5000, // 5 seconds timeout for detection
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AIBO Bot/1.0; +https://github.com/your-repo/aibo)'
      }
    });
    
    // Check if we got a successful response
    return response.status === 200 && response.data.includes('<title>Google</title>');
  } catch (error) {
    // If any error occurs (timeout, network error, etc.), assume Google is not accessible
    return false;
  }
}

/**
 * Detects the best available search engine (Google or Bing)
 * @returns Promise<'google' | 'bing'> - The detected search engine
 */
async function detectSearchEngine(): Promise<'google' | 'bing'> {
  // If already detected, return cached result
  if (detectedSearchEngine) {
    return detectedSearchEngine;
  }
  
  // If detection is already in progress, wait for it
  if (detectionPromise) {
    return detectionPromise;
  }
  
  // Start detection process
  detectionPromise = (async () => {
    try {
      // First, try to detect Google accessibility
      const isGoogleAccessible = await testGoogleAccessibility();
      
      if (isGoogleAccessible) {
        detectedSearchEngine = 'google';
        console.log('[SearchEngineDetector] Google search is accessible, using Google as default search engine');
      } else {
        detectedSearchEngine = 'bing';
        console.log('[SearchEngineDetector] Google search is not accessible, falling back to Bing China');
      }
      
      return detectedSearchEngine;
    } catch (error) {
      // If detection fails for any reason, fall back to Bing
      console.warn('[SearchEngineDetector] Search engine detection failed, falling back to Bing China:', error);
      detectedSearchEngine = 'bing';
      return 'bing';
    } finally {
      // Clear the promise to allow re-detection if needed (though we cache the result)
      detectionPromise = null;
    }
  })();
  
  return detectionPromise;
}

/**
 * Gets the search URL for a given keyword based on the detected search engine
 * @param keyword - The search keyword
 * @returns Promise<string> - The search URL
 */
export async function getSearchUrl(keyword: string): Promise<string> {
  const searchEngine = await detectSearchEngine();
  
  if (searchEngine === 'google') {
    return `https://www.google.com/search?q=${encodeURIComponent(keyword)}`;
  } else {
    return `https://cn.bing.com/search?q=${encodeURIComponent(keyword)}`;
  }
}

/**
 * Gets the current search engine name
 * @returns Promise<'google' | 'bing'> - The current search engine
 */
export async function getCurrentSearchEngine(): Promise<'google' | 'bing'> {
  return await detectSearchEngine();
}

/**
 * Force re-detection of the search engine (useful for testing or when network conditions change)
 */
export async function forceRedetectSearchEngine(): Promise<'google' | 'bing'> {
  detectedSearchEngine = null;
  return await detectSearchEngine();
}