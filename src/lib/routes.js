const APP_HOST = "app.nijip2p.me";
const LANDING_HOSTS = ["nijip2p.me", "www.nijip2p.me"];
export const APP_URL = "https://app.nijip2p.me";
export function hostKind() {
  let h = "";
  try {
    h = String(window.location.hostname || "").toLowerCase();
  } catch {
    return "other";
  }
  if (h === APP_HOST) return "app";
  if (LANDING_HOSTS.includes(h)) return "landing";
  return "other";
}
export function appHref(tab) {
  const t = tab || "home";
  const path = t === "home" ? "/" : "/" + t;
  const kind = hostKind();
  if (kind === "app") return path;
  if (kind === "other") return "#/app" + (t === "home" ? "" : path);
  return APP_URL + path;
}
export function openAppHref(tab) {
  return appHref(tab);
}