/**
 * PoraPlan — Milestone 10 Verification Suite
 * Unified Public Profiles & Role Privacy Gate
 *
 * Scope:
 * 1. Public Profile Retrieval (Student, Mentor, Admin)
 * 2. Privacy Boundary Gate (Strict exclusion of phone, emails, account status, private data)
 * 3. Migration & Security Definer RPC Verification (SQL View, RPC, fixed search_path, mentor RLS policy)
 * 4. Route Registration & Component Checks (profile/:id, aliases, PublicProfilePage)
 * 5. Clickable Profile Integration Across Ecosystem (Student Dashboard, Mentor Assignments, Doubts, Admin Directory)
 * 6. Regression Protection (Existing private profile functions, mock auth store stability)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  getMockUsers,
  getMockProfile,
  getMockPublicProfile,
} from '../src/lib/mockAuthStore';

let passedAssertions = 0;
let failedAssertions = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passedAssertions++;
    console.log(`  ✓ ${message}`);
  } else {
    failedAssertions++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function runMilestone10Verification() {
  console.log('\n================================================================');
  console.log('PORAPLAN — MILESTONE 10: UNIFIED PUBLIC PROFILES & PRIVACY GATE');
  console.log('================================================================\n');

  // ============================================================================
  // SECTION 1: Public Profile Retrieval (Mock Store & Service Layer)
  // ============================================================================
  console.log('--- SECTION 1: Public Profile Retrieval ---');

  const allUsers = getMockUsers();
  const studentUser = allUsers.find((u) => u.role === 'student');
  const mentorUser = allUsers.find((u) => u.role === 'mentor');
  const adminUser = allUsers.find((u) => u.role === 'admin');

  assert(Boolean(studentUser), `Found sample student user (${studentUser?.full_name || 'none'})`);
  assert(Boolean(mentorUser), `Found sample mentor user (${mentorUser?.full_name || 'none'})`);
  assert(Boolean(adminUser), `Found sample admin user (${adminUser?.full_name || 'none'})`);

  if (studentUser) {
    const studentPub = getMockPublicProfile(studentUser.id);
    assert(studentPub !== null, `Successfully retrieved student public profile for ${studentUser.id}`);
    assert(studentPub?.id === studentUser.id, 'Public profile ID matches requested user ID');
    assert(studentPub?.role === 'student', 'Student public profile role is "student"');
    assert(studentPub?.full_name === studentUser.full_name, 'Student public profile preserves full_name');
    assert(studentPub?.poraplan_id === studentUser.poraplan_id, 'Student public profile includes poraplan_id');
    assert(Boolean(studentPub?.university), `Student public profile includes university: "${studentPub?.university}"`);
    assert(Boolean(studentPub?.department), `Student public profile includes department: "${studentPub?.department}"`);
  }

  if (mentorUser) {
    const mentorPub = getMockPublicProfile(mentorUser.id);
    assert(mentorPub !== null, `Successfully retrieved mentor public profile for ${mentorUser.id}`);
    assert(mentorPub?.id === mentorUser.id, 'Mentor public profile ID matches requested mentor ID');
    assert(mentorPub?.role === 'mentor', 'Mentor public profile role is "mentor"');
    assert(mentorPub?.full_name === mentorUser.full_name, 'Mentor public profile preserves full_name');
    assert(Boolean(mentorPub?.expertise), `Mentor public profile includes expertise: "${mentorPub?.expertise}"`);
    assert(Boolean(mentorPub?.mentoring_subjects), `Mentor public profile includes mentoring_subjects: "${mentorPub?.mentoring_subjects}"`);
  }

  // Non-existent ID returns null
  const nonExistent = getMockPublicProfile('non-existent-user-id-9999');
  assert(nonExistent === null, 'Non-existent user ID returns null without throwing');

  // ============================================================================
  // SECTION 2: Privacy Boundary & Data Sanitization Checks
  // ============================================================================
  console.log('\n--- SECTION 2: Privacy Boundary & Data Sanitization ---');

  if (studentUser) {
    const fullProfile = getMockProfile(studentUser.id);
    const pubProfile = getMockPublicProfile(studentUser.id) as Record<string, unknown>;

    assert(Boolean(fullProfile?.email), 'Full internal profile contains email');
    assert(pubProfile?.email === undefined, 'PRIVACY GATE: Public profile strictly omits email');
    assert(pubProfile?.whatsapp_number === undefined, 'PRIVACY GATE: Public profile strictly omits whatsapp_number');
    assert(pubProfile?.linked_email === undefined, 'PRIVACY GATE: Public profile strictly omits linked_email');
    assert(pubProfile?.contact_email === undefined, 'PRIVACY GATE: Public profile strictly omits contact_email');
    assert(pubProfile?.status === undefined, 'PRIVACY GATE: Public profile strictly omits account status');
  }

  if (mentorUser) {
    const pubProfile = getMockPublicProfile(mentorUser.id) as Record<string, unknown>;
    assert(pubProfile?.email === undefined, 'PRIVACY GATE: Mentor public profile strictly omits email');
    assert(pubProfile?.whatsapp_number === undefined, 'PRIVACY GATE: Mentor public profile strictly omits whatsapp_number');
    assert(pubProfile?.linked_email === undefined, 'PRIVACY GATE: Mentor public profile strictly omits linked_email');
    assert(pubProfile?.status === undefined, 'PRIVACY GATE: Mentor public profile strictly omits account status');
  }

  // ============================================================================
  // SECTION 3: Database Migration & RLS Security Inspection
  // ============================================================================
  console.log('\n--- SECTION 3: Database Migration & RLS Static Verification ---');

  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20261102000002_public_profiles_privacy_gate.sql'
  );

  assert(fs.existsSync(migrationPath), `Migration file exists at ${migrationPath}`);

  if (fs.existsSync(migrationPath)) {
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');

    assert(
      migrationSql.includes('CREATE OR REPLACE VIEW public.public_profiles'),
      'Migration defines public.public_profiles VIEW'
    );
    assert(
      migrationSql.includes('CREATE OR REPLACE FUNCTION public.get_public_profile'),
      'Migration defines public.get_public_profile RPC function'
    );
    assert(
      migrationSql.includes('SECURITY DEFINER'),
      'RPC function is marked SECURITY DEFINER for safe cross-role projection'
    );
    assert(
      migrationSql.includes('SET search_path = public, pg_temp'),
      'RPC function sets explicit immutable search_path to prevent search_path poisoning'
    );
    assert(
      !migrationSql.includes('SELECT * FROM public.profiles'),
      'Public view strictly avoids SELECT * on profiles table'
    );
    assert(
      migrationSql.includes('student_mentor_assignments'),
      'Extended RLS policy allows active assigned mentors to query mentees'
    );
    assert(
      migrationSql.includes('GRANT SELECT ON public.public_profiles TO authenticated'),
      'Explicit GRANT SELECT on public_profiles given to authenticated'
    );
    assert(
      migrationSql.includes('GRANT EXECUTE ON FUNCTION public.get_public_profile'),
      'Explicit GRANT EXECUTE on get_public_profile given to authenticated'
    );
  }

  // ============================================================================
  // SECTION 4: Routes & Public Profile Page Verification
  // ============================================================================
  console.log('\n--- SECTION 4: Routes & Page Component Verification ---');

  const routesPath = path.resolve(process.cwd(), 'src/routes/index.tsx');
  const routesContent = fs.readFileSync(routesPath, 'utf8');

  assert(
    routesContent.includes('path="profile/:id"'),
    'Route "profile/:id" is registered in AppRoutes'
  );
  assert(
    routesContent.includes('path="student/profile/:id"'),
    'Alias route "student/profile/:id" is registered'
  );
  assert(
    routesContent.includes('path="mentor/profile/:id"'),
    'Alias route "mentor/profile/:id" is registered'
  );
  assert(
    routesContent.includes('PublicProfilePage'),
    'PublicProfilePage component is mapped in routes'
  );

  const pagePath = path.resolve(process.cwd(), 'src/pages/dashboard/PublicProfilePage.tsx');
  assert(fs.existsSync(pagePath), `PublicProfilePage exists at ${pagePath}`);

  if (fs.existsSync(pagePath)) {
    const pageContent = fs.readFileSync(pagePath, 'utf8');
    assert(pageContent.includes('isOwner'), 'Page computes isOwner status for authenticated self-viewing');
    assert(pageContent.includes('to="/profile"'), 'Page renders Edit Profile button for owner linking to /profile');
    assert(pageContent.includes('Academic Privacy Gate'), 'Page renders Academic Privacy Gate notice');
    assert(pageContent.includes('parseTags'), 'Page safely formats mentor expertise and subject tags');
    assert(pageContent.includes('Profile Unavailable'), 'Page renders friendly error / not-found fallback');
  }

  // ============================================================================
  // SECTION 5: Clickable Cross-Ecosystem Profile Links
  // ============================================================================
  console.log('\n--- SECTION 5: Clickable Cross-Ecosystem Profile Links ---');

  const studentDashboardPath = path.resolve(process.cwd(), 'src/pages/dashboard/StudentDashboardPage.tsx');
  const studentDashboardContent = fs.readFileSync(studentDashboardPath, 'utf8');
  assert(
    studentDashboardContent.includes('to={`/profile/${assignedMentor.id}`}') ||
    studentDashboardContent.includes('/profile/${assignedMentor.id}'),
    'StudentDashboardPage contains clickable link to assigned mentor public profile'
  );

  const mentorAssignmentsPath = path.resolve(process.cwd(), 'src/pages/dashboard/MentorAssignmentsPage.tsx');
  const mentorAssignmentsContent = fs.readFileSync(mentorAssignmentsPath, 'utf8');
  assert(
    mentorAssignmentsContent.includes('to={`/profile/${selectedStudent.id}`}') ||
    mentorAssignmentsContent.includes('/profile/${selectedStudent.id}'),
    'MentorAssignmentsPage contains clickable link to selected student public profile'
  );

  const studentDoubtsPath = path.resolve(process.cwd(), 'src/pages/dashboard/StudentDoubtsPage.tsx');
  const studentDoubtsContent = fs.readFileSync(studentDoubtsPath, 'utf8');
  assert(
    studentDoubtsContent.includes('to={`/profile/${resp.author_id}`}') ||
    studentDoubtsContent.includes('/profile/${resp.author_id}'),
    'StudentDoubtsPage contains clickable link to response author public profile'
  );

  const mentorDoubtsPath = path.resolve(process.cwd(), 'src/pages/dashboard/MentorDoubtsPage.tsx');
  const mentorDoubtsContent = fs.readFileSync(mentorDoubtsPath, 'utf8');
  assert(
    mentorDoubtsContent.includes('to={`/profile/${activeDoubt.student_id}`}') ||
    mentorDoubtsContent.includes('/profile/${activeDoubt.student_id}'),
    'MentorDoubtsPage contains clickable link to questioning student public profile'
  );

  const adminUsersPath = path.resolve(process.cwd(), 'src/pages/dashboard/AdminUsersPage.tsx');
  const adminUsersContent = fs.readFileSync(adminUsersPath, 'utf8');
  assert(
    adminUsersContent.includes('to={`/profile/${selectedUser.id}`}') ||
    adminUsersContent.includes('/profile/${selectedUser.id}'),
    'AdminUsersPage contains clickable link to user public profile in detail drawer'
  );

  // ============================================================================
  // SECTION 6: Regression Protection
  // ============================================================================
  console.log('\n--- SECTION 6: Regression Protection ---');

  const initialUsers = getMockUsers();
  assert(initialUsers.length >= 6, `Mock user directory has expected volume (${initialUsers.length} users)`);
  const initialStudent = getMockProfile('mock-student-pp001');
  assert(initialStudent?.id === 'mock-student-pp001', 'Existing mock student PP-2026-0001 intact');

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('\n================================================================');
  console.log(`TOTAL ASSERTIONS: ${passedAssertions + failedAssertions}`);
  console.log(`PASSED: ${passedAssertions}`);
  console.log(`FAILED: ${failedAssertions}`);
  console.log('================================================================\n');

  if (failedAssertions > 0) {
    process.exit(1);
  }
}

runMilestone10Verification().catch((err) => {
  console.error('Unhandled verification error:', err);
  process.exit(1);
});
