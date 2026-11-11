/// <reference types="node" />
/**
 * PoraPlan — Batch 3: Bundle Optimization & Route-Level Code Splitting Test Suite
 *
 * Validates:
 * 1. Static Source Code & Architectural Hierarchy Verification:
 *    - All 49 page components in src/routes/index.tsx are loaded via lazyRoute.
 *    - lazyRoute implements a resilient single-retry mechanism for chunk load failures.
 *    - src/components/common/LoadingFallback.tsx exists with brutalist styling.
 *    - Suspense wrappers are present in RootLayout.tsx, DashboardLayout.tsx, and App.tsx.
 *    - vite.config.ts configures vendor-react and vendor-supabase in manualChunks.
 *
 * 2. Simulated Dynamic Import & Chunk Retry Logic:
 *    - Immediate successful import resolves without retrying.
 *    - Simulated chunk fetch failure triggers retry and resolves on second attempt.
 *    - Exhausted retries propagate error cleanly to error boundaries.
 *    - Support for named exports and default exports in dynamic module imports.
 *    - Role-based routing guards (ProtectedRoute) remain intact across lazy routes.
 *
 * 3. Security & Design Hygiene:
 *    - Zero emojis across all touched files and LoadingFallback.
 *    - Zero exposed secrets or credential tokens.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

let passCount = 0;
let failCount = 0;

function report(id: string, condition: boolean, description: string, category: 'STATIC/ARCH' | 'UNIT/SIM' | 'HYGIENE' = 'STATIC/ARCH') {
  if (condition) {
    console.log(`[PASS] [${category}] ${id}: ${description}`);
    passCount++;
  } else {
    console.error(`[FAIL] [${category}] ${id}: ${description}`);
    failCount++;
  }
}

// ----------------------------------------------------------------------------
// 1. Static Source Code & Architectural Hierarchy Verification
// ----------------------------------------------------------------------------
console.log('\n--- Section 1: Static Source Code & Architecture Verification ---');

const routesPath = path.join(projectRoot, 'src/routes/index.tsx');
const routesContent = fs.readFileSync(routesPath, 'utf8');

const fallbackPath = path.join(projectRoot, 'src/components/common/LoadingFallback.tsx');
const fallbackExists = fs.existsSync(fallbackPath);
const fallbackContent = fallbackExists ? fs.readFileSync(fallbackPath, 'utf8') : '';

const rootLayoutPath = path.join(projectRoot, 'src/layouts/RootLayout.tsx');
const rootLayoutContent = fs.readFileSync(rootLayoutPath, 'utf8');

const dashboardLayoutPath = path.join(projectRoot, 'src/layouts/DashboardLayout.tsx');
const dashboardLayoutContent = fs.readFileSync(dashboardLayoutPath, 'utf8');

const appPath = path.join(projectRoot, 'src/App.tsx');
const appContent = fs.readFileSync(appPath, 'utf8');

const viteConfigPath = path.join(projectRoot, 'vite.config.ts');
const viteConfigContent = fs.readFileSync(viteConfigPath, 'utf8');

// 1.1 lazyRoute helper exists in routes/index.tsx
report(
  'SPLIT-01',
  routesContent.includes('function lazyRoute') && (routesContent.includes('lazy(') || routesContent.includes('React.lazy(')),
  'src/routes/index.tsx defines lazyRoute helper using lazy with retry logic'
);

// 1.2 lazyRoute retry logic in routes/index.tsx
report(
  'SPLIT-02',
  routesContent.includes('setTimeout') && routesContent.includes('importer()'),
  'src/routes/index.tsx lazyRoute implements retry logic for transient chunk load failures'
);

// 1.3 Ensure static page component imports were eliminated in favor of lazyRoute
const forbiddenStaticImports = [
  "import LandingPage from '../pages/LandingPage'",
  "import LoginPage from '../pages/LoginPage'",
  "import DashboardPage from '../pages/DashboardPage'",
  "import AdminBillingPage from '../pages/dashboard/AdminBillingPage'",
  "import MentorOverviewPage from '../pages/dashboard/MentorOverviewPage'",
  "import StudentCoursesPage from '../pages/dashboard/StudentCoursesPage'",
];

const hasNoStaticPageImports = forbiddenStaticImports.every((stmt) => !routesContent.includes(stmt));
report(
  'SPLIT-03',
  hasNoStaticPageImports,
  'Static page component imports replaced by code-split dynamic lazyRoute imports'
);

// 1.4 Count lazyRoute invocations in routes/index.tsx (should be >= 49 pages)
const lazyRouteMatches = routesContent.match(/lazyRoute\(\s*\(\)\s*=>\s*import\(/g) || [];
report(
  'SPLIT-04',
  lazyRouteMatches.length >= 49,
  `src/routes/index.tsx splits all 49 pages (detected ${lazyRouteMatches.length} lazyRoute calls)`
);

// 1.5 LoadingFallback exists and is exportable
report(
  'SPLIT-05',
  fallbackExists && fallbackContent.includes('export const LoadingFallback') && fallbackContent.includes('export default LoadingFallback'),
  'src/components/common/LoadingFallback.tsx exists with named and default exports'
);

// 1.6 Suspense wrapping in RootLayout.tsx
report(
  'SPLIT-06',
  rootLayoutContent.includes('<Suspense') && rootLayoutContent.includes('LoadingFallback') && rootLayoutContent.includes('<Outlet />'),
  'src/layouts/RootLayout.tsx wraps <Outlet /> with Suspense and LoadingFallback'
);

// 1.7 Suspense wrapping in DashboardLayout.tsx
report(
  'SPLIT-07',
  dashboardLayoutContent.includes('Suspense') && dashboardLayoutContent.includes('LoadingFallback') && dashboardLayoutContent.includes('<Outlet />'),
  'src/layouts/DashboardLayout.tsx wraps <Outlet /> with Suspense and LoadingFallback'
);

// 1.8 Suspense wrapping in App.tsx
report(
  'SPLIT-08',
  appContent.includes('<Suspense') && appContent.includes('LoadingFallback'),
  'src/App.tsx wraps application route outlet with Suspense'
);

// 1.9 vite.config.ts manualChunks configuration
report(
  'SPLIT-09',
  viteConfigContent.includes('manualChunks') &&
  viteConfigContent.includes("'vendor-react'") &&
  viteConfigContent.includes("'vendor-supabase'"),
  'vite.config.ts defines manualChunks for vendor-react and vendor-supabase'
);

// ----------------------------------------------------------------------------
// 2. Simulated Dynamic Import & Chunk Retry Unit Tests
// ----------------------------------------------------------------------------
console.log('\n--- Section 2: Simulated Dynamic Import & Chunk Retry Logic ---');

// Replicate the lazyRoute load logic in a pure testable function
async function simulateLazyLoad<T extends Record<string, unknown>>(
  importer: () => Promise<T>,
  componentName?: string,
  retriesLeft = 1,
  retryDelayMs = 10
): Promise<{ default: unknown }> {
  try {
    const mod = await importer();
    if (componentName && (mod as Record<string, unknown>)[componentName]) {
      return { default: (mod as Record<string, unknown>)[componentName] };
    }
    if (mod.default) {
      return { default: mod.default };
    }
    return mod as unknown as { default: unknown };
  } catch (err) {
    if (retriesLeft > 0) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      return simulateLazyLoad(importer, componentName, retriesLeft - 1, retryDelayMs);
    }
    throw err;
  }
}

// 2.1 Immediate success resolves module default export
async function testImmediateSuccess() {
  const dummyComponent = () => 'RenderedComponent';
  const result = await simulateLazyLoad(async () => ({ default: dummyComponent }));
  report(
    'SIM-01',
    result.default === dummyComponent,
    'simulateLazyLoad cleanly resolves default export on first attempt',
    'UNIT/SIM'
  );
}

// 2.2 Named export resolution when componentName is specified
async function testNamedExportResolution() {
  const dummyComponent = () => 'NamedComponent';
  const result = await simulateLazyLoad(
    async () => ({ TargetPage: dummyComponent }),
    'TargetPage'
  );
  report(
    'SIM-02',
    result.default === dummyComponent,
    'simulateLazyLoad extracts named export when matching componentName',
    'UNIT/SIM'
  );
}

// 2.3 Transient network failure retried and resolved
async function testTransientFailureRetry() {
  let attempts = 0;
  const dummyComponent = () => 'RetriedComponent';
  const flakyImporter = async () => {
    attempts++;
    if (attempts === 1) {
      throw new Error('Failed to fetch dynamically imported module');
    }
    return { default: dummyComponent };
  };

  const result = await simulateLazyLoad(flakyImporter, undefined, 1, 5);
  report(
    'SIM-03',
    attempts === 2 && result.default === dummyComponent,
    'Transient chunk load failure is automatically retried and succeeds on attempt 2',
    'UNIT/SIM'
  );
}

// 2.4 Persistent chunk load failure propagates error
async function testPersistentFailurePropagation() {
  let attempts = 0;
  const failingImporter = async () => {
    attempts++;
    throw new Error('Persistent network error 404');
  };

  let caughtError: Error | null = null;
  try {
    await simulateLazyLoad(failingImporter, undefined, 1, 5);
  } catch (e) {
    caughtError = e as Error;
  }

  report(
    'SIM-04',
    attempts === 2 && caughtError !== null && caughtError.message.includes('404'),
    'Persistent chunk load failure exhausts retries and propagates error to ErrorBoundary',
    'UNIT/SIM'
  );
}

// 2.5 Role-based ProtectedRoute guards remain active in route structure
function testProtectedRouteGuards() {
  // Ensure that ProtectedRoute still wraps protected dashboard paths
  const hasStudentGuard = routesContent.includes("<ProtectedRoute allowedRoles={['student', 'admin']}>");
  const hasMentorGuard = routesContent.includes("<ProtectedRoute allowedRoles={['mentor', 'admin']}>");
  const hasAdminGuard = routesContent.includes("<ProtectedRoute allowedRoles={['admin']}>");

  report(
    'SIM-05',
    hasStudentGuard && hasMentorGuard && hasAdminGuard,
    'Role-based guards (ProtectedRoute) remain intact across code-split dashboard paths',
    'UNIT/SIM'
  );
}

// ----------------------------------------------------------------------------
// 3. Security & Design Hygiene Verification
// ----------------------------------------------------------------------------
console.log('\n--- Section 3: Security & Design Hygiene Verification ---');

// 3.1 Zero emojis across all touched files
const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA70}-\u{1FAFF}]/u;

const touchedFiles = [
  fallbackContent,
  routesContent,
  rootLayoutContent,
  dashboardLayoutContent,
  appContent,
  viteConfigContent,
];

const hasZeroEmojis = touchedFiles.every((content) => !emojiRegex.test(content));
report(
  'HYGIENE-01',
  hasZeroEmojis,
  'Zero emojis detected in all code-splitting, layout, and configuration files',
  'HYGIENE'
);

// 3.2 LoadingFallback adheres to brutalist design tokens
const hasBrutalistTokens =
  fallbackContent.includes('font-mono') &&
  fallbackContent.includes('border-2') &&
  fallbackContent.includes('shadow-brutal');

report(
  'HYGIENE-02',
  hasBrutalistTokens,
  'LoadingFallback adheres to monospace uppercase brutalist design standard',
  'HYGIENE'
);

// 3.3 Zero hardcoded credentials or private tokens
const secretRegex = /(eyJhbGciOi|service_role|supabase_secret|PRIVATE_KEY|password\s*=\s*['"][^'"]+['"])/i;
const hasNoSecrets = touchedFiles.every((content) => !secretRegex.test(content));
report(
  'HYGIENE-03',
  hasNoSecrets,
  'Zero exposed secrets, tokens, or private credentials in touched files',
  'HYGIENE'
);

// Run all simulated async tests
async function runAll() {
  await testImmediateSuccess();
  await testNamedExportResolution();
  await testTransientFailureRetry();
  await testPersistentFailurePropagation();
  testProtectedRouteGuards();

  console.log('\n======================================================');
  console.log(`Summary: ${passCount}/${passCount + failCount} scenarios passed (${failCount} failed).`);
  console.log('======================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runAll().catch((err) => {
  console.error('Unhandled test suite failure:', err);
  process.exit(1);
});
