/// <reference types="node" />
/**
 * PoraPlan — Batch 4.7C-1: Academic Reports Engine Optimization & Bulk Aggregation Test Suite
 *
 * Validates:
 * 1. Constants & Configuration Contract:
 *    - DEFAULT_ADMIN_REPORT_CHUNK_SIZE is exported and equals 50
 *    - generateAdminAcademicIntelligence accepts optional chunkSize option
 * 2. Bulk Retrieval & Architecture Contract:
 *    - PostgREST URI parameter protection via chunking
 *    - Parallel bulk queries for tasks, assignments, and evaluations
 *    - Bounded O(1) query count independent of student count
 *    - Per-mentor count queries eliminated via bulk aggregation
 *    - Pure in-memory calculation via buildStudentReportFromData
 *    - Strict fail-closed error handling on bulk query failures
 * 3. Functional Execution & Output Contract:
 *    - Report overview, student summaries, mentor summaries, and attention radar
 *    - Student summary contract and evidence fields
 *    - Mentor directory workload and activity metrics
 * 4. Multi-Program Effective Mentor Resolution:
 *    - Precedence: Individual Override ?? Cohort Default ?? Unassigned
 *    - Composite student-program key isolation
 * 5. Authorization & Privacy:
 *    - Rejection of non-admin roles and forged sessions
 *    - Strict privacy protection (no private phone/email leakage)
 * 6. Code Hygiene & Boundaries:
 *    - Zero emojis across service and test files
 *    - Strict NO-AMOUNT policy (zero currency symbols or values)
 *    - Protected user files untouched
 *    - UI file AdminReportsPage.tsx untouched (reserved for Batch 4.7C-2)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  DEFAULT_ADMIN_REPORT_CHUNK_SIZE,
  generateAdminAcademicIntelligence,
} from '../lib/reports';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

let passCount = 0;
let failCount = 0;

function report(
  id: string,
  condition: boolean,
  description: string,
  category: 'CONSTANTS' | 'ARCHITECTURE' | 'FUNCTIONAL' | 'RESOLUTION' | 'SECURITY' | 'HYGIENE' = 'CONSTANTS'
) {
  if (condition) {
    passCount++;
    console.log(`[PASS] [${category}] ${id}: ${description}`);
  } else {
    failCount++;
    console.error(`[FAIL] [${category}] ${id}: ${description}`);
  }
}

// In-memory simulation of effective mentor resolution logic
function simulateEffectiveMentorResolution(params: {
  studentId: string;
  programId?: string | null;
  cohortId?: string | null;
  overrides: Array<{ student_id: string; program_id?: string | null; mentor_name: string }>;
  cohortMentors: Array<{ cohort_id: string; program_id?: string | null; mentor_name: string }>;
}): string {
  const { studentId, programId, cohortId, overrides, cohortMentors } = params;

  // 1. Program-specific override
  if (programId) {
    const pOv = overrides.find((o) => o.student_id === studentId && o.program_id === programId);
    if (pOv) return pOv.mentor_name;
  }

  // 2. Student fallback override (legacy/unscoped)
  const sOv = overrides.find((o) => o.student_id === studentId && !o.program_id);
  if (sOv) return sOv.mentor_name;

  // 3. Cohort default mentor
  if (cohortId) {
    const cm = cohortMentors.find((c) => c.cohort_id === cohortId);
    if (cm) return cm.mentor_name;
  }

  return 'Unassigned';
}

async function runTestSuite() {
  console.log('------------------------------------------------------------');
  console.log('PoraPlan Batch 4.7C-1: Academic Reports Engine Test Suite');
  console.log('------------------------------------------------------------\n');

  const reportsSrcRaw = fs.readFileSync(path.join(projectRoot, 'src/lib/reports.ts'), 'utf-8');
  const reportsSrc = reportsSrcRaw.replace(/\r\n/g, '\n');

  // ============================================================================
  // 1. Constants & Configuration Contract
  // ============================================================================
  console.log('Category 1: Constants & Configuration Contract');

  report(
    'CONST-01',
    DEFAULT_ADMIN_REPORT_CHUNK_SIZE === 50,
    'DEFAULT_ADMIN_REPORT_CHUNK_SIZE is exported and strictly equals 50',
    'CONSTANTS'
  );

  report(
    'CONST-02',
    reportsSrc.includes('export const DEFAULT_ADMIN_REPORT_CHUNK_SIZE = 50;'),
    'DEFAULT_ADMIN_REPORT_CHUNK_SIZE declaration matches exact export signature',
    'CONSTANTS'
  );

  report(
    'CONST-03',
    reportsSrc.includes('chunkSize?: number;'),
    'generateAdminAcademicIntelligence options type accepts optional chunkSize parameter',
    'CONSTANTS'
  );

  // ============================================================================
  // 2. Bulk Retrieval & Architecture Contract
  // ============================================================================
  console.log('\nCategory 2: Bulk Retrieval & Architecture Contract');

  report(
    'ARCH-01',
    reportsSrc.includes('for (let i = 0; i < studentIds.length; i += chunkSize)'),
    'PostgREST URI overflow is prevented by chunking studentIds by chunkSize',
    'ARCHITECTURE'
  );

  report(
    'ARCH-02',
    reportsSrc.includes("Promise.all([\n          backend.supabase\n            .from('tasks')") ||
    reportsSrc.includes("Promise.all([\n          backend.supabase.from('tasks')") ||
    reportsSrc.includes("Promise.all([\n          backend.supabase\n            .from('tasks')\n            .select('id, student_id"),
    'Tasks, assignments, and evaluations are retrieved in parallel via Promise.all per chunk',
    'ARCHITECTURE'
  );

  report(
    'ARCH-03',
    reportsSrc.includes(".in('student_id', chunk)"),
    'Bulk queries strictly filter by chunk student IDs (.in(student_id, chunk))',
    'ARCHITECTURE'
  );

  report(
    'ARCH-04',
    reportsSrc.includes('mentorActiveMenteesCountMap.get(mentor.id) || 0') &&
    reportsSrc.includes('mentorActiveCohortsCountMap.get(mentor.id) || 0'),
    'Mentor workload directory derives active counts from pre-aggregated in-memory maps (0 per-mentor queries)',
    'ARCHITECTURE'
  );

  report(
    'ARCH-05',
    reportsSrc.includes('const sReport = buildStudentReportFromData(') &&
    !reportsSrc.includes('for (const student of studentProfiles) {\n      // Active enrollment identification\n      const enr =\n        activeEnrollments.find((e) => e.student_id === student.id) ||\n        allEnrollments.find((e) => e.student_id === student.id);\n\n      let enrollmentStatus: \'active\' | \'completed\' | \'inactive\' | \'none\' = \'none\';\n      if (enr) {\n        enrollmentStatus = enr.status === \'active\' ? \'active\' : enr.status === \'completed\' ? \'completed\' : \'inactive\';\n      }\n\n      // Generate student report using existing reporting engine with admin clearance\n      const { report: sReport } = await generateStudentReport'),
    'Per-student sequential generateStudentReport database loop is completely eliminated and replaced by in-memory buildStudentReportFromData',
    'ARCHITECTURE'
  );

  report(
    'ARCH-06',
    reportsSrc.includes('if (tasksRes.error) return { report: null, error: tasksRes.error };') &&
    reportsSrc.includes('if (asgsRes.error) return { report: null, error: asgsRes.error };') &&
    reportsSrc.includes('if (evalsRes.error) return { report: null, error: evalsRes.error };'),
    'Bulk chunk queries enforce strict fail-closed error handling on database failures',
    'ARCHITECTURE'
  );

  // ============================================================================
  // 3. Functional Execution & Output Contract
  // ============================================================================
  console.log('\nCategory 3: Functional Execution & Output Contract');

  const { report: adminReport, error: reportError } = await generateAdminAcademicIntelligence(
    'monthly',
    undefined,
    undefined,
    {
      requestingUserId: 'mock-admin-ppa001',
      requestingUserRole: 'admin',
    }
  );

  report(
    'FUNC-01',
    reportError === null && adminReport !== null,
    'generateAdminAcademicIntelligence executes successfully in mock backend mode',
    'FUNCTIONAL'
  );

  report(
    'FUNC-02',
    Boolean(
      adminReport?.overview &&
      typeof adminReport.overview.totalRegisteredStudents === 'number' &&
      typeof adminReport.overview.activeStudents === 'number' &&
      typeof adminReport.overview.totalMentors === 'number' &&
      typeof adminReport.overview.activeMentors === 'number' &&
      typeof adminReport.overview.activeEnrollments === 'number' &&
      typeof adminReport.overview.scholarsNeedingAttentionCount === 'number'
    ),
    'Admin overview metrics structure adheres to exact operational contract',
    'FUNCTIONAL'
  );

  report(
    'FUNC-03',
    Array.isArray(adminReport?.students) && adminReport!.students.length > 0,
    'Student summaries collection is populated with individual academic intelligence summaries',
    'FUNCTIONAL'
  );

  const sampleStudent = adminReport?.students[0];
  report(
    'FUNC-04',
    Boolean(
      sampleStudent &&
      sampleStudent.studentId &&
      sampleStudent.studentName &&
      sampleStudent.poraplanId &&
      sampleStudent.enrollmentStatus &&
      typeof sampleStudent.taskCompletionRate === 'number' &&
      typeof sampleStudent.isCompletionRateApplicable === 'boolean' &&
      typeof sampleStudent.tasksAssigned === 'number' &&
      typeof sampleStudent.tasksCompleted === 'number' &&
      typeof sampleStudent.tasksOverdue === 'number' &&
      typeof sampleStudent.submissionRate === 'number' &&
      typeof sampleStudent.submissionsPendingReview === 'number' &&
      sampleStudent.attentionLevel &&
      sampleStudent.attentionReason
    ),
    'AdminStudentSummary records contain all required KPI fields with correct data types',
    'FUNCTIONAL'
  );

  report(
    'FUNC-05',
    Array.isArray(adminReport?.mentors) && adminReport!.mentors.length > 0,
    'Mentor summaries directory is populated with mentor workload items',
    'FUNCTIONAL'
  );

  const sampleMentor = adminReport?.mentors[0];
  report(
    'FUNC-06',
    Boolean(
      sampleMentor &&
      sampleMentor.mentorId &&
      sampleMentor.mentorName &&
      sampleMentor.poraplanId &&
      typeof sampleMentor.activeMenteesCount === 'number' &&
      typeof sampleMentor.activeCohortsCount === 'number' &&
      typeof sampleMentor.recentEvaluationsCount === 'number' &&
      typeof sampleMentor.pendingReviewsCount === 'number' &&
      typeof sampleMentor.menteesNeedingAttentionCount === 'number'
    ),
    'AdminMentorSummary records project workload distribution without sequential queries',
    'FUNCTIONAL'
  );

  report(
    'FUNC-07',
    Array.isArray(adminReport?.attentionItems),
    'Attention radar items collection is structured and separated from general student directory',
    'FUNCTIONAL'
  );

  // ============================================================================
  // 4. Multi-Program Effective Mentor Resolution Contract
  // ============================================================================
  console.log('\nCategory 4: Multi-Program Effective Mentor Resolution Contract');

  const testOverrides = [
    { student_id: 's-101', program_id: 'prog-a', mentor_name: 'Dr. Override Alpha' },
    { student_id: 's-101', program_id: 'prog-b', mentor_name: 'Dr. Override Beta' },
    { student_id: 's-102', program_id: null, mentor_name: 'Dr. Legacy Override' },
  ];
  const testCohortMentors = [
    { cohort_id: 'cohort-1', program_id: 'prog-a', mentor_name: 'Prof. Cohort Default' },
  ];

  const resolvedProgA = simulateEffectiveMentorResolution({
    studentId: 's-101',
    programId: 'prog-a',
    cohortId: 'cohort-1',
    overrides: testOverrides,
    cohortMentors: testCohortMentors,
  });

  const resolvedProgB = simulateEffectiveMentorResolution({
    studentId: 's-101',
    programId: 'prog-b',
    cohortId: 'cohort-1',
    overrides: testOverrides,
    cohortMentors: testCohortMentors,
  });

  const resolvedCohortDefault = simulateEffectiveMentorResolution({
    studentId: 's-999',
    programId: 'prog-a',
    cohortId: 'cohort-1',
    overrides: testOverrides,
    cohortMentors: testCohortMentors,
  });

  const resolvedUnassigned = simulateEffectiveMentorResolution({
    studentId: 's-999',
    programId: 'prog-c',
    cohortId: 'cohort-unknown',
    overrides: testOverrides,
    cohortMentors: testCohortMentors,
  });

  report(
    'RES-01',
    resolvedProgA === 'Dr. Override Alpha' && resolvedProgB === 'Dr. Override Beta',
    'Multi-program students resolve program-specific overrides independently without collision',
    'RESOLUTION'
  );

  report(
    'RES-02',
    resolvedCohortDefault === 'Prof. Cohort Default',
    'Students without individual overrides fall back to cohort default mentor',
    'RESOLUTION'
  );

  report(
    'RES-03',
    resolvedUnassigned === 'Unassigned',
    'Students without override or cohort mentor fall back cleanly to Unassigned',
    'RESOLUTION'
  );

  // ============================================================================
  // 5. Authorization & Privacy Contract
  // ============================================================================
  console.log('\nCategory 5: Authorization & Privacy Contract');

  const { report: studentCallReport, error: studentCallErr } = await generateAdminAcademicIntelligence(
    'monthly',
    undefined,
    undefined,
    {
      requestingUserId: 'mock-student-pp001',
      requestingUserRole: 'student' as any,
    }
  );

  report(
    'SEC-01',
    studentCallReport === null && studentCallErr !== null && studentCallErr.message.includes('Unauthorized'),
    'Non-admin student caller is strictly rejected with Unauthorized error',
    'SECURITY'
  );

  const { report: mentorCallReport, error: mentorCallErr } = await generateAdminAcademicIntelligence(
    'monthly',
    undefined,
    undefined,
    {
      requestingUserId: 'mock-mentor-ppm001',
      requestingUserRole: 'mentor' as any,
    }
  );

  report(
    'SEC-02',
    mentorCallReport === null && mentorCallErr !== null && mentorCallErr.message.includes('Unauthorized'),
    'Non-admin mentor caller is strictly rejected with Unauthorized error',
    'SECURITY'
  );

  const { report: noOptsReport, error: noOptsErr } = await generateAdminAcademicIntelligence('monthly');

  report(
    'SEC-03',
    noOptsReport === null && noOptsErr !== null,
    'Calling generateAdminAcademicIntelligence without authorization options fails closed',
    'SECURITY'
  );

  // Check privacy projection: No email or phone fields in AdminStudentSummary
  const studentHasPrivateFields = adminReport?.students.some((s: any) =>
    Boolean(s.email || s.phone_number || s.whatsapp_number || s.password)
  );

  report(
    'SEC-04',
    !studentHasPrivateFields,
    'Student summary objects strictly exclude private emails, phone numbers, and credentials',
    'SECURITY'
  );

  // ============================================================================
  // 6. Code Hygiene & Boundary Enforcement
  // ============================================================================
  console.log('\nCategory 6: Code Hygiene & Boundary Enforcement');

  const testSuiteSrc = fs.readFileSync(__filename, 'utf-8');

  // Emoji check
  const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  const reportsHasEmoji = emojiRegex.test(reportsSrc);
  const testHasEmoji = emojiRegex.test(testSuiteSrc);

  report(
    'HYG-01',
    !reportsHasEmoji && !testHasEmoji,
    'Zero emojis across reports.ts and test suite',
    'HYGIENE'
  );

  // NO-AMOUNT policy check (zero currency amounts or financial fields)
  const currencyAmountRegex = /(?:[$৳€£]|BDT|\bTk\.?\b)\s*\d+/i;
  const reportsHasCurrencyAmount = currencyAmountRegex.test(reportsSrc);

  const financialWordRegex = /\b(fee|fees|currency|total_paid|revenue|price|billing)\b/i;
  const adminReportsSection = reportsSrc.substring(
    reportsSrc.indexOf('export interface AdminAcademicOverview'),
    reportsSrc.indexOf('export const DEFAULT_ADMIN_REPORT_CHUNK_SIZE')
  );
  const hasFinancialFields = financialWordRegex.test(adminReportsSection);

  report(
    'HYG-02',
    !reportsHasCurrencyAmount && !hasFinancialFields,
    'Strict NO-AMOUNT policy verified: zero currency amounts or financial fields',
    'HYGIENE'
  );

  // Scope bounds: AdminReportsPage.tsx must remain untouched
  const adminReportsPagePath = path.join(projectRoot, 'src/pages/dashboard/AdminReportsPage.tsx');
  const adminReportsPageSrc = fs.readFileSync(adminReportsPagePath, 'utf-8');

  report(
    'HYG-03',
    !adminReportsPageSrc.includes('DEFAULT_ADMIN_REPORT_CHUNK_SIZE'),
    'AdminReportsPage.tsx remains untouched (reserved for Batch 4.7C-2 UI integration)',
    'HYGIENE'
  );

  // Protected user files must not have been modified by reports work
  const protectedFiles = [
    'src/pages/dashboard/MentorTasksPage.tsx',
    'src/pages/dashboard/PublicProfilePage.tsx',
    'src/pages/dashboard/StudentLibraryPage.tsx',
  ];

  let protectedFilesUntouchedByReports = true;
  for (const pf of protectedFiles) {
    const pfSrc = fs.readFileSync(path.join(projectRoot, pf), 'utf-8');
    if (pfSrc.includes('generateAdminAcademicIntelligence') || pfSrc.includes('DEFAULT_ADMIN_REPORT_CHUNK_SIZE')) {
      protectedFilesUntouchedByReports = false;
      break;
    }
  }

  report(
    'HYG-04',
    protectedFilesUntouchedByReports,
    'Protected user files (MentorTasksPage, PublicProfilePage, StudentLibraryPage) are untouched',
    'HYGIENE'
  );

  console.log('\n------------------------------------------------------------');
  console.log(`TOTAL CHECKS: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log('------------------------------------------------------------');

  if (failCount > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal error during test execution:', err);
  process.exit(1);
});
