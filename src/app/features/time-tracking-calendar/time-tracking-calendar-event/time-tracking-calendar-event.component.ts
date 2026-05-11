import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { Store } from '@ngrx/store';
import { selectProjectById } from '../../project/store/project.selectors';
import { TaskService } from '../../tasks/task.service';
import { TimeTrackingEvent } from '../time-tracking-calendar.model';

@Component({
  selector: 'time-tracking-calendar-event',
  standalone: true,
  templateUrl: './time-tracking-calendar-event.component.html',
  styleUrl: './time-tracking-calendar-event.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimeTrackingCalendarEventComponent {
  private _store = inject(Store);
  private _taskService = inject(TaskService);

  event = input.required<TimeTrackingEvent>();

  // Task title
  title = computed(() => this.event().task.title);

  // Time range string (e.g., "9:00 - 10:30")
  timeRange = computed(() => {
    const ev = this.event();
    const startHours = Math.floor(ev.startHours);
    const startMinutes = Math.round((ev.startHours - startHours) * 60);
    const endHours = Math.floor(ev.startHours + ev.durationHours);
    const endMinutes = Math.round((ev.startHours + ev.durationHours - endHours) * 60);

    const startTime = `${startHours.toString().padStart(2, '0')}:${startMinutes.toString().padStart(2, '0')}`;
    const endTime = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;

    return `${startTime} - ${endTime}`;
  });

  // Project color
  projectColor = computed(() => {
    const projectId = this.event().task.projectId;
    if (!projectId) return 'var(--c-primary)';

    let color: string | null = null;
    this._store.select(selectProjectById, { id: projectId }).subscribe((project) => {
      color = project?.theme?.primary || null;
    });
    return color || 'var(--c-primary)';
  });

  // Click handler - select the task
  onClick(): void {
    const task = this.event().task;
    this._taskService.setSelectedId(task.id);
  }
}
