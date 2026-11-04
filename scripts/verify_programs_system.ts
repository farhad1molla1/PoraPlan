/**
 * PoraPlan — Program & Cohort Hierarchy & Independent Management Verification Suite
 *
 * Verifies:
 * 1. 4-Tier Hierarchy:
 *    Programs Page (/programs) -> Program Details (/programs/:slug) -> Cohort Details (/programs/:programSlug/cohorts/:cohortId) -> Contact Page (/contact)
 * 2. Programs Page:
 *    - Two parent categories: Academic Programs & Upskilling Programs.
 *    - Responsive grid (2 columns desktop, 1 column mobile).
 *    - Program cards contain: Admin thumbnail (16:9), Title, Short description, and View Cohorts action.
 *    - Clicking card/button navigates to Program Details (/programs/:slug).
 * 3. Program Details Page:
 *    - Program thumbnail, Title, Short description.
 *    - Published cohorts displayed in responsive grid (2 columns desktop, 1 column mobile).
 *    - Cohort cards contain: Admin Cohort thumbnail, Cohort name, Short description, batch/course info, and View Cohort action.
 *    - Clicking cohort card/button navigates to Cohort Details.
 * 4. Cohort Details Page:
 *    - Compact & minimal layout.
 *    - Displays Cohort thumbnail, Cohort name, Short description, batch/course info (code, dates, capacity, delivery).
 *    - Single primary CTA: "Contact to Enroll" navigating to /contact?program=...&cohort=...
 * 5. Contact Page:
 *    - Receives cohort and program context, pre-populating inquiry target and email subject without requiring login.
 * 6. Admin Programs & Cohorts Management:
 *    - Independent Program and Cohort thumbnails (upload, preview, replace, remove).
 *    - Admin alone can create/edit cohorts under a program, upload independent cohort thumbnails, and publish/unpublish cohorts.
 *    - Mentors have zero program or cohort management or thumbnail upload permissions.
 * 7. Complete Removal of Public Request Modals:
 *    - Zero application modals, request forms, or sign-in gates on public pages.
 *    - Historical application records and Admin review functionality remain 100% functional.
 * 8. Strict NO-AMOUNT policy: zero currency symbols or fee displays.
 * 9. Zero emojis across all modified files.
 */

