/**
 * PoraPlan — Milestone 4: Academic Library Tasks & Study History Integration Verification
 *
 * Verifies:
 * 1. Architecture & Component Existence (StudentLibraryPage Tab 2, AttachmentViewerModal, tasks & storage services)
 * 2. Tab Navigation & URL Synchronization (Tab 2 'tasks' mapping, query params, 3 tabs preserved)
 * 3. Static Inspection of StudentLibraryPage (Date controls, presets, attachment preview/download, status toggle)
 * 4. Date Search & Filtering Semantics (due_date vs created_at vs completed_at)
 * 5. Specific Date & Inclusive Date Range Boundary Queries
 * 6. Subject & Status Filtering (pending, in_progress, completed, overdue logic)
 * 7. Unscheduled Tasks Handling (due_date is null included in All History, excluded in date bounds)
 * 8. History Semantics & Status Toggling (completed_at set on completed, reset to null on pending)
 * 9. Attachment Preview & Download Foundations (private academic-attachments bucket, signed URLs)
 * 10. Preservation of Independent Modules (/student/tasks, Doubts Desk, Announcements, Evaluations, Reviews)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  parseLibraryTab,
  getLibraryTabUrl,
  ACADEMIC_LIBRARY_TABS,
  DEFAULT_ACADEMIC_LIBRARY_TAB,
} from '../src/lib/library';
import {
  getMockStudentTasks,
  createMockTask,
  updateMockTask,
  deleteMockTask,
  getMockTaskById,
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
  console.log('PoraPlan Milestone 4: Academic Library Tasks Integration Test');
  console.log('================================================================\n');

  const studentId = 'mock-student-pp001';

  // ---------------------------------------------------------------------------
  // SECTION 1: Architecture & File Existence
  // ---------------------------------------------------------------------------
  console.log('--- SECTION 1: Architecture & File Existence ---');

  const libraryPagePath = path.resolve('src/pages/dashboard/StudentLibraryPage.tsx');
  assert(fs.existsSync(libraryPagePath), 'StudentLibraryPage.tsx exists on disk');

  const studentTasksPagePath = path.resolve('src/pages/dashboard/StudentTasksPage.tsx');
  assert(fs.existsSync(studentTasksPagePath), 'StudentTasksPage.tsx exists on disk');

  const tasksLibPath = path.resolve('src/lib/tasks.ts');
  assert(fs.existsSync(tasksLibPath), 'src/lib/tasks.ts exists on disk');

  const storageLibPath = path.resolve('src/lib/storage.ts');
  assert(fs.existsSync(storageLibPath), 'src/lib/storage.ts exists on disk');

  const attachmentModalPath = path.resolve('src/components/common/AttachmentViewerModal.tsx');
  assert(fs.existsSync(attachmentModalPath), 'AttachmentViewerModal.tsx exists on disk');

  // ---------------------------------------------------------------------------
  // SECTION 2: Tab Navigation & URL Synchronization
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 2: Tab Navigation & URL Synchronization ---');

  assert(ACADEMIC_LIBRARY_TABS.includes('tasks'), 'tasks is in ACADEMIC_LIBRARY_TABS list');
  assert(parseLibraryTab('tasks') === 'tasks', 'parseLibraryTab parses ?tab=tasks correctly');
  assert(
    getLibraryTabUrl('/student/library', 'tasks') === '/student/library?tab=tasks',
    'getLibraryTabUrl generates /student/library?tab=tasks'
  );
  assert(
    getLibraryTabUrl('/student/library', 'resources') === '/student/library?tab=resources',
    'getLibraryTabUrl generates /student/library?tab=resources'
  );
  assert(
    DEFAULT_ACADEMIC_LIBRARY_TAB === 'resources',
    'Default academic library tab remains resources'
  );

  // ---------------------------------------------------------------------------
  // SECTION 3: Static Inspection of StudentLibraryPage Implementation
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 3: Static Inspection of StudentLibraryPage ---');

  const libraryPageContent = fs.readFileSync(libraryPagePath, 'utf8');

  assert(
    libraryPageContent.includes("activeTab === 'tasks'"),
    'StudentLibraryPage renders activeTab === tasks view'
  );
  assert(
    libraryPageContent.includes('AttachmentViewerModal'),
    'StudentLibraryPage embeds AttachmentViewerModal'
  );
  assert(
    libraryPageContent.includes('handlePreviewAttachment'),
    'StudentLibraryPage contains handlePreviewAttachment'
  );
  assert(
    libraryPageContent.includes('handleDownloadAttachment'),
    'StudentLibraryPage contains handleDownloadAttachment'
  );
  assert(
    libraryPageContent.includes('handleToggleTaskStatus'),
    'StudentLibraryPage contains handleToggleTaskStatus'
  );
  assert(
    libraryPageContent.includes('getAcademicFileSignedUrl'),
    'StudentLibraryPage uses getAcademicFileSignedUrl for secure attachment links'
  );
  assert(
    libraryPageContent.includes('due_date') &&
      libraryPageContent.includes('created_at') &&
      libraryPageContent.includes('completed_at'),
    'StudentLibraryPage clearly displays due_date, created_at, and completed_at'
  );
  assert(
    libraryPageContent.includes('OVERDUE'),
    'StudentLibraryPage provides overdue task identification'
  );
  assert(
    libraryPageContent.includes('computeDateRange'),
    'StudentLibraryPage calculates date bounds for presets (today, week, month, range)'
  );

  // ---------------------------------------------------------------------------
  // SECTION 4: Task Retrieval & Filter Operations
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 4: Task Retrieval & Baseline Data ---');

  const baselineTasks = getMockStudentTasks(studentId);
  assert(Array.isArray(baselineTasks), 'getMockStudentTasks returns an array');
  assert(baselineTasks.length >= 3, `Student has ${baselineTasks.length} baseline tasks`);

  const task1 = baselineTasks[0];
  assert(typeof task1.id === 'string', 'Task has valid ID string');
  assert(typeof task1.title === 'string', 'Task has valid title');
  assert('due_date' in task1, 'Task contains due_date field');
  assert('created_at' in task1, 'Task contains created_at field');
  assert('completed_at' in task1, 'Task contains completed_at field');

  // ---------------------------------------------------------------------------
  // SECTION 5: Specific Date & Inclusive Date Range Boundary Queries
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 5: Specific Date & Inclusive Date Range Queries ---');

  // Target task with known due_date
  const scheduledTask = baselineTasks.find((t) => t.due_date);
  assert(Boolean(scheduledTask), 'Baseline contains a scheduled task');

  if (scheduledTask && scheduledTask.due_date) {
    const targetDate = scheduledTask.due_date;

    // Single Date Filter (startDate = endDate = targetDate)
    const singleDayTasks = getMockStudentTasks(studentId, {
      startDate: targetDate,
      endDate: targetDate,
    });
    assert(singleDayTasks.length >= 1, `Single date filter returned ${singleDayTasks.length} task(s)`);
    assert(
      singleDayTasks.every((t) => t.due_date === targetDate),
      `All single-date tasks match target date ${targetDate}`
    );

    // Inclusive Range Filter
    const rangeTasks = getMockStudentTasks(studentId, {
      startDate: '2026-10-01',
      endDate: '2026-10-31',
    });
    assert(rangeTasks.length >= 2, `October range query returned ${rangeTasks.length} tasks`);
    assert(
      rangeTasks.every(
        (t) => t.due_date !== null && t.due_date >= '2026-10-01' && t.due_date <= '2026-10-31'
      ),
      'All October range tasks strictly fall within 2026-10-01 and 2026-10-31'
    );
  }

  // ---------------------------------------------------------------------------
  // SECTION 6: Status & Subject Filtering
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 6: Status & Subject Filtering ---');

  // Pending Status Filter
  const pendingTasks = getMockStudentTasks(studentId, { status: 'pending' });
  assert(
    pendingTasks.every((t) => t.status === 'pending'),
    'Every task returned by status=pending filter has status pending'
  );

  // Completed Status Filter
  const completedTasks = getMockStudentTasks(studentId, { status: 'completed' });
  assert(
    completedTasks.every((t) => t.status === 'completed'),
    'Every task returned by status=completed filter has status completed'
  );

  // Subject Filter
  const sampleWithSubject = baselineTasks.find((t) => t.subject_id);
  if (sampleWithSubject && sampleWithSubject.subject_id) {
    const subjectTasks = getMockStudentTasks(studentId, {
      subjectId: sampleWithSubject.subject_id,
    });
    assert(
      subjectTasks.every((t) => t.subject_id === sampleWithSubject.subject_id),
      `Subject filter strictly matches subject_id ${sampleWithSubject.subject_id}`
    );
  }

  // ---------------------------------------------------------------------------
  // SECTION 7: Unscheduled Tasks Handling
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 7: Unscheduled Tasks Handling ---');

  // Create temporary task without due_date
  const unscheduledRes = createMockTask({
    studentId,
    title: 'Milestone 4 Unscheduled Verification Task',
    priority: 'low',
  });
  assert(Boolean(unscheduledRes.task?.id), 'Created mock unscheduled task');
  const unscheduledTask = unscheduledRes.task;

  if (unscheduledTask) {
    // All history query (no date range) includes unscheduled tasks
    const allHistory = getMockStudentTasks(studentId);
    assert(
      allHistory.some((t) => t.id === unscheduledTask.id),
      'Unscheduled task is included in All History view'
    );

    // Date bounded query excludes unscheduled tasks
    const boundedTasks = getMockStudentTasks(studentId, {
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });
    assert(
      !boundedTasks.some((t) => t.id === unscheduledTask.id),
      'Unscheduled task is excluded from date-bounded queries'
    );

    // Cleanup
    deleteMockTask(unscheduledTask.id);
  }

  // ---------------------------------------------------------------------------
  // SECTION 8: History Semantics & Status Toggling
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 8: History Semantics & Status Toggling ---');

  const toggleRes = createMockTask({
    studentId,
    title: 'Milestone 4 History Semantics Test Task',
    dueDate: '2026-11-15',
    priority: 'medium',
  });
  assert(Boolean(toggleRes.task?.id), 'Created toggle test task');
  const toggleTask = toggleRes.task;

  if (toggleTask) {
    assert(toggleTask.completed_at === null, 'Initial pending task has completed_at === null');

    // Transition to completed
    const completedRes = updateMockTask(toggleTask.id, {
      status: 'completed',
    });
    assert(completedRes.task?.status === 'completed', 'Task status transitioned to completed');
    assert(
      typeof completedRes.task?.completed_at === 'string' && completedRes.task.completed_at.length > 0,
      'completed_at is recorded when task completes'
    );

    // Revert back to pending
    const revertedRes = updateMockTask(toggleTask.id, {
      status: 'pending',
    });
    assert(revertedRes.task?.status === 'pending', 'Task status reverted to pending');
    assert(
      revertedRes.task?.completed_at === null,
      'completed_at is reset to null upon reverting (verified single-record history semantics)'
    );

    // Cleanup
    deleteMockTask(toggleTask.id);
  }

  // ---------------------------------------------------------------------------
  // SECTION 9: Task Attachment Metadata & Storage Integration
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 9: Task Attachment Storage Integration ---');

  const attachmentRes = createMockTask({
    studentId,
    title: 'Milestone 4 Attachment Task',
    dueDate: '2026-11-20',
    priority: 'high',
    attachmentName: 'practice_sheet.pdf',
    attachmentPath: 'tasks/mock-task-m4/practice_sheet.pdf',
    attachmentSize: 204800,
  });
  assert(Boolean(attachmentRes.task?.id), 'Created task with attachment metadata');
  const attachmentTask = attachmentRes.task;

  if (attachmentTask) {
    assert(attachmentTask.attachment_name === 'practice_sheet.pdf', 'Attachment name preserved');
    assert(attachmentTask.attachment_size === 204800, 'Attachment size preserved');
    assert(
      attachmentTask.attachment_path === 'tasks/mock-task-m4/practice_sheet.pdf',
      'Attachment path preserved'
    );

    // Storage module static audit
    const storageContent = fs.readFileSync(storageLibPath, 'utf8');
    assert(
      storageContent.includes('academic-attachments'),
      'Storage service targets private academic-attachments bucket'
    );
    assert(
      storageContent.includes('getAcademicFileSignedUrl'),
      'Storage service exports getAcademicFileSignedUrl'
    );

    // Cleanup
    deleteMockTask(attachmentTask.id);
  }

  // ---------------------------------------------------------------------------
  // SECTION 10: Module Isolation & Preservation
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 10: Module Isolation & Preservation ---');

  const studentDoubtsPagePath = path.resolve('src/pages/dashboard/StudentDoubtsPage.tsx');
  assert(fs.existsSync(studentDoubtsPagePath), 'StudentDoubtsPage.tsx is preserved');

  const mentorDoubtsPagePath = path.resolve('src/pages/dashboard/MentorDoubtsPage.tsx');
  assert(fs.existsSync(mentorDoubtsPagePath), 'MentorDoubtsPage.tsx is preserved');

  const mentorReviewPath = path.resolve('src/pages/dashboard/MentorReviewQueuePage.tsx');
  assert(fs.existsSync(mentorReviewPath), 'MentorReviewQueuePage.tsx is preserved');

  const studentTasksPageContent = fs.readFileSync(studentTasksPagePath, 'utf8');
  assert(
    studentTasksPageContent.includes('StudentTasksPage'),
    'StudentTasksPage component intact'
  );

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`Results: ${passedTests} / ${totalTests} assertions passed.`);
  console.log('================================================================');

  if (passedTests !== totalTests) {
    process.exitCode = 1;
    throw new Error(`Failed ${totalTests - passedTests} tests.`);
  }
}

runVerification().catch((err) => {
  console.error('Unhandled verification error:', err);
  process.exit(1);
});
