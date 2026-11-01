/**
 * PoraPlan — Milestone 2: Academic Library Data & Service Foundation Verification
 *
 * Verifies:
 * 1. URL Tab Foundation (src/lib/library.ts)
 * 2. Static Analysis of tasks.ts (getStudentTasks filter extensions, PostgREST queries, parity)
 * 3. Unfiltered Task Query Backward Compatibility (mockAuthStore)
 * 4. Specific Date Filtering (due_date)
 * 5. Inclusive Date Range Boundaries
 * 6. Subject Filtering
 * 7. Status Filtering
 * 8. Combined Multidimensional Filtering
 * 9. Null due_date Handling (All History inclusion vs Date Range exclusion)
 * 10. Mock / Supabase Ordering Parity (due_date ASC NULLS LAST, created_at DESC)
 * 11. History Semantics & Distinction between created_at, due_date, and completed_at
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  isValidLibraryTab,
  parseLibraryTab,
  getLibraryTabUrl,
  ACADEMIC_LIBRARY_TABS,
  DEFAULT_ACADEMIC_LIBRARY_TAB,
} from '../src/lib/library';
import {
  getMockStudentTasks,
  createMockTask,
  deleteMockTask,
  updateMockTask,
} from '../src/lib/mockAuthStore';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`[PASS] ${message}`);
  } else {
    console.error(`[FAIL] ${message}`);
    process.exitCode = 1;
  }
}

async function runVerification() {
  console.log('================================================================');
  console.log('PoraPlan Milestone 2: Academic Library Foundation Verification');
  console.log('================================================================\n');

  const studentId = 'mock-student-pp001';

  // ---------------------------------------------------------------------------
  // SECTION 1: URL Tab Foundation (src/lib/library.ts)
  // ---------------------------------------------------------------------------
  console.log('--- SECTION 1: URL Tab Foundation ---');

  assert(
    ACADEMIC_LIBRARY_TABS.length === 3 &&
      ACADEMIC_LIBRARY_TABS.includes('resources') &&
      ACADEMIC_LIBRARY_TABS.includes('tasks') &&
      ACADEMIC_LIBRARY_TABS.includes('assignments'),
    'ACADEMIC_LIBRARY_TABS contains resources, tasks, assignments'
  );

  assert(DEFAULT_ACADEMIC_LIBRARY_TAB === 'resources', 'Default tab is "resources"');

  assert(isValidLibraryTab('resources') === true, 'isValidLibraryTab identifies "resources"');
  assert(isValidLibraryTab('tasks') === true, 'isValidLibraryTab identifies "tasks"');
  assert(isValidLibraryTab('assignments') === true, 'isValidLibraryTab identifies "assignments"');
  assert(isValidLibraryTab('doubts') === false, 'isValidLibraryTab rejects non-library tab "doubts"');
  assert(isValidLibraryTab('') === false, 'isValidLibraryTab rejects empty string');
  assert(isValidLibraryTab(null) === false, 'isValidLibraryTab rejects null');

  assert(parseLibraryTab('tasks') === 'tasks', 'parseLibraryTab parses "tasks"');
  assert(parseLibraryTab('ASSIGNMENTS') === 'assignments', 'parseLibraryTab parses case-insensitively');
  assert(parseLibraryTab(' invalid ') === 'resources', 'parseLibraryTab falls back to default on invalid tab');
  assert(parseLibraryTab(null) === 'resources', 'parseLibraryTab falls back to default on null');
  assert(parseLibraryTab(undefined) === 'resources', 'parseLibraryTab falls back to default on undefined');

  assert(
    getLibraryTabUrl('/student/library', 'tasks') === '/student/library?tab=tasks',
    'getLibraryTabUrl constructs clean URL with tab query parameter'
  );
  assert(
    getLibraryTabUrl('/mentor/library?foo=bar', 'assignments') === '/mentor/library?foo=bar&tab=assignments',
    'getLibraryTabUrl preserves existing search parameters and sets tab'
  );

  // ---------------------------------------------------------------------------
  // SECTION 2: Static Analysis of src/lib/tasks.ts
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 2: Static Code & PostgREST Query Inspection ---');

  const tasksFilePath = path.resolve('src/lib/tasks.ts');
  assert(fs.existsSync(tasksFilePath), 'src/lib/tasks.ts exists on disk');
  const tasksContent = fs.readFileSync(tasksFilePath, 'utf8');

  assert(
    tasksContent.includes('export type { StudentTaskFilters }') ||
      tasksContent.includes('export interface StudentTaskFilters') ||
      tasksContent.includes('StudentTaskFilters,'),
    'tasks.ts imports or exports StudentTaskFilters'
  );

  assert(
    tasksContent.includes('programIdOrFilters?: string | StudentTaskFilters'),
    'getStudentTasks accepts backward-compatible programIdOrFilters argument'
  );

  assert(
    tasksContent.includes("query.gte('due_date', cleanStart)"),
    'tasks.ts performs efficient database-side inclusive startDate filtering on due_date'
  );

  assert(
    tasksContent.includes("query.lte('due_date', cleanEnd)"),
    'tasks.ts performs efficient database-side inclusive endDate filtering on due_date'
  );

  assert(
    tasksContent.includes("query.eq('subject_id', filters.subjectId)"),
    'tasks.ts performs database-side subject filtering'
  );

  assert(
    tasksContent.includes("query.eq('status', filters.status)"),
    'tasks.ts performs database-side status filtering'
  );

  assert(
    tasksContent.includes(".order('due_date', { ascending: true, nullsFirst: false })"),
    'tasks.ts preserves due_date ascending order with nulls placed last'
  );

  assert(
    tasksContent.includes(".order('created_at', { ascending: false })"),
    'tasks.ts orders secondary sort by created_at DESC'
  );

  // ---------------------------------------------------------------------------
  // SECTION 3: Unfiltered Task Query Backward Compatibility
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 3: Unfiltered Query Backward Compatibility ---');

  const tasksUnfiltered = getMockStudentTasks(studentId);
  assert(tasksUnfiltered.length >= 3, 'getMockStudentTasks retrieves all default mock tasks when unfiltered');

  // Verify backward compatible call with programId
  const tasksProgram = getMockStudentTasks(studentId, { programId: 'prog-academic-01' });
  assert(tasksProgram.length >= 3, 'getMockStudentTasks returns tasks for matching programId');

  // Verify backward compatible call with non-matching programId
  const tasksNonProgram = getMockStudentTasks(studentId, { programId: 'prog-nonexistent' });
  assert(tasksNonProgram.length === 0, 'getMockStudentTasks with non-matching programId yields 0 tasks');

  // Verify enriched metadata
  const sampleTask = tasksUnfiltered.find((t) => t.id === 'mock-task-001');
  assert(sampleTask !== undefined, 'mock-task-001 exists in response');
  assert(sampleTask?.subject_name !== undefined, 'mock-task-001 has enriched subject_name');
  assert(sampleTask?.plan_title !== undefined, 'mock-task-001 has enriched plan_title');

  // ---------------------------------------------------------------------------
  // SECTION 4: Specific Date Filtering (due_date)
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 4: Specific Date Filtering ---');

  // Query single date: 2026-10-15 (mock-task-003 is due on 2026-10-15)
  const tasksExactDate = getMockStudentTasks(studentId, {
    startDate: '2026-10-15',
    endDate: '2026-10-15',
  });
  assert(tasksExactDate.length === 1, 'Exact single-day filter matches exactly 1 task');
  assert(tasksExactDate[0].id === 'mock-task-003', 'Exact date filter matched mock-task-003');
  assert(tasksExactDate[0].due_date === '2026-10-15', 'Matched task has exact due_date 2026-10-15');

  // ISO string date format handling
  const tasksIsoDate = getMockStudentTasks(studentId, {
    startDate: '2026-10-15T00:00:00.000Z',
    endDate: '2026-10-15T23:59:59.999Z',
  });
  assert(tasksIsoDate.length === 1, 'ISO-formatted date range matches successfully');
  assert(tasksIsoDate[0].id === 'mock-task-003', 'ISO date filter resolves to mock-task-003');

  // Date with no scheduled tasks
  const tasksEmptyDate = getMockStudentTasks(studentId, {
    startDate: '2026-01-01',
    endDate: '2026-01-01',
  });
  assert(tasksEmptyDate.length === 0, 'Date with no tasks returns 0 results');

  // ---------------------------------------------------------------------------
  // SECTION 5: Inclusive Date Range Boundaries
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 5: Inclusive Date Range Boundaries ---');

  // Tasks exist on: 2026-10-15, 2026-10-25, 2026-10-27
  // Range: 2026-10-25 to 2026-10-27 must include BOTH boundaries
  const tasksInclusiveRange = getMockStudentTasks(studentId, {
    startDate: '2026-10-25',
    endDate: '2026-10-27',
  });
  assert(tasksInclusiveRange.length === 2, 'Range 2026-10-25 to 2026-10-27 matches both boundary tasks');
  const taskIdsInclusive = tasksInclusiveRange.map((t) => t.id);
  assert(taskIdsInclusive.includes('mock-task-001'), 'Includes lower boundary task mock-task-001 (2026-10-25)');
  assert(taskIdsInclusive.includes('mock-task-002'), 'Includes upper boundary task mock-task-002 (2026-10-27)');
  assert(!taskIdsInclusive.includes('mock-task-003'), 'Excludes earlier task mock-task-003 (2026-10-15)');

  // Open-ended lower boundary (only endDate specified)
  const tasksUpperOnly = getMockStudentTasks(studentId, {
    endDate: '2026-10-20',
  });
  assert(tasksUpperOnly.length === 1, 'Open lower bound with endDate 2026-10-20 matches 1 task');
  assert(tasksUpperOnly[0].id === 'mock-task-003', 'Open lower bound matches mock-task-003');

  // Open-ended upper boundary (only startDate specified)
  const tasksLowerOnly = getMockStudentTasks(studentId, {
    startDate: '2026-10-20',
  });
  assert(tasksLowerOnly.length === 2, 'Open upper bound with startDate 2026-10-20 matches 2 tasks');
  const taskIdsLowerOnly = tasksLowerOnly.map((t) => t.id);
  assert(
    taskIdsLowerOnly.includes('mock-task-001') && taskIdsLowerOnly.includes('mock-task-002'),
    'Open upper bound matches 001 and 002'
  );

  // ---------------------------------------------------------------------------
  // SECTION 6: Subject Filtering
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 6: Subject Filtering ---');

  const tasksSubjectMatch = getMockStudentTasks(studentId, {
    subjectId: 'mock-sub-phy-101',
  });
  assert(tasksSubjectMatch.length >= 3, 'Subject filter matches all physics tasks');

  const tasksSubjectNoMatch = getMockStudentTasks(studentId, {
    subjectId: 'mock-sub-chem-999',
  });
  assert(tasksSubjectNoMatch.length === 0, 'Subject filter with non-matching subject returns 0 tasks');

  const tasksSubjectAll = getMockStudentTasks(studentId, {
    subjectId: 'all',
  });
  assert(tasksSubjectAll.length >= 3, 'Subject filter "all" behaves identically to no subject filter');

  // ---------------------------------------------------------------------------
  // SECTION 7: Status Filtering
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 7: Status Filtering ---');

  const tasksCompleted = getMockStudentTasks(studentId, {
    status: 'completed',
  });
  assert(tasksCompleted.length === 1, 'Status "completed" returns 1 task');
  assert(tasksCompleted[0].id === 'mock-task-003', 'Completed task is mock-task-003');

  const tasksPending = getMockStudentTasks(studentId, {
    status: 'pending',
  });
  assert(tasksPending.length === 1, 'Status "pending" returns 1 task');
  assert(tasksPending[0].id === 'mock-task-002', 'Pending task is mock-task-002');

  const tasksInProgress = getMockStudentTasks(studentId, {
    status: 'in_progress',
  });
  assert(tasksInProgress.length === 1, 'Status "in_progress" returns 1 task');
  assert(tasksInProgress[0].id === 'mock-task-001', 'In-progress task is mock-task-001');

  const tasksStatusAll = getMockStudentTasks(studentId, {
    status: 'all' as any,
  });
  assert(tasksStatusAll.length >= 3, 'Status "all" returns all tasks');

  // ---------------------------------------------------------------------------
  // SECTION 8: Combined Multidimensional Filtering
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 8: Combined Multidimensional Filtering ---');

  const tasksCombined = getMockStudentTasks(studentId, {
    subjectId: 'mock-sub-phy-101',
    status: 'in_progress',
    startDate: '2026-10-20',
    endDate: '2026-10-26',
  });
  assert(tasksCombined.length === 1, 'Combined subject + status + date range narrows down to 1 task');
  assert(tasksCombined[0].id === 'mock-task-001', 'Combined query accurately identified mock-task-001');

  // Contradictory filters (status completed on dates where only in_progress exists)
  const tasksContradictory = getMockStudentTasks(studentId, {
    status: 'completed',
    startDate: '2026-10-24',
    endDate: '2026-10-28',
  });
  assert(tasksContradictory.length === 0, 'Contradictory combined filters safely yield 0 results');

  // ---------------------------------------------------------------------------
  // SECTION 9: Null due_date Handling (All History vs Date-Bounded)
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 9: Null due_date Handling ---');

  // Create temporary task with NO due_date (unscheduled task)
  const createRes = createMockTask({
    studentId,
    title: 'Unscheduled General Reading Task',
    priority: 'low',
    subjectId: 'mock-sub-phy-101',
  });
  assert(createRes.error === null && createRes.task !== null, 'Created unscheduled test task with null due_date');
  const unscheduledTaskId = createRes.task!.id;

  try {
    // 1. All History query (no date filter) must include unscheduled task
    const tasksAllHistory = getMockStudentTasks(studentId);
    const foundInAll = tasksAllHistory.find((t) => t.id === unscheduledTaskId);
    assert(foundInAll !== undefined, 'All History query (no date filters) includes unscheduled task with null due_date');
    assert(foundInAll?.due_date === null, 'Unscheduled task retains null due_date');

    // 2. Scheduled date filter query must EXCLUDE unscheduled task
    const tasksFilteredDate = getMockStudentTasks(studentId, {
      startDate: '2026-10-01',
      endDate: '2026-10-31',
    });
    const foundInFiltered = tasksFilteredDate.find((t) => t.id === unscheduledTaskId);
    assert(foundInFiltered === undefined, 'Date-bounded range query excludes unscheduled task without due_date');
  } finally {
    // Clean up temporary task
    deleteMockTask(unscheduledTaskId);
  }

  // ---------------------------------------------------------------------------
  // SECTION 10: Mock / Supabase Ordering Parity
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 10: Ordering Parity ---');

  const tasksOrder = getMockStudentTasks(studentId);
  const dates = tasksOrder.map((t) => t.due_date);
  console.log('Resulting task due_dates order:', dates);

  assert(tasksOrder[0].due_date === '2026-10-15', 'Earliest due_date task (2026-10-15) appears first');
  assert(tasksOrder[1].due_date === '2026-10-25', 'Middle due_date task (2026-10-25) appears second');
  assert(tasksOrder[2].due_date === '2026-10-27', 'Latest due_date task (2026-10-27) appears third');

  // ---------------------------------------------------------------------------
  // SECTION 11: History Semantics & Field Disambiguation
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 11: History Semantics ---');

  const task003 = tasksOrder.find((t) => t.id === 'mock-task-003')!;
  assert(task003.due_date === '2026-10-15', 'due_date represents scheduled date: 2026-10-15');
  assert(task003.created_at !== undefined, 'created_at represents creation timestamp');
  assert(
    task003.completed_at !== null && task003.completed_at !== undefined,
    'completed_at represents completion timestamp'
  );
  assert(
    task003.due_date !== task003.created_at && task003.due_date !== task003.completed_at,
    'due_date, created_at, and completed_at are distinct fields'
  );

  // Status transition reset behavior: toggling from completed to pending clears completed_at
  updateMockTask('mock-task-003', { status: 'pending' });
  const task003Pending = getMockStudentTasks(studentId).find((t) => t.id === 'mock-task-003')!;
  assert(task003Pending.status === 'pending', 'Task transitioned to pending');
  assert(task003Pending.completed_at === null, 'completed_at is reset to null when status leaves completed');

  // Restore status back to completed for mock-task-003
  updateMockTask('mock-task-003', { status: 'completed' });
  const task003Restored = getMockStudentTasks(studentId).find((t) => t.id === 'mock-task-003')!;
  assert(task003Restored.status === 'completed', 'Task restored to completed');
  assert(task003Restored.completed_at !== null, 'completed_at re-stamped with completion timestamp');

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(
    `Verification Summary: ${passedTests} / ${totalTests} Passed (${Math.round((passedTests / totalTests) * 100)}%)`
  );
  console.log('================================================================\n');

  if (passedTests !== totalTests) {
    process.exitCode = 1;
  }
}

runVerification().catch((err) => {
  console.error('Unhandled verification error:', err);
  process.exitCode = 1;
});
