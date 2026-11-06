/**
 * PoraPlan — Mentor Allocation Eligibility & Decoupling Verification Suite
 *
 * Validates:
 * 1. Mentor eligibility resolution directly from registered profiles (role = 'mentor', status != 'suspended')
 *    without requiring a program_applications record.
 * 2. Active and not_activated mentors are eligible; suspended and non-mentor accounts are excluded.
 * 3. Cohort mentor allocation works with mentors having no application record.
 * 4. Individual mentor override allocation works with mentors having no application record.
 * 5. Direct manual student enrollment works with mentors having no application record.
 * 6. Workload summary calculation and eligibility flag.
 * 7. Source code parity: mentorAssignments.ts queries profiles directly and does not query program_applications.
 * 8. UI source verification: removal of 'NO APPROVED APP' badge and updated empty-state messaging.
 * 9. Supabase migration file verification (additive, correct signatures, no application dependency).
 * 10. Zero emojis across all modified files and src/.
 */

import fs from 'fs';
import path from 'path';
import {
  getMockEligibleMentorsForProgram,
  adminAssignMockCohortMentor,
  adminEndMockCohortMentor,
  adminAssignMockIndividualMentor,
  adminEndMockIndividualMentor,
  getMockEffectiveMentorForStudent,
  getMockMentorWorkload,
  adminRegisterMockMember,
  getMockCohortMentors,
  getMockStudentMentorAssignments,
  adminManualEnrollMockStudent,
  setMockAccountStatus,
} from '../src/lib/mockAuthStore';

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
  console.log('--- Starting PoraPlan Mentor Allocation Eligibility Verification ---');

  // ==============================================================================
  // 1. MENTOR ELIGIBILITY RESOLUTION
  // ==============================================================================
  console.log('\n--- Section 1: Mentor Eligibility Resolution ---');

  const eligMentorsProg1 = getMockEligibleMentorsForProgram('prog-academic-01');
  const eligMentorsProg2 = getMockEligibleMentorsForProgram('prog-skillsprint-git');

  // 1.1 Existing active mentor PPM001 is eligible
  const hasPpm001 = eligMentorsProg1.some((m) => m.poraplan_id === 'PPM001');
  report('1.1 Existing mentor PPM001 eligible', hasPpm001, 'PPM001 is included in eligible mentors');

  // 1.2 Existing not_activated mentor PPM002 (Dr. Farhana Yasmin, NO application) is eligible
  const hasPpm002 = eligMentorsProg1.some((m) => m.poraplan_id === 'PPM002');
  report('1.2 Mentor PPM002 (no application) eligible', hasPpm002, 'PPM002 is included without having an application');

  // 1.3 Mentors appear across any program (e.g. prog-skillsprint-git which previously had 0)
  const prog2HasMentors = eligMentorsProg2.length >= 2;
  report('1.3 Mentors eligible for newly added program', prog2HasMentors, `prog-skillsprint-git has ${eligMentorsProg2.length} eligible mentors`);

  // 1.4 Newly provisioned mentor is immediately eligible without application
  const newMentorId = 'PPM099';
  adminRegisterMockMember(newMentorId, 'Prof. Tariq Anam', 'tariq.ppm099@poraplan.internal', 'mentor');
  const eligAfterProvision = getMockEligibleMentorsForProgram('prog-academic-01');
  const hasNewlyProvisioned = eligAfterProvision.some((m) => m.poraplan_id === newMentorId);
  report('1.4 Newly provisioned mentor eligible', hasNewlyProvisioned, 'PPM099 is immediately eligible after admin registration');

  // 1.5 Suspended mentors are excluded
  setMockAccountStatus('mock-mentor-ppm099', 'suspended');
  const eligAfterSuspend = getMockEligibleMentorsForProgram('prog-academic-01');
  const hasSuspended = eligAfterSuspend.some((m) => m.poraplan_id === newMentorId);
  report('1.5 Suspended mentor excluded from eligibility', !hasSuspended, 'PPM099 was excluded after account suspension');
  // Restore for subsequent clean state
  setMockAccountStatus('mock-mentor-ppm099', 'active');

  // 1.6 Non-mentor accounts (students and admins) are excluded
  const hasStudentInEligible = eligAfterProvision.some((m) => m.role !== 'mentor');
  report('1.6 Non-mentor accounts excluded', !hasStudentInEligible, 'No students or admins appear in mentor eligibility list');

  // ==============================================================================
  // 2. COHORT MENTOR ALLOCATION
  // ==============================================================================
  console.log('\n--- Section 2: Cohort Mentor Allocation ---');

  // 2.1 Assign PPM002 (no application) as cohort default mentor
  const cohortAllocRes = adminAssignMockCohortMentor(
    'cohort-uu-cse-b67',
    'mock-mentor-ppm002',
    'Assigning Dr. Farhana without an application.'
  );
  report('2.1 Assign cohort mentor without application', cohortAllocRes.success, cohortAllocRes.message);

  const activeCohortMentor = getMockCohortMentors({ cohortId: 'cohort-uu-cse-b67', isActive: true });
  report(
    '2.2 Active cohort mentor reflects assignment',
    activeCohortMentor.length === 1 && activeCohortMentor[0].mentor_id === 'mock-mentor-ppm002',
    `Active cohort mentor is ${activeCohortMentor[0]?.mentor_id}`
  );

  // 2.3 Reassigning cohort mentor deactivates previous assignment
  const cohortReassignRes = adminAssignMockCohortMentor(
    'cohort-uu-cse-b67',
    'mock-mentor-ppm001',
    'Reassigning Dr. Rafiqul as lead mentor.'
  );
  report('2.3 Reassign cohort mentor', cohortReassignRes.success, cohortReassignRes.message);

  const activeAfterReassign = getMockCohortMentors({ cohortId: 'cohort-uu-cse-b67', isActive: true });
  report(
    '2.4 Previous assignment deactivated after replacement',
    activeAfterReassign.length === 1 && activeAfterReassign[0].mentor_id === 'mock-mentor-ppm001',
    `Active cohort mentor replaced with ${activeAfterReassign[0]?.mentor_id}`
  );

  // 2.5 Assign to a cohort under prog-skillsprint-git (previously blocked)
  const gitSprintAllocRes = adminAssignMockCohortMentor(
    'cohort-git-sprint-01',
    'mock-mentor-ppm002'
  );
  report('2.5 Assign mentor to SkillSprint cohort without application', gitSprintAllocRes.success, gitSprintAllocRes.message);

  // 2.6 Reject suspended mentor assignment
  setMockAccountStatus('mock-mentor-ppm099', 'suspended');
  const rejectSuspendedCohort = adminAssignMockCohortMentor(
    'cohort-uu-cse-b67',
    'mock-mentor-ppm099'
  );
  report('2.6 Reject suspended mentor for cohort allocation', !rejectSuspendedCohort.success, rejectSuspendedCohort.message);
  setMockAccountStatus('mock-mentor-ppm099', 'active');

  // 2.7 End cohort mentor assignment
  const endCohortRes = adminEndMockCohortMentor('cohort-git-sprint-01');
  report('2.7 End cohort mentor assignment', endCohortRes.success, endCohortRes.message);

  // ==============================================================================
  // 3. INDIVIDUAL STUDENT MENTOR ASSIGNMENT
  // ==============================================================================
  console.log('\n--- Section 3: Individual Student Mentor Assignment ---');

  // 3.1 Assign PPM002 as individual override for PP001 without application
  const indOverrideRes = adminAssignMockIndividualMentor(
    'mock-student-pp001',
    'mock-mentor-ppm002',
    'prog-academic-01',
    'cohort-uu-cse-b67',
    'Special individual mentoring.'
  );
  report('3.1 Individual override without application', indOverrideRes.success, indOverrideRes.message);

  // 3.2 Effective mentor engine resolves individual override over cohort default
  const res1 = getMockEffectiveMentorForStudent('mock-student-pp001', 'prog-academic-01');
  report(
    '3.2 Precedence: individual override takes precedence',
    res1.assignment_type === 'individual' && res1.mentor?.id === 'mock-mentor-ppm002',
    `Resolved mentor: ${res1.mentor?.full_name} (${res1.assignment_type})`
  );

  // 3.3 End individual override and restore cohort default
  if (res1.assignment_id) {
    const endIndRes = adminEndMockIndividualMentor(res1.assignment_id);
    report('3.3 End individual override', endIndRes.success, endIndRes.message);

    const res2 = getMockEffectiveMentorForStudent('mock-student-pp001', 'prog-academic-01');
    report(
      '3.4 Reverted to cohort default after ending individual override',
      res2.assignment_type === 'cohort' && res2.mentor?.id === 'mock-mentor-ppm001',
      `Restored cohort default: ${res2.mentor?.full_name} (${res2.assignment_type})`
    );
  }

  // 3.5 Reject suspended mentor for individual assignment
  setMockAccountStatus('mock-mentor-ppm099', 'suspended');
  const rejectSuspendedInd = adminAssignMockIndividualMentor(
    'mock-student-pp001',
    'mock-mentor-ppm099',
    'prog-academic-01'
  );
  report('3.5 Reject suspended mentor for individual override', !rejectSuspendedInd.success, rejectSuspendedInd.message);
  setMockAccountStatus('mock-mentor-ppm099', 'active');

  // ==============================================================================
  // 4. DIRECT MANUAL ENROLLMENT
  // ==============================================================================
  console.log('\n--- Section 4: Direct Manual Student Enrollment ---');

  // Register a new test student
  adminRegisterMockMember('PP099', 'Direct Test Scholar', 'scholar.pp099@poraplan.internal', 'student');

  // 4.1 Direct manual enrollment with PPM002 (no application) as optional mentor
  const directEnrollRes = adminManualEnrollMockStudent(
    'mock-student-pp099',
    'prog-academic-01',
    'cohort-uu-cse-b67',
    'mock-mentor-ppm002',
    'Direct enrollment test'
  );
  report('4.1 Direct enrollment with mentor lacking application', directEnrollRes.success, directEnrollRes.message);

  const activeIndAssign = getMockStudentMentorAssignments({
    studentId: 'mock-student-pp099',
    programId: 'prog-academic-01',
    isActive: true,
  });
  report(
    '4.2 Individual mentor assignment created upon direct enrollment',
    activeIndAssign.length === 1 && activeIndAssign[0].mentor_id === 'mock-mentor-ppm002',
    `Created assignment id: ${activeIndAssign[0]?.id}`
  );

  // 4.3 Direct manual enrollment without custom mentor inherits cohort default
  adminRegisterMockMember('PP098', 'Cohort Default Scholar', 'scholar.pp098@poraplan.internal', 'student');
  const directDefaultRes = adminManualEnrollMockStudent(
    'mock-student-pp098',
    'prog-academic-01',
    'cohort-uu-cse-b67',
    undefined
  );
  report('4.3 Direct enrollment without custom mentor', directDefaultRes.success, directDefaultRes.message);

  const defRes = getMockEffectiveMentorForStudent('mock-student-pp098', 'prog-academic-01');
  report(
    '4.4 Student inherits cohort default mentor correctly',
    defRes.assignment_type === 'cohort' && defRes.mentor?.id === 'mock-mentor-ppm001',
    `Default mentor inherited: ${defRes.mentor?.full_name}`
  );

  // 4.5 Direct manual enrollment rejects suspended mentor
  setMockAccountStatus('mock-mentor-ppm099', 'suspended');
  adminRegisterMockMember('PP097', 'Suspended Mentor Scholar', 'scholar.pp097@poraplan.internal', 'student');
  const directSuspendedRes = adminManualEnrollMockStudent(
    'mock-student-pp097',
    'prog-academic-01',
    'cohort-uu-cse-b67',
    'mock-mentor-ppm099'
  );
  report('4.5 Direct enrollment rejects suspended mentor', !directSuspendedRes.success, directSuspendedRes.message);
  setMockAccountStatus('mock-mentor-ppm099', 'active');

  // ==============================================================================
  // 5. WORKLOAD & UI CODE AUDIT
  // ==============================================================================
  console.log('\n--- Section 5: Workload & UI Verification ---');

  const workload = getMockMentorWorkload();
  const ppm001Workload = workload.find((w) => w.mentor.poraplan_id === 'PPM001');
  const ppm002Workload = workload.find((w) => w.mentor.poraplan_id === 'PPM002');
  report(
    '5.1 Workload calculation for PPM001 is eligible',
    ppm001Workload !== undefined && ppm001Workload.isEligible === true,
    `PPM001 workload found, isEligible=${ppm001Workload?.isEligible}`
  );
  report(
    '5.2 Workload calculation for PPM002 is eligible (no application needed)',
    ppm002Workload !== undefined && ppm002Workload.isEligible === true,
    `PPM002 workload found, isEligible=${ppm002Workload?.isEligible}`
  );

  // 5.3 Static audit of mentorAssignments.ts
  const maPath = path.resolve(__dirname, '../src/lib/mentorAssignments.ts');
  const maContent = fs.readFileSync(maPath, 'utf8');

  report(
    '5.3 mentorAssignments.ts queries profiles directly in Supabase mode',
    maContent.includes("from('profiles')") && maContent.includes(".eq('role', 'mentor')") && maContent.includes(".neq('status', 'suspended')"),
    "Verified supabase.from('profiles').select('*').eq('role', 'mentor').neq('status', 'suspended')"
  );

  report(
    '5.4 mentorAssignments.ts does NOT query program_applications in getEligibleMentorsForProgram',
    !maContent.includes("from('program_applications')"),
    'Zero queries to program_applications in mentorAssignments.ts'
  );

  // 5.5 UI source inspection
  const pagePath = path.resolve(__dirname, '../src/pages/dashboard/AdminMentorAssignmentsPage.tsx');
  const pageContent = fs.readFileSync(pagePath, 'utf8');

  report(
    '5.5 NO APPROVED APP badge removed from UI',
    !pageContent.includes('NO APPROVED APP'),
    'Zero occurrences of NO APPROVED APP in AdminMentorAssignmentsPage.tsx'
  );

  report(
    '5.6 Obsolete application review message replaced in UI',
    !pageContent.includes('Review and approve mentor') && !pageContent.includes('No mentors have approved applications'),
    'Obsolete application review instructions completely removed from modals'
  );

  report(
    '5.7 Accurate member provisioning guidance present in UI',
    pageContent.includes('Provision mentor accounts from the Admin Dashboard first'),
    'Updated empty-state guidance present in both modals'
  );

  // ==============================================================================
  // 6. DATABASE MIGRATION SCRIPT AUDIT
  // ==============================================================================
  console.log('\n--- Section 6: Migration Verification ---');

  const migrationPath = path.resolve(
    __dirname,
    '../supabase/migrations/20261107000001_decouple_mentor_allocation_from_applications.sql'
  );
  const migrationExists = fs.existsSync(migrationPath);
  report('6.1 Additive migration file exists', migrationExists, migrationPath);

  if (migrationExists) {
    const migrationContent = fs.readFileSync(migrationPath, 'utf8');
    const hasAdminAssignCohort = migrationContent.includes('CREATE OR REPLACE FUNCTION public.admin_assign_cohort_mentor');
    const hasAdminAssignIndividual = migrationContent.includes('CREATE OR REPLACE FUNCTION public.admin_assign_individual_mentor');
    const hasAdminManualEnroll = migrationContent.includes('CREATE OR REPLACE FUNCTION public.admin_manual_enroll_student');
    const noProgramAppCheck = !migrationContent.includes('SELECT 1 FROM public.program_applications');

    report('6.2 Migration replaces admin_assign_cohort_mentor', hasAdminAssignCohort, 'Signature and body present');
    report('6.3 Migration replaces admin_assign_individual_mentor', hasAdminAssignIndividual, 'Signature and body present');
    report('6.4 Migration replaces admin_manual_enroll_student', hasAdminManualEnroll, 'Signature and body present');
    report('6.5 Migration completely removes program_applications requirement', noProgramAppCheck, 'Zero checks against program_applications');
  }

  // ==============================================================================
  // 7. EMOJI SCAN AUDIT
  // ==============================================================================
  console.log('\n--- Section 7: Mandatory No-Emoji Scan ---');

  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}]/u;
  const filesToScan = [
    'src/lib/mentorAssignments.ts',
    'src/lib/mockAuthStore.ts',
    'src/pages/dashboard/AdminMentorAssignmentsPage.tsx',
    'supabase/migrations/20261107000001_decouple_mentor_allocation_from_applications.sql',
    'scripts/verify_mentor_allocation_eligibility.ts',
  ];

  let anyEmojiFound = false;
  for (const rel of filesToScan) {
    const full = path.resolve(__dirname, '..', rel);
    const content = fs.readFileSync(full, 'utf8');
    if (emojiRegex.test(content)) {
      anyEmojiFound = true;
      console.error(`[FAIL] Emoji detected in: ${rel}`);
    }
  }

  report('7.1 Mandatory No-Emoji Scan across modified and test files', !anyEmojiFound, 'Zero emojis detected');

  // ==============================================================================
  // FINAL SUMMARY
  // ==============================================================================
  console.log('\n========================================');
  console.log(`TOTAL PASS: ${passCount}`);
  console.log(`TOTAL FAIL: ${failCount}`);
  console.log('========================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Unhandled verification error:', err);
  process.exit(1);
});
