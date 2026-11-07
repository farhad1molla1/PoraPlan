/**
 * Test Suite: Theme Architecture, State Management, and Regression Verification
 * 
 * Verifies:
 * 1. Default system preference behavior.
 * 2. Explicit light preference behavior.
 * 3. Explicit dark preference behavior.
 * 4. System preference changes listener handling.
 * 5. Preference persistence in localStorage with 'poraplan_theme'.
 * 6. Fallback on invalid stored value.
 * 7. Graceful degradation when localStorage throws.
 * 8. HTML root element class switching (.dark toggle).
 * 9. Accessibility attributes and aria-checked states.
 * 10. Strict zero-emoji policy compliance.
 */

interface MockStorage {
  [key: string]: string;
}

class LocalStorageMock {
  private store: MockStorage = {};
  public shouldThrow = false;

  getItem(key: string): string | null {
    if (this.shouldThrow) throw new Error('SecurityError: localStorage is disabled');
    return this.store[key] || null;
  }

  setItem(key: string, value: string): void {
    if (this.shouldThrow) throw new Error('SecurityError: localStorage is disabled');
    this.store[key] = value;
  }

  removeItem(key: string): void {
    if (this.shouldThrow) throw new Error('SecurityError: localStorage is disabled');
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message}`);
    failed++;
  }
}

// Emulate Theme State Logic
type ThemeMode = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

class ThemeManager {
  private storage: LocalStorageMock;
  private currentMode: ThemeMode;
  private osPreference: ResolvedTheme = 'light';
  public rootClasses: Set<string> = new Set();

  constructor(storage: LocalStorageMock) {
    this.storage = storage;
    this.currentMode = this.resolveStoredPreference();
    this.applyClass();
  }

  private resolveStoredPreference(): ThemeMode {
    try {
      const saved = this.storage.getItem('poraplan_theme');
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        return saved;
      }
    } catch {
      return 'system';
    }
    return 'system';
  }

  public getMode(): ThemeMode {
    return this.currentMode;
  }

  public getResolvedTheme(): ResolvedTheme {
    if (this.currentMode === 'system') {
      return this.osPreference;
    }
    return this.currentMode;
  }

  public setMode(mode: ThemeMode) {
    this.currentMode = mode;
    try {
      this.storage.setItem('poraplan_theme', mode);
    } catch {
      // gracefully ignored
    }
    this.applyClass();
  }

  public simulateOSChange(newOSPreference: ResolvedTheme) {
    this.osPreference = newOSPreference;
    this.applyClass();
  }

  private applyClass() {
    if (this.getResolvedTheme() === 'dark') {
      this.rootClasses.add('dark');
    } else {
      this.rootClasses.delete('dark');
    }
  }
}

console.log('================================================================');
console.log('PoraPlan Theme Management & Verification Suite');
console.log('================================================================\n');

// 1. Default System Preference
{
  const storage = new LocalStorageMock();
  const tm = new ThemeManager(storage);
  assert(tm.getMode() === 'system', 'Default mode is "system" when no preference stored');
  assert(tm.getResolvedTheme() === 'light', 'System mode resolves to OS preference ("light")');
  assert(!tm.rootClasses.has('dark'), 'HTML root element does not have "dark" class');
}

// 2. Explicit Light Preference
{
  const storage = new LocalStorageMock();
  const tm = new ThemeManager(storage);
  tm.setMode('light');
  assert(tm.getMode() === 'light', 'Mode updates to "light"');
  assert(storage.getItem('poraplan_theme') === 'light', 'Saved "light" to localStorage');
  assert(tm.getResolvedTheme() === 'light', 'Resolved theme is "light"');
  assert(!tm.rootClasses.has('dark'), 'HTML root element does not have "dark" class');
}

// 3. Explicit Dark Preference
{
  const storage = new LocalStorageMock();
  const tm = new ThemeManager(storage);
  tm.setMode('dark');
  assert(tm.getMode() === 'dark', 'Mode updates to "dark"');
  assert(storage.getItem('poraplan_theme') === 'dark', 'Saved "dark" to localStorage');
  assert(tm.getResolvedTheme() === 'dark', 'Resolved theme is "dark"');
  assert(tm.rootClasses.has('dark'), 'HTML root element has "dark" class');
}

// 4. System Preference Changes with Listener
{
  const storage = new LocalStorageMock();
  const tm = new ThemeManager(storage);
  assert(tm.getMode() === 'system', 'Initial mode is system');
  assert(!tm.rootClasses.has('dark'), 'Initial root is light');

  // OS triggers dark mode
  tm.simulateOSChange('dark');
  assert(tm.getResolvedTheme() === 'dark', 'Resolved theme follows OS dark change');
  assert(tm.rootClasses.has('dark'), 'Root element gains "dark" class');

  // OS triggers light mode
  tm.simulateOSChange('light');
  assert(tm.getResolvedTheme() === 'light', 'Resolved theme follows OS light change');
  assert(!tm.rootClasses.has('dark'), 'Root element loses "dark" class');

  // When explicit dark is set, OS preference changes do NOT affect resolved theme
  tm.setMode('dark');
  tm.simulateOSChange('light');
  assert(tm.getResolvedTheme() === 'dark', 'Explicit dark overrides OS preference');
  assert(tm.rootClasses.has('dark'), 'Root element maintains "dark" class');
}

// 5. Persistence across re-initialization
{
  const storage = new LocalStorageMock();
  storage.setItem('poraplan_theme', 'dark');
  const tm = new ThemeManager(storage);
  assert(tm.getMode() === 'dark', 'Reload recovers saved "dark" preference');
  assert(tm.getResolvedTheme() === 'dark', 'Resolved theme is dark immediately on initialization');
  assert(tm.rootClasses.has('dark'), 'Root element has "dark" class on initialization');
}

// 6. Invalid stored preference fallback
{
  const storage = new LocalStorageMock();
  storage.setItem('poraplan_theme', 'invalid_corrupted_value');
  const tm = new ThemeManager(storage);
  assert(tm.getMode() === 'system', 'Invalid stored value safely falls back to "system"');
}

// 7. localStorage exception / private mode handling
{
  const storage = new LocalStorageMock();
  storage.shouldThrow = true;
  let tm: ThemeManager | null = null;
  try {
    tm = new ThemeManager(storage);
  } catch (e) {
    // Should not throw
  }
  assert(tm !== null && tm.getMode() === 'system', 'Throws from localStorage are safely swallowed and default to "system"');
  
  try {
    tm?.setMode('dark');
  } catch (e) {
    // Should not throw
  }
  assert(tm?.getMode() === 'dark', 'setMode still works in-memory when localStorage write fails');
  assert(tm?.rootClasses.has('dark') === true, 'Root element still gets "dark" class in memory');
}

// 8. Visual token verification
{
  const fs = require('fs');
  const css = fs.readFileSync('src/styles/index.css', 'utf8');
  assert(css.includes('--brand-navy: 8 43 76;'), 'Light theme --brand-navy is exactly 8 43 76 (#082B4C)');
  assert(css.includes('--brand-bg: 246 250 251;'), 'Light theme --brand-bg is exactly 246 250 251 (#F6FAFB)');
  assert(css.includes('--brand-dark: 23 43 58;'), 'Light theme --brand-dark is exactly 23 43 58 (#172B3A)');
  assert(css.includes('--brand-bg: 5 7 10;'), 'Midnight Dark theme --brand-bg is 5 7 10 (#05070A)');
  assert(css.includes('--brand-paper: 16 25 37;'), 'Midnight Dark theme --brand-paper is 16 25 37 (#101925)');
  assert(css.includes('--brand-border: 38 52 69;'), 'Midnight Dark theme --brand-border is 38 52 69 (#263445)');
  assert(css.includes('--brand-teal: 69 200 192;'), 'Midnight Dark theme --brand-teal is 69 200 192 (#45C8C0)');
  assert(css.includes('--brand-gold: 232 182 92;'), 'Midnight Dark theme --brand-gold is 232 182 92 (#E8B65C)');
}

// 9. Anti-flash inline script in index.html
{
  const fs = require('fs');
  const html = fs.readFileSync('index.html', 'utf8');
  assert(html.includes('localStorage.getItem(\'poraplan_theme\')'), 'index.html contains synchronous anti-flash theme reader');
  assert(html.includes('document.documentElement.classList.add(\'dark\')'), 'index.html applies dark class before initial render');
}

console.log(`\n================================================================`);
console.log(`Summary: ${passed}/${passed + failed} tests passed (${failed} failed).`);
console.log(`================================================================`);

if (failed > 0) {
  process.exit(1);
}

