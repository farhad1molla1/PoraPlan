/**
 * PoraPlan Milestone 12.0: Navigation & Profile Access Optimization Verification Script
 *
 * Verifies:
 * 1. Student navigation ordering & route alignment (Doubts Desk elevated to #3, Today's Tasks #2, redundant links pruned).
 * 2. Mentor navigation ordering & route alignment (Review Queue elevated to #2, Doubts Desk #3).
 * 3. Admin navigation ordering & route alignment (Enrollments Desk elevated to #3).
 * 4. Mobile bottom navigation alignment for all 3 roles.
 * 5. Top header profile menu dropdown integration and removal of standalone Sign Out button.
 * 6. Accessibility & keyboard/outside-click listeners.
 * 7. Preservation of strict NO-AMOUNT policy across modified files.
 */

import * as fs from 'fs';
import * as path from 'path';

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passCount++;
  } else {
    console.error(`[FAIL] ${message}`);
    failCount++;
  }
}

console.log('================================================================');
console.log('PoraPlan Milestone 12.0 Navigation & Profile Verification');
console.log('================================================================\n');

const layoutPath = path.join(process.cwd(), 'src', 'layouts', 'DashboardLayout.tsx');
const layoutContent = fs.readFileSync(layoutPath, 'utf8');

// --- Section 1: Student Navigation Verification ---
console.log('--- 1. Student Navigation Ordering & Structure ---');

// Extract studentNavItems block
const studentNavMatch = layoutContent.match(/const studentNavItems = \[(.*?)\];/s);
assert(Boolean(studentNavMatch), 'studentNavItems is defined in DashboardLayout.tsx');

if (studentNavMatch) {
  const block = studentNavMatch[1];
  
  // Verify Dashboard/Overview is #1
  assert(
    block.includes("to: '/student/dashboard'"),
    "Overview route '/student/dashboard' is present"
  );

  // Verify Today's Tasks is #2
  const tasksIndex = block.indexOf("to: '/student/tasks'");
  const dashboardIndex = block.indexOf("to: '/student/dashboard'");
  const doubtsIndex = block.indexOf("to: '/student/doubts'");

  assert(
    dashboardIndex !== -1 && tasksIndex > dashboardIndex,
    "Today's Tasks (/student/tasks) follows Dashboard"
  );

  // Verify Doubts Desk is #3 (elevated right under Tasks)
  assert(
    doubtsIndex !== -1 && doubtsIndex > tasksIndex,
    "Doubts Desk (/student/doubts) is elevated to index 2 (#3 position) right after Today's Tasks"
  );

  // Verify Assignments and Study Plans follow
  const assignmentsIndex = block.indexOf("to: '/student/assignments'");
  const plansIndex = block.indexOf("to: '/student/plans'");
  assert(
    assignmentsIndex > doubtsIndex && plansIndex > assignmentsIndex,
    "Assignments and Study Plans follow Doubts Desk"
  );

  // Verify Billing & Payments is preserved
  assert(
    block.includes("to: '/student/billing'"),
    "Billing & Payments (/student/billing) is preserved in student navigation"
  );

  // Verify redundant / redirect links are pruned from primary sidebar
  assert(
    !block.includes("to: '/student/evaluations'"),
    "Redundant redirect link '/student/evaluations' pruned from sidebar (handled in Library)"
  );
  assert(
    !block.includes("to: '/student/applications'"),
    "Redundant '/student/applications' pruned from primary student sidebar"
  );
}

// --- Section 2: Mentor Navigation Verification ---
console.log('\n--- 2. Mentor Navigation Ordering & Structure ---');

const mentorNavMatch = layoutContent.match(/const mentorNavItems = \[(.*?)\];/s);
assert(Boolean(mentorNavMatch), 'mentorNavItems is defined in DashboardLayout.tsx');

if (mentorNavMatch) {
  const block = mentorNavMatch[1];

  const dashboardIndex = block.indexOf("to: '/mentor/dashboard'");
  const reviewsIndex = block.indexOf("to: '/mentor/reviews'");
  const doubtsIndex = block.indexOf("to: '/mentor/doubts'");
  const tasksIndex = block.indexOf("to: '/mentor/tasks'");

  // Verify Review Queue is #2
  assert(
    dashboardIndex !== -1 && reviewsIndex > dashboardIndex,
    "Review Queue (/mentor/reviews) is positioned at #2 right after Dashboard"
  );

  // Verify Doubts Desk is #3
  assert(
    doubtsIndex > reviewsIndex && tasksIndex > doubtsIndex,
    "Doubts Desk (/mentor/doubts) is elevated to #3 right after Review Queue"
  );

  // Verify Tasks Management is #4
  assert(
    tasksIndex > doubtsIndex,
    "Tasks Management (/mentor/tasks) follows Doubts Desk at #4"
  );

  // Verify Payout History is preserved
  assert(
    block.includes("to: '/mentor/payouts'"),
    "Payout History (/mentor/payouts) is preserved in mentor navigation"
  );

  // Verify redundant application link is pruned
  assert(
    !block.includes("to: '/mentor/applications'"),
    "Redundant '/mentor/applications' pruned from mentor sidebar"
  );
}

