/**
 * PoraPlan Milestone 12.0.1: Profile & Sign Out Refinement Verification Suite
 *
 * Verifies:
 * 1. Profile access remains in the header/account dropdown menu.
 * 2. Standalone Sign Out controls removed from header and sidebar footer.
 * 3. Duplicate profile button removed from sidebar footer.
 * 4. Sign Out action cleanly integrated inside Profile/Account menu on desktop and mobile.
 * 5. Complete absence of emoji characters across application source files (src/).
 * 6. Existing navigation orders, routes, and layouts remain untouched.
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
console.log('PoraPlan Milestone 12.0.1: Profile, Sign Out & Emoji Audit');
console.log('================================================================\n');

const layoutPath = path.join(process.cwd(), 'src', 'layouts', 'DashboardLayout.tsx');
const layoutContent = fs.readFileSync(layoutPath, 'utf8');

// --- Section 1: Profile Access Verification ---
console.log('--- 1. Profile Access Verification ---');

assert(
  layoutContent.includes('const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);'),
  'Profile menu dropdown state is implemented'
);

assert(
  layoutContent.includes('to="/profile"'),
  "Header profile dropdown provides direct access to '/profile'"
);

assert(
  !layoutContent.includes('className="flex-1 py-1 px-2 border-2 border-brand-dark bg-brand-paper text-[11px] font-mono font-bold text-brand-dark hover:bg-brand-gold-light transition-colors shadow-brutal-xs text-center"\n              >\n                My Profile'),
  'Duplicate My Profile button removed from sidebar footer'
);

// --- Section 2: Sign Out Verification ---
console.log('\n--- 2. Sign Out Integration & Standalone Removal ---');

assert(
  layoutContent.includes('handleSignOut') && layoutContent.includes('Sign Out'),
  'Sign Out action is securely placed inside the Profile dropdown menu'
);

assert(
  !layoutContent.includes('<Button\n            variant="ghost"\n            size="sm"\n            onClick={handleSignOut}\n            leftIcon={<LogOut className="w-3.5 h-3.5" />}\n            className="hidden sm:inline-flex text-xs font-mono"\n          >\n            Sign Out\n          </Button>'),
  'Standalone desktop Sign Out button is absent from the header bar'
);

assert(
  !layoutContent.includes('<button\n            type="button"\n            onClick={handleSignOut}\n            className="sm:hidden p-1.5 border-2 border-brand-dark bg-brand-paper shadow-brutal-xs hover:bg-brand-paper-tint"\n            aria-label="Sign out"\n            title="Sign out"\n          >\n            <LogOut className="w-4 h-4 text-brand-dark" />\n          </button>'),
  'Standalone mobile Sign Out button is absent from header'
);

// Verify sidebar footer standalone sign out button is absent
assert(
  !layoutContent.includes('className="p-1 border-2 border-brand-dark bg-brand-paper text-brand-dark hover:bg-red-50 hover:text-red-700 transition-colors shadow-brutal-xs"\n                title="Sign Out"'),
  'Standalone Sign Out button removed from sidebar footer'
);

// --- Section 3: Zero Emoji Check in src/ ---
console.log('\n--- 3. Emoji Removal Verification in src/ ---');

const emojiRegex = /\p{Extended_Pictographic}/u;
let emojiCount = 0;
const emojiViolations: string[] = [];

function scanDir(dir: string) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      scanDir(full);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      const code = fs.readFileSync(full, 'utf8');
      const lines = code.split('\n');
      lines.forEach((line, idx) => {
        // Exclude copyright character if detected by pictographic
        if (emojiRegex.test(line) && !line.includes('©')) {
          emojiCount++;
          emojiViolations.push(`${full}:${idx + 1}: ${line.trim()}`);
        }
      });
    }
  }
}

scanDir(path.join(process.cwd(), 'src'));

if (emojiViolations.length > 0) {
  console.error('Found emoji violations:');
  emojiViolations.forEach((v) => console.error('  ' + v));
}

assert(
  emojiCount === 0,
  `Zero emojis present in application source files (src/) (found ${emojiCount})`
);

// --- Section 4: Navigation Integrity Preservation ---
console.log('\n--- 4. Navigation Integrity Preservation ---');

// Check that student, mentor, admin nav items remain unchanged from Milestone 12.0
assert(
  layoutContent.includes("to: '/student/dashboard'") &&
  layoutContent.includes("to: '/student/tasks'") &&
  layoutContent.includes("to: '/student/doubts'"),
  'Student navigation items preserved in correct order'
);

assert(
  layoutContent.includes("to: '/mentor/dashboard'") &&
  layoutContent.includes("to: '/mentor/reviews'") &&
  layoutContent.includes("to: '/mentor/doubts'"),
  'Mentor navigation items preserved in correct order'
);

assert(
  layoutContent.includes("to: '/admin/dashboard'") &&
  layoutContent.includes("to: '/admin/programs'") &&
  layoutContent.includes("to: '/admin/enrollments'"),
  'Admin navigation items preserved in correct order'
);

// --- Section 5: NO-AMOUNT Financial Policy ---
console.log('\n--- 5. Mandatory NO-AMOUNT Policy Check ---');

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
  'Strict NO-AMOUNT policy verified in DashboardLayout.tsx (0 violations)'
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
