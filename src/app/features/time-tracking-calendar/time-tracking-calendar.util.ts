import { Task } from '../tasks/task.model';
import { TaskTimeEntry } from '../time-tracking/time-tracking.model';
import { TimeTrackingEvent, TimeTrackingDayData } from './time-tracking-calendar.model';

/**
 * Calculate heat level (0-4) based on time spent
 */
export const calculateHeatLevel = (timeSpent: number, maxTimeSpent: number): number => {
  if (timeSpent === 0) return 0;
  if (maxTimeSpent === 0) return 0;
  const ratio = timeSpent / maxTimeSpent;
  if (ratio < 0.15) return 1;
  if (ratio < 0.4) return 2;
  if (ratio < 0.7) return 3;
  return 4;
};

/**
 * Format milliseconds to human readable time string
 */
export const formatMsToTimeString = (ms: number): string => {
  if (!ms || ms <= 0) return '0m';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours === 0) {
    return `${minutes}m`;
  }
  return `${hours}h ${minutes}m`;
};

/**
 * Format milliseconds to short time string (for month view)
 */
export const formatMsToShortTimeString = (ms: number): string => {
  if (!ms || ms <= 0) return '0';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours === 0) {
    return `${minutes}m`;
  }
  if (minutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h${minutes}m`;
};

/**
 * Hours per row (each hour is divided into FH rows)
 */
export const FH = 12;

/**
 * Minimum duration in rows (ensures task name is visible)
 * 2 rows = 10 minutes minimum display height
 */
export const MIN_DURATION_ROWS = 2;

/**
 * Calculate CSS grid style for a time tracking event
 */
export const calculateEventStyle = (
  startHours: number,
  durationHours: number,
  dayIndex: number,
): string => {
  const startRow = Math.round(startHours * FH) + 1;
  let endRow = Math.round((startHours + durationHours) * FH) + 1;

  // Ensure minimum height for visibility
  if (endRow - startRow < MIN_DURATION_ROWS) {
    endRow = startRow + MIN_DURATION_ROWS;
  }

  const gridColumn = dayIndex + 2; // +2 because column 1 is time column
  return `grid-row: ${startRow} / ${endRow}; grid-column: ${gridColumn};`;
};

/**
 * Generate unique ID for a time tracking event
 */
export const generateEventId = (
  taskId: string,
  dateStr: string,
  entryIndex: number,
): string => {
  return `${taskId}_${dateStr}_${entryIndex}`;
};

/**
 * Convert a timestamp to hours relative to midnight of a given date string
 */
export const timestampToHours = (timestamp: number, dateStr: string): number => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const midnight = new Date(year, month - 1, day).getTime();
  return (timestamp - midnight) / (1000 * 60 * 60);
};

/**
 * Map a task's time entries to calendar events for a specific date
 */
export const mapTimeEntriesToEvents = (
  task: Task,
  dateStr: string,
  dayIndex: number,
): TimeTrackingEvent[] => {
  const entries = task.timeEntries?.[dateStr];
  if (!entries || entries.length === 0) return [];

  return entries
    .map((entry: TaskTimeEntry, entryIndex: number) => {
      const startHours = timestampToHours(entry.s, dateStr);
      const durationMs = entry.e - entry.s;
      const durationHours = durationMs / (1000 * 60 * 60);

      // Skip invalid entries (zero/negative duration or out of day range)
      if (durationHours <= 0 || startHours < 0 || startHours >= 24) return null;

      // Clamp to 24 hours
      const clampedDuration = Math.min(durationHours, 24 - startHours);

      return {
        id: generateEventId(task.id, dateStr, entryIndex),
        type: 'TaskTimeEntry' as const,
        dateStr,
        startHours,
        durationHours: clampedDuration,
        task,
        timeSpent: durationMs,
        style: calculateEventStyle(startHours, clampedDuration, dayIndex),
      } satisfies TimeTrackingEvent;
    })
    .filter((ev): ev is TimeTrackingEvent => ev !== null);
};

/**
 * Map all tasks' time entries to TimeTrackingDayData grouped by date
 */
export const mapTasksToDayDataMap = (
  tasks: Task[],
  todayStr: string,
): Map<string, TimeTrackingDayData> => {
  const dayDataMap = new Map<string, TimeTrackingDayData>();

  for (const task of tasks) {
    if (!task.timeEntries) continue;

    for (const [dateStr, entries] of Object.entries(task.timeEntries)) {
      if (!entries || entries.length === 0) continue;

      if (!dayDataMap.has(dateStr)) {
        dayDataMap.set(dateStr, {
          dateStr,
          totalTimeSpent: 0,
          events: [],
          level: 0,
          isToday: dateStr === todayStr,
        });
      }

      const dayData = dayDataMap.get(dateStr)!;

      for (const entry of entries) {
        dayData.totalTimeSpent += entry.e - entry.s;
      }
    }
  }

  // Calculate heat levels
  const maxTimeSpent = Math.max(
    ...Array.from(dayDataMap.values()).map((d) => d.totalTimeSpent),
    0,
  );
  for (const dayData of dayDataMap.values()) {
    dayData.level = calculateHeatLevel(dayData.totalTimeSpent, maxTimeSpent);
  }

  return dayDataMap;
};
