const DB_NAME = "nijip2p-board";
const DB_VERSION = 1;
const STORE = "boards";
let dbPromise = null;
function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  }).catch(() => null);
  return dbPromise;
}
const BIG = "__bigint";
function encode(value) {
  if (typeof value === "bigint") return {
    [BIG]: value.toString()
  };
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value)) out[k] = encode(value[k]);
    return out;
  }
  return value;
}
function decode(value) {
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === "object") {
    if (typeof value[BIG] === "string" && Object.keys(value).length === 1) return BigInt(value[BIG]);
    const out = {};
    for (const k of Object.keys(value)) out[k] = decode(value[k]);
    return out;
  }
  return value;
}
export async function readBoard(key) {
  try {
    const db = await openDB();
    if (!db) return null;
    return await new Promise(resolve => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => {
        const raw = req.result;
        if (!raw) {
          resolve(null);
          return;
        }
        try {
          resolve(decode(raw));
        } catch {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}
export async function writeBoard(key, value) {
  try {
    const db = await openDB();
    if (!db) return false;
    const payload = encode({
      ...value,
      savedAt: Date.now()
    });
    return await new Promise(resolve => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(payload, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}
export async function clearBoard(key) {
  try {
    const db = await openDB();
    if (!db) return;
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
  } catch {}
}