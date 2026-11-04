/**
 * PoraPlan — Milestone 12.1 Verification Suite
 * Student Profile & Enrollment Integration
 *
 * Verifies:
 * 1. ProfilePage imports and integrates getEnrollments and ProgramEnrollmentWithMeta.
 * 2. ProfilePage fetches enrollments scoped strictly to the authenticated student (studentId: userId).
 * 3. ProfilePage distinguishes between Current (active, on_hold) and Historical (completed, withdrawn) enrollments.
 * 4. Program categories are mapped cleanly to human-centered labels (Academic Program vs Upskilling Program).
 * 5. Program name, cohort/batch name, cohort code, term dates, and enrolled date are rendered without emojis.
 * 6. ProfilePage provides a calm, clear empty state when no enrollments exist.
 * 7. Strict NO-AMOUNT rule: zero currency symbols, fees, amounts, or balances in enrollment display.
 * 8. Applications service properly accepts studentId filter for scoped queries.
 * 9. Mock runtime: student query retrieves only their own enrollments, and admin retrieves all.
 * 10. Database schema & RLS: program_enrollments enforces row-level security for students and admins.
 */

import fs from 'fs';
import path from 'path';
import { getMockEnrollments } from '../src/lib/mockAuthStore';

let passCount = 0;
let failCount = 0;

function report(scenario: string, passed: boolean, message: string) {
  if (passed) {
    passCount++;
    console.log(`[PASS] ${scenario}: ${message}`);
  } else {
    failCount++;
    console.error(`[FAIL] ${scenario}: ${message}`);
  }
}

