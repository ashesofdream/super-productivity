import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LocaleDatePipe } from 'src/app/ui/pipes/locale-date.pipe';
import { TranslatePipe } from '@ngx-translate/core';
import { TimeTrackingDayData, TimeTrackingEvent } from '../time-tracking-calendar.model';
import {
  formatMsToTimeString,
  FH,
  mapTimeEntriesToEvents,
} from '../time-tracking-calendar.util';
import { TimeTrackingCalendarEventComponent } from '../time-tracking-calendar-event/time-tracking-calendar-event.component';
import { Task } from '../../tasks/task.model';

@Component({
  selector: 'time-tracking-calendar-week',
  standalone: true,
  imports: [LocaleDatePipe, TranslatePipe, TimeTrackingCalendarEventComponent],
  templateUrl: './time-tracking-calendar-week.component.html',
  styleUrl: './time-tracking-calendar-week.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimeTrackingCalendarWeekComponent {
  daysData = input<Map<string, TimeTrackingDayData>>(new Map());
  daysToShow = input<string[]>([]);
  todayDateStr = input<string>('');
  allTasks = input<Task[]>([]);

  protected readonly FH = FH;
  // Total rows for 24 hours
  protected readonly rowsByNr = Array.from({ length: 24 * FH }, (_, i) => i);

  // Time labels for the left column - every 30 minutes
  times = computed(() => {
    const labels: string[] = [];
    for (let hour = 0; hour < 24; hour++) {
      // Hour label
      labels.push(`${hour.toString().padStart(2, '0')}:00`);
      // Half-hour labels are empty (we only show hour labels)
      for (let i = 1; i < FH; i++) {
        labels.push('');
      }
    }
    return labels;
  });

  // All events for the displayed days
  allEvents = computed(() => {
    const days = this.daysToShow();
    const tasks = this.allTasks();
    const events: TimeTrackingEvent[] = [];

    for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
      const dateStr = days[dayIndex];
      for (const task of tasks) {
        const taskEvents = mapTimeEntriesToEvents(task, dateStr, dayIndex);
        events.push(...taskEvents);
      }
    }

    return events;
  });

  getTotalTimeForDay(day: string): string {
    const data = this.daysData().get(day);
    if (!data) return '0m';
    return formatMsToTimeString(data.totalTimeSpent);
  }
}
