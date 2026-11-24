import { ethers } from "ethers";
import { getSecret, hasSecret, delSecret } from "./secrets.js";
export const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const PAYLOAD_LEN = 24;
const CK_LEN = 4;
const SALT = "nijip2p-account-v1";
const PBKDF2_ITERS = 200000;
const R_EVM = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const LOCAL_KEY = "nijip2p-account-code";
const te = new TextEncoder();
async function sha(bytes) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}
const cat = (...arrs) => {
  const out = new Uint8Array(arrs.reduce((a, b) => a + b.length, 0));
  let o = 0;
  for (const a of arrs) {
    out.set(a, o);
    o += a.length;
  }
  return out;
};
const modB = (bytes, m) => {
  let v = 0n;
  for (const b of bytes) v = v << 8n | BigInt(b);
  v %= m;
  return v === 0n ? 1n : v;
};
function base32(buf) {
  let bits = 0,
    value = 0,
    out = "";
  for (const b of buf) {
    value = value << 8 | b;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[value >>> bits - 5 & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[value << 5 - bits & 31];
  return out;
}
const grp = s => s.match(/.{1,4}/g).join("-");
export const pretty = (payload, ck) => "PS-" + grp(payload) + "-" + ck;
export async function createCode() {
  for (;;) {
    const payload = base32(crypto.getRandomValues(new Uint8Array(16))).slice(0, PAYLOAD_LEN);
    const ck = base32(await sha(te.encode("PS" + payload))).slice(0, CK_LEN);
    if (/^[2-9A-HJ-NP-TV-Z]+$/.test(payload)) return pretty(payload, ck);
  }
}
export function normalize(code) {
  const cleaned = String(code || "").toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/^PS/, "").replace(/[O]/g, "0").replace(/[IL]/g, "1").replace(/[U]/g, "V");
  if (cleaned.length !== PAYLOAD_LEN + CK_LEN) throw new Error(`a nijip2p account code has ${PAYLOAD_LEN + CK_LEN} characters after PS- (${cleaned.length} given)`);
  const payload = cleaned.slice(0, PAYLOAD_LEN),
    ck = cleaned.slice(PAYLOAD_LEN);
  if (!new RegExp(`^[${ALPHABET}]+$`).test(payload + ck)) throw new Error("the code contains characters nijip2p codes never use");
  return {
    payload,
    ck
  };
}
export async function deriveSeed(codeNormalizedFull) {
  const keyMat = await crypto.subtle.importKey("raw", te.encode(codeNormalizedFull), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({
    name: "PBKDF2",
    hash: "SHA-256",
    salt: te.encode(SALT),
    iterations: PBKDF2_ITERS
  }, keyMat, 512);
  return new Uint8Array(bits);
}
export async function deriveFromCode(code) {
  const {
    payload,
    ck
  } = normalize(code);
  const want = base32(await sha(te.encode("PS" + payload))).slice(0, CK_LEN);
  if (want !== ck) throw new Error("that code has a typo - check it against your backup");
  const seed = await deriveSeed(payload + ck);
  const evmPriv = "0x" + modB(await sha(cat(seed, te.encode("evm-wallet-v1"))), R_EVM - 1n).toString(16).padStart(64, "0");
  const wallet = new ethers.Wallet(evmPriv);
  const nostrSk = [...(await sha(cat(seed, te.encode("nostr-v1"))))].map(b => b.toString(16).padStart(2, "0")).join("");
  return {
    seed,
    evmPriv: wallet.privateKey,
    address: wallet.address,
    nostrSk,
    code: pretty(payload, ck)
  };
}
export function storedCode() {
  return getSecret(LOCAL_KEY) ?? "";
}
const HOT_KEY = "nijip2p-session-hot";
export function hotCode() {
  try {
    return sessionStorage.getItem(HOT_KEY) || "";
  } catch {
    return "";
  }
}
export function setHotCode(code) {
  try {
    sessionStorage.setItem(HOT_KEY, String(code || ""));
  } catch {}
}
export function clearHotCode() {
  try {
    sessionStorage.removeItem(HOT_KEY);
  } catch {}
}
export function hasAccount() {
  return !!hotCode() || hasSecret(LOCAL_KEY);
}
export async function forgetAccount() {
  _matCache = null;
  clearHotCode();
  await delSecret(LOCAL_KEY);
}
export async function createAccount() {
  const code = await createCode();
  const m = await deriveFromCode(code);
  _matCache = {
    key: m.code,
    material: m
  };
  return {
    code: m.code,
    address: m.address
  };
}
export async function loginWithCode(code) {
  const m = await deriveFromCode(code);
  _matCache = {
    key: m.code,
    material: m
  };
  return {
    code: m.code,
    address: m.address
  };
}
let _matCache = null;
export async function currentMaterial() {
  const code = hotCode() || storedCode();
  if (!code) return null;
  if (_matCache && _matCache.key === code) return _matCache.material;
  const m = await deriveFromCode(code);
  _matCache = {
    key: code,
    material: m
  };
  return m;
}