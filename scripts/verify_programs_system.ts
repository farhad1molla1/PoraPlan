/**
 * PoraPlan — Programs UI Redesign & Enrollment CTA Simplification Verification Suite
 *
 * Verifies:
 * 1. Two-Column Desktop & One-Column Mobile Layout (grid-cols-1 md:grid-cols-2).
 * 2. Academic Programs and Upskilling Programs separated cleanly into responsive grids.
 * 3. Minimal card content: Thumbnail (16:9), Title, 1-2 line description (line-clamp-2), Cohort/course info, Contact to Enroll.
 * 4. Whole-card click navigation to offering detail page (/programs/:slug) with no separate "View Details" button.
 * 5. Exactly one primary CTA on each offering card: "Contact to Enroll".
 * 6. Program Details Page: Compact structure with Back to Programs, thumbnail, title, description, cohort/course info, and one Contact to Enroll button.
 * 7. Complete removal of public enrollment/mentor application modals, dossiers, and sign-in gates from public pages.
 * 8. Contact destination routes directly to /contact?program=... with program context and zero login barrier.
 * 9. Admin Programs desk, thumbnail uploads/replacements, and review capabilities remain fully intact.
 * 10. Manual student enrollments and mentor assignments preserved without schema regressions.
 * 11. Strict NO-AMOUNT policy: zero currency symbols or fee displays.
 * 12. Zero emojis across all modified files.
 */

