const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;
export function arbiterAddress(cfg) {
  const a = cfg?.arbiter;
  if (typeof a !== "string" || !ADDR_RE.test(a)) return "";
  if (a.toLowerCase() === "0x" + "0".repeat(40)) return "";
  return a;
}
export function arbiterConfigured(cfg) {
  return !!arbiterAddress(cfg);
}