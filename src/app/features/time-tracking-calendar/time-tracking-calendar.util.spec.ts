/* eslint-disable no-mixed-operators */
import { Task } from '../tasks/task.model';
import { TaskTimeEntry } from '../time-tracking/time-tracking.model';
import {
  calculateHeatLevel,
  formatMsToTimeString,
  formatMsToShortTimeString,
  calculateEventStyle,
  timestampToHours,
  mapTimeEntriesToEvents,
  mapTasksToDayDataMap,
  FH,
  MIN_DURATION_ROWS,
} from './time-tracking-calendar.util';

describe('time-tracking-calendar.util', () => {
  const hourMs = 60 * 60 * 1000;
  const minMs = 60 * 1000;

  // Helper to create mock task
  const createMockTask = (
    id: string,
    timeEntries?: Record<string, TaskTimeEntry[]>,
  ): Task =>
    ({
      id,
      title: `Task ${id}`,
      created: Date.now(),
      isDone: false,
      subTaskIds: [],
      tagIds: [],
      projectId: 'INBOX',
      timeSpentOnDay: {},
      timeEstimate: 0,
      timeSpent: 0,
      timeEntries,
      attachments: [],
    }) as Task;

  describe('calculateHeatLevel', () => {
    it('should return 0 for zero time spent', () => {
      expect(calculateHeatLevel(0, 1000)).toBe(0);
    });

    it('should return 0 for zero max time spent', () => {
      expect(calculateHeatLevel(100, 0)).toBe(0);
    });

    it('should return 1 for ratio < 0.15', () => {
      expect(calculateHeatLevel(10, 100)).toBe(1); // 10%
      expect(calculateHeatLevel(14, 100)).toBe(1); // 14%
    });

    it('should return 2 for ratio 0.15 to 0.4', () => {
      expect(calculateHeatLevel(15, 100)).toBe(2); // 15%
      expect(calculateHeatLevel(39, 100)).toBe(2); // 39%
    });

    it('should return 3 for ratio 0.4 to 0.7', () => {
      expect(calculateHeatLevel(40, 100)).toBe(3); // 40%
      expect(calculateHeatLevel(69, 100)).toBe(3); // 69%
    });

    it('should return 4 for ratio >= 0.7', () => {
      expect(calculateHeatLevel(70, 100)).toBe(4); // 70%
      expect(calculateHeatLevel(100, 100)).toBe(4); // 100%
    });
  });

  describe('formatMsToTimeString', () => {
    it('should return "0m" for zero or negative values', () => {
      expect(formatMsToTimeString(0)).toBe('0m');
      expect(formatMsToTimeString(-100)).toBe('0m');
    });

    it('should format minutes only when < 1 hour', () => {
      expect(formatMsToTimeString(30 * minMs)).toBe('30m');
      expect(formatMsToTimeString(45 * minMs)).toBe('45m');
    });

    it('should format hours and minutes', () => {
      expect(formatMsToTimeString(hourMs)).toBe('1h 0m');
      expect(formatMsToTimeString(90 * minMs)).toBe('1h 30m');
      expect(formatMsToTimeString(2 * hourMs + 15 * minMs)).toBe('2h 15m');
    });

    it('should handle large values', () => {
      expect(formatMsToTimeString(8 * hourMs)).toBe('8h 0m');
      expect(formatMsToTimeString(24 * hourMs)).toBe('24h 0m');
    });
  });

  describe('formatMsToShortTimeString', () => {
    it('should return "0" for zero or negative values', () => {
      expect(formatMsToShortTimeString(0)).toBe('0');
      expect(formatMsToShortTimeString(-100)).toBe('0');
    });

    it('should format minutes only when < 1 hour', () => {
      expect(formatMsToShortTimeString(30 * minMs)).toBe('30m');
    });

    it('should format hours only when minutes are 0', () => {
      expect(formatMsToShortTimeString(hourMs)).toBe('1h');
      expect(formatMsToShortTimeString(2 * hourMs)).toBe('2h');
    });

    it('should format hours and minutes compactly', () => {
      expect(formatMsToShortTimeString(90 * minMs)).toBe('1h30m');
      expect(formatMsToShortTimeString(2 * hourMs + 15 * minMs)).toBe('2h15m');
    });
  });

  describe('calculateEventStyle', () => {
    it('should calculate correct grid-row for midnight start', () => {
      const style = calculateEventStyle(0, 1, 0); // 00:00, 1 hour, day 0
      expect(style).toContain('grid-row: 1 / 13'); // FH=12, so 1 hour = 12 rows
      expect(style).toContain('grid-column: 2'); // day 0 + 2 = column 2
    });

    it('should calculate correct grid-row for noon start', () => {
      const style = calculateEventStyle(12, 1, 0); // 12:00, 1 hour
      expect(style).toContain('grid-row: 145 / 157'); // 12*12+1=145
    });

    it('should set correct column for different day indices', () => {
      expect(calculateEventStyle(0, 1, 0)).toContain('grid-column: 2');
      expect(calculateEventStyle(0, 1, 1)).toContain('grid-column: 3');
      expect(calculateEventStyle(0, 1, 5)).toContain('grid-column: 7');
    });

    it('should apply minimum height for very short events', () => {
      // 5 minutes = 0.0833 hours, which is < MIN_DURATION_ROWS/FH = 2/12 = 0.1667 hours
      const style = calculateEventStyle(0, 0.05, 0);
      // Should have at least MIN_DURATION_ROWS height
      expect(style).toContain('grid-row: 1 / 3'); // startRow=1, endRow=1+2=3
    });

    it('should not apply minimum height for longer events', () => {
      const style = calculateEventStyle(0, 1, 0); // 1 hour
      expect(style).toContain('grid-row: 1 / 13'); // 12 rows, no minimum needed
    });
  });

  describe('timestampToHours', () => {
    it('should return 0 for timestamp at midnight', () => {
      const dateStr = '2026-05-12';
      const midnight = new Date(2026, 4, 12).getTime(); // May 12, 2026 00:00
      expect(timestampToHours(midnight, dateStr)).toBe(0);
    });

    it('should return correct hours for noon', () => {
      const dateStr = '2026-05-12';
      const noon = new Date(2026, 4, 12, 12, 0).getTime();
      expect(timestampToHours(noon, dateStr)).toBe(12);
    });

    it('should return correct hours for specific time', () => {
      const dateStr = '2026-05-12';
      const time = new Date(2026, 4, 12, 9, 30).getTime(); // 9:30 AM
      expect(timestampToHours(time, dateStr)).toBeCloseTo(9.5, 2);
    });
  });

  describe('mapTimeEntriesToEvents', () => {
    const dateStr = '2026-05-12';
    const midnight = new Date(2026, 4, 12).getTime();

    it('should return empty array for task without timeEntries', () => {
      const task = createMockTask('task-1');
      expect(mapTimeEntriesToEvents(task, dateStr, 0)).toEqual([]);
    });

    it('should return empty array for task with no entries for date', () => {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const task = createMockTask('task-1', { '2026-05-11': [] });
      expect(mapTimeEntriesToEvents(task, dateStr, 0)).toEqual([]);
    });

    it('should convert valid time entries to events', () => {
      const entry: TaskTimeEntry = {
        s: midnight + 9 * hourMs, // 9:00 AM
        e: midnight + 10 * hourMs, // 10:00 AM
      };
      const task = createMockTask('task-1', { [dateStr]: [entry] });

      const events = mapTimeEntriesToEvents(task, dateStr, 0);

      expect(events.length).toBe(1);
      expect(events[0].task.id).toBe('task-1');
      expect(events[0].dateStr).toBe(dateStr);
      expect(events[0].startHours).toBe(9);
      expect(events[0].durationHours).toBe(1);
    });

    it('should filter out entries with negative duration', () => {
      const entry: TaskTimeEntry = {
        s: midnight + 10 * hourMs,
        e: midnight + 9 * hourMs, // end before start
      };
      const task = createMockTask('task-1', { [dateStr]: [entry] });

      expect(mapTimeEntriesToEvents(task, dateStr, 0)).toEqual([]);
    });

    it('should filter out entries outside day range', () => {
      const entry: TaskTimeEntry = {
        s: midnight - hourMs, // 23:00 previous day
        e: midnight + hourMs,
      };
      const task = createMockTask('task-1', { [dateStr]: [entry] });

      expect(mapTimeEntriesToEvents(task, dateStr, 0)).toEqual([]);
    });

    it('should handle multiple entries', () => {
      const entries: TaskTimeEntry[] = [
        {
          s: midnight + 9 * hourMs,
          e: midnight + 10 * hourMs,
        },
        {
          s: midnight + 14 * hourMs,
          e: midnight + 15 * hourMs,
        },
      ];
      const task = createMockTask('task-1', { [dateStr]: entries });

      const events = mapTimeEntriesToEvents(task, dateStr, 0);

      expect(events.length).toBe(2);
    });
  });

  describe('mapTasksToDayDataMap', () => {
    const todayStr = '2026-05-12';
    const midnight = new Date(2026, 4, 12).getTime();

    it('should return empty map for empty tasks array', () => {
      expect(mapTasksToDayDataMap([], todayStr).size).toBe(0);
    });

    it('should skip tasks without timeEntries', () => {
      const task = createMockTask('task-1');
      const result = mapTasksToDayDataMap([task], todayStr);
      expect(result.size).toBe(0);
    });

    it('should group entries by date', () => {
      const entry: TaskTimeEntry = {
        s: midnight + 9 * hourMs,
        e: midnight + 10 * hourMs,
      };
      const task = createMockTask('task-1', { [todayStr]: [entry] });

      const result = mapTasksToDayDataMap([task], todayStr);

      expect(result.has(todayStr)).toBe(true);
    });

    it('should calculate correct total time per day', () => {
      const entries: TaskTimeEntry[] = [
        {
          s: midnight + 9 * hourMs,
          e: midnight + 10 * hourMs,
        }, // 1 hour
        {
          s: midnight + 14 * hourMs,
          e: midnight + 14.5 * hourMs,
        }, // 30 min
      ];
      const task = createMockTask('task-1', { [todayStr]: entries });

      const result = mapTasksToDayDataMap([task], todayStr);
      const dayData = result.get(todayStr);

      expect(dayData?.totalTimeSpent).toBe(1.5 * hourMs); // 1.5 hours in ms
    });

    it('should calculate correct heat levels', () => {
      const entry: TaskTimeEntry = {
        s: midnight,
        e: midnight + 8 * hourMs,
      }; // 8 hours (max)
      const task = createMockTask('task-1', { [todayStr]: [entry] });

      const result = mapTasksToDayDataMap([task], todayStr);
      const dayData = result.get(todayStr);

      expect(dayData?.level).toBe(4); // max time should have highest level
    });

    it('should mark today correctly', () => {
      const entry: TaskTimeEntry = {
        s: midnight,
        e: midnight + hourMs,
      };
      const task = createMockTask('task-1', { [todayStr]: [entry] });

      const result = mapTasksToDayDataMap([task], todayStr);
      const dayData = result.get(todayStr);

      expect(dayData?.isToday).toBe(true);
    });

    it('should aggregate time from multiple tasks on same day', () => {
      const entry1: TaskTimeEntry = {
        s: midnight,
        e: midnight + hourMs,
      }; // 1 hour
      const entry2: TaskTimeEntry = {
        s: midnight + 2 * hourMs,
        e: midnight + 3 * hourMs,
      }; // 1 hour

      const task1 = createMockTask('task-1', { [todayStr]: [entry1] });
      const task2 = createMockTask('task-2', { [todayStr]: [entry2] });

      const result = mapTasksToDayDataMap([task1, task2], todayStr);
      const dayData = result.get(todayStr);

      expect(dayData?.totalTimeSpent).toBe(2 * hourMs); // 2 hours total
    });
  });

  describe('constants', () => {
    it('should have FH (fractional hours) set to 12', () => {
      expect(FH).toBe(12);
    });

    it('should have MIN_DURATION_ROWS set to 2', () => {
      expect(MIN_DURATION_ROWS).toBe(2);
    });
  });
});
