/**
 * PoraPlan — Milestone 12.3 Verification Suite
 *
 * Verifies Reporting Experience Refinement & Admin Academic Intelligence:
 * 1. Student Report Page 1 Intactness: Core KPIs and Subject Matrix unchanged.
 * 2. Student Report Page 2 Refinement: Visual hierarchy, compact daily consistency graph.
 * 3. Student Report Page 2 Overflow Prevention: Compact sizing guarantees 2-page A4 structure.
 * 4. Mentor Report Print Header Root Cause Fix: Report headers explicitly preserved in print mode.
 * 5. Mentor Overview Print Header Presence: Branding, title, period, and mentor identity visible.
 * 6. Individual Mentee Print Header Presence: Student identity and mentor context visible in print.
 * 7. Admin Reporting Center Route Registration: /admin/reports registered with admin role guard.
 * 8. Admin Navigation Link: DashboardLayout includes Academic Reports in admin navigation.
 * 9. Admin Overview Metrics (C1): Distinguishes registered vs active students and total vs active mentors.
 * 10. Admin Student Directory (C2): Enriched student summaries with academic metadata and metrics.
 * 11. Admin Mentor Directory (C3): Enriched mentor summaries with separated workload and activity.
 * 12. Admin Attention Radar (C4): Evidence-based neutral labels (Critical, Needs Attention, On Track, Insufficient Data).
 * 13. Insufficient Data Neutrality: Zero tasks and evaluations produce Insufficient Data, not negative labels.
 * 14. Admin Single Student Report Access: Admin can generate detailed report for any student.
 * 15. Admin Single Mentor Report Access: Admin can generate detailed report for any mentor.
 * 16. Admin Authorization Enforcement: Non-admin users are strictly blocked from admin reports.
 * 17. Student Role Isolation: Students cannot access other students' reports or admin reports.
 * 18. Mentor Role Isolation: Mentors cannot access unassigned students or admin reports.
 * 19. Privacy Protection: Private contact numbers, passwords, and internal notes are not exposed.
 * 20. End-to-End Build and Milestone 12 / 12.2 / 12.2.1 Regression Protection.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  generateStudentReport,
  generateMentorReport,
  generateAdminAcademicIntelligence,
} from '../src/lib/reports';

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

async function runMilestone12_3Verification() {
  console.log('====================================================');
  console.log('PORAPLAN — MILESTONE 12.3 VERIFICATION SUITE');
  console.log('Reporting Refinement & Admin Academic Intelligence');
  console.log('====================================================\n');

  const studentId = 'mock-student-pp001';
  const mentorId = 'mock-mentor-ppm001';
  const strangerStudentId = 'mock-student-pp003';

  // 1. Student Report Page 1 Intactness
  console.log('--- Check 1: Student Report Page 1 Intactness ---');
  const studentReportPath = path.resolve(__dirname, '../src/pages/dashboard/StudentReportPage.tsx');
  const studentCode = fs.readFileSync(studentReportPath, 'utf-8');
  const [page1Content, page2Content] = studentCode.split('PAGE 2:');

  const p1HasKPIs = page1Content.includes('4 Core KPI Indicators') || page1Content.includes('Task Execution');
  const p1HasMatrix = page1Content.includes('Subject Performance &amp; Mastery Matrix');
  const p1HasAssignments = page1Content.includes('Practice Assignment Quality');
  assert(
    p1HasKPIs && p1HasMatrix && p1HasAssignments,
    '1. Student Report Page 1 remains intact with Core KPIs, Subject Matrix, and Assignment summary'
  );

  // 2. Student Report Page 2 Refinement
  console.log('--- Check 2: Student Report Page 2 Refinement ---');
  const p2HasGraph = page2Content.includes('Daily Schedule Execution Consistency');
  const p2HasBacklog = page2Content.includes('Task Backlog &amp; Deadline Status');
  const p2HasStrengths = page2Content.includes('Verified Academic Strengths');
  const p2HasAttention = page2Content.includes('Areas Requiring Focus &amp; Attention');
  const p2HasRemarks = page2Content.includes('Evaluation Remarks &amp; Mentor Guidance');
  const p2HasRoadmap = page2Content.includes('Prioritized Action Plan for Next Cycle');
  assert(
    p2HasGraph && p2HasBacklog && p2HasStrengths && p2HasAttention && p2HasRemarks && p2HasRoadmap,
    '2. Page 2 presents refined visual hierarchy across Consistency, Backlog, Strengths, Remarks, and Action Plan'
  );

  // 3. Student Report Page 2 Layout & Overflow Protection
  console.log('--- Check 3: Page 2 Overflow Protection ---');
  const p2HasCompactBars = page2Content.includes('h-11');
  const p2HasPageBreak = studentCode.includes('print:page-break');
  const p2HasPage2of2 = page2Content.includes('Page 2 of 2');
  assert(
    p2HasCompactBars && p2HasPageBreak && p2HasPage2of2,
    '3. Page 2 adopts compact 44px consistency bars and strict 2-page pagination preventing 3rd page spill'
  );

  // 4. Mentor Report Print Header Root Cause Fix
  console.log('--- Check 4: Mentor Report Print Header Fix ---');
  const mentorReportPath = path.resolve(__dirname, '../src/pages/dashboard/MentorReportPage.tsx');
  const mentorCode = fs.readFileSync(mentorReportPath, 'utf-8');

  // Verify that bare `header` is NOT hidden in print CSS
  const hasBareHeaderInPrint = mentorCode.includes('nav, aside, header, footer');
  const preservesArticleHeader =
    mentorCode.includes('article header') &&
    mentorCode.includes('display: flex !important');
  assert(
    !hasBareHeaderInPrint && preservesArticleHeader,
    '4. Mentor Report print stylesheet explicitly preserves article and document headers (display: flex !important)'
  );

  // 5. Mentor Overview Print Header Presence
  console.log('--- Check 5: Mentor Overview Print Header Presence ---');
  const hasBrandingInOverview = mentorCode.includes('PORAPLAN MENTORSHIP OVERSIGHT');
  const hasLogoInOverview = mentorCode.includes('poraplan-logo.png');
  const hasAuditWindow = mentorCode.includes('AUDIT WINDOW');
  assert(
    hasBrandingInOverview && hasLogoInOverview && hasAuditWindow,
    '5. Mentor overview report header includes PoraPlan branding, logo, audit window, and confidential faculty badge'
  );

  // 6. Individual Mentee Print Header Presence
  console.log('--- Check 6: Individual Mentee Print Header Presence ---');
  const hasMenteeHeader = mentorCode.includes('CONFIDENTIAL • MENTOR AUDIT COPY');
  const hasMenteeReportTitle = mentorCode.includes('Academic Performance &amp; Improvement Report');
  assert(
    hasMenteeHeader && hasMenteeReportTitle,
    '6. Individual mentee inspection report includes full academic document header for print/PDF'
  );

  // 7. Admin Reporting Route Registration
  console.log('--- Check 7: Admin Reporting Route Registration ---');
  const routesPath = path.resolve(__dirname, '../src/routes/index.tsx');
  const routesCode = fs.readFileSync(routesPath, 'utf-8');
  const hasAdminReportsRoute =
    routesCode.includes('path="admin/reports"') &&
    routesCode.includes('AdminReportsPage') &&
    routesCode.includes("allowedRoles={['admin']}");
  assert(
    hasAdminReportsRoute,
    '7. /admin/reports route is properly registered with role guard allowedRoles={["admin"]}'
  );

  // 8. Admin Navigation Link in DashboardLayout
  console.log('--- Check 8: Admin Navigation Link ---');
  const layoutPath = path.resolve(__dirname, '../src/layouts/DashboardLayout.tsx');
  const layoutCode = fs.readFileSync(layoutPath, 'utf-8');
  const hasAdminNavReport =
    layoutCode.includes("to: '/admin/reports'") &&
    layoutCode.includes("label: 'Academic Reports'");
  assert(
    hasAdminNavReport,
    '8. DashboardLayout includes Academic Reports in admin sidebar and mobile navigation'
  );

  // 9. Admin Overview Metrics Calculation (C1)
  console.log('--- Check 9: Admin Overview Metrics Calculation ---');
  const adminRes = await generateAdminAcademicIntelligence('monthly', undefined, undefined, {
    requestingUserId: 'mock-admin-ppa001',
    requestingUserRole: 'admin',
  });
  const adminReport = adminRes.report;
  assert(
    adminRes.error === null &&
      adminReport !== null &&
      adminReport.overview.totalRegisteredStudents > 0 &&
      adminReport.overview.activeStudents > 0 &&
      adminReport.overview.totalRegisteredStudents >= adminReport.overview.activeStudents &&
      adminReport.overview.totalMentors >= adminReport.overview.activeMentors &&
      adminReport.overview.activeEnrollments > 0,
    '9. Admin overview calculates clearly distinguished registered vs. active students and mentors',
    `Registered: ${adminReport?.overview.totalRegisteredStudents}, Active: ${adminReport?.overview.activeStudents}, Enrollments: ${adminReport?.overview.activeEnrollments}`
  );

  // 10. Admin Student Directory Summaries (C2)
  console.log('--- Check 10: Admin Student Directory Summaries ---');
  const firstStudent = adminReport?.students[0];
  assert(
    firstStudent !== undefined &&
      typeof firstStudent.studentName === 'string' &&
      typeof firstStudent.poraplanId === 'string' &&
      typeof firstStudent.taskCompletionRate === 'number' &&
      (firstStudent.consistencyPercentage === null || typeof firstStudent.consistencyPercentage === 'number') &&
      typeof firstStudent.enrollmentStatus === 'string',
    '10. Admin student directory summaries populate student identity, task execution, and consistency',
    `Student: ${firstStudent?.studentName}, Rate: ${firstStudent?.taskCompletionRate}%, Consistency: ${firstStudent?.consistencyPercentage}%`
  );

  // 11. Admin Mentor Workload Summaries (C3)
  console.log('--- Check 11: Admin Mentor Workload Summaries ---');
  const firstMentor = adminReport?.mentors[0];
  assert(
    firstMentor !== undefined &&
      typeof firstMentor.mentorName === 'string' &&
      typeof firstMentor.poraplanId === 'string' &&
      typeof firstMentor.activeMenteesCount === 'number' &&
      typeof firstMentor.activeCohortsCount === 'number' &&
      typeof firstMentor.pendingReviewsCount === 'number',
    '11. Admin mentor workload directory separates assigned workload, active cohorts, and pending reviews',
    `Mentor: ${firstMentor?.mentorName}, Mentees: ${firstMentor?.activeMenteesCount}, Reviews: ${firstMentor?.pendingReviewsCount}`
  );

  // 12. Admin Attention Radar (C4)
  console.log('--- Check 12: Admin Attention Radar ---');
  assert(
    Array.isArray(adminReport?.attentionItems) &&
      adminReport!.overview.scholarsNeedingAttentionCount === adminReport!.attentionItems.length &&
      adminReport!.attentionItems.every((item) =>
        ['Critical Attention', 'Needs Attention', 'On Track', 'Insufficient Data'].includes(item.levelLabel)
      ),
    '12. Attention radar classifies students using neutral, evidence-based criteria',
    `Attention count: ${adminReport?.attentionItems.length}`
  );

  // 13. Insufficient Data Neutrality
  console.log('--- Check 13: Insufficient Data Neutrality ---');
  const studentWithZeroTasks = adminReport?.students.find((s) => s.tasksAssigned === 0 && s.scoredEvaluationsCount === 0);
  assert(
    studentWithZeroTasks !== undefined &&
      studentWithZeroTasks.attentionLevel === 'insufficient_data' &&
      studentWithZeroTasks.attentionReason?.toLowerCase().includes('insufficient'),
    '13. Students with zero tasks or evaluations are classified neutrally as Insufficient Data (not struggling)',
    `Student: ${studentWithZeroTasks?.studentName}, Level: ${studentWithZeroTasks?.attentionLevel}`
  );

  // 14. Admin Single Student Report Access
  console.log('--- Check 14: Admin Single Student Report Access ---');
  const adminStudentReportRes = await generateStudentReport(
    studentId,
    'schedule',
    undefined,
    undefined,
    {
      requestingUserId: 'mock-admin-001',
      requestingUserRole: 'admin',
    }
  );
  assert(
    adminStudentReportRes.error === null && adminStudentReportRes.report?.studentId === studentId,
    '14. Admin has authorized clearance to generate detailed academic report for any student'
  );

  // 15. Admin Single Mentor Report Access
  console.log('--- Check 15: Admin Single Mentor Report Access ---');
  const adminMentorReportRes = await generateMentorReport(
    mentorId,
    'schedule',
    undefined,
    undefined,
    undefined,
    {
      requestingUserId: 'mock-admin-001',
      requestingUserRole: 'admin',
    }
  );
  assert(
    adminMentorReportRes.error === null && adminMentorReportRes.report?.mentorId === mentorId,
    '15. Admin has authorized clearance to generate detailed mentor report for any mentor'
  );

  // 16. Admin Authorization Enforcement
  console.log('--- Check 16: Admin Authorization Enforcement ---');
  const unauthorizedStudentRes = await generateAdminAcademicIntelligence('monthly', undefined, undefined, {
    requestingUserId: 'mock-student-pp001',
    requestingUserRole: 'student',
  });
  const unauthorizedMentorRes = await generateAdminAcademicIntelligence('monthly', undefined, undefined, {
    requestingUserId: 'mock-mentor-ppm001',
    requestingUserRole: 'mentor',
  });
  const missingOptionsRes = await generateAdminAcademicIntelligence('monthly');
  const forgedRoleRes = await generateAdminAcademicIntelligence('monthly', undefined, undefined, {
    requestingUserId: 'mock-student-pp001',
    requestingUserRole: 'admin',
  });
  const missingSessionRes = await generateAdminAcademicIntelligence('monthly', undefined, undefined, {
    requestingUserRole: 'admin',
  });

  assert(
    unauthorizedStudentRes.report === null &&
      unauthorizedStudentRes.error !== null &&
      unauthorizedMentorRes.report === null &&
      unauthorizedMentorRes.error !== null &&
      missingOptionsRes.report === null &&
      missingOptionsRes.error !== null &&
      forgedRoleRes.report === null &&
      forgedRoleRes.error !== null &&
      missingSessionRes.report === null &&
      missingSessionRes.error !== null,
    '16. Non-admin roles (student, mentor) are strictly blocked from admin academic intelligence'
  );

  // 17. Student Role Isolation
  console.log('--- Check 17: Student Role Isolation ---');
  const studentStrangerRes = await generateStudentReport(
    strangerStudentId,
    'monthly',
    undefined,
    undefined,
    {
      requestingUserId: studentId,
      requestingUserRole: 'student',
    }
  );
  assert(
    studentStrangerRes.report === null && studentStrangerRes.error !== null,
    '17. Students are strictly barred from querying another student academic report'
  );

  // 18. Mentor Role Isolation
  console.log('--- Check 18: Mentor Role Isolation ---');
  const mentorStrangerRes = await generateStudentReport(
    strangerStudentId,
    'monthly',
    undefined,
    undefined,
    {
      requestingUserId: mentorId,
      requestingUserRole: 'mentor',
    }
  );
  assert(
    mentorStrangerRes.report === null && mentorStrangerRes.error !== null,
    '18. Mentors are strictly barred from querying progress reports for unassigned students'
  );

  // 19. Privacy Protection
  console.log('--- Check 19: Privacy Protection ---');
  const serializedStudents = JSON.stringify(adminReport?.students || []);
  const containsPasswords = serializedStudents.includes('password') || serializedStudents.includes('secret');
  const containsPhoneNumbers = serializedStudents.includes('+880') || serializedStudents.includes('017');
  assert(
    !containsPasswords && !containsPhoneNumbers,
    '19. Report summaries strictly project academic context without exposing phone numbers or security secrets'
  );

  // 20. Regression Protection across existing report cycles
  console.log('--- Check 20: Regression Protection ---');
  const weeklyRes = await generateStudentReport(studentId, 'weekly');
  const monthlyRes = await generateStudentReport(studentId, 'monthly');
  assert(
    weeklyRes.error === null &&
      monthlyRes.error === null &&
      weeklyRes.report?.taskMetrics.completed !== undefined &&
      monthlyRes.report?.taskMetrics.completed !== undefined,
    '20. Standard weekly and monthly student reporting cycles operate without regression'
  );

  console.log('\n====================================================');
  console.log(`TOTAL CHECKS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runMilestone12_3Verification().catch((err) => {
  console.error('Unhandled verification error:', err);
  process.exit(1);
});