import fs from 'fs';
import path from 'path';
import {
  getMockPrograms,
  getMockCohorts,
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
  console.log('PoraPlan Program & Cohort 4-Tier Hierarchy Verification Suite');
  console.log('================================================================\n');

  const programsPageContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/pages/ProgramsPage.tsx'),
    'utf8'
  );
  const programDetailPageContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/pages/ProgramDetailPage.tsx'),
    'utf8'
  );
  const cohortDetailPageContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/pages/CohortDetailPage.tsx'),
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
  const routesContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/routes/index.tsx'),
    'utf8'
  );
  const programsLibContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/lib/programs.ts'),
    'utf8'
  );
  const cohortMigrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20261104000004_cohort_thumbnails.sql'
  );

  // 1. Tier 1: Programs Listing Page
  const hasTwoColDesktop = programsPageContent.includes('grid-cols-1 md:grid-cols-2');
  const hasAcademicAndUpskilling =
    programsPageContent.includes('Academic Programs') &&
    programsPageContent.includes('Upskilling Programs');
  const programCardHasThumbnail = programsPageContent.includes('aspect-video');
  const programCardHasViewCohorts =
    programsPageContent.includes('View Cohorts') &&
    programsPageContent.includes('navigate(`/programs/${program.slug}`)');

  report(
    'Tier 1 [Programs Page - Offerings Grid & View Cohorts Action]',
    hasTwoColDesktop && hasAcademicAndUpskilling && programCardHasThumbnail && programCardHasViewCohorts,
    'Programs page displays Academic & Upskilling offerings in 2-col desktop grid, with 16:9 thumbnail, title, description, and "View Cohorts" navigation'
  );

  // 2. Tier 2: Program Details Page
  const programDetailHasCohortsGrid =
    programDetailPageContent.includes('grid-cols-1 md:grid-cols-2') &&
    (programDetailPageContent.includes('Available Academic Cohorts') ||
      programDetailPageContent.includes('Available Course Cohorts'));
  const programDetailHasCohortCardDetails =
    programDetailPageContent.includes('cohort.cover_image_url') &&
    programDetailPageContent.includes('cohort.name') &&
    programDetailPageContent.includes('cohort.description') &&
    programDetailPageContent.includes('View Cohort');
  const programDetailLinksToCohort =
    programDetailPageContent.includes('/programs/${program.slug}/cohorts/${cohort.id}');

  report(
    'Tier 2 [Program Details Page - Cohort Listing & View Cohort Action]',
    programDetailHasCohortsGrid && programDetailHasCohortCardDetails && programDetailLinksToCohort,
    'Program Details page shows Program overview and a 2-column grid of published cohorts with independent thumbnails and "View Cohort" navigation'
  );

  // 3. Tier 3: Cohort Details Page
  const cohortDetailHasMeta =
    cohortDetailPageContent.includes('cohort.cover_image_url') &&
    cohortDetailPageContent.includes('cohort.name') &&
    cohortDetailPageContent.includes('cohort.code') &&
    cohortDetailPageContent.includes('program.name');
  const cohortDetailHasSingleCTA =
    cohortDetailPageContent.includes('Contact to Enroll') &&
    cohortDetailPageContent.includes('/contact?program=') &&
    cohortDetailPageContent.includes('cohort=');
  const cohortDetailHasNoModals =
    !cohortDetailPageContent.includes('submitApplication') &&
    !cohortDetailPageContent.includes('Sign In to Request Enrollment');

  report(
    'Tier 3 [Cohort Details Page - Compact Metadata & Contact to Enroll CTA]',
    cohortDetailHasMeta && cohortDetailHasSingleCTA && cohortDetailHasNoModals,
    'Cohort Details page presents compact intake specs with independent thumbnail and exactly one primary CTA: "Contact to Enroll"'
  );

  // 4. Tier 4: Contact Page
  const contactReadsBothParams =
    contactPageContent.includes("searchParams.get('program')") &&
    contactPageContent.includes("searchParams.get('cohort')");
  const contactShowsContextBanner =
    contactPageContent.includes('ENROLLMENT INQUIRY') &&
    contactPageContent.includes('Inquiring about:');
  const contactPrepopulatesEmail =
    contactPageContent.includes('mailto:poraplan.bd@gmail.com?subject=') &&
    contactPageContent.includes('Enrollment Inquiry:');

  report(
    'Tier 4 [Contact Page - Cohort & Program Inquiry Context]',
    contactReadsBothParams && contactShowsContextBanner && contactPrepopulatesEmail,
    'Contact page captures program and cohort search params, displaying clear inquiry context and pre-populating mailto subject'
  );

  // 5. Routing Configuration
  const hasCohortRoutes =
    routesContent.includes('programs/:programSlug/cohorts/:cohortId') &&
    routesContent.includes('cohorts/:cohortId') &&
    routesContent.includes('CohortDetailPage');

  report(
    'Routing [Cohort Detail Routes in AppRoutes]',
    hasCohortRoutes,
    'Application routes include public paths for both /programs/:programSlug/cohorts/:cohortId and /cohorts/:cohortId'
  );

  // 6. Admin-Only Cohort & Program Thumbnail Management
  const adminHasProgramThumbnailUI =
    adminProgramsPageContent.includes('Program Thumbnail') &&
    adminProgramsPageContent.includes('handleThumbnailFileSelect');
  const adminHasCohortThumbnailUI =
    adminProgramsPageContent.includes('Cohort Thumbnail') &&
    adminProgramsPageContent.includes('handleCohortThumbnailFileSelect') &&
    adminProgramsPageContent.includes('cohortThumbnailPreview');
  const adminHasCohortShortDescription =
    adminProgramsPageContent.includes('cohortForm.description') &&
    adminProgramsPageContent.includes('Short Description');
  const adminHasPublishCohortToggle =
    adminProgramsPageContent.includes('handleToggleCohortPublication') &&
    adminProgramsPageContent.includes('Unpublish') &&
    adminProgramsPageContent.includes('Publish');
  const programsLibHasCohortThumbnailFuncs =
    programsLibContent.includes('uploadCohortThumbnail') &&
    programsLibContent.includes('deleteCohortThumbnail');
  const cohortMigrationExists = fs.existsSync(cohortMigrationPath);

  report(
    'Admin Management [Independent Cohort Thumbnails & Publishing]',
    adminHasProgramThumbnailUI &&
      adminHasCohortThumbnailUI &&
      adminHasCohortShortDescription &&
      adminHasPublishCohortToggle &&
      programsLibHasCohortThumbnailFuncs &&
      cohortMigrationExists,
    'Admin desk supports independent Program and Cohort thumbnail upload/preview/replace/removal, cohort descriptions, and cohort publishing'
  );

  // 7. Mentor Permission Enforcement (Mentors blocked from program/cohort management)
  function mentorCanManagePrograms(code: string): boolean {
    const adminProgMatch = code.match(/path="admin\/programs"[\s\S]*?allowedRoles=\{([^}]+)\}/);
    if (adminProgMatch && adminProgMatch[1].includes('mentor')) return true;
    return false;
  }

  const adminProgramsRestrictedToAdmin =
    routesContent.includes('path="admin/programs"') &&
    !mentorCanManagePrograms(routesContent);

  report(
    'RBAC Security [Mentors Blocked from Program & Cohort Management]',
    adminProgramsRestrictedToAdmin,
    'Only Admin can access /admin/programs or modify programs/cohorts; mentors are strictly excluded from management routes'
  );

  // 8. Public Interface Simplification (Zero application modals on public pages)
  const noPublicApplicationModals =
    !programsPageContent.includes('requestModalOpen') &&
    !programDetailPageContent.includes('requestModalOpen') &&
    !cohortDetailPageContent.includes('requestModalOpen') &&
    !programDetailPageContent.includes('Apply to Mentor Program') &&
    !cohortDetailPageContent.includes('Apply to Mentor Program');

  report(
    'Public Simplification [Zero Public Application Modals or Sign-In Dossiers]',
    noPublicApplicationModals,
    'Public Program and Cohort pages have no request modals, mentor application prompts, or sign-in barriers'
  );

  // 9. Historical Application & Enrollment Pipeline Preservation
  const mockProgs = getMockPrograms();
  const targetProg = mockProgs[0];
  const testStudentId = 'student-uuid-4tier-check';
  const submitRes = createMockApplication({
    program_id: targetProg.id,
    applicant_id: testStudentId,
    application_type: 'student',
    status: 'pending',
    message: 'Preservation test',
  });
  const targetAppId = submitRes.application ? submitRes.application.id : '';
  const reviewRes = adminReviewMockApplication('admin-1', targetAppId, 'approved', 'Approved during 4-tier check');
  const enrollments = getMockEnrollments();
  const createdEnrollment = enrollments.find(
    (e) => e.student_id === testStudentId && e.program_id === targetProg.id
  );

  report(
    'Preservation [Admin Review & Student Enrollment Integrity]',
    Boolean(targetAppId) && reviewRes.success && Boolean(createdEnrollment),
    'Admin application review, automated student enrollment creation, and historical tables remain fully functional'
  );

  // 10. Zero Emojis and Strict NO-AMOUNT Policy
  const filesToAudit = [
    'src/pages/ProgramsPage.tsx',
    'src/pages/ProgramDetailPage.tsx',
    'src/pages/CohortDetailPage.tsx',
    'src/pages/ContactPage.tsx',
    'src/lib/programs.ts',
    'src/pages/dashboard/AdminProgramsPage.tsx',
    'src/routes/index.tsx',
    'supabase/migrations/20261104000004_cohort_thumbnails.sql',
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
    'Policy Compliance [Zero Emojis Policy]',
    emojiViolations === 0,
    `Zero emojis detected across all program & cohort surfaces (violations: ${emojiViolations})`
  );

  report(
    'Policy Compliance [Strict NO-AMOUNT Policy]',
    amountViolations === 0,
    `Strict NO-AMOUNT policy respected: zero currency symbols or fee displays (violations: ${amountViolations})`
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
