/**
 * Date & Time Utilities for Routify
 *
 * Ensures all dates and times are handled in the user's local timezone
 * WITHOUT unintended UTC shifts (e.g. +7h or -7h).
 */

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Returns "YYYY-MM-DD" in local time.
 */
export const toLocalDateString = (d: Date = new Date()): string => {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Returns "HH:mm" in local time.
 */
export const toLocalTimeString = (d: Date = new Date()): string => {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * Returns "YYYY-MM-DDTHH:mm" in local time for HTML datetime-local input.
 */
export const toLocalInputString = (d: Date = new Date()): string => {
  return `${toLocalDateString(d)}T${toLocalTimeString(d)}`;
};

/**
 * Parse any backend datetime string ("2026-09-20T14:00:00", "2026-09-20 14:00:00", etc.)
 * to HTML input format "YYYY-MM-DDTHH:mm".
 * Does NOT convert timezones or call toISOString().
 */
export const parseBackendDatetimeToLocalInput = (str?: string | null): string => {
  if (!str || !str.trim()) return '';
  const trimmed = str.trim().replace(' ', 'T');
  if (trimmed.length >= 16) {
    return trimmed.slice(0, 16);
  }
  if (trimmed.length === 10) {
    // Just a date "YYYY-MM-DD"
    return `${trimmed}T00:00`;
  }
  return trimmed;
};

/**
 * Formats a local input string ("YYYY-MM-DDTHH:mm") to backend format ("YYYY-MM-DDTHH:mm:ss").
 * Does NOT convert to UTC / toISOString(), preserving exact local user time.
 */
export const formatDatetimeForBackend = (val?: string | null): string | undefined => {
  if (!val || !val.trim()) return undefined;
  const trimmed = val.trim().replace(' ', 'T');
  // If "YYYY-MM-DDTHH:mm:ss", return first 19 chars
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 19);
  }
  // If "YYYY-MM-DDTHH:mm", append ":00"
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed}:00`;
  }
  // If "YYYY-MM-DD", append "T00:00:00"
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T00:00:00`;
  }
  return trimmed;
};

// Aliases for compatibility
export const isoToLocalInput = parseBackendDatetimeToLocalInput;
export const localInputToISO = formatDatetimeForBackend;

/**
 * Returns Monday, Sunday, ISO week number, and formatted label for any given date.
 */
export const getWeekDateRange = (d: Date = new Date()) => {
  const current = new Date(d.getTime());
  const day = current.getDay();
  // day 0 is Sunday, 1 is Monday ... 6 is Saturday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(current);
  monday.setDate(current.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  // ISO week calculation
  const target = new Date(monday.valueOf());
  const dayNr = (monday.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);

  const pad2 = (n: number) => String(n).padStart(2, '0');
  const monStr = `${pad2(monday.getDate())}/${pad2(monday.getMonth() + 1)}`;
  const sunStr = `${pad2(sunday.getDate())}/${pad2(sunday.getMonth() + 1)}/${sunday.getFullYear()}`;
  const label = `Tuần ${weekNumber} (${monStr} - ${sunStr})`;

  return {
    monday,
    sunday,
    mondayStr: toLocalDateString(monday),
    sundayStr: toLocalDateString(sunday),
    weekNumber,
    year: monday.getFullYear(),
    label,
    shortRange: `${monStr} - ${sunStr}`,
  };
};

/**
 * Add or subtract weeks from a date.
 */
export const addWeeks = (d: Date, numWeeks: number): Date => {
  const res = new Date(d.getTime());
  res.setDate(res.getDate() + numWeeks * 7);
  return res;
};

