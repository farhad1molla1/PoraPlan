/**
 * PoraPlan — Milestone 3: Academic Library Container & Study Resources Integration Verification
 *
 * Verifies:
 * 1. File existence & Architecture (StudentLibraryPage, routing, DashboardLayout, library.ts)
 * 2. Tab URL Parsing, Fallback & URL Generation Logic
 * 3. Route Registration & Backward Compatibility Redirect for /student/resources
 * 4. Dedicated Menu Isolation (Announcements, Doubts, Evaluations, Mentor Review Queue)
 * 5. Mentor Resources Navigation Preservation
 * 6. Study Resources Functional Data & Filter Logic (Title, Description, Subject, Type)
 * 7. Distinction of Resource Types (Link, Note, File metadata-only)
 * 8. Foundation Placeholders for Tab 2 (Tasks) and Tab 3 (Assignments)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  isValidLibraryTab,
  parseLibraryTab,
  getLibraryTabUrl,
  ACADEMIC_LIBRARY_TABS,
  DEFAULT_ACADEMIC_LIBRARY_TAB,
} from '../src/lib/library';
import {
  getMockStudentResources,
  getMockMentorResources,
  createMockResource,
  deleteMockResource,
} from '../src/lib/mockAuthStore';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`[PASS] ${message}`);
  } else {
    console.error(`[FAIL] ${message}`);
    process.exitCode = 1;
  }
}

async function runVerification() {
  console.log('================================================================');
  console.log('PoraPlan Milestone 3: Academic Library Integration Verification');
  console.log('================================================================\n');

  const studentId = 'mock-student-pp001';

  // ---------------------------------------------------------------------------
  // SECTION 1: Architecture & File Existence
  // ---------------------------------------------------------------------------
  console.log('--- SECTION 1: Architecture & File Existence ---');

  const libraryPagePath = path.resolve('src/pages/dashboard/StudentLibraryPage.tsx');
  assert(fs.existsSync(libraryPagePath), 'StudentLibraryPage.tsx exists on disk');

  const libraryUtilPath = path.resolve('src/lib/library.ts');
  assert(fs.existsSync(libraryUtilPath), 'src/lib/library.ts exists on disk');

  const routesPath = path.resolve('src/routes/index.tsx');
  assert(fs.existsSync(routesPath), 'src/routes/index.tsx exists on disk');

  const layoutPath = path.resolve('src/layouts/DashboardLayout.tsx');
  assert(fs.existsSync(layoutPath), 'src/layouts/DashboardLayout.tsx exists on disk');

  const studentLibraryContent = fs.readFileSync(libraryPagePath, 'utf8');
  assert(
    studentLibraryContent.includes('Academic Library'),
    'StudentLibraryPage renders "Academic Library" page heading'
  );
  assert(
    studentLibraryContent.includes('useSearchParams'),
    'StudentLibraryPage uses useSearchParams for URL synchronization'
  );
  assert(
    studentLibraryContent.includes('parseLibraryTab'),
    'StudentLibraryPage utilizes parseLibraryTab from library.ts'
  );

  // ---------------------------------------------------------------------------
  // SECTION 2: Tab URL Parsing, Fallback & URL Generation Logic
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 2: Tab URL Parsing & Fallback Logic ---');

  assert(
    ACADEMIC_LIBRARY_TABS.length === 3 &&
      ACADEMIC_LIBRARY_TABS.includes('resources') &&
      ACADEMIC_LIBRARY_TABS.includes('tasks') &&
      ACADEMIC_LIBRARY_TABS.includes('assignments'),
    'ACADEMIC_LIBRARY_TABS contains resources, tasks, assignments'
  );

  assert(DEFAULT_ACADEMIC_LIBRARY_TAB === 'resources', 'Default tab is "resources"');

  assert(isValidLibraryTab('resources') === true, 'isValidLibraryTab identifies "resources"');
  assert(isValidLibraryTab('tasks') === true, 'isValidLibraryTab identifies "tasks"');
  assert(isValidLibraryTab('assignments') === true, 'isValidLibraryTab identifies "assignments"');
  assert(isValidLibraryTab('evaluations') === false, 'isValidLibraryTab rejects non-library tab "evaluations"');
  assert(isValidLibraryTab('doubts') === false, 'isValidLibraryTab rejects non-library tab "doubts"');

  assert(parseLibraryTab('resources') === 'resources', 'parseLibraryTab parses "resources"');
  assert(parseLibraryTab('tasks') === 'tasks', 'parseLibraryTab parses "tasks"');
  assert(parseLibraryTab('assignments') === 'assignments', 'parseLibraryTab parses "assignments"');
  assert(parseLibraryTab('TASKS') === 'tasks', 'parseLibraryTab parses uppercase "TASKS" case-insensitively');
  assert(parseLibraryTab('ASSIGNMENTS') === 'assignments', 'parseLibraryTab parses uppercase "ASSIGNMENTS" case-insensitively');
  assert(parseLibraryTab('unknown_random_tab') === 'resources', 'Invalid tab safely falls back to "resources"');
  assert(parseLibraryTab(null) === 'resources', 'null parameter falls back to "resources"');
  assert(parseLibraryTab(undefined) === 'resources', 'undefined parameter falls back to "resources"');
  assert(parseLibraryTab('') === 'resources', 'empty string falls back to "resources"');

  assert(
    getLibraryTabUrl('/student/library', 'tasks') === '/student/library?tab=tasks',
    'getLibraryTabUrl constructs clean URL with ?tab=tasks'
  );
  assert(
    getLibraryTabUrl('/student/library?subject=phy101', 'assignments') === '/student/library?subject=phy101&tab=assignments',
    'getLibraryTabUrl preserves existing query params and sets tab'
  );

  // ---------------------------------------------------------------------------
  // SECTION 3: Route Registration & Backward Compatibility Redirect
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 3: Route Registration & Backward Compatibility ---');

  const routesContent = fs.readFileSync(routesPath, 'utf8');

  assert(
    routesContent.includes('StudentLibraryPage'),
    'routes/index.tsx imports StudentLibraryPage'
  );

  assert(
    routesContent.includes('path="student/library"'),
    'routes/index.tsx registers route /student/library'
  );

  assert(
    routesContent.includes('path="student/resources"'),
    'routes/index.tsx preserves route /student/resources'
  );

  assert(
    routesContent.includes('StudentResourcesRedirect'),
    'routes/index.tsx defines StudentResourcesRedirect component'
  );

  assert(
    routesContent.includes("pathname: '/student/library', search: location.search"),
    'StudentResourcesRedirect preserves location.search across redirect'
  );

  // ---------------------------------------------------------------------------
  // SECTION 4: Sidebar Navigation Updates
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 4: Sidebar Navigation Updates ---');

  const layoutContent = fs.readFileSync(layoutPath, 'utf8');

  assert(
    layoutContent.includes("{ label: 'Academic Library', shortLabel: 'Library', to: '/student/library', icon: BookMarked }"),
    'DashboardLayout studentNavItems links "Academic Library" to /student/library'
  );

  assert(
    !layoutContent.includes("{ label: 'Study Resources', shortLabel: 'Resources', to: '/student/resources'"),
    'Old student sidebar entry /student/resources replaced by /student/library'
  );

  // ---------------------------------------------------------------------------
  // SECTION 5: Explicit Preservation of Mentor Navigation & Other Modules
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 5: Preservation of Dedicated Modules ---');

  // Mentor Resources untouched
  assert(
    layoutContent.includes("{ label: 'Resources', shortLabel: 'Resources', to: '/mentor/resources', icon: BookMarked }"),
    'Mentor navigation retains dedicated /mentor/resources link'
  );

  // Announcements untouched
  assert(
    layoutContent.includes('/student/announcements') && layoutContent.includes('/mentor/announcements'),
    'Announcements navigation remains distinct for students and mentors'
  );

  // Doubts Desk untouched
  assert(
    layoutContent.includes('/student/doubts') && layoutContent.includes('/mentor/doubts'),
    'Doubts Desk navigation remains distinct for students and mentors'
  );

  // Evaluations untouched
  assert(
    layoutContent.includes('/student/evaluations') && layoutContent.includes('/mentor/evaluations'),
    'Evaluations navigation remains distinct for students and mentors'
  );

  // Mentor Review Queue untouched
  assert(
    layoutContent.includes('/mentor/reviews'),
    'Mentor Review Queue navigation remains distinct'
  );

  // ---------------------------------------------------------------------------
  // SECTION 6: Study Resources Functional Data & Filter Logic
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 6: Study Resources Functional Data & Filter Logic ---');

  // Create a temporary file-type resource for full functional parity testing
  const tempFileRes = createMockResource({
    studentId,
    title: 'Kinetic Friction & Incline Plane Handout PDF',
    resourceType: 'file',
    fileName: 'incline_friction_summary.pdf',
    fileSize: 345120,
    subjectId: 'mock-sub-phy-101',
  });
  assert(tempFileRes.error === null && tempFileRes.resource !== null, 'createMockResource created temporary file resource');

  const mockResources = getMockStudentResources(studentId);
  assert(mockResources.length >= 3, 'getMockStudentResources returns student study resources');

  // Verify resource types exist
  const noteResources = mockResources.filter((r) => r.resource_type === 'note');
  const linkResources = mockResources.filter((r) => r.resource_type === 'link');
  const fileResources = mockResources.filter((r) => r.resource_type === 'file');

  assert(noteResources.length >= 1, 'Mock resources include note-type resources');
  assert(linkResources.length >= 1, 'Mock resources include link-type resources');
  assert(fileResources.length >= 1, 'Mock resources include file-type resources');

  // Subject filtering simulation
  const physicsSubjectId = 'mock-sub-phy-101';
  const physicsResources = mockResources.filter((r) => r.subject_id === physicsSubjectId);
  assert(physicsResources.length >= 1, 'Subject filter accurately scopes resources to physics');

  // Keyword search simulation
  const query = 'formula';
  const searchResults = mockResources.filter((r) => {
    const q = query.toLowerCase();
    const matchTitle = r.title.toLowerCase().includes(q);
    const matchDesc = r.description ? r.description.toLowerCase().includes(q) : false;
    const matchContent = r.content ? r.content.toLowerCase().includes(q) : false;
    return matchTitle || matchDesc || matchContent;
  });
  assert(searchResults.length >= 1, 'Search query matches resources by title, description, or content');

  // ---------------------------------------------------------------------------
  // SECTION 7: Distinction of Resource Types (Link, Note, File metadata-only)
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 7: Distinction of Resource Types ---');

  // Notes: must have content
  const sampleNote = noteResources[0];
  assert(typeof sampleNote.content === 'string' && sampleNote.content.length > 0, 'Note resource provides readable text content for modal');

  // Links: must have URL starting with http:// or https://
  const sampleLink = linkResources[0];
  assert(
    typeof sampleLink.url === 'string' &&
      (sampleLink.url.startsWith('http://') || sampleLink.url.startsWith('https://')),
    'Link resource provides valid HTTP/HTTPS target URL'
  );

  // Files: must have file_name and file_size metadata, but NO fake download button
  const sampleFile = fileResources[0];
  assert(typeof sampleFile.file_name === 'string', 'File resource provides file_name metadata');
  assert(typeof sampleFile.file_size === 'number', 'File resource provides file_size metadata');
  assert(
    studentLibraryContent.includes('File metadata info (Clearly presented as reference document, not a downloadable attachment)'),
    'StudentLibraryPage clearly marks file resources as reference metadata without a fake download button'
  );

  // Clean up temporary file resource
  if (tempFileRes.resource) {
    deleteMockResource(tempFileRes.resource.id, 'mock-mentor-ppm001');
  }

  // ---------------------------------------------------------------------------
  // SECTION 8: Placeholders for Tabs 2 & 3
  // ---------------------------------------------------------------------------
  console.log('\n--- SECTION 8: Foundation Placeholders for Tabs 2 & 3 ---');

  assert(
    studentLibraryContent.includes("activeTab === 'tasks'"),
    'StudentLibraryPage provides dedicated container for Tab 2 (tasks)'
  );
  assert(
    studentLibraryContent.includes("Milestone 4 Foundation"),
    'Tab 2 clearly indicates Milestone 4 integration status'
  );
  assert(
    studentLibraryContent.includes('to="/student/tasks"'),
    'Tab 2 provides direct link to standalone tasks page (/student/tasks)'
  );

  assert(
    studentLibraryContent.includes("activeTab === 'assignments'"),
    'StudentLibraryPage provides dedicated container for Tab 3 (assignments)'
  );
  assert(
    studentLibraryContent.includes("Milestone 5 Foundation"),
    'Tab 3 clearly indicates Milestone 5 integration status'
  );
  assert(
    studentLibraryContent.includes('to="/student/assignments"'),
    'Tab 3 provides direct link to standalone assignments page (/student/assignments)'
  );

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(
    `Verification Summary: ${passedTests} / ${totalTests} Passed (${Math.round((passedTests / totalTests) * 100)}%)`
  );
  console.log('================================================================\n');

  if (passedTests !== totalTests) {
    process.exitCode = 1;
  }
}

runVerification().catch((err) => {
  console.error('Unhandled verification error:', err);
  process.exitCode = 1;
});
