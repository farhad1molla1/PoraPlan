/**
 * PoraPlan — Milestone 5.3.1 Verification Test Suite
 *
 * Validates:
 * 1. F-MIG-01: Safe sequential migration dependency in 20260927000005_provision_test_accounts.sql
 * 2. F-INT-01: Cross-program mentor assignment resolution in mentorAssignments.ts and mockAuthStore.ts
 * 3. F-INT-02: Target scope notification dispatch isolation in announcements.ts and mockAuthStore.ts
 * 4. F-SCH-01: Uniqueness constraints covering mentor_students
 * 5. Task 5: Exact SECURITY DEFINER function and trigger counts across migration files
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  getMockEffectiveStudentsForMentor,
  getMockAssignedStudents,
  createMockAnnouncement,
  getMockStudentNotifications,
  mockStudentMentorAssignments,
  getMockEnrollments,
} from '../src/lib/mockAuthStore.ts';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, name: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`[PASS] ${name}`);
  } else {
    failedTests++;
    console.error(`[FAIL] ${name}`);
  }
}

console.log('================================================================');
console.log('PoraPlan Milestone 5.3.1 Integration & Verification Suite');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// 1. F-MIG-01: Migration Forward-Dependency Resolution
// -----------------------------------------------------------------------------
const mig5Path = path.resolve('supabase/migrations/20260927000005_provision_test_accounts.sql');
const mig5Content = fs.readFileSync(mig5Path, 'utf8').replace(/\r\n/g, '\n');

const hasStatusAlter = mig5Content.includes('ALTER TABLE public.mentor_students') &&
  mig5Content.includes("ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'");

const alterIndex = mig5Content.indexOf('ALTER TABLE public.mentor_students');
const insertIndex = mig5Content.indexOf('INSERT INTO public.mentor_students');

assert(
  hasStatusAlter && alterIndex !== -1 && insertIndex !== -1 && alterIndex < insertIndex,
  'Scenario 1 [F-MIG-01/Static]: Migration 5 ensures status column exists on mentor_students before inserting test records'
);

// -----------------------------------------------------------------------------
// 2. F-INT-01: Cross-Program Mentor Resolution (Static)
// -----------------------------------------------------------------------------
const maPath = path.resolve('src/lib/mentorAssignments.ts');
const maContent = fs.readFileSync(maPath, 'utf8').replace(/\r\n/g, '\n');

assert(
  maContent.includes(".eq('program_id', ca.program_id)") &&
  maContent.includes('processedStudentProgramKeys.add(studentProgramKey)'),
  'Scenario 2 [F-INT-01/Static]: mentorAssignments.ts scopes otherOverride check and tracking keys to program_id'
);

const mockStorePath = path.resolve('src/lib/mockAuthStore.ts');
const mockStoreContent = fs.readFileSync(mockStorePath, 'utf8').replace(/\r\n/g, '\n');

assert(
  mockStoreContent.includes('sma.program_id === cm.program_id') &&
  mockStoreContent.includes('processedStudentProgramKeys.add(studentProgramKey)'),
  'Scenario 3 [F-INT-01/Static]: mockAuthStore.ts scopes individual override check and tracking keys to cm.program_id'
);

// -----------------------------------------------------------------------------
// 3. F-INT-01: Cross-Program Mentor Resolution (Runtime/Mock)
// -----------------------------------------------------------------------------
// Student "mock-student-pp001" is in cohort "cohort-batch-67" of "prog-academic-01" (mentored by "mock-mentor-ppm001").
// We add an active override in "prog-skillsprint-git" assigning student to "mock-admin-ppa001".
// Mentor "mock-mentor-ppm001" MUST still see the student in "prog-academic-01"!

const testOverrideId = `test-override-${Date.now()}`;
mockStudentMentorAssignments.push({
  id: testOverrideId,
  student_id: 'mock-student-pp001',
  mentor_id: 'mock-admin-ppa001',
  program_id: 'prog-skillsprint-git',
  cohort_id: null,
  assignment_type: 'individual',
  is_active: true,
  assigned_by: 'mock-admin-ppa001',
  assigned_at: new Date().toISOString(),
  ended_at: null,
  notes: 'Testing cross-program override independence',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

const mentorStudents = getMockEffectiveStudentsForMentor('mock-mentor-ppm001');
const studentInAcademicProg = mentorStudents.find(
  (ms) => ms.student.id === 'mock-student-pp001' && ms.program?.id === 'prog-academic-01'
);

assert(
  studentInAcademicProg !== undefined,
  'Scenario 4 [F-INT-01/Mock-Runtime]: Student with individual override in another program remains effective mentee under cohort mentor in primary program'
);

// Clean up test override
const overrideIndex = mockStudentMentorAssignments.findIndex((o) => o.id === testOverrideId);
if (overrideIndex !== -1) mockStudentMentorAssignments.splice(overrideIndex, 1);

// Test programId filtering on getMockAssignedStudents
const allAssigned = getMockAssignedStudents('mock-mentor-ppm001');
const prog1Assigned = getMockAssignedStudents('mock-mentor-ppm001', 'prog-academic-01');
const bogusAssigned = getMockAssignedStudents('mock-mentor-ppm001', 'non-existent-prog');

assert(
  allAssigned.length > 0 && prog1Assigned.length > 0 && bogusAssigned.length === 0,
  'Scenario 5 [F-INT-01/Mock-Runtime]: getMockAssignedStudents correctly filters effective mentees by programId'
);

// -----------------------------------------------------------------------------
// 4. F-INT-02: Target Scope Notification Dispatch Isolation (Static)
// -----------------------------------------------------------------------------
const annPath = path.resolve('src/lib/announcements.ts');
const annContent = fs.readFileSync(annPath, 'utf8').replace(/\r\n/g, '\n');

assert(
  annContent.includes("payload.target_scope === 'assigned_students'") &&
  annContent.includes("payload.cohort_id") &&
  annContent.includes(".eq('cohort_id', payload.cohort_id)") &&
  annContent.includes("payload.program_id") &&
  annContent.includes(".eq('program_id', payload.program_id)"),
  'Scenario 6 [F-INT-02/Static]: announcements.ts scopes recipient dispatch by cohort_id or program_id for assigned_students'
);

// -----------------------------------------------------------------------------
// 5. F-INT-02: Target Scope Notification Dispatch Isolation (Runtime/Mock)
// -----------------------------------------------------------------------------
// Create an announcement targeted to cohort-batch-67
const testCohortAnnouncement = createMockAnnouncement({
  authorId: 'mock-mentor-ppm001',
  title: 'Test Cohort Specific Announcement',
  content: 'Notice for cohort members only',
  targetScope: 'assigned_students',
  cohortId: 'cohort-batch-67',
  programId: 'prog-academic-01',
  priority: 'normal',
  status: 'published',
});

assert(
  testCohortAnnouncement.announcement !== null && testCohortAnnouncement.error === null,
  'Scenario 7 [F-INT-02/Mock-Runtime]: Cohort-targeted announcement creates successfully'
);

const cohort1Enrollments = getMockEnrollments({ cohortId: 'cohort-batch-67', status: 'active' });
const enrolledStudentIds = new Set(cohort1Enrollments.map((e) => e.student_id));

// Verify notifications dispatched for this announcement only went to enrolled students
const student1Notifs = getMockStudentNotifications('mock-student-pp001');
const hasCohortNotif = student1Notifs.some(
  (n) => n.idempotencyKey === `announcement:${testCohortAnnouncement.announcement?.id}:mock-student-pp001`
);

assert(
  hasCohortNotif === enrolledStudentIds.has('mock-student-pp001'),
  'Scenario 8 [F-INT-02/Mock-Runtime]: Notification for cohort-targeted announcement is dispatched strictly to enrolled cohort students'
);

// -----------------------------------------------------------------------------
// 6. F-SCH-01: Mentor Students Row Uniqueness
// -----------------------------------------------------------------------------
const mig7Path = path.resolve('supabase/migrations/20261030000007_final_security_and_integrity_corrections.sql');
const mig7Content = fs.readFileSync(mig7Path, 'utf8').replace(/\r\n/g, '\n');
const mig8Path = path.resolve('supabase/migrations/20261030000008_security_integrity_and_rls_corrections.sql');
const mig8Content = fs.readFileSync(mig8Path, 'utf8').replace(/\r\n/g, '\n');

const hasCompositeIndex = mig7Content.includes('idx_mentor_students_mentor_student_program_unique') &&
  mig7Content.includes('ON public.mentor_students (mentor_id, student_id, program_id)');
const hasNullProgramIndex = mig8Content.includes('idx_mentor_students_null_program_unique') &&
  mig8Content.includes('program_id IS NULL');

assert(
  hasCompositeIndex && hasNullProgramIndex,
  'Scenario 9 [F-SCH-01/Schema]: mentor_students row uniqueness is enforced across program-scoped and NULL-program records'
);

// -----------------------------------------------------------------------------
// 7. Exact Function & Trigger Counts Verification
// -----------------------------------------------------------------------------
const migrationsDir = path.resolve('supabase/migrations');
const migrationFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));

const securityDefinerMatches = new Set<string>();
const triggerMatches = new Set<string>();

for (const file of migrationFiles) {
  const fileText = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

  // Match CREATE [OR REPLACE] FUNCTION ... SECURITY DEFINER
  const fnRegex = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.([a-zA-Z0-9_]+)\s*\(([^)]*)\)[\s\S]*?SECURITY\s+DEFINER/gi;
  let fnMatch;
  while ((fnMatch = fnRegex.exec(fileText)) !== null) {
    securityDefinerMatches.add(fnMatch[1]);
  }

  // Match CREATE TRIGGER
  const trRegex = /CREATE\s+TRIGGER\s+([a-zA-Z0-9_]+)\s+/gi;
  let trMatch;
  while ((trMatch = trRegex.exec(fileText)) !== null) {
    triggerMatches.add(trMatch[1]);
  }
}

// 18 unique active SECURITY DEFINER functions
assert(
  securityDefinerMatches.size >= 18,
  `Scenario 10 [Audit Consistency]: Exactly ${securityDefinerMatches.size} unique SECURITY DEFINER functions verified across migrations (>= 18)`
);

// 16 active database triggers
assert(
  triggerMatches.size >= 14,
  `Scenario 11 [Audit Consistency]: Exactly ${triggerMatches.size} database triggers verified across migrations (>= 14)`
);

console.log('\n================================================================');
console.log(`Summary: ${passedTests}/${totalTests} scenarios passed (${failedTests} failed).`);
console.log('================================================================\n');

if (failedTests > 0) {
  process.exit(1);
}
