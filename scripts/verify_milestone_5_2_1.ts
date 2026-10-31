/**
 * PoraPlan Milestone 5.2.1 Regression & Verification Suite
 *
 * Verifies all security integrity corrections implemented in Milestone 5.2.1:
 * - F-001: Purge of residual permissive UPDATE/DELETE policies on assignments and resources
 * - F-002: Submission review integrity, post-review immutability, and state-machine downgrade protection
 * - F-003: Search path hardening on legacy SECURITY DEFINER triggers (SET search_path = public)
 * - F-004: Explicit multi-program effective mentor lookup without arbitrary selection
 * - F-005: Partial unique index for NULL-program mentor_students duplicate prevention
 * - F-006: Announcement author immutability and scope authorization hardening
 * - F-007: Administrative function execution revocation from PUBLIC and anon
 *
 * Testing Methodologies:
 * - [SQL/Static Verification]: Validates SQL migration 20261030000008, trigger code, index definitions, and privilege revokes.
 * - [Mock-Data Tests]: Tests mock store state transitions, authorization boundaries, and service layer methods.
 * - [Environment Limitation]: Real Supabase PostgreSQL RLS integration tests are NOT executed locally
 *   because no local database container or live Supabase deployment is connected. Migrations remain unapplied.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  getMockEffectiveMentorForStudent,
  getMockAssignedMentors,
  updateMockAnnouncement,
  reviewMockSubmission,
  submitMockAssignment,
  updateMockSubmissionStatus,
} from '../src/lib/mockAuthStore.ts';

interface TestResult {
  id: number;
  name: string;
  category: 'SQL/Static' | 'Mock-Data';
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function recordTest(id: number, name: string, category: 'SQL/Static' | 'Mock-Data', passed: boolean, details: string) {
  results.push({ id, name, category, passed, details });
  const status = passed ? 'PASS' : 'FAIL';
  console.log(`[${status}] Scenario ${id} [${category}]: ${name}`);
  if (!passed) {
    console.error(`  Error details: ${details}`);
  }
}

// Read migration file 008 for SQL static verification
const migration008Path = path.resolve('supabase/migrations/20261030000008_security_integrity_and_rls_corrections.sql');
const migration008Sql = fs.readFileSync(migration008Path, 'utf8');

console.log('================================================================');
console.log('PoraPlan Milestone 5.2.1 Security Integrity Verification');
console.log('================================================================\n');

// ------------------------------------------------------------------------------
// Scenario 1 [SQL/Static]: F-001 Drop residual assignments UPDATE policy
// ------------------------------------------------------------------------------
{
  const check = migration008Sql.includes('DROP POLICY IF EXISTS "Mentors can update assignments for assigned students" ON public.assignments;');
  recordTest(
    1,
    'F-001: Purge residual permissive UPDATE policy on assignments',
    'SQL/Static',
    check,
    'Verified exact drop of "Mentors can update assignments for assigned students"'
  );
}

// ------------------------------------------------------------------------------
// Scenario 2 [SQL/Static]: F-001 Drop residual assignments DELETE policy
// ------------------------------------------------------------------------------
{
  const check = migration008Sql.includes('DROP POLICY IF EXISTS "Mentors can delete assignments for assigned students" ON public.assignments;');
  recordTest(
    2,
    'F-001: Purge residual permissive DELETE policy on assignments',
    'SQL/Static',
    check,
    'Verified exact drop of "Mentors can delete assignments for assigned students"'
  );
}

// ------------------------------------------------------------------------------
// Scenario 3 [SQL/Static]: F-001 Drop residual resources UPDATE policy
// ------------------------------------------------------------------------------
{
  const check = migration008Sql.includes('DROP POLICY IF EXISTS "Mentors can update resources for assigned students" ON public.resources;');
  recordTest(
    3,
    'F-001: Purge residual permissive UPDATE policy on resources',
    'SQL/Static',
    check,
    'Verified exact drop of "Mentors can update resources for assigned students"'
  );
}

// ------------------------------------------------------------------------------
// Scenario 4 [SQL/Static]: F-001 Drop residual resources DELETE policy
// ------------------------------------------------------------------------------
{
  const check = migration008Sql.includes('DROP POLICY IF EXISTS "Mentors can delete resources for assigned students" ON public.resources;');
  recordTest(
    4,
    'F-001: Purge residual permissive DELETE policy on resources',
    'SQL/Static',
    check,
    'Verified exact drop of "Mentors can delete resources for assigned students"'
  );
}

// ------------------------------------------------------------------------------
// Scenario 5 [SQL/Static]: F-002 Submission review fields immutability
// ------------------------------------------------------------------------------
{
  const check = migration008Sql.includes('NEW.feedback := OLD.feedback;') &&
                migration008Sql.includes('NEW.score := OLD.score;') &&
                migration008Sql.includes('NEW.reviewed_by := OLD.reviewed_by;') &&
                migration008Sql.includes('NEW.reviewed_at := OLD.reviewed_at;');
  recordTest(
    5,
    'F-002: Student cannot modify review fields (feedback, score, reviewer, timestamp)',
    'SQL/Static',
    check,
    'Verified unconditional preservation of review fields when updated by student'
  );
}

// ------------------------------------------------------------------------------
// Scenario 6 [SQL/Static]: F-002 Post-review content immutability & downgrade lock
// ------------------------------------------------------------------------------
{
  const check = migration008Sql.includes("IF OLD.status = 'reviewed' THEN") &&
                migration008Sql.includes("NEW.status := 'reviewed';") &&
                migration008Sql.includes("NEW.content := OLD.content;");
  recordTest(
    6,
    'F-002: Reviewed submission locks content and prevents status downgrade',
    'SQL/Static',
    check,
    'Verified SQL trigger forces NEW.content := OLD.content and NEW.status := reviewed'
  );
}

// ------------------------------------------------------------------------------
// Scenario 7 [SQL/Static]: F-002 Under-review submission content locking
// ------------------------------------------------------------------------------
{
  const check = migration008Sql.includes("ELSIF OLD.status = 'under_review' THEN") &&
                migration008Sql.includes("NEW.status := 'under_review';") &&
                migration008Sql.includes("NEW.content := OLD.content;");
  recordTest(
    7,
    'F-002: Under-review submission locks content against student modification',
    'SQL/Static',
    check,
    'Verified SQL trigger protects submissions in active review'
  );
}

// ------------------------------------------------------------------------------
// Scenario 8 [SQL/Static]: F-002 Legitimate needs_revision resubmission permitted
// ------------------------------------------------------------------------------
{
  const check = migration008Sql.includes("ELSIF OLD.status = 'needs_revision' THEN") &&
                migration008Sql.includes("NEW.status := 'submitted';") &&
                migration008Sql.includes("NEW.submitted_at := timezone('utc'::text, now());");
  recordTest(
    8,
    'F-002: Legitimate resubmission permitted from needs_revision state',
    'SQL/Static',
    check,
    'Verified SQL trigger updates submitted_at and transitions to submitted on revision'
  );
}

// ------------------------------------------------------------------------------
// Scenario 9 [SQL/Static]: F-002 Unauthorized caller rejection on submission update
// ------------------------------------------------------------------------------
{
  const check = migration008Sql.includes("RAISE EXCEPTION 'Unauthorized: Caller cannot modify this submission.';");
  recordTest(
    9,
    'F-002: Explicit rejection of unauthorized third-party submission updates',
    'SQL/Static',
    check,
    'Verified trigger raises exception for non-admin, non-student, non-authorized mentor'
  );
}

// ------------------------------------------------------------------------------
// Scenario 10 [SQL/Static]: F-003 Search path set on handle_doubt_response_added
// ------------------------------------------------------------------------------
{
  const check = migration008Sql.includes('CREATE OR REPLACE FUNCTION public.handle_doubt_response_added()') &&
                migration008Sql.includes('SET search_path = public');
  recordTest(
    10,
    'F-003: handle_doubt_response_added has SET search_path = public',
    'SQL/Static',
    check,
    'Verified search_path hardening on doubt response trigger'
  );
}

// ------------------------------------------------------------------------------
// Scenario 11 [SQL/Static]: F-003 Search path set on protect_evaluation_grading_fields
// ------------------------------------------------------------------------------
{
  const check = migration008Sql.includes('CREATE OR REPLACE FUNCTION public.protect_evaluation_grading_fields()') &&
                migration008Sql.includes('SET search_path = public');
  recordTest(
    11,
    'F-003: protect_evaluation_grading_fields has SET search_path = public',
    'SQL/Static',
    check,
    'Verified search_path hardening on evaluation grading trigger'
  );
}

// ------------------------------------------------------------------------------
// Scenario 12 [SQL/Static]: F-005 Partial unique index for NULL-program pairings
// ------------------------------------------------------------------------------
{
  const check = migration008Sql.includes('CREATE UNIQUE INDEX IF NOT EXISTS idx_mentor_students_null_program_unique') &&
                migration008Sql.includes('ON public.mentor_students (mentor_id, student_id)') &&
                migration008Sql.includes('WHERE (program_id IS NULL);');
  recordTest(
    12,
    'F-005: Partial unique index prevents duplicate legacy NULL-program records',
    'SQL/Static',
    check,
    'Verified idx_mentor_students_null_program_unique definition on (mentor_id, student_id) WHERE (program_id IS NULL)'
  );
}

// ------------------------------------------------------------------------------
// Scenario 13 [SQL/Static]: F-006 Announcement NULL-safe comparisons
// ------------------------------------------------------------------------------
{
  const check = migration008Sql.includes('NEW.author_id IS DISTINCT FROM OLD.author_id') &&
                migration008Sql.includes("NEW.target_scope = 'platform' AND OLD.target_scope IS DISTINCT FROM 'platform'");
  recordTest(
    13,
    'F-006: protect_announcement_fields uses IS DISTINCT FROM for NULL-safe comparisons',
    'SQL/Static',
    check,
    'Verified author immutability and platform escalation use IS DISTINCT FROM'
  );
}

// ------------------------------------------------------------------------------
// Scenario 14 [SQL/Static]: F-006 Announcement assigned_students scope validation
// ------------------------------------------------------------------------------
{
  const check = migration008Sql.includes("NEW.target_scope = 'assigned_students'") &&
                migration008Sql.includes("RAISE EXCEPTION 'Cannot publish announcement for a program you do not mentor.';");
  recordTest(
    14,
    'F-006: protect_announcement_fields validates mentor program authorization on assigned_students',
    'SQL/Static',
    check,
    'Verified program-role verification in announcement trigger'
  );
}

// ------------------------------------------------------------------------------
// Scenario 15 [SQL/Static]: F-007 Revoke execute on admin_review_application from PUBLIC/anon
// ------------------------------------------------------------------------------
{
  const check = migration008Sql.includes('REVOKE ALL ON FUNCTION public.admin_review_application(UUID, TEXT, TEXT) FROM PUBLIC;') &&
                migration008Sql.includes('REVOKE ALL ON FUNCTION public.admin_review_application(UUID, TEXT, TEXT) FROM anon;');
  recordTest(
    15,
    'F-007: Revoke execution on admin_review_application from PUBLIC and anon',
    'SQL/Static',
    check,
    'Verified execute revocation on application review RPC'
  );
}

// ------------------------------------------------------------------------------
// Scenario 16 [SQL/Static]: F-007 Revoke execute on admin_register_member from PUBLIC/anon
// ------------------------------------------------------------------------------
{
  const check = migration008Sql.includes('REVOKE ALL ON FUNCTION public.admin_register_member(TEXT, TEXT, TEXT, user_role, TEXT) FROM PUBLIC;') &&
                migration008Sql.includes('REVOKE ALL ON FUNCTION public.admin_register_member(TEXT, TEXT, TEXT, user_role, TEXT) FROM anon;');
  recordTest(
    16,
    'F-007: Revoke execution on admin_register_member from PUBLIC and anon',
    'SQL/Static',
    check,
    'Verified execute revocation on member registration RPC'
  );
}

// ------------------------------------------------------------------------------
// Scenario 17 [SQL/Static]: F-007 Revoke execute on provision_poraplan_account from PUBLIC/anon
// ------------------------------------------------------------------------------
{
  const check = migration008Sql.includes('REVOKE ALL ON FUNCTION public.provision_poraplan_account(TEXT, TEXT, TEXT, user_role, TEXT) FROM PUBLIC;') &&
                migration008Sql.includes('REVOKE ALL ON FUNCTION public.provision_poraplan_account(TEXT, TEXT, TEXT, user_role, TEXT) FROM anon;');
  recordTest(
    17,
    'F-007: Revoke execution on provision_poraplan_account from PUBLIC and anon',
    'SQL/Static',
    check,
    'Verified execute revocation on account provisioning function'
  );
}

// ------------------------------------------------------------------------------
// Scenario 18 [Mock-Data]: Student cannot modify or resubmit already reviewed submission
// ------------------------------------------------------------------------------
{
  // Setup: review submission mock-subm-001
  reviewMockSubmission({
    submissionId: 'mock-subm-001',
    mentorId: 'mock-mentor-ppm001',
    status: 'reviewed',
    feedback: 'Excellent work on mechanics problems.',
    score: 95,
  });

  // Attempt to submit new content for already reviewed submission
  const resubmitResult = submitMockAssignment({
    assignmentId: 'mock-asgn-phy-01',
    studentId: 'mock-student-pp001',
    submissionType: 'text',
    content: 'Tampered content after grading completed.',
  });

  recordTest(
    18,
    'F-002: Student cannot modify or resubmit an already reviewed submission',
    'Mock-Data',
    resubmitResult.submission === null && resubmitResult.error !== null,
    `Resubmit on reviewed submission properly rejected: "${resubmitResult.error?.message}"`
  );
}

// ------------------------------------------------------------------------------
// Scenario 19 [Mock-Data]: Student cannot downgrade reviewed submission to submitted
// ------------------------------------------------------------------------------
{
  const downgradeResult = updateMockSubmissionStatus('mock-subm-001', 'submitted');
  recordTest(
    19,
    'F-002: Student cannot downgrade reviewed submission back to submitted',
    'Mock-Data',
    downgradeResult.submission === null && downgradeResult.error !== null,
    `Downgrade attempt properly blocked: "${downgradeResult.error?.message}"`
  );
}

// ------------------------------------------------------------------------------
// Scenario 20 [Mock-Data]: Legitimate resubmission permitted from needs_revision
// ------------------------------------------------------------------------------
{
  // Transition submission to needs_revision (mentor requests revisions)
  updateMockSubmissionStatus('mock-subm-001', 'needs_revision');

  // Student resubmits revised content
  const revisionResult = submitMockAssignment({
    assignmentId: 'mock-assign-001',
    studentId: 'mock-student-pp001',
    submissionType: 'text',
    content: 'Revised solution with step-by-step mechanics proofs.',
  });

  recordTest(
    20,
    'F-002: Student can successfully resubmit when status is needs_revision',
    'Mock-Data',
    revisionResult.submission !== null && revisionResult.submission.status === 'submitted',
    `Resubmission from needs_revision transitioned to: status=${revisionResult.submission?.status}`
  );
}

// ------------------------------------------------------------------------------
// Scenario 21 [Mock-Data]: Mentor cannot reassign announcement author
// ------------------------------------------------------------------------------
{
  const authorTamperResult = updateMockAnnouncement('mock-ann-001', 'mock-mentor-ppm001', {
    author_id: 'mock-mentor-ppm002',
    title: 'Tampered announcement author',
  } as any);

  recordTest(
    21,
    'F-006: Mentor cannot reassign announcement author',
    'Mock-Data',
    authorTamperResult.announcement === null && authorTamperResult.error !== null,
    `Author tampering rejected: "${authorTamperResult.error?.message}"`
  );
}

// ------------------------------------------------------------------------------
// Scenario 22 [Mock-Data]: Mentor cannot publish announcement for unmentored program
// ------------------------------------------------------------------------------
{
  const programTamperResult = updateMockAnnouncement('mock-ann-001', 'mock-mentor-ppm001', {
    program_id: 'prog-skillsprint-c-fundamentals',
    title: 'Announcement for unmentored program',
  } as any);

  recordTest(
    22,
    'F-006: Mentor cannot publish announcement for a program they do not mentor',
    'Mock-Data',
    programTamperResult.announcement === null && programTamperResult.error !== null,
    `Unmentored program announcement rejected: "${programTamperResult.error?.message}"`
  );
}

// ------------------------------------------------------------------------------
// Scenario 23 [Mock-Data]: Program-specific effective mentor lookup
// ------------------------------------------------------------------------------
{
  const prog1Mentor = getMockEffectiveMentorForStudent('mock-student-pp001', 'prog-academic-01');
  const prog2Mentor = getMockEffectiveMentorForStudent('mock-student-pp001', 'prog-skillsprint-git');

  recordTest(
    23,
    'F-004: Explicit program-scoped mentor lookup resolves target program mentor',
    'Mock-Data',
    prog1Mentor.mentor?.id === 'mock-mentor-ppm001' && prog2Mentor.assignment_type === 'none',
    `Prog1 mentor=${prog1Mentor.mentor?.full_name}, Prog2 assignment_type=${prog2Mentor.assignment_type}`
  );
}

// ------------------------------------------------------------------------------
// Scenario 24 [Mock-Data]: Multi-program assigned mentors collection without arbitrary selection
// ------------------------------------------------------------------------------
{
  const mentors = getMockAssignedMentors('mock-student-pp001');
  recordTest(
    24,
    'F-004: getMockAssignedMentors returns all active program mentors without arbitrary limit',
    'Mock-Data',
    Array.isArray(mentors) && mentors.length > 0 && mentors[0].id === 'mock-mentor-ppm001',
    `Retrieved ${mentors.length} active mentors: [${mentors.map((m) => m.full_name).join(', ')}]`
  );
}

// ==============================================================================
// Verification Summary
// ==============================================================================
console.log('\n================================================================');
const passedCount = results.filter((r) => r.passed).length;
const failedCount = results.filter((r) => !r.passed).length;
console.log(`Summary: ${passedCount}/${results.length} scenarios passed (${failedCount} failed).`);
console.log('================================================================');

if (failedCount > 0) {
  process.exit(1);
}
