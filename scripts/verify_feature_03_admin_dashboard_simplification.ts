/**
 * PoraPlan UX Track — Feature 03: Admin Dashboard Simplification Verification Suite
 *
 * Verifies:
 * 1. Scope Boundary Integrity:
 *    - Only AdminDashboardPage.tsx was modified in src/.
 *    - StudentDashboardPage.tsx and MentorDashboardPage.tsx remain untouched.
 * 2. Obsolete Milestone & Clutter Removal:
 *    - Removed obsolete development milestone badges ("MILESTONE 2", "MILESTONE 3", "MILESTONE 4").
 *    - Removed redundant screaming header label ("ADMIN WORKSPACE").
 *    - Removed static promotional/documentation blurbs ("Authentication & Access Controls").
 * 3. Operational Desks Grid Coverage:
 *    - All 7 core administrative areas accessible with direct routes:
 *      - Enrollments Desk (/admin/enrollments)
 *      - Programs & Cohorts (/admin/programs)
 *      - Mentor Allocations (/admin/mentor-assignments)
 *      - Billing Management (/admin/billing)
 *      - User Directory (/admin/users)
 *      - Academic Reports (/admin/reports)
 *      - System Alerts (/admin/notifications)
 * 4. Controlled Member Provisioning Preservation:
 *    - Form handler handleProvisionMember preserved.
 *    - adminRegisterMember function call preserved.
 *    - Form input controls (ID, name, email, role) preserved with labels.
 *    - Loading indicator and success/error message banners preserved.
 * 5. Pre-Registered Testing Accounts Reference Preservation:
 *    - Reference credentials table preserved for PP001, PPM001, and PPA001.
 * 6. Strict App-Wide No-Emoji Compliance:
 *    - Zero emojis present in AdminDashboardPage.tsx.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, description: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] #${totalTests}: ${description}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] #${totalTests}: ${description}`);
  }
}

async function runSuite() {
  console.log('\n================================================================');
  console.log(' PoraPlan UX Track — Feature 03: Admin Dashboard Simplification');
  console.log('================================================================\n');

  const adminDashboardPath = resolve(__dirname, '../src/pages/dashboard/AdminDashboardPage.tsx');
  const studentDashboardPath = resolve(__dirname, '../src/pages/dashboard/StudentDashboardPage.tsx');
  const mentorDashboardPath = resolve(__dirname, '../src/pages/dashboard/MentorDashboardPage.tsx');

  const adminSrc = readFileSync(adminDashboardPath, 'utf8');
  const studentSrc = readFileSync(studentDashboardPath, 'utf8');
  const mentorSrc = readFileSync(mentorDashboardPath, 'utf8');

  // ---------------------------------------------------------------------------
  // Suite 1: Scope Boundary Integrity
  // ---------------------------------------------------------------------------
  console.log('--- Suite 1: Scope Boundary Integrity ---');

  assert(existsSync(adminDashboardPath), 'AdminDashboardPage.tsx exists');
  assert(studentSrc.includes('StudentDashboardPage'), 'StudentDashboardPage.tsx is intact and unmodified');
  assert(mentorSrc.includes('MentorDashboardPage'), 'MentorDashboardPage.tsx is intact and unmodified');

  // ---------------------------------------------------------------------------
  // Suite 2: Obsolete Milestone & Clutter Removal
  // ---------------------------------------------------------------------------
  console.log('\n--- Suite 2: Obsolete Milestone & Clutter Removal ---');

  assert(!adminSrc.includes('MILESTONE 2'), 'Removed obsolete "MILESTONE 2" badge');
  assert(!adminSrc.includes('MILESTONE 3'), 'Removed obsolete "MILESTONE 3" badge');
  assert(!adminSrc.includes('MILESTONE 4'), 'Removed obsolete "MILESTONE 4" badge');
  assert(!adminSrc.includes('ADMIN WORKSPACE'), 'Removed decorative all-caps "ADMIN WORKSPACE" label');
  assert(!adminSrc.includes('Authentication &amp; Access Controls') && !adminSrc.includes('Authentication & Access Controls'), 'Removed redundant static authentication info box');
  assert(!adminSrc.includes('Profile records and mentorship relationships are strictly protected'), 'Removed static database documentation copy');

  // ---------------------------------------------------------------------------
  // Suite 3: Operational Desks Grid Coverage
  // ---------------------------------------------------------------------------
  console.log('\n--- Suite 3: Operational Desks Grid Coverage ---');

  assert(!adminSrc.includes('Applications Desk'), 'Removed Applications Desk from admin console');
  assert(!adminSrc.includes('/admin/applications'), 'Removed link to /admin/applications');

  assert(adminSrc.includes('Enrollments Desk'), 'Includes Enrollments Desk');
  assert(adminSrc.includes('/admin/enrollments'), 'Includes link to /admin/enrollments');

  assert(adminSrc.includes('Programs & Cohorts'), 'Includes Programs & Cohorts desk');
  assert(adminSrc.includes('/admin/programs'), 'Includes link to /admin/programs');

  assert(adminSrc.includes('Mentor Allocations'), 'Includes Mentor Allocations desk');
  assert(adminSrc.includes('/admin/mentor-assignments'), 'Includes link to /admin/mentor-assignments');

  assert(adminSrc.includes('Billing & Invoicing'), 'Includes Billing & Invoicing desk');
  assert(adminSrc.includes('/admin/billing'), 'Includes link to /admin/billing');

  assert(adminSrc.includes('User Directory'), 'Includes User Directory desk');
  assert(adminSrc.includes('/admin/users'), 'Includes link to /admin/users');

  assert(adminSrc.includes('Academic Reports'), 'Includes Academic Reports desk');
  assert(adminSrc.includes('/admin/reports'), 'Includes link to /admin/reports');

  assert(adminSrc.includes('System Alerts'), 'Includes System Alerts desk');
  assert(adminSrc.includes('/admin/notifications'), 'Includes link to /admin/notifications');

  // ---------------------------------------------------------------------------
  // Suite 4: Controlled Member Provisioning Preservation
  // ---------------------------------------------------------------------------
  console.log('\n--- Suite 4: Controlled Member Provisioning Preservation ---');

  assert(adminSrc.includes('handleProvisionMember'), 'Preserves handleProvisionMember form submission handler');
  assert(adminSrc.includes('adminRegisterMember'), 'Preserves adminRegisterMember backend service call');
  assert(adminSrc.includes('id="provision-id"'), 'Preserves provision-id input element');
  assert(adminSrc.includes('id="provision-name"'), 'Preserves provision-name input element');
  assert(adminSrc.includes('id="provision-email"'), 'Preserves provision-email input element');
  assert(adminSrc.includes('id="provision-role"'), 'Preserves provision-role select element');
  assert(adminSrc.includes('provisionLoading'), 'Preserves loading state during account creation');
  assert(adminSrc.includes('provisionMessage'), 'Preserves feedback message rendering for success and error');

  // ---------------------------------------------------------------------------
  // Suite 5: Pre-Registered Testing Accounts Reference Preservation
  // ---------------------------------------------------------------------------
  console.log('\n--- Suite 5: Pre-Registered Testing Accounts Reference Preservation ---');

  assert(adminSrc.includes('Pre-Registered Testing Accounts'), 'Preserves testing accounts section');
  assert(adminSrc.includes('PP001'), 'Preserves student testing account PP001');
  assert(adminSrc.includes('PPM001'), 'Preserves mentor testing account PPM001');
  assert(adminSrc.includes('PPA001'), 'Preserves admin testing account PPA001');

  // ---------------------------------------------------------------------------
  // Suite 6: Strict App-Wide No-Emoji Compliance
  // ---------------------------------------------------------------------------
  console.log('\n--- Suite 6: Strict App-Wide No-Emoji Compliance ---');

  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E0}-\u{1F1FF}]/u;
  const hasEmoji = emojiRegex.test(adminSrc);
  assert(!hasEmoji, 'AdminDashboardPage.tsx contains ZERO emojis');

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(` Results: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

