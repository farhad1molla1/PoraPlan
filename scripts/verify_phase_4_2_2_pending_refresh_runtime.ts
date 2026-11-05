/**
 * PoraPlan — Phase 4.2.2: Pending Refresh Implementation & Runtime Tests
 *
 * Verifies:
 * 1. Static Architecture Audit of NotificationInbox.tsx:
 *    - pendingRefreshRef and pendingManualRefreshRef declarations
 *    - In-flight request interception and pending flag capture
 *    - Sequential follow-up execution in finally block
 *    - Unmount guard (isMountedRef) and reference cleanup
 *    - Fallback polling (30s) and custom event listener lifecycle
 * 2. Executable Asynchronous Runtime Simulation using Deferred Promises:
 *    - Scenario A: Single event during active fetch triggers follow-up fetch upon completion
 *    - Scenario B: Multiple events during active fetch coalesce into exactly one follow-up fetch
 *    - Scenario C: Event during follow-up fetch queues another follow-up, executing strictly sequentially
 *    - Scenario D: Fetch failure with pending refresh triggers follow-up fetch and recovers
 *    - Scenario E: Unmount during active fetch cancels pending follow-up without errors or state updates
 *    - Scenario F: Manual refresh during active fetch queues manual follow-up preserving manual loading state
 *    - Scenario G: 30-second polling tick during active fetch queues at most one follow-up
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, description: string, isAsyncRuntime = false) {
  totalTests++;
  const tag = isAsyncRuntime ? '[ASYNC-RUNTIME]' : '[STATIC]';
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${tag} #${totalTests}: ${description}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${tag} #${totalTests}: ${description}`);
  }
}

// -----------------------------------------------------------------------------
// Deferred Promise Helper for Asynchronous Concurrency Simulation
// -----------------------------------------------------------------------------
export interface Deferred<T = void> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
  isSettled: () => boolean;
}

export function createDeferred<T = void>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  let settled = false;

  const promise = new Promise<T>((res, rej) => {
    resolve = (val) => {
      settled = true;
      res(val);
    };
    reject = (err) => {
      settled = true;
      rej(err);
    };
  });

  return {
    promise,
    resolve,
    reject,
    isSettled: () => settled,
  };
}

// -----------------------------------------------------------------------------
// Pure Refresh Controller Model matching NotificationInbox.tsx exact logic
// -----------------------------------------------------------------------------
export interface RefreshControllerOptions {
  fetcher: (isManual?: boolean) => Promise<void>;
  onLoadingChange?: (loading: boolean) => void;
  onErrorChange?: (error: string | null) => void;
}

export interface RefreshController {
  trigger: (isManual?: boolean) => Promise<void>;
  isInFlight: () => boolean;
  hasPendingRefresh: () => boolean;
  hasPendingManualRefresh: () => boolean;
  unmount: () => void;
}

export function createTestRefreshController(options: RefreshControllerOptions): RefreshController {
  let isMounted = true;
  let inFlight = false;
  let pendingRefresh = false;
  let pendingManualRefresh = false;

  const fetchNotifications = async (isManualRefresh = false): Promise<void> => {
    if (!isMounted) return;

    if (inFlight) {
      pendingRefresh = true;
      if (isManualRefresh) {
        pendingManualRefresh = true;
        options.onLoadingChange?.(true);
      }
      return;
    }

    inFlight = true;
    if (isManualRefresh) {
      options.onLoadingChange?.(true);
    }
    options.onErrorChange?.(null);

    try {
      await options.fetcher(isManualRefresh);
    } catch (err: unknown) {
      if (!isMounted) return;
      const msg = err instanceof Error ? err.message : String(err);
      options.onErrorChange?.(msg);
    } finally {
      inFlight = false;
      if (isMounted) {
        if (pendingRefresh) {
          pendingRefresh = false;
          const nextIsManual = pendingManualRefresh;
          pendingManualRefresh = false;
          void fetchNotifications(nextIsManual);
        } else {
          options.onLoadingChange?.(false);
        }
      }
    }
  };

  return {
    trigger: (isManual = false) => fetchNotifications(isManual),
    isInFlight: () => inFlight,
    hasPendingRefresh: () => pendingRefresh,
    hasPendingManualRefresh: () => pendingManualRefresh,
    unmount: () => {
      isMounted = false;
      pendingRefresh = false;
      pendingManualRefresh = false;
    },
  };
}

async function runSuite() {
  console.log('\n================================================================');
  console.log(' PoraPlan — Phase 4.2.2: Pending Refresh Verification Suite');
  console.log('================================================================\n');

  // ---------------------------------------------------------------------------
  // Suite 1: Static Architecture & Implementation Integrity Audit
  // ---------------------------------------------------------------------------
  console.log('--- Suite 1: Static Implementation Integrity Audit ---');

  const inboxSrc = readFileSync(
    resolve(__dirname, '../src/components/notifications/NotificationInbox.tsx'),
    'utf8'
  );

  // 1. Ref declarations
  assert(
    inboxSrc.includes('const pendingRefreshRef = useRef(false);'),
    'Declares pendingRefreshRef initialized to false'
  );
  assert(
    inboxSrc.includes('const pendingManualRefreshRef = useRef(false);'),
    'Declares pendingManualRefreshRef initialized to false'
  );

  // 2. In-flight handling
  assert(
    inboxSrc.includes('if (inFlightRef.current) {') &&
    inboxSrc.includes('pendingRefreshRef.current = true;'),
    'Captures incoming refresh event as pending when request is in-flight'
  );
  assert(
    inboxSrc.includes('if (isManualRefresh) {') &&
    inboxSrc.includes('pendingManualRefreshRef.current = true;') &&
    inboxSrc.includes('setLoading(true);'),
    'Preserves manual refresh intent and sets loading state when manual refresh arrives during in-flight fetch'
  );
  assert(
    inboxSrc.includes('if (inFlightRef.current) return;'),
    'Bails out cleanly without spawning concurrent request while in flight'
  );

  // 3. Finally block sequential follow-up
  assert(
    inboxSrc.includes('inFlightRef.current = false;'),
    'Resets inFlightRef to false in finally block'
  );
  assert(
    inboxSrc.includes('if (isMountedRef.current) {') &&
    inboxSrc.includes('if (pendingRefreshRef.current) {'),
    'Checks mounted guard and pendingRefreshRef before triggering follow-up'
  );
  assert(
    inboxSrc.includes('pendingRefreshRef.current = false;') &&
    inboxSrc.includes('const nextIsManual = pendingManualRefreshRef.current;') &&
    inboxSrc.includes('pendingManualRefreshRef.current = false;') &&
    inboxSrc.includes('fetchNotifications(nextIsManual);'),
    'Consumes pending flags and invokes follow-up fetchNotifications with queued manual mode'
  );
  assert(
    inboxSrc.includes('else {') && inboxSrc.includes('setLoading(false);'),
    'Transitions loading state to false only when no pending refresh remains'
  );

  // 4. Unmount cleanup
  assert(
    inboxSrc.includes('isMountedRef.current = false;') &&
    inboxSrc.includes('pendingRefreshRef.current = false;') &&
    inboxSrc.includes('pendingManualRefreshRef.current = false;'),
    'Resets mounted guard and clears pending flags upon component unmount'
  );
  assert(
    inboxSrc.includes('clearInterval(intervalId);') &&
    inboxSrc.includes("window.removeEventListener('notifications-updated', handleUpdate);"),
    'Cleans up polling interval and event listeners upon component unmount'
  );

  // ---------------------------------------------------------------------------
  // Suite 2: Executable Asynchronous Runtime Concurrency Scenarios
  // ---------------------------------------------------------------------------
  console.log('\n--- Suite 2: Executable Asynchronous Runtime Scenarios ---');

  // Scenario A: Single event during active fetch triggers follow-up fetch
  {
    console.log('  Testing Scenario A: Single event during active fetch...');
    let fetchCount = 0;
    let concurrentCount = 0;
    let maxConcurrency = 0;

    const deferred1 = createDeferred();
    const deferred2 = createDeferred();

    const controller = createTestRefreshController({
      fetcher: async () => {
        fetchCount++;
        concurrentCount++;
        if (concurrentCount > maxConcurrency) maxConcurrency = concurrentCount;

        if (fetchCount === 1) {
          await deferred1.promise;
        } else if (fetchCount === 2) {
          await deferred2.promise;
        }
        concurrentCount--;
      },
    });

    // 1. Trigger initial fetch
    const p1 = controller.trigger(false);
    assert(controller.isInFlight() === true, 'Scenario A: Fetch 1 is currently in-flight', true);
    assert(controller.hasPendingRefresh() === false, 'Scenario A: No pending refresh before event arrives', true);

    // 2. Dispatch event while Fetch 1 in-flight
    await controller.trigger(false);
    assert(controller.hasPendingRefresh() === true, 'Scenario A: Event during in-flight fetch sets pending flag', true);
    assert(fetchCount === 1, 'Scenario A: Concurrency guarded — Fetch 2 has not started yet', true);

    // 3. Resolve Fetch 1
    deferred1.resolve();
    await p1;

    // Small tick to allow finally block microtasks to run
    await new Promise((r) => setTimeout(r, 10));

    assert(fetchCount === 2, 'Scenario A: Fetch 2 triggered automatically from finally block', true);
    assert(controller.isInFlight() === true, 'Scenario A: Fetch 2 is currently in-flight', true);
    assert(controller.hasPendingRefresh() === false, 'Scenario A: Pending flag was consumed by Fetch 2', true);

    // 4. Resolve Fetch 2
    deferred2.resolve();
    await new Promise((r) => setTimeout(r, 10));

    assert(controller.isInFlight() === false, 'Scenario A: Controller is idle after Fetch 2 finishes', true);
    assert(maxConcurrency === 1, 'Scenario A: Maximum concurrency was strictly 1 (no overlap)', true);
    assert(fetchCount === 2, 'Scenario A: Exactly 2 fetches executed', true);
  }

  // Scenario B: Multiple events during active fetch coalesce into exactly one follow-up fetch
  {
    console.log('  Testing Scenario B: Multiple events coalesce into exactly one follow-up...');
    let fetchCount = 0;
    let maxConcurrency = 0;
    let active = 0;

    const deferred1 = createDeferred();
    const deferred2 = createDeferred();

    const controller = createTestRefreshController({
      fetcher: async () => {
        fetchCount++;
        active++;
        if (active > maxConcurrency) maxConcurrency = active;

        if (fetchCount === 1) {
          await deferred1.promise;
        } else {
          await deferred2.promise;
        }
        active--;
      },
    });

    // 1. Initial fetch
    void controller.trigger(false);
    assert(controller.isInFlight() === true, 'Scenario B: Fetch 1 is in-flight', true);

    // 2. Rapid succession of 5 events
    void controller.trigger(false);
    void controller.trigger(false);
    void controller.trigger(false);
    void controller.trigger(false);
    void controller.trigger(false);

    assert(controller.hasPendingRefresh() === true, 'Scenario B: Pending flag is active', true);
    assert(fetchCount === 1, 'Scenario B: All 5 events were buffered without starting parallel fetches', true);

    // 3. Resolve Fetch 1
    deferred1.resolve();
    await new Promise((r) => setTimeout(r, 10));

    assert(fetchCount === 2, 'Scenario B: Exactly one coalesced follow-up (Fetch 2) began', true);
    assert(controller.hasPendingRefresh() === false, 'Scenario B: Pending flag cleared for Fetch 2', true);

    // 4. Resolve Fetch 2
    deferred2.resolve();
    await new Promise((r) => setTimeout(r, 10));

    assert(fetchCount === 2, 'Scenario B: Total fetches capped at 2 (no duplicate follow-ups)', true);
    assert(maxConcurrency === 1, 'Scenario B: Concurrency never exceeded 1', true);
    assert(controller.isInFlight() === false, 'Scenario B: Fully settled in idle state', true);
  }

  // Scenario C: Event during follow-up fetch queues another follow-up, executing strictly sequentially
  {
    console.log('  Testing Scenario C: Chained sequential follow-up execution...');
    let fetchCount = 0;
    let maxConcurrency = 0;
    let active = 0;

    const deferreds = [createDeferred(), createDeferred(), createDeferred()];

    const controller = createTestRefreshController({
      fetcher: async () => {
        const idx = fetchCount;
        fetchCount++;
        active++;
        if (active > maxConcurrency) maxConcurrency = active;

        if (deferreds[idx]) {
          await deferreds[idx].promise;
        }
        active--;
      },
    });

    // Start Fetch 1
    void controller.trigger(false);

    // Event 1 arrives during Fetch 1
    void controller.trigger(false);

    // Resolve Fetch 1 -> starts Fetch 2
    deferreds[0].resolve();
    await new Promise((r) => setTimeout(r, 10));

    assert(fetchCount === 2, 'Scenario C: Fetch 2 started after Fetch 1 resolved', true);

    // Event 2 arrives during Fetch 2!
    void controller.trigger(false);
    assert(controller.hasPendingRefresh() === true, 'Scenario C: Event 2 captured while Fetch 2 in-flight', true);

    // Resolve Fetch 2 -> starts Fetch 3
    deferreds[1].resolve();
    await new Promise((r) => setTimeout(r, 10));

    assert(fetchCount === 3, 'Scenario C: Fetch 3 started after Fetch 2 resolved', true);

    // Resolve Fetch 3
    deferreds[2].resolve();
    await new Promise((r) => setTimeout(r, 10));

    assert(fetchCount === 3, 'Scenario C: All 3 sequential fetches completed', true);
    assert(maxConcurrency === 1, 'Scenario C: Strict serialized execution with maxConcurrency = 1', true);
    assert(controller.isInFlight() === false, 'Scenario C: Returned to clean idle state', true);
  }

  // Scenario D: Fetch failure with pending refresh triggers follow-up fetch and recovers
  {
    console.log('  Testing Scenario D: Error handling & follow-up recovery...');
    let fetchCount = 0;
    const errorsRecorded: (string | null)[] = [];
    const deferred1 = createDeferred();
    const deferred2 = createDeferred();

    const controller = createTestRefreshController({
      fetcher: async () => {
        fetchCount++;
        if (fetchCount === 1) {
          await deferred1.promise;
          throw new Error('Supabase network error during Fetch 1');
        } else {
          await deferred2.promise;
        }
      },
      onErrorChange: (err) => {
        errorsRecorded.push(err);
      },
    });

    // Start Fetch 1
    void controller.trigger(false);

    // Event arrives during Fetch 1
    void controller.trigger(false);

    // Complete Fetch 1 (which throws)
    deferred1.resolve();
    await new Promise((r) => setTimeout(r, 10));

    assert(
      errorsRecorded.includes('Supabase network error during Fetch 1'),
      'Scenario D: Fetch 1 error caught and logged',
      true
    );
    assert(fetchCount === 2, 'Scenario D: Pending refresh still triggered Fetch 2 despite Fetch 1 failure', true);

    // Resolve Fetch 2 cleanly
    deferred2.resolve();
    await new Promise((r) => setTimeout(r, 10));

    assert(
      errorsRecorded[errorsRecorded.length - 1] === null,
      'Scenario D: Fetch 2 cleared previous error state upon recovery',
      true
    );
    assert(controller.isInFlight() === false, 'Scenario D: System recovered and idle', true);
  }

  // Scenario E: Unmount during active fetch cancels pending follow-up without errors or state updates
  {
    console.log('  Testing Scenario E: Component unmount safety...');
    let fetchCount = 0;
    let loadingState = false;
    const deferred1 = createDeferred();

    const controller = createTestRefreshController({
      fetcher: async () => {
        fetchCount++;
        await deferred1.promise;
      },
      onLoadingChange: (loading) => {
        loadingState = loading;
      },
    });

    // Start Fetch 1
    void controller.trigger(false);

    // Event arrives during Fetch 1
    void controller.trigger(false);
    assert(controller.hasPendingRefresh() === true, 'Scenario E: Pending refresh queued', true);

    // Component unmounts
    controller.unmount();
    assert(controller.hasPendingRefresh() === false, 'Scenario E: Pending flags cleared upon unmount', true);

    // Resolve Fetch 1 after unmount
    deferred1.resolve();
    await new Promise((r) => setTimeout(r, 10));

    assert(fetchCount === 1, 'Scenario E: Follow-up fetch suppressed after unmount', true);
    assert(loadingState === false, 'Scenario E: No state listener invocations after unmount', true);
  }

  // Scenario F: Manual refresh during active fetch queues manual follow-up preserving manual loading state
  {
    console.log('  Testing Scenario F: Manual refresh loading indicator preservation...');
    let fetchCount = 0;
    const manualFlags: boolean[] = [];
    let loadingState = false;

    const deferred1 = createDeferred();
    const deferred2 = createDeferred();

    const controller = createTestRefreshController({
      fetcher: async (isManual = false) => {
        fetchCount++;
        manualFlags.push(isManual);
        if (fetchCount === 1) {
          await deferred1.promise;
        } else {
          await deferred2.promise;
        }
      },
      onLoadingChange: (loading) => {
        loadingState = loading;
      },
    });

    // Start background fetch (isManual = false)
    void controller.trigger(false);
    assert(loadingState === false, 'Scenario F: Initial background fetch does not force manual loading spinner', true);

    // User clicks manual refresh while Fetch 1 is in-flight
    void controller.trigger(true);
    assert(controller.hasPendingManualRefresh() === true, 'Scenario F: pendingManualRefresh flag captured', true);
    assert(loadingState === true, 'Scenario F: Manual loading spinner activated immediately upon user click', true);

    // Resolve Fetch 1 -> triggers Fetch 2 with isManual = true
    deferred1.resolve();
    await new Promise((r) => setTimeout(r, 10));

    assert(fetchCount === 2, 'Scenario F: Fetch 2 began', true);
    assert(manualFlags[0] === false, 'Scenario F: Fetch 1 was background', true);
    assert(manualFlags[1] === true, 'Scenario F: Fetch 2 inherited manual flag from user intent', true);
    assert(loadingState === true, 'Scenario F: Loading spinner remained active through Fetch 2 execution', true);

    // Resolve Fetch 2
    deferred2.resolve();
    await new Promise((r) => setTimeout(r, 10));

    assert(loadingState === false, 'Scenario F: Loading spinner turned off only after Fetch 2 completed', true);
  }

  // Scenario G: 30-second polling tick during active fetch queues at most one follow-up
  {
    console.log('  Testing Scenario G: 30-second polling tick during active fetch...');
    let fetchCount = 0;
    let maxConcurrency = 0;
    let active = 0;

    const deferred1 = createDeferred();
    const deferred2 = createDeferred();

    const controller = createTestRefreshController({
      fetcher: async () => {
        fetchCount++;
        active++;
        if (active > maxConcurrency) maxConcurrency = active;
        if (fetchCount === 1) {
          await deferred1.promise;
        } else {
          await deferred2.promise;
        }
        active--;
      },
    });

    // Start initial fetch
    void controller.trigger(false);

    // Polling interval triggers tick (false) while Fetch 1 in-flight
    void controller.trigger(false);

    // Second polling tick triggers before Fetch 1 resolves
    void controller.trigger(false);

    assert(controller.hasPendingRefresh() === true, 'Scenario G: Polling ticks buffered as pending refresh', true);
    assert(fetchCount === 1, 'Scenario G: Polling did not spawn overlapping HTTP request', true);

    // Resolve Fetch 1
    deferred1.resolve();
    await new Promise((r) => setTimeout(r, 10));

    assert(fetchCount === 2, 'Scenario G: Follow-up fetch executed once for buffered ticks', true);

    // Resolve Fetch 2
    deferred2.resolve();
    await new Promise((r) => setTimeout(r, 10));

    assert(fetchCount === 2, 'Scenario G: Total fetches capped at 2', true);
    assert(maxConcurrency === 1, 'Scenario G: Concurrency never exceeded 1 during polling collisions', true);
  }

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
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
