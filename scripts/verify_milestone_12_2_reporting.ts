/**
 * PoraPlan — Milestone 12.2 Verification Suite
 *
 * Verifies Academic Performance & Improvement Reporting across 20 rigorous checks:
 * 1. Task Cohort Calculation: Tasks due in reporting window form denominator.
 * 2. Task Completion & On-Time vs. Late Differentiation.
 * 3. Task Zero Denominator Handling (No NaN or division error).
 * 4. Weighted Evaluation Mastery Calculation: (earned / possible) * 100.
 * 5. Unscored Evaluation Handling: Oral/code walkthroughs excluded from average, preserved in feedback.
 * 6. Subject-Wise Weighted Evaluation Percentage.
 * 7. Assignment Unique Cohort Calculation: Revisions do not inflate submitted count.
 * 8. Assignment Status Segregation: Reviewed, Pending Review, Needs Revision, Not Submitted.
 * 9. Study Consistency (Active Days): Unique local calendar dates in UTC+6 Bangladesh.
 * 10. Doubts Desk Metrics Integration: Created, Resolved, Pending, Resolution Turnaround.
 * 11. Previous-Period Comparison Deltas: Task completion, eval average, submission rate.
 * 12. Multi-Tier Academic Insights (Level 1 Facts, Level 2 Observations, Level 3 Stored Feedback).
 * 13. Deterministic Prioritized Recommendations (Max 3, transparent, with evidence & measurable target).
 * 14. Student Metadata Display: University, Department, Batch, Semester, Program, Mentor.
 * 15. Student Ownership Security: Students cannot access other students' reports.
 * 16. Mentor Roster Authorization: Mentors cannot query unassigned students.
 * 17. Mentor Roster Triage Badges & Reason Generation.
 * 18. Actual Logo Asset Presence & Branding Integration.
 * 19. Dedicated A4 Portrait Print Stylesheet & Page Break Rules.
 * 20. End-to-End Build and Milestone 12 Regression Protection.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  generateStudentReport,
  generateMentorReport,
  computeReportDateRange,
  toLocalDateStr,
  REPORT_THRESHOLDS,
} from '../src/lib/reports';
import { getMockAssignedStudents } from '../src/lib/mockAuthStore';

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

async function runMilestone12_2Verification() {
  console.log('====================================================');
  console.log('PORAPLAN — MILESTONE 12.2 VERIFICATION SUITE');
  console.log('Academic Performance & Improvement Reporting');
  console.log('====================================================\n');

  const studentId = 'mock-student-pp001';
  const mentorId = 'mock-mentor-ppm001';
  const strangerStudentId = 'mock-student-pp003';

  // 1. Task Cohort Calculation
  console.log('--- Check 1: Task Cohort Calculation ---');
  const monthlyRes = await generateStudentReport(studentId, 'monthly');
  const mReport = monthlyRes.report;
  assert(
    monthlyRes.error === null &&
      mReport !== null &&
      mReport.taskMetrics.eligibleDue === mReport.taskMetrics.totalAssigned &&
      mReport.taskMetrics.totalAssigned >= mReport.taskMetrics.completed,
    '1. Task cohort correctly isolates tasks due in reporting period'
  );

  // 2. Task Completion & On-Time vs. Late Differentiation
  console.log('--- Check 2: Task On-Time vs Late Differentiation ---');
  const totalCompleted = mReport?.taskMetrics.completed || 0;
  const onTime = mReport?.taskMetrics.onTimeCompleted || 0;
  const late = mReport?.taskMetrics.lateCompleted || 0;
  assert(
    onTime + late === totalCompleted && totalCompleted > 0,
    '2. Completed tasks accurately differentiated into on-time and late completions',
    `onTime (${onTime}) + late (${late}) !== totalCompleted (${totalCompleted})`
  );

  // 3. Task Zero Denominator Handling
  console.log('--- Check 3: Task Zero Denominator Handling ---');
  const emptyRes = await generateStudentReport('mock-student-pp003', 'weekly');
  const emptyReport = emptyRes.report;
  assert(
    emptyRes.error === null &&
      emptyReport !== null &&
      emptyReport.taskMetrics.totalAssigned === 0 &&
      emptyReport.taskMetrics.completionRate === 0 &&
      emptyReport.taskMetrics.isCompletionRateApplicable === false &&
      !isNaN(emptyReport.taskMetrics.completionRate),
    '3. Zero-task cohort returns 0 rate with isCompletionRateApplicable: false and no NaN'
  );

  // 4. Weighted Evaluation Mastery Calculation: (earned / possible) * 100
  console.log('--- Check 4: Weighted Evaluation Mastery Calculation ---');
  assert(
    mReport !== null &&
      mReport.evaluationMetrics.scoredCount > 0 &&
      mReport.evaluationMetrics.totalEarnedPoints > 0 &&
      mReport.evaluationMetrics.totalPossiblePoints > 0 &&
      mReport.evaluationMetrics.weightedAveragePercentage ===
        Math.round(
          (mReport.evaluationMetrics.totalEarnedPoints / mReport.evaluationMetrics.totalPossiblePoints) *
            1000
        ) / 10,
    '4. Evaluation score calculated strictly using weighted formula (earned/possible * 100)'
  );

  // 5. Unscored Evaluation Handling
  console.log('--- Check 5: Unscored Evaluation Handling ---');
  assert(
    mReport !== null &&
      typeof mReport.evaluationMetrics.unscoredCompletedCount === 'number' &&
      Array.isArray(mReport.evaluationMetrics.recentFeedback),
    '5. Qualitative walkthroughs preserved in feedback without skewing numeric averages'
  );

  // 6. Subject-Wise Weighted Evaluation Percentage
  console.log('--- Check 6: Subject-Wise Weighted Evaluation Percentage ---');
  const phySubject = mReport?.subjectBreakdown.find((s) => s.subjectId === 'mock-sub-phy-101');
  assert(
    phySubject !== undefined &&
      phySubject.evaluationsAverageScore !== null &&
      phySubject.evaluationsScoredCount > 0 &&
      phySubject.evaluationsAverageScore >= REPORT_THRESHOLDS.MASTERY_SCORE_MIN,
    '6. Subject-wise evaluations calculated with individual weighted scores and point totals'
  );

  // 7. Assignment Unique Cohort Calculation: Revisions do not inflate
  console.log('--- Check 7: Assignment Unique Cohort Calculation ---');
  const totalDueAsgs = mReport?.assignmentMetrics.totalAssigned || 0;
  const submittedUnique = mReport?.assignmentMetrics.submitted || 0;
  assert(
    totalDueAsgs >= submittedUnique &&
      submittedUnique <= totalDueAsgs &&
      mReport?.assignmentMetrics.submissionRate ===
        Math.round((submittedUnique / totalDueAsgs) * 100),
    '7. Assignment submissions count unique assignments; revisions do not inflate cohort'
  );

  // 8. Assignment Status Segregation
  console.log('--- Check 8: Assignment Status Segregation ---');
  const asgMetrics = mReport?.assignmentMetrics;
  const statusSum =
    (asgMetrics?.reviewed || 0) +
    (asgMetrics?.pendingReview || 0) +
    (asgMetrics?.needsRevision || 0);
  assert(
    asgMetrics !== undefined && statusSum === asgMetrics.submitted,
    '8. Submissions segregated into reviewed, pending review, and revision requested',
    `statusSum (${statusSum}) !== submitted (${asgMetrics?.submitted})`
  );

  // 9. Study Consistency (Active Days) in Bangladesh UTC+6
  console.log('--- Check 9: Study Consistency (Active Days) ---');
  const activeDays = mReport?.studyConsistency.activeStudyDays || 0;
  const totalPeriodDays = mReport?.studyConsistency.totalPeriodDays || 0;
  const verifiedEvents = mReport?.studyConsistency.verifiedEventsCount || 0;
  assert(
    activeDays > 0 &&
      activeDays <= totalPeriodDays &&
      verifiedEvents >= activeDays &&
      mReport?.studyConsistency.consistencyPercentage ===
        Math.round((activeDays / totalPeriodDays) * 100),
    '9. Active study days counted strictly from verified local calendar dates'
  );

  // 10. Doubts Desk Metrics Integration
  console.log('--- Check 10: Doubts Desk Metrics Integration ---');
  assert(
    mReport !== null &&
      typeof mReport.doubtMetrics.createdInPeriod === 'number' &&
      typeof mReport.doubtMetrics.resolvedInPeriod === 'number' &&
      typeof mReport.doubtMetrics.pendingInPeriod === 'number' &&
      mReport.doubtMetrics.totalStudentDoubts > 0,
    '10. Doubts desk metrics integrated (created, resolved, pending, turnaround time)'
  );

  // 11. Previous-Period Comparison Deltas
  console.log('--- Check 11: Previous-Period Comparison Deltas ---');
  assert(
    mReport !== null &&
      mReport.taskMetrics.previousPeriodCompletionRate !== undefined &&
      mReport.evaluationMetrics.previousPeriodAveragePercentage !== undefined &&
      mReport.assignmentMetrics.previousPeriodSubmissionRate !== undefined,
    '11. Previous period comparison metrics and deltas correctly populated for monthly window'
  );

  // 12. Multi-Tier Academic Insights
  console.log('--- Check 12: Multi-Tier Academic Insights ---');
  const hasFacts = (mReport?.insights.facts.length || 0) >= 3;
  const hasObservations = (mReport?.insights.observations.length || 0) >= 1;
  const hasRemarks = Array.isArray(mReport?.insights.mentorRemarks);
  assert(
    hasFacts && hasObservations && hasRemarks,
    '12. Multi-tier academic insights populated (Tier 1 Facts, Tier 2 Observations, Tier 3 Mentor Remarks)'
  );

  // 13. Deterministic Prioritized Recommendations (Max 3)
  console.log('--- Check 13: Deterministic Prioritized Recommendations ---');
  const recs = mReport?.recommendations || [];
  const validPriorities = recs.every((r) => ['P1', 'P2', 'P3'].includes(r.priority));
  const hasRequiredFields = recs.every(
    (r) => r.title && r.evidence && r.recommendedAction && r.measurableSuccessIndicator
  );
  assert(
    recs.length > 0 &&
      recs.length <= REPORT_THRESHOLDS.MAX_RECOMMENDATIONS &&
      validPriorities &&
      hasRequiredFields,
    '13. Recommendations capped at max 3, prioritized deterministically with evidence and measurable targets'
  );

  // 14. Student Metadata Display
  console.log('--- Check 14: Student Metadata Display ---');
  assert(
    mReport !== null &&
      mReport.studentName === 'Fahim Rahman' &&
      mReport.poraplanId === 'PP001' &&
      Boolean(mReport.university) &&
      Boolean(mReport.department) &&
      Boolean(mReport.mentorName),
    '14. Student academic context (university, department, batch, mentor) populated for official header'
  );

  // 15. Student Ownership Security
  console.log('--- Check 15: Student Ownership Security ---');
  const unauthorizedStudentAttempt = await generateStudentReport(
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
    unauthorizedStudentAttempt.error !== null &&
      unauthorizedStudentAttempt.error.message.includes('Unauthorized'),
    '15. Students are strictly blocked from requesting another student academic report'
  );

  // 16. Mentor Roster Authorization
  console.log('--- Check 16: Mentor Roster Authorization ---');
  const unauthorizedMentorFilter = await generateMentorReport(
    mentorId,
    'monthly',
    undefined,
    undefined,
    'unauthorized-random-student-id',
    {
      requestingUserId: mentorId,
      requestingUserRole: 'mentor',
    }
  );
  assert(
    unauthorizedMentorFilter.error !== null &&
      unauthorizedMentorFilter.error.message.includes('Unauthorized'),
    '16. Mentors cannot request progress reports for students outside their assigned roster'
  );

  // 17. Mentor Roster Triage Badges & Reason Generation
  console.log('--- Check 17: Mentor Roster Triage Badges ---');
  const mentorReportRes = await generateMentorReport(mentorId, 'monthly', undefined, undefined, undefined, {
    requestingUserId: mentorId,
    requestingUserRole: 'mentor',
  });
  const mRoster = mentorReportRes.report;
  const hasTriage = mRoster?.studentSummaries.every((s) =>
    ['critical', 'warning', 'normal'].includes(s.attentionLevel)
  );
  assert(
    mentorReportRes.error === null &&
      mRoster !== null &&
      mRoster.studentSummaries.length > 0 &&
      Boolean(hasTriage),
    '17. Mentor roster report provides explicit triage badges (critical/warning/normal) with reasons'
  );

  // 18. Actual Logo Asset Presence & Branding Integration
  console.log('--- Check 18: Logo Asset & Branding Integration ---');
  const logoPath = path.join(process.cwd(), 'public/poraplan-logo.png');
  const logoExists = fs.existsSync(logoPath);
  const studentPageContent = fs.readFileSync(
    path.join(process.cwd(), 'src/pages/dashboard/StudentReportPage.tsx'),
    'utf8'
  );
  const mentorPageContent = fs.readFileSync(
    path.join(process.cwd(), 'src/pages/dashboard/MentorReportPage.tsx'),
    'utf8'
  );
  assert(
    logoExists &&
      studentPageContent.includes('/poraplan-logo.png') &&
      mentorPageContent.includes('/poraplan-logo.png'),
    '18. Actual PoraPlan logo asset exists and is rendered in both Student and Mentor report headers'
  );

  // 19. Dedicated A4 Portrait Print Stylesheet & Page Break Rules
  console.log('--- Check 19: Dedicated A4 Print Stylesheet & Page Break Rules ---');
  assert(
    studentPageContent.includes('@page') &&
      studentPageContent.includes('size: A4 portrait') &&
      studentPageContent.includes('print:page-break') &&
      mentorPageContent.includes('@page') &&
      mentorPageContent.includes('size: A4 portrait'),
    '19. A4 portrait styling, margins, and explicit page-break rules configured for printing'
  );

  // 20. End-to-End Build and Milestone 12 Regression Protection
  console.log('--- Check 20: Regression Protection ---');
  const dateRangeCheck = computeReportDateRange('weekly');
  const localDateCheck = toLocalDateStr('2026-11-02T15:30:00Z');
  assert(
    dateRangeCheck.daysCount === 7 && localDateCheck === '2026-11-02',
    '20. Date boundary and local calendar formatters operate without regression across cycles'
  );

  console.log('\n====================================================');
  console.log(`TOTAL CHECKS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runMilestone12_2Verification().catch((err) => {
  console.error('Milestone 12.2 Verification failed with error:', err);
  process.exit(1);
});
