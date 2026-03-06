let lastNavigationAt = 0;
let navigatingLock = false;

const THROTTLE_MS = 500;

export function runThrottled(fn: () => void, throttleMs = THROTTLE_MS): void {
  const now = Date.now();
  if (now - lastNavigationAt < throttleMs) {
    return;
  }
  lastNavigationAt = now;
  fn();
}

export function runSafelyWithLock(fn: () => void, lockMs = THROTTLE_MS): void {
  if (navigatingLock) {
    return;
  }
  navigatingLock = true;
  fn();
  setTimeout(() => {
    navigatingLock = false;
  }, lockMs);
}
