import { useSyncExternalStore } from "react";
const slots = new Map();
const listeners = new Set();
let version = 0;
function emit() {
  version++;
  listeners.forEach(l => l());
}
export function reportActivity(deskId, items) {
  slots.set(deskId, {
    items: Array.isArray(items) ? items : [],
    at: Date.now()
  });
  emit();
}
export function clearActivity(deskId) {
  if (slots.has(deskId)) {
    slots.delete(deskId);
    emit();
  }
}
let cache = {
  v: -1,
  list: []
};
export function getActivity() {
  if (cache.v !== version) {
    const out = [];
    for (const [, slot] of slots) for (const it of slot.items) out.push({
      ...it,
      at: slot.at
    });
    out.sort((a, b) => (b.hot ? 1 : 0) - (a.hot ? 1 : 0));
    cache = {
      v: version,
      list: out
    };
  }
  return cache.list;
}
export function deskItems(deskId) {
  return slots.get(deskId)?.items ?? [];
}
export function subscribeActivity(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function useActivity() {
  return useSyncExternalStore(subscribeActivity, getActivity, getActivity);
}
export function useDeskActivity(deskId) {
  return useSyncExternalStore(subscribeActivity, () => (slots.get(deskId)?.items?.length ?? 0) > 0, () => false);
}
export const activityVersion = () => version;