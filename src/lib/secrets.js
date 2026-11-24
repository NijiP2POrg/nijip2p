const DB_NAME = "nijip2p-secrets";
const DB_STORE = "kv";
const DB_KEYID = "device-key";
let memory = new Map();
let dbPromise = null;
let cryptoKey = null;
const enc = new TextEncoder();
const dec = new TextDecoder();
function b64(buf) {
  let s = "";
  const b = new Uint8Array(buf);
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}
function unb64(s) {
  const raw = atob(s);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(DB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).catch(() => null);
  return dbPromise;
}
async function idbGet(key) {
  const db = await openDB();
  if (!db) return undefined;
  return new Promise(resolve => {
    const tx = db.transaction(DB_STORE, "readonly");
    const req = tx.objectStore(DB_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(undefined);
  });
}
async function idbSet(key, value) {
  const db = await openDB();
  if (!db) return false;
  return new Promise(resolve => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put(value, key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}
async function idbDel(key) {
  const db = await openDB();
  if (!db) return;
  return new Promise(resolve => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}
async function getOrCreateKey() {
  if (cryptoKey) return cryptoKey;
  let key = await idbGet(DB_KEYID);
  if (!key || typeof CryptoKey === "undefined" || !(key instanceof CryptoKey)) {
    key = await crypto.subtle.generateKey({
      name: "AES-GCM",
      length: 256
    }, false, ["encrypt", "decrypt"]);
    await idbSet(DB_KEYID, key);
  }
  cryptoKey = key;
  return key;
}
async function encryptPlain(plain) {
  const key = await getOrCreateKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({
    name: "AES-GCM",
    iv
  }, key, enc.encode(plain));
  return b64(iv) + "." + b64(ct);
}
async function decryptBlob(blob) {
  try {
    const [ivB, ctB] = String(blob).split(".");
    const key = await getOrCreateKey();
    const pt = await crypto.subtle.decrypt({
      name: "AES-GCM",
      iv: unb64(ivB)
    }, key, unb64(ctB));
    return dec.decode(pt);
  } catch {
    return null;
  }
}
export async function hydrateSecrets() {
  const db = await openDB();
  if (!db) return;
  const keys = await new Promise(resolve => {
    const tx = db.transaction(DB_STORE, "readonly");
    const req = tx.objectStore(DB_STORE).getAllKeys();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => resolve([]);
  });
  for (const k of keys) {
    if (k === DB_KEYID) continue;
    const blob = await idbGet(k);
    if (typeof blob !== "string") continue;
    const plain = await decryptBlob(blob);
    if (plain !== null) memory.set(k, plain);
  }
}
export function getSecret(name) {
  return memory.has(name) ? memory.get(name) : null;
}
export function hasSecret(name) {
  return memory.has(name);
}
export async function setSecret(name, value) {
  if (value === null || value === undefined) return delSecret(name);
  memory.set(name, String(value));
  await idbSet(name, await encryptPlain(String(value)));
}
export async function delSecret(name) {
  memory.delete(name);
  await idbDel(name);
}
export async function migrateLegacy(name) {
  let legacy = null;
  try {
    legacy = localStorage.getItem(name);
  } catch {
    return false;
  }
  if (typeof legacy !== "string" || !legacy.length) return false;
  if (!memory.has(name)) await setSecret(name, legacy);
  try {
    localStorage.removeItem(name);
  } catch {}
  return true;
}