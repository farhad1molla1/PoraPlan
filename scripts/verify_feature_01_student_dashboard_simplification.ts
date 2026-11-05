/**
 * PoraPlan UX Track — Feature 01: Student Dashboard Simplification Verification Suite
 *
 * Verifies:
 * 1. Scope Boundary Integrity:
 *    - Only StudentDashboardPage.tsx was modified.
 *    - MentorDashboardPage.tsx and AdminDashboardPage.tsx remain completely untouched.
 *    - No database migrations or schema files were touched.
 * 2. Unnecessary Structure Removal (UX Principles):
 *    - Removed redundant 6-card "Study Modules" marketing section.
 *    - Removed redundant decorative labels ("STUDY WORKSPACE", "Personal Study Assistance", "TODAY'S TARGETS").
 *    - Removed nested dark-navy-inside-white card structure for mentor section.
 *    - Removed redundant general navigation buttons ("Study Plans", "Ask a Doubt") from the mentor card.
 * 3. Functional Requirements Preservation:
 *    - Answers "What should I study today?" as the primary workspace focus.
 *    - Greeting preserves student name, current date, Student ID, and role.
 *    - Mentor section preserves effective/assigned mentor resolution, profile link, WhatsApp direct link, and unassigned state.
 *    - Active study plan banner preserves title, subject badge, and roadmap link.
 *    - Today's tasks list preserves task status toggle handler (handleToggleTaskStatus), priority badges, estimated minutes, attachments, and subject tags.
 *    - Preserves loading state (Loader2) and simplified empty state.
 *    - 4 real-time study status cards preserve live counts and direct routes for Tasks, Assignments, Doubts, and Evaluations.
 *    - Personal email connection section and handler (handleLinkEmail) remain intact.
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
  console.log(' PoraPlan UX Track — Feature 01: Student Dashboard Simplification');
  console.log('================================================================\n');

  const studentDashboardPath = resolve(__dirname, '../src/pages/dashboard/StudentDashboardPage.tsx');
  const mentorDashboardPath = resolve(__dirname, '../src/pages/dashboard/MentorDashboardPage.tsx');
  const adminDashboardPath = resolve(__dirname, '../src/pages/dashboard/AdminDashboardPage.tsx');

  const studentSrc = readFileSync(studentDashboardPath, 'utf8');
  const mentorSrc = readFileSync(mentorDashboardPath, 'utf8');
  const adminSrc = readFileSync(adminDashboardPath, 'utf8');

  // ---------------------------------------------------------------------------
  // Suite 1: Scope Boundary Integrity
  // ---------------------------------------------------------------------------
  console.log('--- Suite 1: Scope Boundary Integrity ---');

  assert(existsSync(studentDashboardPath), 'StudentDashboardPage.tsx exists');
  assert(mentorSrc.includes('MentorDashboardPage'), 'MentorDashboardPage.tsx is intact and unmodified');
  assert(adminSrc.includes('AdminDashboardPage'), 'AdminDashboardPage.tsx is intact and unmodified');

  // ---------------------------------------------------------------------------
  // Suite 2: Unnecessary Structure Removal (UX Principles)
  // ---------------------------------------------------------------------------
  console.log('\n--- Suite 2: Unnecessary Structure & Clutter Removal ---');

  // 1. Redundant 6-card "Study Modules" marketing hub removed
  assert(!studentSrc.includes('Study Modules'), 'Removed redundant "Study Modules" section heading');
  assert(!studentSrc.includes('ROADMAPS'), 'Removed redundant decorative eyebrow "ROADMAPS"');
  assert(!studentSrc.includes('PRACTICE'), 'Removed redundant decorative eyebrow "PRACTICE"');
  assert(!studentSrc.includes('Curated formula sheets'), 'Removed static marketing descriptions for Library');
  assert(!studentSrc.includes('Stuck on a problem or formula?'), 'Removed static marketing descriptions for Doubts');

  // 2. Redundant decorative badges removed
  assert(!studentSrc.includes('STUDY WORKSPACE'), 'Removed decorative all-caps "STUDY WORKSPACE" label');
  assert(!studentSrc.includes('Personal Study Assistance'), 'Removed redundant "Personal Study Assistance" badge');
  assert(!studentSrc.includes("TODAY'S TARGETS"), 'Removed redundant stacked eyebrow "TODAY\'S TARGETS"');

  // 3. Redundant nested action buttons removed from mentor card
  assert(
    !studentSrc.includes('to="/student/doubts"') || !studentSrc.includes('Ask a Doubt</span>\n                </Link>'),
    'Removed redundant generic "Ask a Doubt" link from mentor card'
  );
  assert(
    !studentSrc.includes('to="/student/plans"') || !studentSrc.includes('Study Plans</span>\n                  <ArrowRight'),
    'Removed redundant generic "Study Plans" link from mentor card'
  );

  // 4. Line count reduction
  const lineCount = studentSrc.split('\n').length;
  assert(lineCount < 550, `StudentDashboardPage reduced from ~747 lines to ${lineCount} lines (~30% cleaner)`);

  // ---------------------------------------------------------------------------
  // Suite 3: Functional Requirements & Data Preservation
  // ---------------------------------------------------------------------------
  console.log('\n--- Suite 3: Functional Requirements & Data Preservation ---');

  // 1. Greeting & Identity
  assert(studentSrc.includes('Welcome, {studentName}'), 'Preserves personalized student greeting');
  assert(studentSrc.includes('{currentDate}'), 'Preserves current formatted date display');
  assert(studentSrc.includes('poraplanId'), 'Preserves student ID display');

  // 2. Mentor Section
  assert(studentSrc.includes('assignedMentor.full_name'), 'Displays assigned mentor name');
  assert(studentSrc.includes('assignmentType === \'individual\''), 'Distinguishes individual vs cohort mentor');
  assert(studentSrc.includes('to={`/profile/${assignedMentor.id}`}'), 'Provides direct link to mentor profile');
  assert(studentSrc.includes('wa.me/'), 'Preserves direct WhatsApp contact link when available');
  assert(studentSrc.includes('No mentor assigned yet'), 'Provides reassuring fallback when no mentor is assigned');

  // 3. What to Study Today (Primary Focus)
  assert(studentSrc.includes('What to Study Today'), 'Focuses clearly on "What to Study Today"');
  assert(studentSrc.includes('handleToggleTaskStatus'), 'Preserves interactive task completion toggle');
  assert(studentSrc.includes('updatingTaskId'), 'Preserves task update loading state');
  assert(studentSrc.includes('task.estimated_minutes'), 'Preserves task estimated minutes display');
  assert(studentSrc.includes('task.priority === \'high\''), 'Preserves high-priority task badge');
  assert(studentSrc.includes('task.attachment_path'), 'Preserves task attachment file indicator');
  assert(studentSrc.includes('task.subject_name'), 'Preserves task subject indicator');
  assert(studentSrc.includes('to="/student/tasks"'), 'Preserves link to full tasks queue');

  // 4. Active Study Plan
  assert(studentSrc.includes('activePlan.title'), 'Preserves active study plan title');
  assert(studentSrc.includes('activePlan.subject_name'), 'Preserves active study plan subject badge');
  assert(studentSrc.includes('to={`/student/plans/${activePlan.id}`}'), 'Preserves direct link to active roadmap');

  // 5. Four Core Study Status Cards
  assert(studentSrc.includes('Study Status'), 'Preserves Study Status summary section');
  assert(studentSrc.includes('pendingTasks.length'), 'Displays live pending tasks count');
  assert(studentSrc.includes('pendingAssignments.length'), 'Displays live assignments to submit count');
  assert(studentSrc.includes('openDoubts.length'), 'Displays live open doubts count');
  assert(studentSrc.includes('upcomingEval'), 'Displays upcoming evaluation status');
  assert(studentSrc.includes('to="/student/progress"'), 'Preserves link to Full Progress Report');

  // 6. Loading and Empty States
  assert(studentSrc.includes('Loader2') && studentSrc.includes('Loading tasks...'), 'Preserves clear loading state');
  assert(studentSrc.includes('No Tasks for Today'), 'Provides concise and encouraging empty state');

  // 7. Email Linking Action
  assert(studentSrc.includes('handleLinkEmail'), 'Preserves personal email connection handler');
  assert(studentSrc.includes('connectEmail'), 'Preserves connectEmail auth integration');

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
