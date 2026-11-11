/// <reference types="node" />
/**
 * PoraPlan Consolidated Test Suite Runner
 *
 * Coordinates execution of all automated test suites:
 * 1. Legacy Verification Suites (Milestones 5.2, 5.2.1, 5.3.1)
 * 2. Modern Security Suites (RLS Privacy, Suspended RLS, Password Policy, etc.)
 * 3. Batch 1 Regression Suite (AuthContext Fallback Hardening)
 *
 * Ensures synchronous/asynchronous error propagation, zero emoji usage,
 * non-zero exit codes on failure, and clean execution reporting.
 */

import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

interface TestSuiteDef {
  name: string;
  relativePath: string;
  category: 'Legacy Verification' | 'Security & RLS' | 'Authentication Hardening' | 'Application Resilience' | 'Performance & Optimization';
}

const testSuites: TestSuiteDef[] = [
  // Legacy Milestone Verification Suites
  {
    name: 'Milestone 5.2 Security & Data Integrity',
    relativePath: 'scripts/verify_milestone_5_2.ts',
    category: 'Legacy Verification',
  },
  {
    name: 'Milestone 5.2.1 Security Integrity',
    relativePath: 'scripts/verify_milestone_5_2_1.ts',
    category: 'Legacy Verification',
  },
  {
    name: 'Milestone 5.3.1 Integration & Integrity',
    relativePath: 'scripts/verify_milestone_5_3_1.ts',
    category: 'Legacy Verification',
  },

  // Batch 1 Authentication Hardening
  {
    name: 'Batch 1: AuthContext Fallback Hardening',
    relativePath: 'src/__tests__/authContextFallbackHardening.test.ts',
    category: 'Authentication Hardening',
  },

  // Batch 2 Application Error Resilience
  {
    name: 'Batch 2: Application Error Resilience',
    relativePath: 'src/__tests__/applicationErrorResilience.test.ts',
    category: 'Application Resilience',
  },

  // Batch 3 Bundle Optimization & Route Splitting
  {
    name: 'Batch 3: Bundle Optimization & Route-Level Splitting',
    relativePath: 'src/__tests__/routeCodeSplittingOptimization.test.ts',
    category: 'Performance & Optimization',
  },

  // Modern Security & RLS Suites
  {
    name: 'RLS Helper Privacy & Status Semantics',
    relativePath: 'src/__tests__/rlsHelperPrivacyAndStatusSemantics.test.ts',
    category: 'Security & RLS',
  },
  {
    name: 'Suspended Account RLS & Edge Hardening',
    relativePath: 'src/__tests__/suspendedRlsAndEdgeHardening.test.ts',
    category: 'Security & RLS',
  },
  {
    name: 'Strong Password Security Policy',
    relativePath: 'src/__tests__/passwordSecurityPolicy.test.ts',
    category: 'Security & RLS',
  },
  {
    name: 'Test Account Retirement & Credentials Purge',
    relativePath: 'src/__tests__/testAccountRetirement.test.ts',
    category: 'Security & RLS',
  },
  {
    name: 'Cohort & Program Publication Status RLS',
    relativePath: 'src/__tests__/cohortProgramVisibilityRls.test.ts',
    category: 'Security & RLS',
  },
  {
    name: 'Authentication Abuse & ID Enumeration Protection',
    relativePath: 'src/__tests__/authenticationAbuseProtection.test.ts',
    category: 'Security & RLS',
  },
  {
    name: 'Self-Service Password Policy Enforcement',
    relativePath: 'src/__tests__/selfServicePasswordEnforcement.test.ts',
    category: 'Security & RLS',
  },
];

interface SuiteResult {
  suite: TestSuiteDef;
  durationMs: number;
  exitCode: number;
  passedScenarios: number;
  totalScenarios: number;
  error?: string;
}

