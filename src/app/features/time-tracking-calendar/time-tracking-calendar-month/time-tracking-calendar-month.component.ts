import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';
import { LocaleDatePipe } from 'src/app/ui/pipes/locale-date.pipe';
import { TranslatePipe } from '@ngx-translate/core';
import { DateTimeFormatService } from 'src/app/core/date-time-format/date-time-format.service';
import { safeFormatDate } from 'src/app/util/safe-format-date';
import { parseDbDateStr } from 'src/app/util/parse-db-date-str';
import { TaskService } from '../../tasks/task.service';
import { TimeTrackingDayData, TimeTrackingEvent } from '../time-tracking-calendar.model';
import {
  formatMsToShortTimeString,
  calculateEventLevel,
  formatEventTime,
} from '../time-tracking-calendar.util';

@Component({
  selector: 'time-tracking-calendar-month',
  standalone: true,
  imports: [LocaleDatePipe, TranslatePipe, MatTooltip],
  templateUrl: './time-tracking-calendar-month.component.html',
  styleUrl: './time-tracking-calendar-month.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimeTrackingCalendarMonthComponent {
  private _dateTimeFormatService = inject(DateTimeFormatService);
  private _taskService = inject(TaskService);

  daysData = input<Map<string, TimeTrackingDayData>>(new Map());
  daysToShow = input<string[]>([]);
  weeksToShow = input<number>(6);
  firstDayOfWeek = input<number>(1);

  // Generate weekday headers based on firstDayOfWeek setting
  readonly weekdayHeaders = computed(() => {
    const firstDay = this.firstDayOfWeek();
    const headers: string[] = [];
    // January 2, 2000 was a Sunday
    const sundayDate = new Date(2000, 0, 2);

    for (let i = 0; i < 7; i++) {
      const dayIndex = (firstDay + i) % 7;
      const date = new Date(sundayDate);
      date.setDate(sundayDate.getDate() + dayIndex);
      headers.push(
        safeFormatDate(date, 'EEE', this._dateTimeFormatService.currentLocale()),
      );
    }

    return headers;
  });

  // Reference month for determining "other month" styling
  readonly referenceMonth = computed(() => {
    const days = this.daysToShow();
    if (days.length === 0) return new Date();
    const middleIndex = Math.floor(days.length / 2);
    return parseDbDateStr(days[middleIndex]);
  });

  getWeekIndex(dayIndex: number): number {
    return Math.floor(dayIndex / 7);
  }

  getDayIndex(dayIndex: number): number {
    return dayIndex % 7;
  }

  getDayClass(day: string): string {
    const dayDate = parseDbDateStr(day);
    const today = new Date();
    const monthToCompare = this.referenceMonth();

    const isCurrentMonth =
      dayDate.getMonth() === monthToCompare.getMonth() &&
      dayDate.getFullYear() === monthToCompare.getFullYear();
    const isToday = dayDate.toDateString() === today.toDateString();

    let classes = '';
    if (!isCurrentMonth) classes += ' other-month';
    if (isToday) classes += ' today';

    return classes;
  }

  getDayData(day: string): TimeTrackingDayData | undefined {
    return this.daysData().get(day);
  }

  getLevel(day: string): number {
    return this.daysData().get(day)?.level ?? 0;
  }

  getTooltipText(day: string): string {
    const data = this.daysData().get(day);
    if (!data) return '';
    const timeStr = formatMsToShortTimeString(data.totalTimeSpent);
    return `${day}: ${timeStr}`;
  }

  formatTimeShort(ms: number): string {
    return formatMsToShortTimeString(ms);
  }

  getTaskCount(dayData: TimeTrackingDayData): number {
    // Count unique tasks from events
    const taskIds = new Set(dayData.events.map((e) => e.task.id));
    return taskIds.size;
  }

  getEvents(day: string): TimeTrackingEvent[] {
    return this.daysData().get(day)?.events ?? [];
  }

  getEventLevel(event: TimeTrackingEvent): number {
    return calculateEventLevel(event.timeSpent);
  }

  getEventTime(event: TimeTrackingEvent): string {
    return formatEventTime(event.startHours);
  }

  readonly maxVisibleEvents = 4;

  onEventClick(event: TimeTrackingEvent): void {
    this._taskService.setSelectedId(event.task.id);
  }
}
