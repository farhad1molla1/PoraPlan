/**
 * PoraPlan — Milestone 12.5 Verification Suite
 *
 * Production Security Hardening & Authorization Verification:
 *
 * GROUP 1: Admin Authorization & Intelligence Access
 * 1. Admin can retrieve authorized admin intelligence.
 * 2. Student cannot retrieve admin intelligence.
 * 3. Mentor cannot retrieve admin intelligence.
 * 4. Missing options are rejected with authorization error.
 * 5. Undefined role is rejected.
 * 6. Forged { requestingUserRole: 'admin' } without authenticated admin session is rejected.
 * 7. Invalid or non-existent session user ID is rejected.
 *
 * GROUP 2: Student Report Ownership & Access Isolation
 * 8. Student can access their own academic report.
 * 9. Student cannot access another student's academic report.
 * 10. Mentor can access an assigned student's academic report.
 * 11. Mentor cannot access an unassigned student's academic report.
 * 12. Admin can access an authorized student academic report.
 * 13. Forged role string ({ requestingUserId: studentId, requestingUserRole: 'admin' }) cannot bypass ownership checks.
 *
 * GROUP 3: Mentor Report Workload Isolation
 * 14. Mentor can access their own mentor report.
 * 15. Mentor cannot access another mentor's workload report.
 * 16. Student cannot access mentor workload reports.
 * 17. Admin can access authorized platform-wide mentor reports.
 * 18. Missing or forged role context cannot access mentor workload.
 *
 * GROUP 4: Database / Migration Schema Hardening Review
 * 19. Migration 20261103000001 defines SECURITY DEFINER functions with explicit search_path = public.
 * 20. Migration revokes execution privileges from PUBLIC/anon and grants strictly to authenticated.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  generateStudentReport,
  generateMentorReport,
  generateAdminAcademicIntelligence,
} from '../src/lib/reports';
// Imported without unused bindings

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

async function runMilestone12_5SecurityVerification() {
  console.log('====================================================');
  console.log('PORAPLAN — MILESTONE 12.5 SECURITY VERIFICATION SUITE');
  console.log('Reporting Module: Production Security Hardening');
  console.log('====================================================\n');

  const adminId = 'mock-admin-ppa001';
  const mentorId = 'mock-mentor-ppm001';
  const otherMentorId = 'mock-mentor-ppm002';
  const studentId = 'mock-student-pp001';
  const strangerStudentId = 'mock-student-pp003';

  // =========================================================================
  // GROUP 1: ADMIN AUTHORIZATION TESTS
  // =========================================================================
  console.log('--- GROUP 1: Admin Authorization Tests ---');

  // Test 1: Admin can retrieve authorized admin intelligence
  const adminRes = await generateAdminAcademicIntelligence('monthly', undefined, undefined, {
    requestingUserId: adminId,
    requestingUserRole: 'admin',
  });
  assert(
    adminRes.error === null && adminRes.report !== null && adminRes.report.overview.totalRegisteredStudents > 0,
    '1. Admin can retrieve authorized admin intelligence'
  );

  // Test 2: Student cannot retrieve admin intelligence
  const studentAdminRes = await generateAdminAcademicIntelligence('monthly', undefined, undefined, {
    requestingUserId: studentId,
    requestingUserRole: 'student',
  });
  assert(
    studentAdminRes.report === null &&
      studentAdminRes.error !== null &&
      studentAdminRes.error.message.includes('Unauthorized'),
    '2. Student cannot retrieve admin intelligence'
  );

  // Test 3: Mentor cannot retrieve admin intelligence
  const mentorAdminRes = await generateAdminAcademicIntelligence('monthly', undefined, undefined, {
    requestingUserId: mentorId,
    requestingUserRole: 'mentor',
  });
  assert(
    mentorAdminRes.report === null &&
      mentorAdminRes.error !== null &&
      mentorAdminRes.error.message.includes('Unauthorized'),
    '3. Mentor cannot retrieve admin intelligence'
  );

  // Test 4: Missing options are rejected
  const missingOptsAdminRes = await generateAdminAcademicIntelligence('monthly');
  assert(
    missingOptsAdminRes.report === null &&
      missingOptsAdminRes.error !== null &&
      missingOptsAdminRes.error.message.includes('Unauthorized'),
    '4. Missing options are rejected with authorization error'
  );

  // Test 5: Undefined role is rejected
  const undefRoleAdminRes = await generateAdminAcademicIntelligence('monthly', undefined, undefined, {
    requestingUserId: adminId,
    requestingUserRole: undefined,
  });
  assert(
    undefRoleAdminRes.report === null && undefRoleAdminRes.error !== null,
    '5. Undefined role is rejected'
  );

  // Test 6: Forged { requestingUserRole: 'admin' } without authenticated admin session is rejected
  const forgedAdminNoIdRes = await generateAdminAcademicIntelligence('monthly', undefined, undefined, {
    requestingUserRole: 'admin',
  });
  const studentForgedAdminRes = await generateAdminAcademicIntelligence('monthly', undefined, undefined, {
    requestingUserId: studentId,
    requestingUserRole: 'admin',
  });
  assert(
    forgedAdminNoIdRes.report === null &&
      forgedAdminNoIdRes.error !== null &&
      studentForgedAdminRes.report === null &&
      studentForgedAdminRes.error !== null,
    '6. Forged { requestingUserRole: "admin" } without authenticated admin session is rejected'
  );

  // Test 7: Invalid or missing session user ID is rejected
  const invalidSessionAdminRes = await generateAdminAcademicIntelligence('monthly', undefined, undefined, {
    requestingUserId: 'non-existent-user-999',
    requestingUserRole: 'admin',
  });
  assert(
    invalidSessionAdminRes.report === null && invalidSessionAdminRes.error !== null,
    '7. Invalid or missing session user ID is rejected'
  );

  // =========================================================================
  // GROUP 2: STUDENT REPORT OWNERSHIP TESTS
  // =========================================================================
  console.log('\n--- GROUP 2: Student Report Ownership Tests ---');

  // Test 8: Student can access their own academic report
  const studentSelfRes = await generateStudentReport(studentId, 'monthly', undefined, undefined, {
    requestingUserId: studentId,
    requestingUserRole: 'student',
  });
  assert(
    studentSelfRes.error === null && studentSelfRes.report !== null && studentSelfRes.report.studentId === studentId,
    '8. Student can access their own academic report'
  );

  // Test 9: Student cannot access another student's report
  const studentCrossRes = await generateStudentReport(strangerStudentId, 'monthly', undefined, undefined, {
    requestingUserId: studentId,
    requestingUserRole: 'student',
  });
  assert(
    studentCrossRes.report === null &&
      studentCrossRes.error !== null &&
      studentCrossRes.error.message.includes('Unauthorized'),
    '9. Student cannot access another student academic report'
  );

  // Test 10: Mentor can access an assigned student's report
  const mentorAssignedRes = await generateStudentReport(studentId, 'monthly', undefined, undefined, {
    requestingUserId: mentorId,
    requestingUserRole: 'mentor',
  });
  assert(
    mentorAssignedRes.error === null &&
      mentorAssignedRes.report !== null &&
      mentorAssignedRes.report.studentId === studentId,
    '10. Mentor can access an assigned student academic report'
  );

  // Test 11: Mentor cannot access an unassigned student's report
  const mentorUnassignedRes = await generateStudentReport(strangerStudentId, 'monthly', undefined, undefined, {
    requestingUserId: mentorId,
    requestingUserRole: 'mentor',
  });
  assert(
    mentorUnassignedRes.report === null &&
      mentorUnassignedRes.error !== null &&
      mentorUnassignedRes.error.message.includes('Unauthorized'),
    '11. Mentor cannot access an unassigned student academic report'
  );

  // Test 12: Admin can access an authorized student report
  const adminStudentRes = await generateStudentReport(studentId, 'monthly', undefined, undefined, {
    requestingUserId: adminId,
    requestingUserRole: 'admin',
  });
  assert(
    adminStudentRes.error === null && adminStudentRes.report !== null && adminStudentRes.report.studentId === studentId,
    '12. Admin can access an authorized student academic report'
  );

  // Test 13: Forged role string cannot bypass student authorization
  const studentForgedAdminStudentRes = await generateStudentReport(
    strangerStudentId,
    'monthly',
    undefined,
    undefined,
    {
      requestingUserId: studentId,
      requestingUserRole: 'admin',
    }
  );
  assert(
    studentForgedAdminStudentRes.report === null && studentForgedAdminStudentRes.error !== null,
    '13. Forged role string ({ requestingUserId: studentId, requestingUserRole: "admin" }) cannot bypass authorization'
  );

  // =========================================================================
  // GROUP 3: MENTOR REPORT WORKLOAD ISOLATION TESTS
  // =========================================================================
  console.log('\n--- GROUP 3: Mentor Report Workload Isolation Tests ---');

  // Test 14: Mentor can access their own report
  const mentorSelfRes = await generateMentorReport(mentorId, 'schedule', undefined, undefined, undefined, {
    requestingUserId: mentorId,
    requestingUserRole: 'mentor',
  });
  assert(
    mentorSelfRes.error === null && mentorSelfRes.report !== null && mentorSelfRes.report.mentorId === mentorId,
    '14. Mentor can access their own mentor report'
  );

  // Test 15: Mentor cannot access another mentor's report
  const mentorCrossRes = await generateMentorReport(otherMentorId, 'schedule', undefined, undefined, undefined, {
    requestingUserId: mentorId,
    requestingUserRole: 'mentor',
  });
  assert(
    mentorCrossRes.report === null &&
      mentorCrossRes.error !== null &&
      mentorCrossRes.error.message.includes('Unauthorized'),
    '15. Mentor cannot access another mentor workload report'
  );

  // Test 16: Student cannot access mentor workload reports
  const studentMentorRes = await generateMentorReport(mentorId, 'schedule', undefined, undefined, undefined, {
    requestingUserId: studentId,
    requestingUserRole: 'student',
  });
  assert(
    studentMentorRes.report === null &&
      studentMentorRes.error !== null &&
      studentMentorRes.error.message.includes('Unauthorized'),
    '16. Student cannot access mentor workload reports'
  );

  // Test 17: Admin can access authorized platform-wide mentor reports
  const adminMentorRes = await generateMentorReport(mentorId, 'schedule', undefined, undefined, undefined, {
    requestingUserId: adminId,
    requestingUserRole: 'admin',
  });
  assert(
    adminMentorRes.error === null && adminMentorRes.report !== null && adminMentorRes.report.mentorId === mentorId,
    '17. Admin can access authorized platform-wide mentor reports'
  );

  // Test 18: Missing or forged authorization context cannot access mentor workload
  const forgedMentorRes = await generateMentorReport(otherMentorId, 'schedule', undefined, undefined, undefined, {
    requestingUserId: studentId,
    requestingUserRole: 'admin',
  });
  assert(
    forgedMentorRes.report === null && forgedMentorRes.error !== null,
    '18. Missing or forged authorization context is rejected'
  );

  // =========================================================================
  // GROUP 4: DATABASE / MIGRATION SCHEMA STATIC CHECKS
  // =========================================================================
  console.log('\n--- GROUP 4: Database / Migration Schema Checks ---');

  const migrationPath = path.resolve(
    __dirname,
    '../supabase/migrations/20261103000001_reporting_security_and_authorization.sql'
  );
  const migrationExists = fs.existsSync(migrationPath);
  const migrationSql = migrationExists ? fs.readFileSync(migrationPath, 'utf-8') : '';

  // Test 19: Security definer functions with explicit search_path
  const hasSecurityDefiner = migrationSql.includes('SECURITY DEFINER');
  const hasSearchPath = migrationSql.includes('SET search_path = public');
  const hasAuthUidCheck = migrationSql.includes('auth.uid()');
  assert(
    migrationExists && hasSecurityDefiner && hasSearchPath && hasAuthUidCheck,
    '19. Migration 20261103000001 defines SECURITY DEFINER functions with explicit search_path = public and auth.uid() check'
  );

  // Test 20: Privileges revoked from PUBLIC/anon and granted to authenticated
  const hasRevokePublic = migrationSql.includes('REVOKE ALL ON FUNCTION public.get_admin_academic_intelligence_roster() FROM PUBLIC');
  const hasRevokeAnon = migrationSql.includes('REVOKE ALL ON FUNCTION public.get_admin_academic_intelligence_roster() FROM anon');
  const hasGrantAuth = migrationSql.includes('GRANT EXECUTE ON FUNCTION public.get_admin_academic_intelligence_roster() TO authenticated');
  assert(
    hasRevokePublic && hasRevokeAnon && hasGrantAuth,
    '20. Migration revokes execution privileges from PUBLIC/anon and grants strictly to authenticated'
  );

  console.log('\n====================================================');
  console.log(`TOTAL CHECKS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runMilestone12_5SecurityVerification().catch((err) => {
  console.error('Unhandled security verification error:', err);
  process.exit(1);
});