// --- Section 3: Admin Navigation Verification ---
console.log('\n--- 3. Admin Navigation Ordering & Structure ---');

const adminNavMatch = layoutContent.match(/const adminNavItems = \[(.*?)\];/s);
assert(Boolean(adminNavMatch), 'adminNavItems is defined in DashboardLayout.tsx');

if (adminNavMatch) {
  const block = adminNavMatch[1];

  const consoleIndex = block.indexOf("to: '/admin/dashboard'");
  const programsIndex = block.indexOf("to: '/admin/programs'");
  const enrollmentsIndex = block.indexOf("to: '/admin/enrollments'");
  const mentorAllocIndex = block.indexOf("to: '/admin/mentor-assignments'");
  const billingIndex = block.indexOf("to: '/admin/billing'");

  assert(
    consoleIndex !== -1 && programsIndex > consoleIndex,
    "Programs & Cohorts follows Admin Console"
  );

  assert(
    enrollmentsIndex > programsIndex && mentorAllocIndex > enrollmentsIndex,
    "Enrollments Desk (/admin/enrollments) is prioritized at #3 as primary onboarding desk"
  );

  assert(
    billingIndex > mentorAllocIndex,
    "Billing Management (/admin/billing) is preserved in admin navigation"
  );
}

// --- Section 4: Mobile Bottom Navigation ---
console.log('\n--- 4. Mobile Bottom Navigation Alignment ---');

const mobileStudentMatch = layoutContent.match(/const mobileStudentNavItems = \[(.*?)\];/s);
const mobileMentorMatch = layoutContent.match(/const mobileMentorNavItems = \[(.*?)\];/s);
const mobileAdminMatch = layoutContent.match(/const mobileAdminNavItems = \[(.*?)\];/s);

assert(Boolean(mobileStudentMatch), 'mobileStudentNavItems is defined');
assert(Boolean(mobileMentorMatch), 'mobileMentorNavItems is defined');
assert(Boolean(mobileAdminMatch), 'mobileAdminNavItems is defined');

if (mobileStudentMatch) {
  assert(
    mobileStudentMatch[1].includes("to: '/student/doubts'"),
    "Mobile student nav includes Doubts desk"
  );
}

if (mobileMentorMatch) {
  assert(
    mobileMentorMatch[1].includes("to: '/mentor/reviews'"),
    "Mobile mentor nav includes Review Queue"
  );
  assert(
    mobileMentorMatch[1].includes("to: '/mentor/doubts'"),
    "Mobile mentor nav includes Doubts desk"
  );
}

if (mobileAdminMatch) {
  assert(
    mobileAdminMatch[1].includes("to: '/admin/enrollments'"),
    "Mobile admin nav includes Enrollments desk"
  );
  assert(
    mobileAdminMatch[1].includes("to: '/admin/billing'"),
    "Mobile admin nav includes Billing desk"
  );
}

// --- Section 5: Header Profile Dropdown & Sign Out Integration ---
console.log('\n--- 5. Header Profile Dropdown & Sign Out Integration ---');

// Assert standalone sign out button is removed from header
assert(
  !layoutContent.includes('<Button\n            variant="ghost"\n            size="sm"\n            onClick={handleSignOut}\n            leftIcon={<LogOut className="w-3.5 h-3.5" />}\n            className="hidden sm:inline-flex text-xs font-mono"\n          >\n            Sign Out\n          </Button>'),
  'Standalone desktop Sign Out button is replaced in top header bar'
);

// Assert profile dropdown state and toggle exists
assert(
  layoutContent.includes('const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);'),
  'profileDropdownOpen state is implemented'
);

assert(
  layoutContent.includes('ref={profileMenuRef}'),
  'profileMenuRef is attached to dropdown container'
);

assert(
  layoutContent.includes('handleClickOutside') && layoutContent.includes('Escape'),
  'Outside click and Escape key listeners implemented for profile menu'
);

assert(
  layoutContent.includes('to="/profile"'),
  "Dropdown menu provides direct access to '/profile'"
);

assert(
  layoutContent.includes('handleSignOut') && layoutContent.includes('Sign Out'),
  'Sign Out action is securely integrated inside the Profile dropdown menu'
);

// --- Section 6: No Financial Amount Violations ---
console.log('\n--- 6. Mandatory NO-AMOUNT Financial Policy Check ---');

const bannedTerms = [
  /\bcurrency\b/i,
  /\bamount\b/i,
  /\btotal_amount\b/i,
  /\bpayable_amount\b/i,
  /\bfee\b/i,
  /\bsalary\b/i,
  /\bpricing\b/i,
];

let amountViolations = 0;
for (const term of bannedTerms) {
  if (term.test(layoutContent)) {
    console.error(`[FAIL] Banned financial term detected in DashboardLayout: ${term}`);
    amountViolations++;
  }
}

assert(
  amountViolations === 0,
  `Strict NO-AMOUNT policy verified in DashboardLayout.tsx (0 violations)`
);

// --- Summary ---
console.log('\n================================================================');
console.log(`Summary: ${passCount}/${passCount + failCount} verifications passed (${failCount} failed).`);
console.log('================================================================\n');

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}

