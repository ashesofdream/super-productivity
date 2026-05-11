import { Task } from '../tasks/task.model';

/**
 * 时间追踪事件 - 用于在时间线上显示
 */
export interface TimeTrackingEvent {
  id: string;
  type: 'TaskTimeEntry';
  dateStr: string;
  startHours: number;
  durationHours: number;
  task: Task;
  timeSpent: number;
  style: string;
}

/**
 * 单日时间追踪数据
 */
export interface TimeTrackingDayData {
  dateStr: string;
  totalTimeSpent: number;
  events: TimeTrackingEvent[];
  level: number;
  isToday: boolean;
  workStart?: number;
  workEnd?: number;
}
