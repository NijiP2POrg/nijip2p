import { ethers } from "ethers";
const RANGE_RE = /block range|range (is )?too (large|wide|big)|too many blocks|exceed(s|ed)? (the )?(max|limit)|limit exceeded|more than .* (blocks|results)|response size|query returned more than/i;
export function errorText(e) {
  return String(e?.shortMessage ?? e?.reason ?? e?.message ?? e ?? "");
}
export function isRangeError(e) {
  return RANGE_RE.test(errorText(e));
}
export function withTimeout(promise, ms, label = "RPC request") {
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error(label + " timed out after " + Math.round(ms / 1000) + "s")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}
export function explainDbError(e) {
  const text = errorText(e);
  if (/database 401|database 403/i.test(text)) return "The board feed rejected this device - a reload usually fixes it.";
  if (/429|rate[- ]?limit|too many requests/i.test(text)) return "The board feed is rate-limiting this device - retrying shortly.";
  if (/timed? ?out|ETIMEDOUT|Failed to fetch|NetworkError|ERR_NETWORK|ECONNREFUSED|ECONNRESET|fetch failed/i.test(text)) return "The board feed did not answer - retrying shortly.";
  return text;
}
const gasCache = {
  at: 0,
  value: null
};
const FEE_KEY = "nijip2p-feetier-v1";
const ECONOMY_FLOOR_GWEI = "0.05";
let feeTier = "standard";
try {
  const t = localStorage.getItem(FEE_KEY);
  if (t === "economy" || t === "standard" || t === "fast") feeTier = t;
} catch {}
export function getFeeTier() {
  return feeTier;
}
export function setFeeTier(t) {
  if (t !== "economy" && t !== "standard" && t !== "fast") return;
  feeTier = t;
  try {
    localStorage.setItem(FEE_KEY, t);
  } catch {}
}
export function tierPrice(tier, rec) {
  if (rec == null) return null;
  if (tier === "economy") {
    const floor = ethers.parseUnits(ECONOMY_FLOOR_GWEI, "gwei");
    const low = rec * 6n / 10n;
    return low > floor ? low : floor;
  }
  if (tier === "fast") return rec * 3n / 2n;
  return rec;
}
export async function recommendedGasPrice(provider) {
  if (gasCache.value && Date.now() - gasCache.at < 60000) return gasCache.value;
  try {
    const gp = await provider.getGasPrice();
    gasCache.value = gp;
    gasCache.at = Date.now();
    return gp;
  } catch {
    return gasCache.value ?? ethers.parseUnits(ECONOMY_FLOOR_GWEI, "gwei");
  }
}
export async function liveGasPrice(provider) {
  try {
    const gp = await provider.getGasPrice();
    gasCache.value = gp;
    gasCache.at = Date.now();
    return gp;
  } catch {
    return gasCache.value ?? ethers.parseUnits(ECONOMY_FLOOR_GWEI, "gwei");
  }
}
export function finalTierPrice(tier, live) {
  if (live == null) return null;
  const tp = tierPrice(tier, live) ?? live;
  return tp > live ? tp : live;
}
export async function gasPriceOf(provider) {
  return finalTierPrice(feeTier, await liveGasPrice(provider));
}