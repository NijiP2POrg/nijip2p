import { forgetAccount } from "./account.js";
const KEY = "nijip2p-lock-idle";
const NOTE = "nijip2p-lock-note";
export const DEFAULT_MIN = 0;
export const CHOICES = [0, 5, 15, 30, 60];
export function lockMinutes() {
  try {
    const v = parseInt(localStorage.getItem(KEY) ?? "", 10);
    return Number.isFinite(v) && v >= 0 ? v : DEFAULT_MIN;
  } catch {
    return DEFAULT_MIN;
  }
}
export function setLockMinutes(m) {
  try {
    localStorage.setItem(KEY, String(Math.max(0, m | 0)));
  } catch {}
}
export async function lockNow() {
  try {
    localStorage.setItem(NOTE, "1");
  } catch {}
  try {
    await forgetAccount();
  } catch {}
  window.location.reload();
}
export function takeLockNote() {
  try {
    if (localStorage.getItem(NOTE) !== "1") return false;
    localStorage.removeItem(NOTE);
    return true;
  } catch {
    return false;
  }
}
export function armIdleLock() {
  const min = lockMinutes();
  if (!min) return () => {};
  const state = {
    t: Date.now()
  };
  const bump = () => {
    state.t = Date.now();
  };
  const events = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"];
  for (const e of events) window.addEventListener(e, bump, {
    passive: true,
    capture: true
  });
  const iv = setInterval(() => {
    if (Date.now() - state.t >= min * 60000) lockNow();
  }, 15000);
  return () => {
    clearInterval(iv);
    for (const e of events) window.removeEventListener(e, bump, {
      capture: true
    });
  };
}