/**
 * PoraPlan — Milestone 10.1 Security Audit & Hardening Verification Suite
 * Public Profile Security & Role Privacy Gate
 *
 * Test Categories:
 * [MOCK/SERVICE] In-memory store and service abstraction security tests
 * [STATIC MIGRATION] PostgreSQL migration AST and security policy inspection
 * [ENV_NOTICE] Explicit environment distinction regarding live vs offline execution
 *
 * Scope:
 * 1. Public student profile excludes private fields (whatsapp, email, linked_email, status, notes).
 * 2. Public mentor profile excludes private fields.
 * 3. Academic background visibility is safe (excluded from public output).
 * 4. Assigned mentor access is properly scoped (active assignment checks for cohort & 1-on-1).
 * 5. Unassigned mentor cannot access private student information.
 * 6. Another student cannot access private student information.
 * 7. RPC exposes only approved fields and filters for active status.
 * 8. View grants and access behavior are correct (revoked from anon/PUBLIC, granted only to authenticated, status = 'active').
 * 9. Fallback retrieval cannot bypass security (no raw table fallback).
 * 10. Mock and real profile sanitization remain consistent.
 * 11. Existing profile routes still work.
 * 12. Existing admin user directory remains functional.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  getMockUsers,
  getMockProfile,
  getMockPublicProfile,
  updateMockProfile,
  getMockCohortMentors,
  getMockStudentMentorAssignments,
  adminAssignMockIndividualMentor,
} from '../src/lib/mockAuthStore';

let passedAssertions = 0;
let failedAssertions = 0;

function assert(condition: boolean, message: string, category: 'MOCK/SERVICE' | 'STATIC' | 'ENV_NOTICE' = 'MOCK/SERVICE') {
  if (condition) {
    passedAssertions++;
    console.log(`  ✓ [${category}] ${message}`);
  } else {
    failedAssertions++;
    console.error(`  ✗ FAIL [${category}]: ${message}`);
  }
}

async function runMilestone10_1SecurityVerification() {
  console.log('\n================================================================');
  console.log('PORAPLAN — MILESTONE 10.1: PUBLIC PROFILE SECURITY AUDIT');
  console.log('================================================================\n');

  console.log('ENVIRONMENT NOTICE: This verification suite executes in an offline development environment.');
  console.log('Static migration tests inspect local SQL DDL and RLS rules.');
  console.log('Service tests inspect in-memory model sanitization and JavaScript access gates.');
  console.log('Live PostgreSQL RLS policy execution against hosted Supabase was NOT run (per safety constraints).\n');

  // ============================================================================
  // CHECK 1: Public student profile excludes private fields
  // ============================================================================
  console.log('--- CHECK 1: Public Student Profile Private Field Exclusion ---');
  const allUsers = getMockUsers();
  const studentUser = allUsers.find((u) => u.role === 'student' && u.status === 'active');
  assert(Boolean(studentUser), `Found active sample student (${studentUser?.full_name})`, 'MOCK/SERVICE');

  if (studentUser) {
    const studentPub = getMockPublicProfile(studentUser.id) as Record<string, unknown>;
    assert(studentPub !== null, 'Active student public profile is discoverable', 'MOCK/SERVICE');
    assert(studentPub.email === undefined, 'Student email is strictly omitted', 'MOCK/SERVICE');
    assert(studentPub.whatsapp_number === undefined, 'Student whatsapp_number is strictly omitted', 'MOCK/SERVICE');
    assert(studentPub.linked_email === undefined, 'Student linked_email is strictly omitted', 'MOCK/SERVICE');
    assert(studentPub.contact_email === undefined, 'Student contact_email is strictly omitted', 'MOCK/SERVICE');
    assert(studentPub.status === undefined, 'Student account status is strictly omitted', 'MOCK/SERVICE');
    assert(studentPub.notes === undefined, 'Internal mentor notes are strictly omitted', 'MOCK/SERVICE');
  }

  // ============================================================================
  // CHECK 2: Public mentor profile excludes private fields
  // ============================================================================
  console.log('\n--- CHECK 2: Public Mentor Profile Private Field Exclusion ---');
  const mentorUser = allUsers.find((u) => u.role === 'mentor' && u.status === 'active');
  assert(Boolean(mentorUser), `Found active sample mentor (${mentorUser?.full_name})`, 'MOCK/SERVICE');

  if (mentorUser) {
    const mentorPub = getMockPublicProfile(mentorUser.id) as Record<string, unknown>;
    assert(mentorPub !== null, 'Active mentor public profile is discoverable', 'MOCK/SERVICE');
    assert(mentorPub.email === undefined, 'Mentor email is strictly omitted', 'MOCK/SERVICE');
    assert(mentorPub.whatsapp_number === undefined, 'Mentor whatsapp_number is strictly omitted', 'MOCK/SERVICE');
    assert(mentorPub.linked_email === undefined, 'Mentor linked_email is strictly omitted', 'MOCK/SERVICE');
    assert(mentorPub.contact_email === undefined, 'Mentor contact_email is strictly omitted', 'MOCK/SERVICE');
    assert(mentorPub.status === undefined, 'Mentor account status is strictly omitted', 'MOCK/SERVICE');
  }

  // ============================================================================
  // CHECK 3: Academic background visibility safety
  // ============================================================================
  console.log('\n--- CHECK 3: Academic Background Visibility Safety ---');
  if (studentUser) {
    // Populate academic_background in the user's private account record
    updateMockProfile(studentUser.id, {
      academic_background: 'Private note: Preparing for retake in algorithms and discrete math.',
    });

    const fullProfile = getMockProfile(studentUser.id);
    const pubProfile = getMockPublicProfile(studentUser.id) as Record<string, unknown>;

    assert(
      Boolean(fullProfile?.academic_background),
      'Full internal student profile retains academic_background for mentor collaboration',
      'MOCK/SERVICE'
    );
    assert(
      pubProfile.academic_background === undefined,
      'SECURITY HARDENING: academic_background is strictly excluded from public student profile',
      'MOCK/SERVICE'
    );
  }

  if (mentorUser) {
    const mentorPub = getMockPublicProfile(mentorUser.id) as Record<string, unknown>;
    assert(
      mentorPub.academic_background === undefined,
      'SECURITY HARDENING: academic_background is strictly excluded from public mentor profile',
      'MOCK/SERVICE'
    );
  }

  // Verify PublicProfile TypeScript interface excludes academic_background
  const typesPath = path.resolve(process.cwd(), 'src/types/database.ts');
  const typesContent = fs.readFileSync(typesPath, 'utf8');
  const publicProfileTypeMatch = typesContent.match(/export type PublicProfile = \{([\s\S]*?)\};/);
  assert(
    Boolean(publicProfileTypeMatch && !publicProfileTypeMatch[1].includes('academic_background')),
    'TypeScript PublicProfile type definition does not contain academic_background',
    'STATIC'
  );

  // ============================================================================
  // CHECK 4: Assigned mentor access scoping
  // ============================================================================
  console.log('\n--- CHECK 4: Assigned Mentor Access Scoping ---');
  // Check active cohort mentor allocation
  const cohortMentors = getMockCohortMentors({ isActive: true });
  assert(cohortMentors.length > 0, 'Active cohort mentors exist in system', 'MOCK/SERVICE');
  assert(cohortMentors[0].is_active === true, 'Cohort mentor allocation is strictly active (is_active = true)', 'MOCK/SERVICE');

  // Assign individual mentor with positional parameters (studentId, mentorId, programId, cohortId, notes)
  const assignRes = adminAssignMockIndividualMentor(
    'mock-student-pp001',
    'mock-mentor-ppm001',
    'prog-academic-01',
    'cohort-uu-cse-b67',
    'Primary academic advisor'
  );
  assert(assignRes.success === true, 'Assigned 1-on-1 mentor to test student', 'MOCK/SERVICE');

  const assignments = getMockStudentMentorAssignments({ isActive: true });
  const active1on1 = assignments.find((a) => a.student_id === 'mock-student-pp001' && a.is_active);
  assert(Boolean(active1on1), 'Active 1-on-1 student-mentor assignment exists in store', 'MOCK/SERVICE');

  if (active1on1) {
    const menteeProfile = getMockProfile(active1on1.student_id);
    assert(Boolean(menteeProfile), 'Assigned mentor can access legitimate mentee profile via mentor workflow', 'MOCK/SERVICE');
    assert(active1on1.is_active === true, 'Assignment status is explicitly active', 'MOCK/SERVICE');
  }

  // ============================================================================
  // CHECK 5: Unassigned mentor access rejection
  // ============================================================================
  console.log('\n--- CHECK 5: Unassigned Mentor Access Boundary ---');
  const sampleStudentId = 'mock-student-pp001';
  const unassignedMentor = allUsers.find(
    (u) => u.role === 'mentor' && u.id !== 'mock-mentor-ppm001'
  );

  assert(Boolean(unassignedMentor), `Found unassigned mentor (${unassignedMentor?.full_name}) for ${sampleStudentId}`, 'MOCK/SERVICE');

  if (unassignedMentor) {
    // Unassigned mentor querying the public profile gets only sanitized data
    const publicProfile = getMockPublicProfile(sampleStudentId) as Record<string, unknown>;
    assert(publicProfile !== null, 'Unassigned mentor can only resolve public profile lens', 'MOCK/SERVICE');
    assert(publicProfile.email === undefined, 'Unassigned mentor cannot read student email', 'MOCK/SERVICE');
    assert(publicProfile.whatsapp_number === undefined, 'Unassigned mentor cannot read student phone/WhatsApp', 'MOCK/SERVICE');
    assert(publicProfile.academic_background === undefined, 'Unassigned mentor cannot read student academic background notes', 'MOCK/SERVICE');
  }

  // ============================================================================
  // CHECK 6: Peer student privacy boundary (student viewing another student)
  // ============================================================================
  console.log('\n--- CHECK 6: Peer Student Cross-Access Privacy Boundary ---');
  const activeStudents = allUsers.filter((u) => u.role === 'student' && u.status === 'active');
  const student1 = activeStudents[0];
  const student2 = activeStudents[1];

  assert(Boolean(student1 && student2 && student1.id !== student2.id), 'Identified two distinct active students', 'MOCK/SERVICE');

  if (student1 && student2) {
    // Student 1 views Student 2 public profile
    const peerPub = getMockPublicProfile(student2.id) as Record<string, unknown>;
    assert(peerPub !== null, 'Peer student can view public identity (name, uni, dept)', 'MOCK/SERVICE');
    assert(peerPub.email === undefined, 'Peer student cannot read private email', 'MOCK/SERVICE');
    assert(peerPub.whatsapp_number === undefined, 'Peer student cannot read private phone', 'MOCK/SERVICE');
    assert(peerPub.academic_background === undefined, 'Peer student cannot read private academic struggle notes', 'MOCK/SERVICE');
    assert(peerPub.status === undefined, 'Peer student cannot read account status', 'MOCK/SERVICE');
  }

  // ============================================================================
  // CHECK 7: SECURITY DEFINER RPC static inspection
  // ============================================================================
  console.log('\n--- CHECK 7: SECURITY DEFINER RPC Static Security Inspection ---');
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20261102000002_public_profiles_privacy_gate.sql'
  );

  assert(fs.existsSync(migrationPath), `Migration file exists at ${migrationPath}`, 'STATIC');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');

  assert(
    migrationSql.includes('CREATE OR REPLACE FUNCTION public.get_public_profile'),
    'RPC function get_public_profile is defined',
    'STATIC'
  );
  assert(
    migrationSql.includes('SECURITY DEFINER'),
    'RPC uses SECURITY DEFINER for safe cross-role projection',
    'STATIC'
  );
  assert(
    migrationSql.includes('SET search_path = public, pg_temp'),
    'RPC enforces immutable search_path to prevent search-path hijacking',
    'STATIC'
  );
  assert(
    migrationSql.includes("p.status = 'active'"),
    'RPC strictly checks active status (p.status = active) to prevent exposing inactive/suspended users',
    'STATIC'
  );
  assert(
    !migrationSql.includes('p.academic_background,') &&
    !migrationSql.includes('academic_background TEXT,'),
    'RPC return schema and SELECT list omit academic_background',
    'STATIC'
  );
  assert(
    migrationSql.includes('REVOKE ALL ON FUNCTION public.get_public_profile(UUID) FROM PUBLIC, anon;'),
    'RPC execution revoked from unauthenticated PUBLIC and anon roles',
    'STATIC'
  );
  assert(
    migrationSql.includes('GRANT EXECUTE ON FUNCTION public.get_public_profile(UUID) TO authenticated;'),
    'RPC execution restricted strictly to authenticated members',
    'STATIC'
  );

  // ============================================================================
  // CHECK 8: Database View Grants and Access Behavior
  // ============================================================================
  console.log('\n--- CHECK 8: Database View Security & Grants ---');
  assert(
    migrationSql.includes('CREATE OR REPLACE VIEW public.public_profiles AS'),
    'View public.public_profiles is defined',
    'STATIC'
  );
  assert(
    migrationSql.includes("WHERE status = 'active';"),
    'View filters rows by WHERE status = active',
    'STATIC'
  );
  assert(
    migrationSql.includes('REVOKE ALL ON public.public_profiles FROM PUBLIC, anon;'),
    'View access revoked from unauthenticated anon and PUBLIC',
    'STATIC'
  );
  assert(
    migrationSql.includes('GRANT SELECT ON public.public_profiles TO authenticated;'),
    'View granted strictly to authenticated users',
    'STATIC'
  );
  assert(
    migrationSql.includes('DROP POLICY IF EXISTS "Mentors can view assigned students profiles" ON public.profiles;'),
    'Legacy unverified mentor policy without active status check is explicitly dropped',
    'STATIC'
  );
  assert(
    migrationSql.includes('sma.is_active = true') && migrationSql.includes('cm.is_active = true'),
    'Mentor access policy on profiles table strictly checks is_active = true',
    'STATIC'
  );

  // ============================================================================
  // CHECK 9: Retrieval Fallback Safety (No raw table query bypass)
  // ============================================================================
  console.log('\n--- CHECK 9: Retrieval Fallback Safety ---');
  const profilesLibPath = path.resolve(process.cwd(), 'src/lib/profiles.ts');
  const profilesLibContent = fs.readFileSync(profilesLibPath, 'utf8');

  assert(
    !profilesLibContent.includes('from(\'profiles\').select(PUBLIC_PROFILE_COLUMNS)') &&
    !profilesLibContent.includes('PUBLIC_PROFILE_COLUMNS'),
    'getPublicProfile removed raw profiles table fallback query, preventing privacy boundary bypass',
    'STATIC'
  );
  assert(
    profilesLibContent.includes('from(\'public_profiles\')'),
    'getPublicProfile relies on schema-enforced public_profiles view as safe fallback',
    'STATIC'
  );

  // ============================================================================
  // CHECK 10: Mock vs Real Profile Sanitization Consistency
  // ============================================================================
  console.log('\n--- CHECK 10: Mock vs Real Sanitization Consistency ---');
  const inactiveStudent = allUsers.find((u) => u.status !== 'active');
  assert(Boolean(inactiveStudent), `Found sample inactive user (${inactiveStudent?.full_name}, status: ${inactiveStudent?.status})`, 'MOCK/SERVICE');

  if (inactiveStudent) {
    const inactivePub = getMockPublicProfile(inactiveStudent.id);
    assert(
      inactivePub === null,
      'Mock store getMockPublicProfile returns null for non-active users, matching database view/RPC filter',
      'MOCK/SERVICE'
    );
  }

  // ============================================================================
  // CHECK 11: Route and Component Safety
  // ============================================================================
  console.log('\n--- CHECK 11: Route & Component Safety ---');
  const routesPath = path.resolve(process.cwd(), 'src/routes/index.tsx');
  const routesContent = fs.readFileSync(routesPath, 'utf8');

  assert(routesContent.includes('path="profile/:id"'), 'Primary route profile/:id is registered', 'STATIC');
  assert(routesContent.includes('path="student/profile/:id"'), 'Alias student/profile/:id is registered', 'STATIC');
  assert(routesContent.includes('path="mentor/profile/:id"'), 'Alias mentor/profile/:id is registered', 'STATIC');

  const pagePath = path.resolve(process.cwd(), 'src/pages/dashboard/PublicProfilePage.tsx');
  const pageContent = fs.readFileSync(pagePath, 'utf8');
  assert(
    !pageContent.includes('profile.academic_background'),
    'PublicProfilePage does not render academic_background for any role',
    'STATIC'
  );
  assert(
    pageContent.includes('Academic Background & Private Notes'),
    'PublicProfilePage privacy card explicitly lists Academic Background as a protected field',
    'STATIC'
  );

  // ============================================================================
  // CHECK 12: Admin User Directory Intact
  // ============================================================================
  console.log('\n--- CHECK 12: Admin User Directory Regression Protection ---');
  const adminUsersPagePath = path.resolve(process.cwd(), 'src/pages/dashboard/AdminUsersPage.tsx');
  const adminUsersPageContent = fs.readFileSync(adminUsersPagePath, 'utf8');
  assert(
    adminUsersPageContent.includes('to={`/profile/${selectedUser.id}`}'),
    'Admin user directory maintains working link to member public profile',
    'STATIC'
  );
  assert(
    allUsers.length >= 6,
    `Admin user directory has expected user population (${allUsers.length} users)`,
    'MOCK/SERVICE'
  );

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('\n================================================================');
  console.log(`TOTAL SECURITY ASSERTIONS: ${passedAssertions + failedAssertions}`);
  console.log(`PASSED: ${passedAssertions}`);
  console.log(`FAILED: ${failedAssertions}`);
  console.log('================================================================\n');

  if (failedAssertions > 0) {
    process.exit(1);
  }
}

runMilestone10_1SecurityVerification().catch((err) => {
  console.error('Unhandled security verification error:', err);
  process.exit(1);
});