function runSuite(suite: TestSuiteDef): SuiteResult {
  const fullPath = path.join(projectRoot, suite.relativePath);
  const startTime = Date.now();

  console.log(`\n>>> RUNNING: [${suite.category}] ${suite.name}`);
  console.log(`    Target: ${suite.relativePath}`);

  // Execute directly with current Node runtime and local jiti bundle
  const jitiBin = path.join(projectRoot, 'node_modules/jiti/bin/jiti.js');
  const child = spawnSync(process.execPath, [jitiBin, fullPath], {
    cwd: projectRoot,
    stdio: ['inherit', 'pipe', 'pipe'],
    encoding: 'utf8',
    env: process.env,
  });

  const durationMs = Date.now() - startTime;
  const stdout = child.stdout || '';
  const stderr = child.stderr || '';

  // Stream output to console
  if (stdout) {
    process.stdout.write(stdout);
  }
  if (stderr) {
    process.stderr.write(stderr);
  }

  // Parse scenario summary line (e.g., "Summary: 33/33 scenarios passed")
  let passedScenarios = 0;
  let totalScenarios = 0;
  const combined = stdout + '\n' + stderr;
  const match = combined.match(/Summary:\s+(\d+)\/(\d+)\s+scenarios passed/i);
  if (match) {
    passedScenarios = parseInt(match[1], 10);
    totalScenarios = parseInt(match[2], 10);
  }

  const exitCode = child.status ?? (child.error ? 1 : 0);

  return {
    suite,
    durationMs,
    exitCode,
    passedScenarios,
    totalScenarios,
    error: child.error ? child.error.message : undefined,
  };
}

function main() {
  console.log('================================================================');
  console.log('PoraPlan Complete Automated Test Suite Runner');
  console.log(`Total suites to execute: ${testSuites.length}`);
  console.log('================================================================');

  const overallStart = Date.now();
  const results: SuiteResult[] = [];
  let anyFailed = false;

  for (const suite of testSuites) {
    const res = runSuite(suite);
    results.push(res);
    if (res.exitCode !== 0) {
      anyFailed = true;
      console.error(`\n[FAILED SUITE] ${suite.name} exited with code ${res.exitCode}`);
      // Break early on failure to prevent hiding error in long scroll
      break;
    }
  }

  const totalTimeSec = ((Date.now() - overallStart) / 1000).toFixed(2);

  console.log('\n================================================================');
  console.log('TEST EXECUTION SUMMARY MATRIX');
  console.log('================================================================');
  console.log(
    'Status'.padEnd(10) +
    'Category'.padEnd(26) +
    'Suite Name'.padEnd(46) +
    'Scenarios'.padEnd(14) +
    'Duration'
  );
  console.log('-'.repeat(105));

  let totalPassed = 0;
  let totalExecuted = 0;

  for (const r of results) {
    const statusStr = r.exitCode === 0 ? '[PASS]' : '[FAIL]';
    const scnStr = r.totalScenarios > 0 ? `${r.passedScenarios}/${r.totalScenarios}` : 'N/A';
    const durStr = `${(r.durationMs / 1000).toFixed(2)}s`;

    totalPassed += r.passedScenarios;
    totalExecuted += r.totalScenarios;

    console.log(
      statusStr.padEnd(10) +
      r.suite.category.padEnd(26) +
      r.suite.name.padEnd(46) +
      scnStr.padEnd(14) +
      durStr
    );
  }

  console.log('-'.repeat(105));
  console.log(
    `Suites: ${results.filter((r) => r.exitCode === 0).length}/${testSuites.length} passed | ` +
    `Scenarios: ${totalPassed}/${totalExecuted} passed | ` +
    `Total Time: ${totalTimeSec}s`
  );
  console.log('================================================================\n');

  if (anyFailed || results.length < testSuites.length) {
    console.error('Test execution failed. See details above.');
    process.exit(1);
  } else {
    console.log('All test suites passed successfully.');
    process.exit(0);
  }
}

main();
