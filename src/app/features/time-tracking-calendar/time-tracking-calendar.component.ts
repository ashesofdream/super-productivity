/* eslint-disable */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { fromEvent, from, Observable } from 'rxjs';
import { debounceTime, map, startWith } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Store } from '@ngrx/store';
import { LayoutService } from '../../core-ui/layout/layout.service';
import { GlobalTrackingIntervalService } from '../../core/global-tracking-interval/global-tracking-interval.service';
import { GlobalConfigService } from '../config/global-config.service';
import { DateService } from '../../core/date/date.service';
import { DateTimeFormatService } from '../../core/date-time-format/date-time-format.service';
import { TaskService } from '../tasks/task.service';
import { TaskArchiveService } from '../archive/task-archive.service';
import { selectAllTasks } from '../tasks/store/task.selectors';
import { LS } from 'src/app/core/persistence/storage-keys.const';
import { safeFormatDate } from '../../util/safe-format-date';
import { getWeekNumber } from '../../util/get-week-number';
import { parseDbDateStr } from '../../util/parse-db-date-str';
import { DEFAULT_FIRST_DAY_OF_WEEK } from '../../core/locale.constants';
import { TimeTrackingCalendarService } from './time-tracking-calendar.service';
import {
  formatMsToTimeString,
  mapTasksToDayDataMap,
} from './time-tracking-calendar.util';
import { TimeTrackingCalendarWeekComponent } from './time-tracking-calendar-week/time-tracking-calendar-week.component';
import { TimeTrackingCalendarMonthComponent } from './time-tracking-calendar-month/time-tracking-calendar-month.component';
import { T } from '../../t.const';
import { Task, TaskArchive } from '../tasks/task.model';
import { SCHEDULE_CONSTANTS } from '../schedule/schedule.constants';

