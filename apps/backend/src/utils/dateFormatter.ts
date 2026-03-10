/**
 * Format date to local timezone string
 * Returns date in format: "YYYY-MM-DD HH:MM:SS" in local timezone
 * @param date - Date object to format
 * @returns Formatted date string in local timezone or null if date is null
 */
export function formatToLocalTimezone(date: Date | null | undefined): string | null {
  if (!date) return null;
  
  // Get local timezone offset in minutes
  const offset = date.getTimezoneOffset();
  
  // Create a new date adjusted for local timezone
  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  
  // Format as YYYY-MM-DD HH:MM:SS
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');
  const hours = String(localDate.getHours()).padStart(2, '0');
  const minutes = String(localDate.getMinutes()).padStart(2, '0');
  const seconds = String(localDate.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Format date to IST (Indian Standard Time)
 * Returns date in format: "YYYY-MM-DD HH:MM:SS IST"
 * @param date - Date object to format
 * @returns Formatted date string in IST or null if date is null
 */
export function formatToIST(date: Date | null | undefined): string | null {
  if (!date) return null;
  
  // Convert to IST (UTC+5:30)
  const istOffset = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds
  const istDate = new Date(date.getTime() + istOffset);
  
  // Format as YYYY-MM-DD HH:MM:SS
  const year = istDate.getUTCFullYear();
  const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(istDate.getUTCDate()).padStart(2, '0');
  const hours = String(istDate.getUTCHours()).padStart(2, '0');
  const minutes = String(istDate.getUTCMinutes()).padStart(2, '0');
  const seconds = String(istDate.getUTCSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