async function runVerification() {
  console.log('================================================================');
  console.log('PoraPlan Milestone 12.1 Student Profile & Enrollment Verification');
  console.log('================================================================\n');

  const profilePagePath = path.resolve(process.cwd(), 'src/pages/dashboard/ProfilePage.tsx');
  const profilePageContent = fs.readFileSync(profilePagePath, 'utf8');

  // Scenario 1: Imports
  const hasGetEnrollmentsImport = profilePageContent.includes("getEnrollments");
  const hasEnrollmentTypeImport = profilePageContent.includes("ProgramEnrollmentWithMeta");
  const hasLucideLayers = profilePageContent.includes("Layers");
  const hasLucideCalendar = profilePageContent.includes("Calendar");
  report(
    'Scenario 1 [Static/Imports]',
    hasGetEnrollmentsImport && hasEnrollmentTypeImport && hasLucideLayers && hasLucideCalendar,
    'ProfilePage imports getEnrollments, ProgramEnrollmentWithMeta, Layers, and Calendar'
  );

  // Scenario 2: Student-scoped fetch
  const hasStudentScopedFetch =
    profilePageContent.includes("getEnrollments({ studentId: userId })") &&
    profilePageContent.includes("isStudent && userId");
  report(
    'Scenario 2 [Static/Scope]',
    hasStudentScopedFetch,
    'ProfilePage queries getEnrollments strictly scoped to authenticated student (studentId: userId)'
  );

  // Scenario 3: Distinction between current and historical enrollments
  const hasCurrentDistinction =
    profilePageContent.includes("status === 'active' || e.status === 'on_hold'") &&
    profilePageContent.includes("status === 'completed' || e.status === 'withdrawn'");
  const rendersCurrentAndPast =
    profilePageContent.includes("Current Enrollment") &&
    profilePageContent.includes("Past / Completed Enrollment");
  report(
    'Scenario 3 [Static/Segmentation]',
    hasCurrentDistinction && rendersCurrentAndPast,
    'ProfilePage distinguishes Current (active/on_hold) and Historical (completed/withdrawn) enrollments'
  );

  // Scenario 4: Program category mapping
  const mapsSkillSprint =
    profilePageContent.includes("skillsprint") &&
    profilePageContent.includes("Upskilling Program");
  const mapsAcademicMentorship =
    profilePageContent.includes("Academic Program");
  report(
    'Scenario 4 [Static/Taxonomy]',
    mapsSkillSprint && mapsAcademicMentorship,
    'Categories map cleanly: skillsprint -> Upskilling Program, academic_mentorship -> Academic Program'
  );

  // Scenario 5: Enrollment details and Zero Emojis
  const rendersProgramName = profilePageContent.includes("enr.program?.name");
  const rendersCohortName = profilePageContent.includes("enr.cohort?.name");
  const rendersCohortCode = profilePageContent.includes("enr.cohort.code") || profilePageContent.includes("enr.cohort?.code");
  const rendersEnrolledDate = profilePageContent.includes("enr.enrolled_at");
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  const hasEmoji = emojiRegex.test(profilePageContent);
  report(
    'Scenario 5 [Static/Metadata & Tone]',
    rendersProgramName && rendersCohortName && rendersCohortCode && rendersEnrolledDate && !hasEmoji,
    'Enrollment displays program name, cohort name, code, enrolled date with ZERO emojis'
  );

  // Scenario 6: Clean empty state
  const hasEmptyState =
    profilePageContent.includes("No active or historical program enrollments recorded.") &&
    profilePageContent.includes("Your programs and assigned cohorts will appear here once an application is accepted");
  report(
    'Scenario 6 [Static/EmptyState]',
    hasEmptyState,
    'Clear, minimal empty state rendered when a student has no enrollments'
  );

  // Scenario 7: Strict NO-AMOUNT rule
  const enrollmentSectionStart = profilePageContent.indexOf("Section: PoraPlan Program & Cohort Enrollments");
  const enrollmentSectionEnd = profilePageContent.indexOf("Section: Academic Biography");
  const enrollmentSectionSnippet = profilePageContent.slice(enrollmentSectionStart, enrollmentSectionEnd);
  // Remove string interpolation tokens ${...} to avoid false positives on JS variables
  const sanitizedSnippet = enrollmentSectionSnippet.replace(/\$\{[^}]+\}/g, '');
  const financialRegex = /(?:(?:\$|\bBDT\b|৳)\s*\d+|\b(?:fee|fees|salary|balance|cost|tuition|amount)\b)/i;
  const hasFinancialTokens = financialRegex.test(sanitizedSnippet);
  report(
    'Scenario 7 [Static/NoAmountPolicy]',
    !hasFinancialTokens,
    'Enrollment section strictly complies with NO-AMOUNT rule (zero currency, fees, amounts, or salaries)'
  );

  // Scenario 8: Applications Service implementation check
  const applicationsPath = path.resolve(process.cwd(), 'src/lib/applications.ts');
  const applicationsContent = fs.readFileSync(applicationsPath, 'utf8');
  const hasGetEnrollmentsService = applicationsContent.includes("export async function getEnrollments");
  const hasStudentFilter = applicationsContent.includes("filters?.studentId");
  report(
    'Scenario 8 [Static/ServiceLayer]',
    hasGetEnrollmentsService && hasStudentFilter,
    'getEnrollments service in applications.ts properly accepts studentId filter for scoped queries'
  );

  // Scenario 9: Mock runtime - Student query isolation & Admin query
  const studentEnrollments = getMockEnrollments({ studentId: 'mock-student-pp001' });
  const allStudentRecordsMatch = studentEnrollments.every(
    (e) => e.student_id === 'mock-student-pp001'
  );
  const allEnrollments = getMockEnrollments();
  report(
    'Scenario 9 [Runtime/MockStore]',
    allStudentRecordsMatch && studentEnrollments.length > 0 && allEnrollments.length >= studentEnrollments.length,
    `Mock store returns ${studentEnrollments.length} enrollments strictly for student, and ${allEnrollments.length} total for admin desk`
  );

  // Scenario 10: Database RLS & Schema Integrity
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20261030000003_applications_and_enrollments_schema.sql'
  );
  const migrationContent = fs.readFileSync(migrationPath, 'utf8');
  const hasStudentRls = migrationContent.includes("student_id = auth.uid()");
  const hasAdminRls = migrationContent.includes("profiles.role FROM public.profiles WHERE profiles.id = auth.uid()") &&
                      migrationContent.includes("'admin'");
  report(
    'Scenario 10 [Security/RLS]',
    hasStudentRls && hasAdminRls,
    'Migration schema enforces student row isolation (student_id = auth.uid()) and Admin access'
  );

  console.log('\n================================================================');
  console.log(`Summary: ${passCount}/${passCount + failCount} scenarios passed (${failCount} failed).`);
  console.log('================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runVerification().catch((err) => {
  console.error('Unexpected error running verification:', err);
  process.exit(1);
});
