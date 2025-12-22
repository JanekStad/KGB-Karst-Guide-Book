/**
 * Normalize a string for case-insensitive and diacritics-insensitive search.
 * 
 * This function:
 * - Removes diacritics (accents) from characters
 * - Converts to lowercase
 * - Removes extra whitespace
 * 
 * Examples:
 *   "Jáchymka" -> "jachymka"
 *   "Dívčí válka" -> "divci valka"
 *   "Vlnová dálka" -> "vlnova dalka"
 * 
 * @param {string} str - The string to normalize
 * @returns {string} - Normalized string
 */
export function normalizeString(str) {
  if (!str) return '';
  
  // Convert to unicode normalized form (NFD) to separate base characters from diacritics
  // Then remove combining characters (diacritics)
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove combining diacritical marks
    .toLowerCase()
    .trim();
}