@Component({
  selector: 'time-tracking-calendar',
  standalone: true,
  imports: [
    TimeTrackingCalendarWeekComponent,
    TimeTrackingCalendarMonthComponent,
    MatIconButton,
    MatIcon,
    MatTooltip,
    TranslatePipe,
  ],
  templateUrl: './time-tracking-calendar.component.html',
  styleUrls: ['./time-tracking-calendar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,

  host: {
    '[style.--nr-of-days]': 'daysToShow().length',
  },
})
export class TimeTrackingCalendarComponent {
  T = T;

  private _layoutService = inject(LayoutService);
  private _globalTrackingIntervalService = inject(GlobalTrackingIntervalService);
  private _globalConfigService = inject(GlobalConfigService);
  private _dateService = inject(DateService);
  private _dateTimeFormatService = inject(DateTimeFormatService);
  private _translate = inject(TranslateService);
  private _store = inject(Store);
  private _taskService = inject(TaskService);
  private _taskArchiveService = inject(TaskArchiveService);
  private _timeTrackingCalendarService = inject(TimeTrackingCalendarService);

  // Scroll wrapper reference for horizontal scroll positioning
  private _scrollWrapperEl = viewChild.required<ElementRef<HTMLElement>>('scrollWrapper');

  // View mode
  private _currentTimeViewMode = computed(() => this._layoutService.selectedTimeView());
  isMonthView = computed(() => this._currentTimeViewMode() === 'month');

  // Navigation state - reference date for the view (defaults to yesterday for "review" focus)
  private _selectedDate = signal<Date | null>(null);

  // Today's date string
  protected _todayDateStr = toSignal(this._globalTrackingIntervalService.todayDateStr$, {
    initialValue: this._dateService.todayStr(),
  });

  // Window size for responsive layout
  private _windowSize = toSignal(
    fromEvent(window, 'resize').pipe(
      startWith({ width: window.innerWidth, height: window.innerHeight }),
      debounceTime(50),
      map(() => ({ width: window.innerWidth, height: window.innerHeight })),
    ),
    { initialValue: { width: window.innerWidth, height: window.innerHeight } },
  );

  // Horizontal scroll mode for mobile
  shouldEnableHorizontalScroll = computed(() => {
    const selectedView = this._currentTimeViewMode();
    // Only enable horizontal scroll for week view when viewport is narrow
    if (selectedView !== 'week') {
      return false;
    }
    // Enable scroll when viewport is smaller than what's needed for 7 days
    return this._windowSize().width < SCHEDULE_CONSTANTS.HORIZONTAL_SCROLL_THRESHOLD;
  });

  // Track if user has scrolled horizontally (for sticky time column background)
  isHScrolled = signal(false);

  onScrollWrapperScroll(event: Event): void {
    const el = event.target as HTMLElement;
    this.isHScrolled.set(el.scrollLeft > 0);
  }

  // Number of days/weeks to show
  private _daysToShowCount = computed(() => {
    const size = this._windowSize();
    const selectedView = this._currentTimeViewMode();
    const height = size.height;

    if (selectedView === 'month') {
      const availableHeight = height - 120;
      const minHeightPerWeek = 80;
      const maxWeeks = Math.floor(availableHeight / minHeightPerWeek);
      return Math.min(Math.max(maxWeeks, 3), 6);
    }

    return 7; // Week view always 7 days
  });

  // Days to show - defaults to past week (yesterday and 6 days before)
  daysToShow = computed(() => {
    const count = this._daysToShowCount();
    const selectedView = this._currentTimeViewMode();
    const selectedDate = this._selectedDate();
    this._todayDateStr(); // Trigger re-computation when today changes

    if (selectedView === 'month') {
      return this._getMonthDaysToShow(count, this.firstDayOfWeek(), selectedDate);
    }
    return this._getPastDaysToShow(count, selectedDate);
  });

  weeksToShow = computed(() => Math.ceil(this.daysToShow().length / 7));

  // First day of week setting
  firstDayOfWeek = computed(() => {
    const cfg = this._globalConfigService.localization()?.firstDayOfWeek;
    return cfg !== null && cfg !== undefined ? cfg : DEFAULT_FIRST_DAY_OF_WEEK;
  });

  // Header title
  headerTitle = computed(() => {
    const days = this.daysToShow();
    if (!days.length) return '';
    const locale = this._dateTimeFormatService.currentLocale();

    if (this.isMonthView()) {
      const mid = parseDbDateStr(days[Math.floor(days.length / 2)]);
      return safeFormatDate(mid, 'LLLL yyyy', locale);
    }

    const start = parseDbDateStr(days[0]);
    const end = parseDbDateStr(days[days.length - 1]);
    const weekNr = getWeekNumber(start);
    const sameMonth =
      start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
    const startStr = safeFormatDate(start, 'MMM d', locale);
    const endStr = sameMonth
      ? safeFormatDate(end, 'd', locale)
      : safeFormatDate(end, 'MMM d', locale);
    const label = this._translate.instant(T.F.TIME_TRACKING_CALENDAR.WEEK_NR, {
      nr: weekNr,
    });
    return `${label} · ${startStr} – ${endStr}`;
  });

  // All tasks (current + archive)
  allTasks = toSignal(this._store.select(selectAllTasks), { initialValue: [] as Task[] });

  // Archive tasks
  private _archiveTasks = toSignal(
    from(this._taskArchiveService.load()) as Observable<TaskArchive>,
    {
      initialValue: null,
    },
  );

  // Combined tasks
  combinedTasks = computed(() => {
    const current = this.allTasks();
    const archive = this._archiveTasks();
    const archiveTasks = archive
      ? (Object.values(archive.entities).filter(Boolean) as Task[])
      : [];
    // Combine and dedupe by id
    const taskMap = new Map<string, Task>();
    for (const task of [...archiveTasks, ...current]) {
      if (task && task.id) {
        taskMap.set(task.id, task);
      }
    }
    return Array.from(taskMap.values());
  });

  // Day data map
  dayDataMap = computed(() => {
    const tasks = this.combinedTasks();
    const todayStr = this._todayDateStr();
    return mapTasksToDayDataMap(tasks, todayStr);
  });

  // Total time for displayed range
  totalTimeForRange = computed(() => {
    const days = this.daysToShow();
    const dayData = this.dayDataMap();
    let total = 0;
    for (const day of days) {
      const data = dayData.get(day);
      if (data) {
        total += data.totalTimeSpent;
      }
    }
    return total;
  });

  totalTimeFormatted = computed(() => formatMsToTimeString(this.totalTimeForRange()));

  // Track if we've already scrolled to avoid repeated scrolling
  private _hasScrolledToRight = false;

  constructor() {
    // Restore view mode from localStorage
    this._layoutService.selectedTimeView.set(this._getTimeView());

    // Scroll to right (most recent day) when horizontal scroll mode is first enabled
    effect((onCleanup) => {
      const isHorizontalScroll = this.shouldEnableHorizontalScroll();
      if (isHorizontalScroll && !this._hasScrolledToRight) {
        this._hasScrolledToRight = true;
        const timeoutId = setTimeout(() => {
          const el = this._scrollWrapperEl()?.nativeElement;
          if (el) {
            el.scrollLeft = el.scrollWidth - el.clientWidth;
          }
        }, 0);
        onCleanup(() => clearTimeout(timeoutId));
      }
    });
  }

  // Navigation methods - navigate through past periods
  goToPreviousPeriod(): void {
    const currentDate = this._selectedDate() || this._getDefaultReferenceDate();
    const selectedView = this._currentTimeViewMode();

    if (selectedView === 'month') {
      const previousMonth = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - 1,
        1,
      );
      this._selectedDate.set(previousMonth);
    } else {
      const daysToSkip = this.daysToShow().length;
      const previousPeriod = new Date(currentDate);
      previousPeriod.setDate(currentDate.getDate() - daysToSkip);
      this._selectedDate.set(previousPeriod);
    }
  }

  goToNextPeriod(): void {
    const currentDate = this._selectedDate() || this._getDefaultReferenceDate();
    const selectedView = this._currentTimeViewMode();

    if (selectedView === 'month') {
      const nextMonth = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        1,
      );
      this._selectedDate.set(nextMonth);
    } else {
      const daysToSkip = this.daysToShow().length;
      const nextPeriod = new Date(currentDate);
      nextPeriod.setDate(currentDate.getDate() + daysToSkip);

      // Don't allow navigating to future beyond today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (nextPeriod > today) {
        this._selectedDate.set(null); // Reset to default (past week ending today)
      } else {
        this._selectedDate.set(nextPeriod);
      }
    }
  }

  // Reset to default view (most recent past week/month)
  goToLatest(): void {
    this._selectedDate.set(null);
  }

  selectTimeView(view: 'week' | 'month'): void {
    this._layoutService.selectedTimeView.set(view);
    localStorage.setItem(LS.SELECTED_TIME_VIEW, view);
  }

  private _getTimeView(): 'week' | 'month' {
    const preservedView = localStorage.getItem(LS.SELECTED_TIME_VIEW);
    return preservedView === 'month' ? 'month' : 'week';
  }

  // Get yesterday's date (end of review range)
  // Uses DateService to respect logical day boundaries and clock mocks
  private _getYesterday(): Date {
    const today = this._dateService.getLogicalTodayDate();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  // Default reference date is today (for "review" focus on past)
  private _getDefaultReferenceDate(): Date {
    return this._getYesterday();
  }

  // Get past N days ending today (for week view - review past data)
  private _getPastDaysToShow(
    nrOfDaysToShow: number,
    referenceDate: Date | null = null,
  ): string[] {
    // Default to today as the end date
    const endDate = referenceDate ? referenceDate : this._getYesterday();
    const endTime = endDate.getTime();
    const daysToShow: string[] = [];
    const msPerDay = 24 * 60 * 60 * 1000;

    // Go back N days from the reference date
    for (let i = nrOfDaysToShow - 1; i >= 0; i--) {
      daysToShow.push(this._dateService.todayStr(endTime - i * msPerDay));
    }
    return daysToShow;
  }

  private _getMonthDaysToShow(
    numberOfWeeks: number,
    firstDayOfWeek: number = 1,
    referenceDate: Date | null = null,
  ): string[] {
    // Default to yesterday for month view too
    const today = referenceDate ? referenceDate : this._getYesterday();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const firstDayToShow = new Date(firstDayOfMonth);
    const monthStartDay = firstDayOfMonth.getDay();

    const daysToGoBack = (monthStartDay - firstDayOfWeek + 7) % 7;
    firstDayToShow.setDate(firstDayOfMonth.getDate() - daysToGoBack);

    const totalDays = numberOfWeeks * 7;
    const daysToShow: string[] = [];
    for (let i = 0; i < totalDays; i++) {
      const currentDate = new Date(firstDayToShow);
      currentDate.setDate(firstDayToShow.getDate() + i);
      daysToShow.push(this._dateService.todayStr(currentDate.getTime()));
    }

    return daysToShow;
  }
}
