import { inject, Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { Task } from '../tasks/task.model';
import { TaskArchiveService } from '../archive/task-archive.service';
import { TaskService } from '../tasks/task.service';
import { DateService } from '../../core/date/date.service';
import { TimeTrackingDayData, TimeTrackingEvent } from './time-tracking-calendar.model';
import {
  mapTasksToDayDataMap,
  mapTimeEntriesToEvents,
} from './time-tracking-calendar.util';

@Injectable({
  providedIn: 'root',
})
export class TimeTrackingCalendarService {
  private _taskArchiveService = inject(TaskArchiveService);
  private _taskService = inject(TaskService);
  private _dateService = inject(DateService);

  /**
   * Load all tasks' time tracking data (current + archive)
   */
  loadAllTimeTrackingData$(): Observable<Map<string, TimeTrackingDayData>> {
    return from(this._loadAllTasks()).pipe(
      map((tasks) => this._mapTasksToDayData(tasks)),
      shareReplay(1),
    );
  }

  /**
   * Get events for specific days (used by week view)
   */
  getEventsForDays(
    daysToShow: string[],
    dayDataMap: Map<string, TimeTrackingDayData>,
  ): TimeTrackingEvent[] {
    const events: TimeTrackingEvent[] = [];

    for (let dayIndex = 0; dayIndex < daysToShow.length; dayIndex++) {
      const dateStr = daysToShow[dayIndex];
      const dayData = dayDataMap.get(dateStr);
      if (!dayData) continue;

      for (const dayDataItem of dayDataMap.values()) {
        if (dayDataItem.dateStr !== dateStr) continue;
        // Events will be generated from time entries in the tasks
      }
    }

    return events;
  }

  private async _loadAllTasks(): Promise<Task[]> {
    const archive = await this._taskArchiveService.load();
    const archiveTasks = archive
      ? (Object.values(archive.entities).filter(Boolean) as Task[])
      : [];

    // Note: current tasks are handled through taskFeatureState
    return archiveTasks;
  }

  private _mapTasksToDayData(tasks: Task[]): Map<string, TimeTrackingDayData> {
    const todayStr = this._dateService.todayStr();
    return mapTasksToDayDataMap(tasks, todayStr);
  }

  /**
   * Generate events for a specific day from tasks with time entries
   */
  generateEventsForDay(
    tasks: Task[],
    dateStr: string,
    dayIndex: number,
  ): TimeTrackingEvent[] {
    const events: TimeTrackingEvent[] = [];

    for (const task of tasks) {
      const taskEvents = mapTimeEntriesToEvents(task, dateStr, dayIndex);
      events.push(...taskEvents);
    }

    return events;
  }
}
