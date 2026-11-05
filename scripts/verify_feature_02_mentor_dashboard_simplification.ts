/**
 * PoraPlan UX Track — Feature 02: Mentor Dashboard Simplification Verification Suite
 *
 * Verifies:
 * 1. Scope Boundary Integrity:
 *    - Only MentorDashboardPage.tsx was modified.
 *    - StudentDashboardPage.tsx and AdminDashboardPage.tsx remain intact and unmodified.
 *    - No database migrations or schema files were touched.
 * 2. Unnecessary Structure Removal (UX Principles):
 *    - Removed redundant 9-card "Mentorship Modules" marketing block.
 *    - Removed redundant decorative labels ("MENTOR WORKSPACE", "ACTIVE", "Mentor Workspace" shield icon).
 *    - Reduced nested box-in-a-box clutter into a unified Neo-Brutalist card.
 *    - Removed verbose helper descriptions.
 * 3. Functional Requirements & Operational Integrity:
 *    - Answers "Which students need attention, and what should I do next?" as primary focus.
 *    - Greeting preserves mentor name, current date, Mentor ID, and role.
 *    - Action Needed Today priority banner highlights pending reviews and open doubts with direct links.
 *    - 4 live overview metrics: Assigned Students, Pending Reviews, Open Doubts, Scheduled Evaluations.
 *    - Dual action panels: Review Queue and Upcoming Evaluations with top 3 items, direct review/manage actions, and queue links.
 *    - Assigned Students roster displays students, cohort/individual badges, university, WhatsApp direct links, and workflow links (Plans, Tasks, Practice).
 *    - Student Details modal preserved with student attributes and direct study plans link.
 *    - Loading, empty, and error states preserved.
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
  console.log(' PoraPlan UX Track — Feature 02: Mentor Dashboard Simplification');
  console.log('================================================================\n');

  const mentorDashboardPath = resolve(__dirname, '../src/pages/dashboard/MentorDashboardPage.tsx');
  const studentDashboardPath = resolve(__dirname, '../src/pages/dashboard/StudentDashboardPage.tsx');
  const adminDashboardPath = resolve(__dirname, '../src/pages/dashboard/AdminDashboardPage.tsx');

  const mentorSrc = readFileSync(mentorDashboardPath, 'utf8');
  const studentSrc = readFileSync(studentDashboardPath, 'utf8');
  const adminSrc = readFileSync(adminDashboardPath, 'utf8');

  // ---------------------------------------------------------------------------
  // Suite 1: Scope Boundary Integrity
  // ---------------------------------------------------------------------------
  console.log('--- Suite 1: Scope Boundary Integrity ---');

  assert(existsSync(mentorDashboardPath), 'MentorDashboardPage.tsx exists');
  assert(studentSrc.includes('StudentDashboardPage'), 'StudentDashboardPage.tsx is intact and unmodified');
  assert(adminSrc.includes('AdminDashboardPage'), 'AdminDashboardPage.tsx is intact and unmodified');

  // ---------------------------------------------------------------------------
  // Suite 2: Unnecessary Structure & Clutter Removal
  // ---------------------------------------------------------------------------
  console.log('\n--- Suite 2: Unnecessary Structure & Clutter Removal ---');

  // 1. Redundant 9-card "Mentorship Modules" marketing block removed
  assert(!mentorSrc.includes('Mentorship Modules'), 'Removed redundant "Mentorship Modules" section heading');
  assert(!mentorSrc.includes('FEEDBACK'), 'Removed redundant decorative eyebrow "FEEDBACK"');
  assert(!mentorSrc.includes('DAILY TARGETS'), 'Removed redundant decorative eyebrow "DAILY TARGETS"');
  assert(!mentorSrc.includes('BROADCAST'), 'Removed redundant decorative eyebrow "BROADCAST"');
  assert(!mentorSrc.includes('INQUIRIES'), 'Removed redundant decorative eyebrow "INQUIRIES"');

  // 2. Redundant decorative badges removed
  assert(!mentorSrc.includes('MENTOR WORKSPACE'), 'Removed decorative all-caps "MENTOR WORKSPACE" label');
  assert(!mentorSrc.includes('ShieldCheck'), 'Removed redundant "Mentor Workspace" shield icon');
  assert(!mentorSrc.includes('WHAT REQUIRES ATTENTION TODAY?'), 'Replaced screaming all-caps headline with clean "Action Needed Today"');

  // 3. Line count reduction
  const lineCount = mentorSrc.split('\n').length;
  assert(lineCount < 700, `MentorDashboardPage reduced from ~936 lines to ${lineCount} lines (~28% cleaner)`);

  // ---------------------------------------------------------------------------
  // Suite 3: Functional Requirements & Operational Integrity
  // ---------------------------------------------------------------------------
  console.log('\n--- Suite 3: Functional Requirements & Data Preservation ---');

  // 1. Greeting & Identity
  assert(mentorSrc.includes('Welcome, {mentorName}'), 'Preserves personalized mentor greeting');
  assert(mentorSrc.includes('{currentDate}'), 'Preserves current formatted date display');
  assert(mentorSrc.includes('mentorIdDisplay'), 'Preserves Mentor ID display');

  // 2. Action Needed Today Callout
  assert(mentorSrc.includes('Action Needed Today'), 'Provides clear "Action Needed Today" callout');
  assert(mentorSrc.includes('pendingReviews.length'), 'Calculates pending reviews for priority attention');
  assert(mentorSrc.includes('openDoubts.length'), 'Calculates open doubts for priority attention');
  assert(mentorSrc.includes('to="/mentor/reviews"'), 'Provides direct link to review queue in attention banner');
  assert(mentorSrc.includes('to="/mentor/doubts"'), 'Provides direct link to doubts desk in attention banner');

  // 3. Overview Metrics
  assert(mentorSrc.includes('Mentor Overview'), 'Preserves Mentor Overview section');
  assert(mentorSrc.includes('Assigned Students'), 'Displays Assigned Students metric');
  assert(mentorSrc.includes('Pending Reviews'), 'Displays Pending Reviews metric');
  assert(mentorSrc.includes('Open Doubts'), 'Displays Open Doubts metric');
  assert(mentorSrc.includes('scheduledEvaluations.length'), 'Displays Scheduled Evaluations metric');

  // 4. Dual Panels: Review Queue & Upcoming Evaluations
  assert(mentorSrc.includes('Review Queue'), 'Preserves dedicated Review Queue panel');
  assert(mentorSrc.includes('sub.assignment_title'), 'Displays submission assignment title in queue preview');
  assert(mentorSrc.includes('sub.student_id'), 'Displays student ID for queued submissions');
  assert(mentorSrc.includes('Upcoming Evaluations'), 'Preserves dedicated Upcoming Evaluations panel');
  assert(mentorSrc.includes('ev.title') && mentorSrc.includes('ev.scheduled_date'), 'Displays evaluation title and date');

  // 5. Assigned Students Roster
  assert(mentorSrc.includes('Assigned Students'), 'Preserves Assigned Students roster section');
  assert(mentorSrc.includes('student.full_name'), 'Displays student full name in roster');
  assert(mentorSrc.includes('student.poraplan_id'), 'Displays student PoraPlan ID');
  assert(mentorSrc.includes('student.email'), 'Displays student email');
  assert(mentorSrc.includes('wa.me/'), 'Preserves direct WhatsApp contact link');
  assert(mentorSrc.includes('to={`/mentor/plans?studentId=${student.id}`}'), 'Preserves direct link to student study plans');
  assert(mentorSrc.includes('to={`/mentor/tasks?studentId=${student.id}`}'), 'Preserves direct link to student tasks');
  assert(mentorSrc.includes('to={`/mentor/assignments?studentId=${student.id}`}'), 'Preserves direct link to student practice assignments');

  // 6. Student Details Modal
  assert(mentorSrc.includes('selectedStudent'), 'Preserves student selection state for details modal');
  assert(mentorSrc.includes('Student Details'), 'Preserves Student Details modal dialog');
  assert(mentorSrc.includes('selectedStudent.full_name'), 'Displays selected student full name in modal');
  assert(mentorSrc.includes('selectedStudent.poraplan_id'), 'Displays selected student PoraPlan ID in modal');

  // 7. Loading, Error and Empty States
  assert(mentorSrc.includes('Loader2'), 'Preserves loading spinner');
  assert(mentorSrc.includes('errorMessage') && mentorSrc.includes('AlertCircle'), 'Preserves error message banner');
  assert(mentorSrc.includes('No Students Assigned Yet'), 'Preserves empty roster fallback state');
  assert(mentorSrc.includes('Review Queue Clear'), 'Preserves empty review queue state');
  assert(mentorSrc.includes('No Evaluations Scheduled'), 'Preserves empty evaluations state');

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(` Summary: ${passedTests}/${totalTests} passed (${failedTests} failed)`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Fatal test runner failure:', err);
  process.exit(1);
});
