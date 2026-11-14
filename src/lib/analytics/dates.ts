import { DatePeriod, PeriodPreset } from "../types";
import { TIMEZONE } from "../constants";

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Converts a Date or timestamp into YYYY-MM-DD in Europe/London timezone,
 * properly respecting GMT/BST daylight saving transitions.
 */
export function getLondonDateString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

/**
 * Adds `days` calendar days to a YYYY-MM-DD string deterministically.
 */
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/**
 * Returns an inclusive array of YYYY-MM-DD strings between startDate and endDate.
 */
export function listDatesInRange(startDate: string, endDate: string): string[] {
  if (startDate > endDate) return [];
  const dates: string[] = [];
  let curr = startDate;
  while (curr <= endDate) {
    dates.push(curr);
    curr = addDays(curr, 1);
  }
  return dates;
}

/**
 * Formats a date range concisely in British editorial format, e.g. "8–14 Nov" or "28 Oct–3 Nov".
 */
export function formatDateRangeLabel(startDate: string, endDate: string): string {
  if (startDate === endDate) {
    return formatSingleDateShort(startDate);
  }
  const [y1, m1, d1] = startDate.split("-").map(Number);
  const [y2, m2, d2] = endDate.split("-").map(Number);

  if (y1 === y2 && m1 === m2) {
    return `${d1}–${d2} ${SHORT_MONTHS[m1 - 1]}`;
  }
  return `${d1} ${SHORT_MONTHS[m1 - 1]}–${d2} ${SHORT_MONTHS[m2 - 1]}`;
}

export function formatSingleDateShort(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const weekday = dt.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
  return `${weekday} ${d} ${SHORT_MONTHS[m - 1]}`;
}

export function getWeekdayInitial(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const weekday = dt.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
  return weekday.slice(0, 1).toUpperCase();
}

/**
 * Resolves a PeriodPreset and optional custom bounds into a DatePeriod with
 * its exact equivalent previous period.
 */
export function resolveDatePeriod(
  preset: PeriodPreset,
  anchorDate: string = "2026-11-14",
  customStart?: string,
  customEnd?: string,
  earliestDate: string = "2026-10-12"
): DatePeriod {
  switch (preset) {
    case "today": {
      const prev = addDays(anchorDate, -1);
      return {
        preset: "today",
        startDate: anchorDate,
        endDate: anchorDate,
        label: formatSingleDateShort(anchorDate),
        prevStartDate: prev,
        prevEndDate: prev,
        prevLabel: formatSingleDateShort(prev),
      };
    }

    case "week": {
      // 7-day window ending on anchorDate (e.g. Sun 8 Nov – Sat 14 Nov)
      const startDate = addDays(anchorDate, -6);
      const prevEndDate = addDays(startDate, -1);
      const prevStartDate = addDays(prevEndDate, -6);
      return {
        preset: "week",
        startDate,
        endDate: anchorDate,
        label: formatDateRangeLabel(startDate, anchorDate),
        prevStartDate,
        prevEndDate,
        prevLabel: formatDateRangeLabel(prevStartDate, prevEndDate),
      };
    }

    case "month": {
      const [y, m] = anchorDate.split("-").map(Number);
      const startDate = `${y}-${String(m).padStart(2, "0")}-01`;
      // Compare with the equivalent number of days in the previous calendar month
      const daysElapsed = listDatesInRange(startDate, anchorDate).length;
      const prevMonthYear = m === 1 ? y - 1 : y;
      const prevMonth = m === 1 ? 12 : m - 1;
      const prevStartDate = `${prevMonthYear}-${String(prevMonth).padStart(2, "0")}-01`;
      const prevEndDate = addDays(prevStartDate, daysElapsed - 1);
      return {
        preset: "month",
        startDate,
        endDate: anchorDate,
        label: formatDateRangeLabel(startDate, anchorDate),
        prevStartDate,
        prevEndDate,
        prevLabel: formatDateRangeLabel(prevStartDate, prevEndDate),
      };
    }

    case "custom": {
      const s = customStart && customStart <= (customEnd || anchorDate) ? customStart : addDays(anchorDate, -13);
      const e = customEnd && customEnd >= s ? customEnd : anchorDate;
      const dayCount = listDatesInRange(s, e).length;
      const prevEndDate = addDays(s, -1);
      const prevStartDate = addDays(prevEndDate, -(dayCount - 1));
      return {
        preset: "custom",
        startDate: s,
        endDate: e,
        label: formatDateRangeLabel(s, e),
        prevStartDate,
        prevEndDate,
        prevLabel: formatDateRangeLabel(prevStartDate, prevEndDate),
      };
    }

    case "all":
    default: {
      return {
        preset: "all",
        startDate: earliestDate,
        endDate: anchorDate,
        label: formatDateRangeLabel(earliestDate, anchorDate),
        prevStartDate: null,
        prevEndDate: null,
        prevLabel: null,
      };
    }
  }
}
