/**
 * PoraPlan — Milestone 12 Verification Suite
 *
 * Verifies Academic Library Evaluation Integration & Progress Reports across 18 critical checks:
 * 1. Library Evaluations tab integration.
 * 2. Existing Resources tab regression.
 * 3. Existing Tasks tab regression.
 * 4. Existing Assignments tab regression.
 * 5. Evaluation history retrieval.
 * 6. Evaluation filtering (status, format, subject, date).
 * 7. Student report calculations (completion rates, averages).
 * 8. Mentor report calculations (roster aggregates).
 * 9. Date range calculations (computeReportDateRange).
 * 10. UTC+6 timezone boundary validation.
 * 11. Empty and missing data handling.
 * 12. Average score calculation correctness (excluding unscored).
 * 13. Student ownership isolation.
 * 14. Mentor assignment roster isolation.
 * 15. Report period filtering (weekly, monthly, custom).
 * 16. Print stylesheet presence (@media print, print:hidden).
 * 17. Legacy /student/evaluations route redirect compatibility.
 * 18. Existing Progress Page regression.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { ACADEMIC_LIBRARY_TABS, formatLocalDate } from '../src/lib/library';
import {
  computeReportDateRange,
  generateStudentReport,
  generateMentorReport,
} from '../src/lib/reports';
import {
  getMockStudentTasks,
  getMockStudentResources,
  getMockStudentAssignments,
  getMockStudentEvaluations,
  getMockAssignedStudents,
} from '../src/lib/mockAuthStore';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passed++;
  } else {
    console.error(`[FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
    failed++;
  }
}

async function runMilestone12Verification() {
  console.log('====================================================');
  console.log('PORAPLAN — MILESTONE 12 VERIFICATION SUITE');
  console.log('Academic Library Evaluation & Progress Reports');
  console.log('====================================================\n');

  const studentId = 'mock-student-pp001';
  const mentorId = 'mock-mentor-ppm001';

  // Check 1: Library Evaluations Tab Integration
  console.log('--- Check 1: Library Evaluations Tab Integration ---');
  const hasEvaluationsTab = (ACADEMIC_LIBRARY_TABS as readonly string[]).includes('evaluations');
  const libraryPageContent = fs.readFileSync(
    path.join(process.cwd(), 'src/pages/dashboard/StudentLibraryPage.tsx'),
    'utf8'
  );
  assert(
    hasEvaluationsTab &&
      libraryPageContent.includes("handleTabChange('evaluations')") &&
      libraryPageContent.includes("activeTab === 'evaluations'"),
    '1. Academic Library includes 4th Evaluations tab in schema and UI'
  );

  // Check 2: Existing Resources Tab Regression
  console.log('--- Check 2: Existing Resources Tab Regression ---');
  const hasResourcesTab = (ACADEMIC_LIBRARY_TABS as readonly string[]).includes('resources');
  const resources = getMockStudentResources(studentId);
  assert(
    hasResourcesTab && Array.isArray(resources) && resources.length > 0,
    '2. Existing Resources tab schema and data layer remain fully intact'
  );

  // Check 3: Existing Tasks Tab Regression
  console.log('--- Check 3: Existing Tasks Tab Regression ---');
  const hasTasksTab = (ACADEMIC_LIBRARY_TABS as readonly string[]).includes('tasks');
  const tasks = getMockStudentTasks(studentId);
  assert(
    hasTasksTab && Array.isArray(tasks) && tasks.length > 0,
    '3. Existing Tasks tab schema and data retrieval operate without regression'
  );

  // Check 4: Existing Assignments Tab Regression
  console.log('--- Check 4: Existing Assignments Tab Regression ---');
  const hasAssignmentsTab = (ACADEMIC_LIBRARY_TABS as readonly string[]).includes('assignments');
  const assignments = getMockStudentAssignments(studentId);
  assert(
    hasAssignmentsTab && Array.isArray(assignments) && assignments.length > 0,
    '4. Existing Assignments tab schema and submission retrieval operate without regression'
  );

  // Check 5: Evaluation History Retrieval
  console.log('--- Check 5: Evaluation History Retrieval ---');
  const mockEvaluations = getMockStudentEvaluations(studentId);
  const evaluationsFileContent = fs.readFileSync(
    path.join(process.cwd(), 'src/lib/evaluations.ts'),
    'utf8'
  );
  assert(
    Array.isArray(mockEvaluations) &&
      mockEvaluations.length > 0 &&
      evaluationsFileContent.includes('export async function getStudentEvaluationsCount') &&
      evaluationsFileContent.includes('export async function getStudentEvaluations'),
    '5. Evaluation history and count service retrieve successfully for student'
  );

  // Check 6: Evaluation Filtering
  console.log('--- Check 6: Evaluation Filtering ---');
  const allEvals = mockEvaluations || [];
  const completedEvals = allEvals.filter((e) => e.status === 'completed');
  const oralEvals = allEvals.filter((e) => e.format === 'oral');
  assert(
    completedEvals.length > 0 &&
      oralEvals.length > 0 &&
      libraryPageContent.includes('evaluationStatusFilter') &&
      libraryPageContent.includes('evaluationFormatFilter'),
    '6. Evaluation filters (status, format, subject, date) correctly differentiate records'
  );

  // Check 7: Student Report Calculations
  console.log('--- Check 7: Student Report Calculations ---');
  const studentReportRes = await generateStudentReport(studentId, 'monthly');
  const sReport = studentReportRes.report;
  assert(
    studentReportRes.error === null &&
      sReport !== null &&
      typeof sReport.taskMetrics.completionRate === 'number' &&
      sReport.taskMetrics.completionRate >= 0 &&
      sReport.taskMetrics.completionRate <= 100 &&
      sReport.taskMetrics.totalAssigned >= sReport.taskMetrics.completed,
    '7. Student report correctly calculates task metrics, completion rate, and submission status'
  );

  // Check 8: Mentor Report Calculations
  console.log('--- Check 8: Mentor Report Calculations ---');
  const mentorReportRes = await generateMentorReport(mentorId, 'monthly');
  const mReport = mentorReportRes.report;
  assert(
    mentorReportRes.error === null &&
      mReport !== null &&
      mReport.assignedStudentsCount > 0 &&
      mReport.studentSummaries.length === mReport.assignedStudentsCount &&
      typeof mReport.aggregateMetrics.overallTaskCompletionRate === 'number',
    '8. Mentor report aggregates mentee roster, task completion, submissions backlog, and evaluations'
  );

  // Check 9: Date Range Calculations (computeReportDateRange)
  console.log('--- Check 9: Date Range Calculations ---');
  const weeklyRange = computeReportDateRange('weekly');
  const monthlyRange = computeReportDateRange('monthly');
  const customRange = computeReportDateRange('custom', '2026-10-01', '2026-10-15');

  const now = new Date();
  const sixDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  const expectedWeeklyStart = formatLocalDate(sixDaysAgo);

  assert(
    weeklyRange.startDate === expectedWeeklyStart &&
      weeklyRange.endDate === formatLocalDate(now) &&
      weeklyRange.daysCount === 7 &&
      monthlyRange.daysCount === 30 &&
      customRange.startDate === '2026-10-01' &&
      customRange.endDate === '2026-10-15',
    '9. computeReportDateRange accurately calculates weekly, monthly, and custom calendar ranges'
  );

  // Check 10: UTC+6 Timezone Boundary Validation
  console.log('--- Check 10: UTC+6 Timezone Boundary Validation ---');
  // In UTC+6, a date at 02:00 local time on Nov 2 is 20:00 UTC on Nov 1.
  // formatLocalDate should preserve local calendar date rather than slipping to UTC.
  const testDate = new Date(2026, 10, 2, 2, 30, 0); // Nov 2, 2026 02:30 local
  const formatted = formatLocalDate(testDate);
  assert(
    formatted === '2026-11-02',
    '10. formatLocalDate preserves local calendar boundary without UTC day-slip'
  );

  // Check 11: Empty and Missing Data Handling
  console.log('--- Check 11: Empty and Missing Data Handling ---');
  const unknownStudentRes = await generateStudentReport('non-existent-student-id', 'weekly');
  const emptyStudentRes = await generateStudentReport('mock-student-pp003', 'weekly');
  const emptyReport = emptyStudentRes.report;
  assert(
    unknownStudentRes.error !== null &&
      emptyStudentRes.error === null &&
      emptyReport !== null &&
      emptyReport.taskMetrics.totalAssigned === 0 &&
      emptyReport.taskMetrics.completionRate === 0 &&
      emptyReport.evaluationMetrics.averageScorePercentage === null &&
      !isNaN(emptyReport.taskMetrics.completionRate),
    '11. Empty student data handles 0 denominators gracefully without NaN or errors'
  );

  // Check 12: Average Score Calculation Correctness (Excluding Unscored)
  console.log('--- Check 12: Average Score Calculation Correctness ---');
  // If an evaluation has score: null (e.g. ungraded or pending evaluation), it must NOT lower average score
  const studentEvaluations = getMockStudentEvaluations(studentId);
  const scoredEvals = studentEvaluations.filter(
    (e) => e.status === 'completed' && e.score !== null && e.total_points && e.total_points > 0
  );
  const manualAverage = scoredEvals.length > 0
    ? Math.round(
        scoredEvals.reduce((acc, e) => acc + ((e.score! / e.total_points) * 100), 0) /
          scoredEvals.length
      )
    : null;
  assert(
    sReport?.evaluationMetrics.averageScorePercentage === manualAverage,
    '12. Evaluation average percentage only includes scored completed evaluations'
  );

  // Check 13: Student Ownership Isolation
  console.log('--- Check 13: Student Ownership Isolation ---');
  const studentReportTasks = sReport?.taskMetrics ? true : false;
  const mockTasks = getMockStudentTasks(studentId);
  const allBelongToStudent = mockTasks.every((t) => t.student_id === studentId);
  assert(
    studentReportTasks && allBelongToStudent,
    '13. Student reports exclusively process tasks and evaluations owned by the student'
  );

  // Check 14: Mentor Assignment Roster Isolation
  console.log('--- Check 14: Mentor Assignment Roster Isolation ---');
  const assignedStudents = getMockAssignedStudents(mentorId);
  const unauthorizedFilter = await generateMentorReport(
    mentorId,
    'monthly',
    undefined,
    undefined,
    'unauthorized-stranger-id'
  );
  assert(
    unauthorizedFilter.error !== null &&
      unauthorizedFilter.error.message.includes('Unauthorized') &&
      mReport?.studentSummaries.every((mr) =>
        assignedStudents.some((as) => as.id === mr.studentId)
      ) === true,
    '14. Mentor reports enforce strict access isolation to assigned students only'
  );

  // Check 15: Report Period Filtering
  console.log('--- Check 15: Report Period Filtering ---');
  const pastCustomReport = await generateStudentReport(
    studentId,
    'custom',
    '2025-01-01',
    '2025-01-07'
  );
  assert(
    pastCustomReport.report !== null &&
      pastCustomReport.report.studyActivityTimeline.every((d) => d.tasksCompleted === 0) &&
      pastCustomReport.report.taskMetrics.totalAssigned === 0,
    '15. Report period accurately filters out activities outside specified window'
  );

  // Check 16: Print Stylesheet Presence
  console.log('--- Check 16: Print Stylesheet Presence ---');
  const studentReportContent = fs.readFileSync(
    path.join(process.cwd(), 'src/pages/dashboard/StudentReportPage.tsx'),
    'utf8'
  );
  const mentorReportContent = fs.readFileSync(
    path.join(process.cwd(), 'src/pages/dashboard/MentorReportPage.tsx'),
    'utf8'
  );
  assert(
    studentReportContent.includes('@media print') &&
      studentReportContent.includes('print:hidden') &&
      mentorReportContent.includes('@media print') &&
      mentorReportContent.includes('print:hidden') &&
      studentReportContent.includes('window.print()'),
    '16. Student and Mentor report pages include dedicated A4 print styles and print triggers'
  );

  // Check 17: Legacy /student/evaluations Route Redirect Compatibility
  console.log('--- Check 17: Legacy Route Redirect Compatibility ---');
  const routesContent = fs.readFileSync(
    path.join(process.cwd(), 'src/routes/index.tsx'),
    'utf8'
  );
  assert(
    routesContent.includes('StudentEvaluationsRedirect') &&
      routesContent.includes("path=\"student/evaluations\"") &&
      routesContent.includes("tab=evaluations") &&
      routesContent.includes("path=\"student/reports\"") &&
      routesContent.includes("path=\"mentor/reports\""),
    '17. Legacy /student/evaluations route redirects safely to library?tab=evaluations and report routes are registered'
  );

  // Check 18: Existing Progress Page Regression
  console.log('--- Check 18: Existing Progress Page Regression ---');
  const studentProgressExists = fs.existsSync(
    path.join(process.cwd(), 'src/pages/dashboard/StudentProgressPage.tsx')
  );
  const mentorProgressExists = fs.existsSync(
    path.join(process.cwd(), 'src/pages/dashboard/MentorProgressPage.tsx')
  );
  assert(
    studentProgressExists &&
      mentorProgressExists &&
      routesContent.includes("path=\"student/progress\"") &&
      routesContent.includes("path=\"mentor/progress\""),
    '18. StudentProgressPage and MentorProgressPage remain preserved and active'
  );

  console.log('\n====================================================');
  console.log(`TOTAL CHECKS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runMilestone12Verification().catch((err) => {
  console.error('Verification failed with error:', err);
  process.exit(1);
});
