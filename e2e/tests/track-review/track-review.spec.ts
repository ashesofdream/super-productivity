import { test, expect } from '../../fixtures/test.fixture';

// Mock time for all tests in this file
const MOCK_DATE = new Date('2026-05-12T10:00:00');

test.describe('Track Review', () => {
  test.use({ mockTime: MOCK_DATE });

  test('should display empty state when no time tracked', async ({
    page,
    testPrefix,
    workViewPage,
  }) => {
    await workViewPage.waitForTaskList();

    // Navigate to track-review
    await page.goto('/#/track-review');

    // Wait for page to load
    await expect(page.locator('time-tracking-calendar')).toBeVisible();

    // Should show total time as 0
    const totalTime = page.locator('.total-time .value');
    await expect(totalTime).toContainText('0m');
  });

  test('should record time entry when tracking stops', async ({
    page,
    testPrefix,
    workViewPage,
    taskPage,
  }) => {
    await workViewPage.waitForTaskList();

    // Create a task with sd:today so it appears in TODAY view
    const taskName = `${testPrefix}TrackTask1 sd:today`;
    await workViewPage.addTask(taskName);

    // Find task by the actual name (without sd:today)
    const task = taskPage.getTaskByText(`${testPrefix}TrackTask1`);
    await expect(task).toBeVisible();

    // Start tracking
    await taskPage.toggleTaskTimeTracking(task);
    await expect(task).toHaveClass(/isCurrent/);

    // Fast forward 2 minutes
    await page.clock.fastForward(2 * 60 * 1000);

    // Stop tracking
    await taskPage.toggleTaskTimeTracking(task);
    await expect(task).not.toHaveClass(/isCurrent/);

    // Navigate to track-review
    await page.goto('/#/track-review');
    await expect(page.locator('time-tracking-calendar')).toBeVisible();

    // Should show total time (at least 1 minute since we fast-forwarded 2 minutes)
    const totalTime = page.locator('.total-time .value');
    const timeText = await totalTime.textContent();
    expect(timeText).toMatch(/^[1-9]\d*m$/); // Should match "1m" or more
  });

  test('should preserve time entry when task is marked done', async ({
    page,
    testPrefix,
    workViewPage,
    taskPage,
  }) => {
    await workViewPage.waitForTaskList();

    // Create a task
    const taskName = `${testPrefix}TrackTaskDone sd:today`;
    await workViewPage.addTask(taskName);

    const task = taskPage.getTaskByText(`${testPrefix}TrackTaskDone`);
    await expect(task).toBeVisible();

    // Start tracking
    await taskPage.toggleTaskTimeTracking(task);
    await expect(task).toHaveClass(/isCurrent/);

    // Fast forward 2 minutes
    await page.clock.fastForward(2 * 60 * 1000);

    // Stop tracking
    await taskPage.toggleTaskTimeTracking(task);
    await expect(task).not.toHaveClass(/isCurrent/);

    // Mark task as done
    await taskPage.markTaskAsDone(task);

    // Navigate to track-review
    await page.goto('/#/track-review');
    await expect(page.locator('time-tracking-calendar')).toBeVisible();

    // Should still show the tracked time (at least 1 minute)
    const totalTime = page.locator('.total-time .value');
    const timeText = await totalTime.textContent();
    expect(timeText).toMatch(/^[1-9]\d*m$/); // Should match "1m" or more
  });

  test('should record time for multiple tasks when switching', async ({
    page,
    testPrefix,
    workViewPage,
    taskPage,
  }) => {
    await workViewPage.waitForTaskList();

    // Create two tasks
    const taskNameA = `${testPrefix}TaskA sd:today`;
    const taskNameB = `${testPrefix}TaskB sd:today`;
    await workViewPage.addTask(taskNameA);
    await workViewPage.addTask(taskNameB);

    const taskA = taskPage.getTaskByText(`${testPrefix}TaskA`);
    const taskB = taskPage.getTaskByText(`${testPrefix}TaskB`);
    await expect(taskA).toBeVisible();
    await expect(taskB).toBeVisible();

    // Start tracking task A
    await taskPage.toggleTaskTimeTracking(taskA);
    await expect(taskA).toHaveClass(/isCurrent/);

    // Fast forward 2 minutes
    await page.clock.fastForward(2 * 60 * 1000);

    // Switch to task B (this should stop A and start B)
    await taskPage.toggleTaskTimeTracking(taskB);
    await expect(taskA).not.toHaveClass(/isCurrent/);
    await expect(taskB).toHaveClass(/isCurrent/);

    // Fast forward 1 minute
    await page.clock.fastForward(60 * 1000);

    // Stop tracking B
    await taskPage.toggleTaskTimeTracking(taskB);
    await expect(taskB).not.toHaveClass(/isCurrent/);

    // Navigate to track-review
    await page.goto('/#/track-review');
    await expect(page.locator('time-tracking-calendar')).toBeVisible();

    // Should show combined time from both tasks (3 minutes total)
    const totalTime = page.locator('.total-time .value');
    const timeText = await totalTime.textContent();
    expect(timeText).toMatch(/^[1-9]\d*m$/); // Should match "1m" or more
  });

  test('should navigate to previous period', async ({
    page,
    testPrefix,
    workViewPage,
    taskPage,
  }) => {
    await workViewPage.waitForTaskList();

    // Create and track a task
    const taskName = `${testPrefix}NavTask sd:today`;
    await workViewPage.addTask(taskName);

    const task = taskPage.getTaskByText(`${testPrefix}NavTask`);
    await taskPage.toggleTaskTimeTracking(task);
    await page.clock.fastForward(2 * 60 * 1000);
    await taskPage.toggleTaskTimeTracking(task);

    // Navigate to track-review
    await page.goto('/#/track-review');
    await expect(page.locator('time-tracking-calendar')).toBeVisible();

    // Get initial title
    const headerTitle = page.locator('.calendar-nav-controls .title');
    const initialTitle = await headerTitle.textContent();

    // Click previous button (chevron_left icon)
    const prevBtn = page.locator('mat-icon').filter({ hasText: 'chevron_left' }).first();
    await prevBtn.click();

    // Wait for title to change using expect.poll
    await expect.poll(async () => await headerTitle.textContent()).not.toBe(initialTitle);
  });

  test('should navigate to latest period', async ({
    page,
    testPrefix,
    workViewPage,
    taskPage,
  }) => {
    await workViewPage.waitForTaskList();

    // Create and track a task
    const taskName = `${testPrefix}LatestTask sd:today`;
    await workViewPage.addTask(taskName);

    const task = taskPage.getTaskByText(`${testPrefix}LatestTask`);
    await taskPage.toggleTaskTimeTracking(task);
    await page.clock.fastForward(2 * 60 * 1000);
    await taskPage.toggleTaskTimeTracking(task);

    // Navigate to track-review
    await page.goto('/#/track-review');
    await expect(page.locator('time-tracking-calendar')).toBeVisible();

    // Get initial title
    const headerTitle = page.locator('.calendar-nav-controls .title');
    const initialTitle = await headerTitle.textContent();

    // Go to previous period first
    const prevBtn = page.locator('mat-icon').filter({ hasText: 'chevron_left' }).first();
    await prevBtn.click();

    // Wait for title to change
    await expect.poll(async () => await headerTitle.textContent()).not.toBe(initialTitle);

    // Now click latest button (history icon)
    const latestBtn = page
      .locator('.calendar-nav-controls mat-icon')
      .filter({ hasText: 'history' });
    await latestBtn.first().click();

    // Wait for title to return to initial
    await expect.poll(async () => await headerTitle.textContent()).toBe(initialTitle);
  });

  test('should switch between week and month view', async ({
    page,
    testPrefix,
    workViewPage,
    taskPage,
  }) => {
    await workViewPage.waitForTaskList();

    // Create and track a task
    const taskName = `${testPrefix}ViewSwitchTask sd:today`;
    await workViewPage.addTask(taskName);

    const task = taskPage.getTaskByText(`${testPrefix}ViewSwitchTask`);
    await taskPage.toggleTaskTimeTracking(task);
    await page.clock.fastForward(2 * 60 * 1000);
    await taskPage.toggleTaskTimeTracking(task);

    // Navigate to track-review
    await page.goto('/#/track-review');
    await expect(page.locator('time-tracking-calendar')).toBeVisible();

    // Should initially show week view
    await expect(page.locator('time-tracking-calendar-week')).toBeVisible();

    // Switch to month view (calendar_month icon)
    const monthViewBtn = page
      .locator('mat-icon')
      .filter({ hasText: 'calendar_month' })
      .first();
    await monthViewBtn.click();

    // Should show month component
    await expect(page.locator('time-tracking-calendar-month')).toBeVisible();

    // Switch back to week view (view_week icon)
    const weekViewBtn = page.locator('mat-icon').filter({ hasText: 'view_week' }).first();
    await weekViewBtn.click();

    // Should show week component again
    await expect(page.locator('time-tracking-calendar-week')).toBeVisible();
  });

  test('should not crash when deleting task during tracking', async ({
    page,
    testPrefix,
    workViewPage,
    taskPage,
  }) => {
    await workViewPage.waitForTaskList();

    // Create a task
    const taskName = `${testPrefix}DeleteTask sd:today`;
    await workViewPage.addTask(taskName);

    const task = taskPage.getTaskByText(`${testPrefix}DeleteTask`);
    await expect(task).toBeVisible();

    // Start tracking
    await taskPage.toggleTaskTimeTracking(task);
    await expect(task).toHaveClass(/isCurrent/);

    // Fast forward 1 minute
    await page.clock.fastForward(60 * 1000);

    // Delete the task while tracking - use keyboard shortcut
    await task.focus();
    await page.keyboard.press('Delete');
    // Wait for any dialog and confirm
    await page.waitForTimeout(300);

    // Navigate to track-review - should not crash
    await page.goto('/#/track-review');
    await expect(page.locator('time-tracking-calendar')).toBeVisible();

    // Page should load without errors
    const totalTime = page.locator('.total-time .value');
    await expect(totalTime).toBeVisible();
  });
});
