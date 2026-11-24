import { ethers } from "ethers";
const B32 = "0123456789bcdefghjkmnpqrstuvwxyz";
export const GEOHASH_CHARS = 7;
export function geohashEncode(lat, lon, chars = GEOHASH_CHARS) {
  let latMin = -90,
    latMax = 90,
    lonMin = -180,
    lonMax = 180,
    hash = "",
    bit = 0,
    chEven = 1,
    ch = 0;
  while (hash.length < chars) {
    if (chEven) {
      const mid = (lonMin + lonMax) / 2;
      if (lon >= mid) {
        ch = (ch << 1) + 1;
        lonMin = mid;
      } else {
        ch <<= 1;
        lonMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        ch = (ch << 1) + 1;
        latMin = mid;
      } else {
        ch <<= 1;
        latMax = mid;
      }
    }
    chEven = !chEven;
    if (++bit === 5) {
      hash += B32[ch];
      bit = 0;
      ch = 0;
    }
  }
  return hash;
}
export function geohashBounds(hash) {
  let even = 1,
    latMin = -90,
    latMax = 90,
    lonMin = -180,
    lonMax = 180;
  for (const c of String(hash).toLowerCase()) {
    const idx = B32.indexOf(c);
    if (idx < 0) return null;
    for (let b = 4; b >= 0; b--) {
      const bit = idx >> b & 1;
      if (even) {
        const mid = (lonMin + lonMax) / 2;
        if (bit) lonMin = mid;else lonMax = mid;
      } else {
        const mid = (latMin + latMax) / 2;
        if (bit) latMin = mid;else latMax = mid;
      }
      even = !even;
    }
  }
  return {
    latMin,
    latMax,
    lonMin,
    lonMax
  };
}
export function geohashDecode(hash) {
  const b = geohashBounds(hash);
  return b ? {
    lat: (b.latMin + b.latMax) / 2,
    lon: (b.lonMin + b.lonMax) / 2
  } : null;
}
export const cellToUint64 = hash => {
  let v = 0n;
  for (const c of String(hash).toLowerCase()) {
    const i = B32.indexOf(c);
    if (i < 0) return null;
    v = v * 32n + BigInt(i);
  }
  return v;
};
export const cellFromUint64 = cell => {
  if (cell == null) return null;
  const s = String(cell).toLowerCase();
  if (s.length === GEOHASH_CHARS && /^[0123456789bcdefghjkmnpqrstuvwxyz]+$/.test(s)) return s;
  try {
    let v = BigInt(s),
      out = "";
    for (let i = 0; i < GEOHASH_CHARS; i++) {
      out = B32[Number(v % 32n)] + out;
      v /= 32n;
    }
    return out;
  } catch {
    return null;
  }
};
export const cellFromGPS = (lat, lon) => cellToUint64(geohashEncode(lat, lon));
export function neighbourCells(lat, lon) {
  const h = geohashDecode(geohashEncode(lat, lon));
  const step = 0.00137 * 1.02;
  const out = [];
  for (const dLat of [-step, 0, step]) {
    for (const dLon of [-step * 1.4, 0, step * 1.4]) {
      if (!dLat && !dLon) continue;
      const c = cellToUint64(geohashEncode(h.lat + dLat, h.lon + dLon));
      if (c != null) out.push(c);
    }
  }
  return out;
}
export function matchCell(myLat, myLon, wantCell) {
  const want = BigInt(wantCell);
  const mine = cellFromGPS(myLat, myLon);
  if (mine != null && mine === want) return {
    ok: true,
    cell: mine,
    near: false
  };
  const near = neighbourCells(myLat, myLon).some(c => c === want);
  if (near) return {
    ok: true,
    cell: want,
    near: true
  };
  return {
    ok: false,
    cell: mine,
    near: false
  };
}
const WORDS = ["amber", "basil", "cedar", "delta", "ember", "flint", "garnet", "hazel", "indigo", "jade", "koel", "lotus", "mango", "neem", "opal", "pearl", "quartz", "river", "saffron", "teak", "ultra", "violet", "willow", "xenon", "yacht", "zephyr", "monsoon", "peacock", "banyan", "coral", "dusk", "falcon", "grove", "harbor", "iris", "jasmine", "kite", "lumen", "marble", "nectar"];
export const cellFromWords = words => {
  const h = ethers.keccak256(ethers.toUtf8Bytes("nijip2p-venue:" + String(words ?? "").trim().toLowerCase()));
  return BigInt(h) & 0xFFFFFFFFFFFFFFFn;
};
export const cellDisplay = pin => {
  if (!pin) return "";
  if (pin.kind === "words") return pin.words;
  if (pin.kind === "gps" || pin.kind === "map") {
    const h = cellFromUint64(pin.cell);
    return h ?? String(pin.cell);
  }
  return String(pin.cell);
};
export function getGPS(timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("this device has no location service"));
      return;
    }
    const timer = setTimeout(() => reject(new Error("the location fix timed out - move near a window or use the venue words")), timeoutMs);
    navigator.geolocation.getCurrentPosition(pos => {
      clearTimeout(timer);
      resolve({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        acc: pos.coords.accuracy ?? 0
      });
    }, err => {
      clearTimeout(timer);
      reject(new Error(err?.code === 1 ? "location permission denied - the venue words are the fallback" : err?.message ?? "the location fix failed"));
    }, {
      enableHighAccuracy: true,
      timeout: timeoutMs - 500,
      maximumAge: 30000
    });
  });
}
export const makeGpsPin = ({
  lat,
  lon,
  code
}) => ({
  kind: "gps",
  cell: cellFromGPS(lat, lon),
  code
});
export const makeMapPin = ({
  lat,
  lon,
  code
}) => ({
  kind: "map",
  cell: cellFromGPS(lat, lon),
  code
});
export const pinText = pin => pin?.kind === "words" ? `${pin.code} ${pin.words}` : `${pin.code} ${cellFromUint64(pin.cell) ?? ""}`.trim();