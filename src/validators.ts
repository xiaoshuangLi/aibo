/**
 * Configuration validation utilities for the AI Bot application.
 * 
 * This module provides functions to validate and sanitize configuration values
 * to ensure the application runs safely and correctly.
 */

/**
 * Validates if a string is a valid API key format.
 * For OpenAI, this should be a string starting with 'sk-' followed by alphanumeric characters.
 * 
 * @param apiKey - The API key to validate
 * @returns true if valid, false otherwise
 */
export function isValidApiKey(apiKey: string): boolean {
  if (typeof apiKey !== 'string' || apiKey.trim() === '') {
    return false;
  }
  
  // OpenAI API keys typically start with 'sk-' followed by alphanumeric characters
  // Minimum length should be reasonable (e.g., at least 20 characters after 'sk-')
  const trimmedKey = apiKey.trim();
  if (!trimmedKey.startsWith('sk-')) {
    return false;
  }
  
  const suffix = trimmedKey.substring(3);
  if (suffix.length < 20) {
    return false;
  }
  
  // Check if suffix contains only alphanumeric characters
  return /^[a-zA-Z0-9]+$/.test(suffix);
}

/**
 * Validates if a URL string is properly formatted.
 * 
 * @param url - The URL to validate
 * @returns true if valid, false otherwise
 */
export function isValidUrl(url: string): boolean {
  if (typeof url !== 'string' || url.trim() === '') {
    return false;
  }
  
  try {
    new URL(url.trim());
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates model name format.
 * Model names should be non-empty strings containing only alphanumeric characters, hyphens, underscores, and dots.
 * 
 * @param modelName - The model name to validate
 * @returns true if valid, false otherwise
 */
export function isValidModelName(modelName: string): boolean {
  if (typeof modelName !== 'string' || modelName.trim() === '') {
    return false;
  }
  
  const pattern = /^[a-zA-Z0-9._-]+$/;
  return pattern.test(modelName.trim());
}

/**
 * Validates positive integer values.
 * 
 * @param value - The value to validate
 * @returns true if valid positive integer, false otherwise
 */
export function isValidPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}