import { ethers } from "ethers";
export const NETWORKS = [{
  chainId: 1,
  name: "Ethereum",
  short: "Ethereum",
  currency: "ETH",
  defaultRpc: "https://eth.llamarpc.com",
  explorer: "https://etherscan.io",
  dev: false
}, {
  chainId: 56,
  name: "BNB Smart Chain",
  short: "BNB Chain",
  currency: "BNB",
  defaultRpc: "https://bsc-dataseed.binance.org",
  explorer: "https://bscscan.com",
  dev: false
}, {
  chainId: 137,
  name: "Polygon",
  short: "Polygon",
  currency: "POL",
  defaultRpc: "https://polygon-rpc.com",
  explorer: "https://polygonscan.com",
  dev: false
}];
export const LOCAL = {
  chainId: 31337,
  name: "Local network",
  short: "Local",
  currency: "ETH",
  defaultRpc: "http://127.0.0.1:8545",
  explorer: "",
  dev: true
};
const RPC_KEY = "nijip2p-rpc-v1";
const NET_KEY = "nijip2p-network-v1";
export function networkMeta(chainId) {
  const id = Number(chainId);
  return NETWORKS.find(n => n.chainId === id) ?? (id === LOCAL.chainId ? LOCAL : null);
}
export function isSupportedMainnet(chainId) {
  return NETWORKS.some(n => n.chainId === Number(chainId));
}
export function getRpcPrefs() {
  try {
    return JSON.parse(localStorage.getItem(RPC_KEY) ?? "{}");
  } catch {
    return {};
  }
}
export function getCustomRpc(chainId) {
  const v = getRpcPrefs()[String(chainId)];
  return typeof v === "string" && v.trim() ? v.trim() : "";
}
export function setCustomRpc(chainId, url) {
  const prefs = getRpcPrefs();
  const clean = String(url ?? "").trim();
  if (clean) prefs[String(chainId)] = clean;else delete prefs[String(chainId)];
  try {
    localStorage.setItem(RPC_KEY, JSON.stringify(prefs));
  } catch {}
}
export function clearCustomRpc(chainId) {
  setCustomRpc(chainId, "");
}
export function rpcFor(chainId) {
  const meta = networkMeta(chainId);
  return getCustomRpc(chainId) || (meta?.defaultRpc ?? "");
}
export function getSelectedChainId(fallback) {
  const id = Number(localStorage.getItem(NET_KEY));
  if (NETWORKS.some(n => n.chainId === id) || id === LOCAL.chainId) return id;
  return Number(fallback);
}
export function setSelectedChainId(chainId) {
  try {
    localStorage.setItem(NET_KEY, String(Number(chainId)));
  } catch {}
}
export async function validateRpc(url, expectedChainId) {
  const clean = String(url ?? "").trim();
  if (!clean) return {
    ok: false,
    error: "Type an RPC URL first."
  };
  let parsed;
  try {
    parsed = new URL(clean);
  } catch {
    return {
      ok: false,
      error: "That is not a valid URL; it must start with http:// or https:// (or ws:// for a local relay)."
    };
  }
  if (!/^https?:$/.test(parsed.protocol)) return {
    ok: false,
    error: "The RPC endpoint must use http:// or https://."
  };
  let provider;
  try {
    provider = new ethers.JsonRpcProvider(clean, undefined);
  } catch {
    return {
      ok: false,
      error: "The endpoint could not be opened; check the URL."
    };
  }
  let got;
  try {
    got = Number((await provider.getNetwork()).chainId);
  } catch {
    return {
      ok: false,
      error: "The endpoint did not answer; check that it is reachable and speaks JSON-RPC."
    };
  }
  if (got !== Number(expectedChainId)) {
    return {
      ok: false,
      chainId: got,
      error: `The endpoint reports chain ${got}, but ${networkMeta(expectedChainId)?.name ?? expectedChainId} is chain ${expectedChainId}.`
    };
  }
  return {
    ok: true,
    chainId: got,
    error: ""
  };
}