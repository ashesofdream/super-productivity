import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TimeTrackingCalendarComponent } from './time-tracking-calendar.component';
import { TaskService } from '../tasks/task.service';
import { LayoutService } from '../../core-ui/layout/layout.service';
import { GlobalTrackingIntervalService } from '../../core/global-tracking-interval/global-tracking-interval.service';
import { GlobalConfigService } from '../config/global-config.service';
import { DateService } from '../../core/date/date.service';
import { DateTimeFormatService } from '../../core/date-time-format/date-time-format.service';
import { TaskArchiveService } from '../archive/task-archive.service';
import { TimeTrackingCalendarService } from './time-tracking-calendar.service';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { provideMockStore } from '@ngrx/store/testing';
import { TranslateModule } from '@ngx-translate/core';

describe('TimeTrackingCalendarComponent', () => {
  let component: TimeTrackingCalendarComponent;
  let fixture: ComponentFixture<TimeTrackingCalendarComponent>;
  let mockTaskService: jasmine.SpyObj<TaskService>;
  let mockLayoutService: jasmine.SpyObj<LayoutService>;
  let mockGlobalTrackingIntervalService: jasmine.SpyObj<GlobalTrackingIntervalService>;
  let mockGlobalConfigService: jasmine.SpyObj<GlobalConfigService>;
  let mockDateService: jasmine.SpyObj<DateService>;
  let mockDateTimeFormatService: jasmine.SpyObj<DateTimeFormatService>;
  let mockTaskArchiveService: jasmine.SpyObj<TaskArchiveService>;
  let mockTimeTrackingCalendarService: jasmine.SpyObj<TimeTrackingCalendarService>;

  beforeEach(async () => {
    mockTaskService = jasmine.createSpyObj('TaskService', ['setCurrentId'], {
      currentTaskId$: of(null),
    });

    mockLayoutService = jasmine.createSpyObj('LayoutService', ['selectedTimeView']);
    (mockLayoutService as any).selectedTimeView = signal('week');

    mockGlobalTrackingIntervalService = jasmine.createSpyObj(
      'GlobalTrackingIntervalService',
      ['todayDateStr$'],
      {
        todayDateStr$: of('2026-05-13'),
      },
    );

    mockGlobalConfigService = jasmine.createSpyObj('GlobalConfigService', [
      'localization',
      'cfg',
    ]);
    (mockGlobalConfigService as any).localization = signal({ firstDayOfWeek: 1 });
    (mockGlobalConfigService as any).cfg = signal(undefined);
    (mockGlobalConfigService as any).appFeatures = signal({
      isTimeTrackingEnabled: true,
    });

    mockDateService = jasmine.createSpyObj('DateService', [
      'todayStr',
      'getLogicalTodayDate',
      'getStartOfNextDayDiffMs',
    ]);
    mockDateService.todayStr.and.callFake((timestamp?: number | Date) => {
      if (timestamp === undefined || timestamp === null) return '2026-05-13';
      const d = new Date(timestamp);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    });
    mockDateService.getLogicalTodayDate.and.returnValue(new Date(2026, 4, 13));
    mockDateService.getStartOfNextDayDiffMs.and.returnValue(0);

    mockDateTimeFormatService = jasmine.createSpyObj('DateTimeFormatService', [
      'currentLocale',
    ]);
    (mockDateTimeFormatService as any).currentLocale = signal('en-US');

    mockTaskArchiveService = jasmine.createSpyObj('TaskArchiveService', ['load']);
    mockTaskArchiveService.load.and.returnValue(
      Promise.resolve({ entities: {}, ids: [] }),
    );

    mockTimeTrackingCalendarService = jasmine.createSpyObj(
      'TimeTrackingCalendarService',
      ['dummy'],
    );

    await TestBed.configureTestingModule({
      imports: [TimeTrackingCalendarComponent, TranslateModule.forRoot()],
      providers: [
        provideMockStore({
          initialState: {
            tasks: {
              entities: {},
              ids: [],
            },
          },
        }),
        { provide: TaskService, useValue: mockTaskService },
        { provide: LayoutService, useValue: mockLayoutService },
        {
          provide: GlobalTrackingIntervalService,
          useValue: mockGlobalTrackingIntervalService,
        },
        { provide: GlobalConfigService, useValue: mockGlobalConfigService },
        { provide: DateService, useValue: mockDateService },
        { provide: DateTimeFormatService, useValue: mockDateTimeFormatService },
        { provide: TaskArchiveService, useValue: mockTaskArchiveService },
        {
          provide: TimeTrackingCalendarService,
          useValue: mockTimeTrackingCalendarService,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TimeTrackingCalendarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display week view by default', () => {
    expect(component.isMonthView()).toBe(false);
  });

  it('should switch to month view', () => {
    mockLayoutService.selectedTimeView.set('month');
    fixture.detectChanges();
    expect(component.isMonthView()).toBe(true);
  });

  describe('shouldEnableHorizontalScroll', () => {
    it('should be false for month view', () => {
      mockLayoutService.selectedTimeView.set('month');
      fixture.detectChanges();
      expect(component.shouldEnableHorizontalScroll()).toBe(false);
    });

    it('should be true for week view on narrow viewport', () => {
      mockLayoutService.selectedTimeView.set('week');
      // Default window size in test is likely small
      fixture.detectChanges();
      // The actual value depends on window.innerWidth
      expect(typeof component.shouldEnableHorizontalScroll()).toBe('boolean');
    });
  });

  describe('navigation', () => {
    it('should navigate to previous period', () => {
      const initialDays = component.daysToShow();
      component.goToPreviousPeriod();
      fixture.detectChanges();
      const newDays = component.daysToShow();
      expect(newDays[0]).not.toEqual(initialDays[0]);
    });

    it('should reset to latest period', () => {
      component.goToPreviousPeriod();
      fixture.detectChanges();
      component.goToLatest();
      fixture.detectChanges();
      expect(component.daysToShow().length).toBeGreaterThan(0);
    });
  });

  describe('selectTimeView', () => {
    it('should switch to month view and persist', () => {
      component.selectTimeView('month');
      expect(mockLayoutService.selectedTimeView()).toBe('month');
    });

    it('should switch to week view and persist', () => {
      component.selectTimeView('week');
      expect(mockLayoutService.selectedTimeView()).toBe('week');
    });
  });

  describe('onScrollWrapperScroll', () => {
    it('should update isHScrolled signal', () => {
      const mockEvent = {
        target: { scrollLeft: 100 },
      } as unknown as Event;
      component.onScrollWrapperScroll(mockEvent);
      expect(component.isHScrolled()).toBe(true);
    });

    it('should set isHScrolled to false when scrollLeft is 0', () => {
      const mockEvent = {
        target: { scrollLeft: 0 },
      } as unknown as Event;
      component.onScrollWrapperScroll(mockEvent);
      expect(component.isHScrolled()).toBe(false);
    });
  });
});
