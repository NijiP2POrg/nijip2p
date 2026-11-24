const CACHE_KEY = "nijip2p-city-geo-v1";
const mem = new Map();
const bad = new Set();
const inflight = new Map();
let lastStart = 0;
const loadDisk = () => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") ?? {};
  } catch {
    return {};
  }
};
const saveDisk = (k, v) => {
  try {
    const all = loadDisk();
    all[k] = v;
    const keys = Object.keys(all);
    if (keys.length > 120) for (const old of keys.slice(0, keys.length - 120)) delete all[old];
    localStorage.setItem(CACHE_KEY, JSON.stringify(all));
  } catch {}
};
export const cityGeoKey = (city, stateName) => `${String(city ?? "").trim().toLowerCase()}|${String(stateName ?? "").trim().toLowerCase()}`;
export async function geocodeCity(city, stateName) {
  const c = String(city ?? "").trim();
  if (!c) return null;
  const key = cityGeoKey(city, stateName);
  if (mem.has(key)) return mem.get(key);
  if (bad.has(key)) return null;
  const disk = loadDisk()[key];
  if (disk?.lat != null) {
    mem.set(key, disk);
    return disk;
  }
  if (inflight.has(key)) return inflight.get(key);
  const job = (async () => {
    const wait = Math.max(0, lastStart + 1100 - Date.now());
    if (wait) await new Promise(res => setTimeout(res, wait));
    lastStart = Date.now();
    try {
      const q = `${c}${stateName ? ", " + stateName : ""}, India`;
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=en&q=${encodeURIComponent(q)}`, {
        headers: {
          Accept: "application/json"
        }
      });
      const rows = await r.json();
      const hit = Array.isArray(rows) && rows[0] ? {
        lat: Number(rows[0].lat),
        lon: Number(rows[0].lon)
      } : null;
      if (hit && Number.isFinite(hit.lat) && Number.isFinite(hit.lon)) {
        mem.set(key, hit);
        saveDisk(key, hit);
        return hit;
      }
    } catch {}
    bad.add(key);
    return null;
  })();
  inflight.set(key, job);
  try {
    return await job;
  } finally {
    inflight.delete(key);
  }
}