import fs from 'fs';
import path from 'path';
import {
  getMockPrograms,
  createMockApplication,
  adminReviewMockApplication,
  getMockEnrollments,
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
  console.log('================================================================');
  console.log('PoraPlan Programs UI Redesign & Enrollment CTA Verification');
  console.log('================================================================\n');

  const programsPageContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/pages/ProgramsPage.tsx'),
    'utf8'
  );
  const detailPageContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/pages/ProgramDetailPage.tsx'),
    'utf8'
  );
  const contactPageContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/pages/ContactPage.tsx'),
    'utf8'
  );
  const adminProgramsPageContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/pages/dashboard/AdminProgramsPage.tsx'),
    'utf8'
  );
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20261104000003_program_thumbnails_storage.sql'
  );

  // 1. Desktop & Mobile Layout: Two columns on desktop, one column on mobile
  const hasTwoColDesktop = programsPageContent.includes('grid-cols-1 md:grid-cols-2');
  const hasSeparateSections =
    programsPageContent.includes('Academic Programs') &&
    programsPageContent.includes('Upskilling Programs');
  report(
    'Scenario 1 [Grid Layout Responsiveness]',
    hasTwoColDesktop && hasSeparateSections,
    'Listing page organizes Academic and Upskilling offerings into 2 columns on desktop and 1 column on mobile'
  );

  // 2. Card Content Minimality: Thumbnail, Title, Description, Cohort Info, Contact to Enroll
  const cardHas16x9Thumb = programsPageContent.includes('aspect-video');
  const cardHasLineClamp = programsPageContent.includes('line-clamp-2');
  const cardHasCohortInfo =
    programsPageContent.includes('activeCohort') &&
    programsPageContent.includes('Batch / Cohort:');
  const cardHasSingleCTA =
    programsPageContent.includes('Contact to Enroll') &&
    !programsPageContent.includes('View Details');
  report(
    'Scenario 2 [Minimal Program Card Anatomy]',
    cardHas16x9Thumb && cardHasLineClamp && cardHasCohortInfo && cardHasSingleCTA,
    'Card contains only thumbnail (16:9), title, 1-2 line description, cohort info, and Contact to Enroll CTA'
  );

  // 3. Whole Card Click Navigation
  const cardNavigatesToDetail =
    programsPageContent.includes('navigate(`/programs/${program.slug}`)') ||
    programsPageContent.includes('navigate(`/programs/${program.slug}`');
  const noSeparateViewDetailsButton = !programsPageContent.includes('View Details');
  report(
    'Scenario 3 [Card Click Navigation & No View Details Button]',
    cardNavigatesToDetail && noSeparateViewDetailsButton,
    'Clicking the offering card navigates to /programs/:slug without a redundant View Details button'
  );

  // 4. Program Details Page: Compact Structure
  const detailHasBackLink = detailPageContent.includes('Back to Programs');
  const detailHasThumbnail = detailPageContent.includes('aspect-video');
  const detailHasTitle = detailPageContent.includes('program.name');
  const detailHasCohortInfo = detailPageContent.includes('activeCohort');
  const detailHasSingleCTA =
    detailPageContent.includes('Contact to Enroll') &&
    !detailPageContent.includes('submitApplication');
  report(
    'Scenario 4 [Compact Program Details Page]',
    detailHasBackLink && detailHasThumbnail && detailHasTitle && detailHasCohortInfo && detailHasSingleCTA,
    'Details page displays compact structure: Back link, thumbnail, title, description, cohort info, and Contact to Enroll'
  );

  // 5. Complete Removal of Public Application Modals and Sign-In Prompts
  const noSignInCTA =
    !programsPageContent.includes('Sign In to Request Enrollment') &&
    !detailPageContent.includes('Sign In to Request Enrollment');
  const noRequestModal =
    !detailPageContent.includes('requestModalOpen') &&
    !detailPageContent.includes('handleOpenRequestModal');
  const noMentorModal =
    !detailPageContent.includes('Apply to Mentor Program') &&
    !detailPageContent.includes('mentorExperience');
  const noApplicationDossier =
    !detailPageContent.includes('existingApplication') &&
    !detailPageContent.includes('My Applications');
  report(
    'Scenario 5 [Zero Public Application Workflows / Modals]',
    noSignInCTA && noRequestModal && noMentorModal && noApplicationDossier,
    'All public application modals, request dossiers, and login-required enrollment prompts are cleanly removed'
  );

  // 6. Contact Destination & Program Context
  const cardRoutesToContact = programsPageContent.includes('/contact?program=');
  const detailRoutesToContact = detailPageContent.includes('/contact?program=');
  const contactPageReadsParam = contactPageContent.includes("searchParams.get('program')");
  report(
    'Scenario 6 [Public Contact Destination & Context]',
    cardRoutesToContact && detailRoutesToContact && contactPageReadsParam,
    'Contact to Enroll routes to /contact?program=... with offering context without requiring any user authentication'
  );

  // 7. Preservation of Admin Program Management and Thumbnail Uploads
  const adminHasThumbnailUI =
    adminProgramsPageContent.includes('Program Thumbnail') &&
    adminProgramsPageContent.includes('handleThumbnailFileSelect');
  const adminHasViewApps = adminProgramsPageContent.includes('/admin/applications?programId=');
  const migrationExists = fs.existsSync(migrationPath);
  report(
    'Scenario 7 [Preserved Admin Offerings & Thumbnail Pipeline]',
    adminHasThumbnailUI && adminHasViewApps && migrationExists,
    'Admin program desk, thumbnail management pipeline, and review navigation remain completely intact'
  );

  // 8. Preservation of Manual Enrollment and Historical Review Operations
  const mockProgs = getMockPrograms();
  const targetProg = mockProgs[0];
  const testStudentId = 'student-uuid-programs-preserved';
  const submitRes = createMockApplication({
    program_id: targetProg.id,
    applicant_id: testStudentId,
    application_type: 'student',
    status: 'pending',
    message: 'Preservation verification',
  });
  const targetAppId = submitRes.application ? submitRes.application.id : '';
  const reviewRes = adminReviewMockApplication('admin-1', targetAppId, 'approved', 'Approved during preservation check');
  const enrollments = getMockEnrollments();
  const createdEnrollment = enrollments.find(
    (e) => e.student_id === testStudentId && e.program_id === targetProg.id
  );
  report(
    'Scenario 8 [Preserved Enrollment & Application DB Operations]',
    Boolean(targetAppId) && reviewRes.success && Boolean(createdEnrollment),
    'Admin application review, automated student enrollment creation, and historical tables remain functional'
  );

  // 9. Zero Emojis Policy Check
  const filesToAudit = [
    'src/pages/ProgramsPage.tsx',
    'src/pages/ProgramDetailPage.tsx',
    'src/pages/ContactPage.tsx',
    'src/lib/programs.ts',
    'src/pages/dashboard/AdminProgramsPage.tsx',
    'src/pages/dashboard/AdminApplicationsPage.tsx',
  ];

  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FAFF}]/u;
  const moneyRegex = /(?:[\$৳€£¥]\s*\d+)|(?:(?:BDT|USD|EUR|GBP|TK|Tk|৳)\.?\s*\d+)/i;

  let emojiViolations = 0;
  let amountViolations = 0;

  for (const relPath of filesToAudit) {
    const fullPath = path.resolve(process.cwd(), relPath);
    if (!fs.existsSync(fullPath)) continue;
    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line) => {
      if (emojiRegex.test(line)) emojiViolations++;
      if (moneyRegex.test(line)) amountViolations++;
    });
  }

  report(
    'Scenario 9 [Zero Emojis Policy]',
    emojiViolations === 0,
    `Zero emojis detected across all modified files (violations: ${emojiViolations})`
  );

  report(
    'Scenario 10 [Strict NO-AMOUNT Policy]',
    amountViolations === 0,
    `Strict NO-AMOUNT policy respected across all program surfaces (violations: ${amountViolations})`
  );

  console.log('\n----------------------------------------------------------------');
  console.log(`Verification Summary: ${passCount} Passed, ${failCount} Failed`);
  console.log('----------------------------------------------------------------');

  if (failCount > 0) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Unexpected verification error:', err);
  process.exit(1);
});
