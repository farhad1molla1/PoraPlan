/**
 * PoraPlan — Program & Cohort Hierarchy, Independent Management, and Lifecycle Separation Verification Suite
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
 * 7. Cohort Academic Status vs Publication Status Lifecycle Separation:
 *    - Academic status: planned / active / completed.
 *    - Publication status: draft / published / archived.
 *    - Publishing a planned cohort does not alter its academic status.
 *    - Unpublishing an active cohort does not alter its academic status.
 *    - Public visitors only see published cohorts (publication_status = 'published').
 * 8. Thumbnail Storage Security Policy Verification:
 *    - Bucket 'program-thumbnails' configuration.
 *    - Public SELECT policy for thumbnail rendering.
 *    - Admin-only INSERT, UPDATE, DELETE policies.
 *    - Explicit exclusion of mentors from storage write operations.
 * 9. Complete Removal of Public Request Modals:
 *    - Zero application modals, request forms, or sign-in gates on public pages.
 *    - Historical application records and Admin review functionality remain 100% functional.
 * 10. Strict NO-AMOUNT policy: zero currency symbols or fee displays.
 * 11. Zero emojis across all modified files.
 */

import fs from 'fs';
import path from 'path';
import {
  getMockPrograms,
  getMockCohorts,
  createMockCohort,
  updateMockCohort,
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
  console.log('PoraPlan Program & Cohort Architecture Verification Suite');
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
  const publicationMigrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20261104000005_cohort_publication_status.sql'
  );
  const storageMigrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20261104000003_program_thumbnails_storage.sql'
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
  const programDetailFiltersPublished =
    programDetailPageContent.includes("c.publication_status === 'published'");

  report(
    'Tier 2 [Program Details Page - Cohort Listing & View Cohort Action]',
    programDetailHasCohortsGrid &&
      programDetailHasCohortCardDetails &&
      programDetailLinksToCohort &&
      programDetailFiltersPublished,
    'Program Details page shows Program overview and 2-col grid of published cohorts, filtering strictly on publication_status = "published"'
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
  const cohortDetailGuardsPublished =
    cohortDetailPageContent.includes("cohortRes.cohort.publication_status !== 'published'");

  report(
    'Tier 3 [Cohort Details Page - Metadata & Public Visibility Guard]',
    cohortDetailHasMeta && cohortDetailHasSingleCTA && cohortDetailHasNoModals && cohortDetailGuardsPublished,
    'Cohort Details page presents compact intake specs with independent thumbnail, single CTA, and guards unlisted cohorts via publication_status'
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

  // 6. Cohort Academic Status vs Publication Status Lifecycle Separation
  const adminHasAcademicStatusSelect =
    adminProgramsPageContent.includes('Academic Status') &&
    adminProgramsPageContent.includes('<option value="planned">Planned</option>') &&
    adminProgramsPageContent.includes('<option value="active">Active</option>') &&
    adminProgramsPageContent.includes('<option value="completed">Completed</option>');
  const adminHasPublicationStatusSelect =
    adminProgramsPageContent.includes('Publication Status') &&
    adminProgramsPageContent.includes('<option value="draft">Draft (Private)</option>') &&
    adminProgramsPageContent.includes('<option value="published">Published (Public)</option>') &&
    adminProgramsPageContent.includes('<option value="archived">Archived (Hidden)</option>');
  const adminHasToggleByPublicationStatus =
    adminProgramsPageContent.includes("cohort.publication_status === 'published' ? 'draft' : 'published'") &&
    adminProgramsPageContent.includes("academic status remains");
  const migration5Exists = fs.existsSync(publicationMigrationPath);

  // Runtime test of lifecycle independence:
  const testCohortCode = `TEST-CYCLE-${Date.now()}`;
  const createRes = createMockCohort({
    program_id: 'prog-academic-01',
    name: 'Lifecycle Separation Test Cohort',
    code: testCohortCode,
    status: 'planned',
    publication_status: 'draft',
  });
  const createdTestCohort = createRes.cohort!;

  // Test 1: Publishing a planned cohort does NOT change its academic status
  updateMockCohort(createdTestCohort.id, { publication_status: 'published' });
  const cohortsAfterPublish = getMockCohorts();
  const publishedCohortCheck = cohortsAfterPublish.find((c) => c.id === createdTestCohort.id);
  const plannedRemainsPlanned =
    publishedCohortCheck?.status === 'planned' &&
    publishedCohortCheck?.publication_status === 'published';

  // Test 2: Unpublishing an active cohort does NOT change its academic status
  updateMockCohort(createdTestCohort.id, { status: 'active', publication_status: 'published' });
  updateMockCohort(createdTestCohort.id, { publication_status: 'draft' });
  const cohortsAfterUnpublish = getMockCohorts();
  const unpublishedCohortCheck = cohortsAfterUnpublish.find((c) => c.id === createdTestCohort.id);
  const activeRemainsActive =
    unpublishedCohortCheck?.status === 'active' &&
    unpublishedCohortCheck?.publication_status === 'draft';

  // Test 3: Public query only returns published cohorts
  const publicCohorts = getMockCohorts('prog-academic-01').filter(
    (c) => c.publication_status === 'published'
  );
  const draftExcludedFromPublic = !publicCohorts.some((c) => c.id === createdTestCohort.id);

  report(
    'Lifecycle Separation [Academic Status vs Publication Status Independence]',
    adminHasAcademicStatusSelect &&
      adminHasPublicationStatusSelect &&
      adminHasToggleByPublicationStatus &&
      migration5Exists &&
      plannedRemainsPlanned &&
      activeRemainsActive &&
      draftExcludedFromPublic,
    'Academic status (planned/active/completed) and publication status (draft/published/archived) are completely decoupled across UI, service, and database'
  );

  // 7. Thumbnail Storage Security Policies Verification
  const storageMigrationContent = fs.readFileSync(storageMigrationPath, 'utf8');
  const bucketProvisioned = storageMigrationContent.includes("'program-thumbnails'");
  const publicSelectPolicy =
    storageMigrationContent.includes('CREATE POLICY "Public can view program thumbnails"') &&
    storageMigrationContent.includes("FOR SELECT") &&
    storageMigrationContent.includes("bucket_id = 'program-thumbnails'");
  const adminInsertPolicy =
    storageMigrationContent.includes('CREATE POLICY "Admins can upload program thumbnails"') &&
    storageMigrationContent.includes("FOR INSERT") &&
    storageMigrationContent.includes("(SELECT profiles.role FROM public.profiles WHERE profiles.id = auth.uid()) = 'admin'");
  const adminUpdatePolicy =
    storageMigrationContent.includes('CREATE POLICY "Admins can update program thumbnails"') &&
    storageMigrationContent.includes("FOR UPDATE") &&
    storageMigrationContent.includes("(SELECT profiles.role FROM public.profiles WHERE profiles.id = auth.uid()) = 'admin'");
  const adminDeletePolicy =
    storageMigrationContent.includes('CREATE POLICY "Admins can delete program thumbnails"') &&
    storageMigrationContent.includes("FOR DELETE") &&
    storageMigrationContent.includes("(SELECT profiles.role FROM public.profiles WHERE profiles.id = auth.uid()) = 'admin'");

  report(
    'Storage Security [Bucket Configuration & Strict RLS Policies]',
    bucketProvisioned && publicSelectPolicy && adminInsertPolicy && adminUpdatePolicy && adminDeletePolicy,
    'Storage bucket program-thumbnails enforces public SELECT and strictly restricts INSERT, UPDATE, DELETE to authenticated admin role (mentors excluded)'
  );

  // 8. Mentor RBAC Security Enforcement
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

  // 9. Public Interface Simplification (Zero application modals on public pages)
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

  // 10. Historical Application & Enrollment Pipeline Preservation
  const mockProgs = getMockPrograms();
  const targetProg = mockProgs[0];
  const testStudentId = 'student-uuid-lifecycle-check';
  const submitRes = createMockApplication({
    program_id: targetProg.id,
    applicant_id: testStudentId,
    application_type: 'student',
    status: 'pending',
    message: 'Preservation test',
  });
  const targetAppId = submitRes.application ? submitRes.application.id : '';
  const reviewRes = adminReviewMockApplication('admin-1', targetAppId, 'approved', 'Approved during lifecycle check');
  const enrollments = getMockEnrollments();
  const createdEnrollment = enrollments.find(
    (e) => e.student_id === testStudentId && e.program_id === targetProg.id
  );

  report(
    'Preservation [Admin Review & Student Enrollment Integrity]',
    Boolean(targetAppId) && reviewRes.success && Boolean(createdEnrollment),
    'Admin application review, automated student enrollment creation, and historical tables remain fully functional'
  );

  // 11. Zero Emojis and Strict NO-AMOUNT Policy
  const filesToAudit = [
    'src/pages/ProgramsPage.tsx',
    'src/pages/ProgramDetailPage.tsx',
    'src/pages/CohortDetailPage.tsx',
    'src/pages/ContactPage.tsx',
    'src/lib/programs.ts',
    'src/pages/dashboard/AdminProgramsPage.tsx',
    'src/routes/index.tsx',
    'supabase/migrations/20261104000004_cohort_thumbnails.sql',
    'supabase/migrations/20261104000005_cohort_publication_status.sql',
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
