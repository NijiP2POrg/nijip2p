import { ethers } from "ethers";
import ABIS from "../abi/abis.json";
import { hasAccount, currentMaterial } from "./account.js";
export const ABIs = ABIS;
export async function loadConfig() {
  const res = await fetch("./config.json?v=" + encodeURIComponent(String(import.meta.url).split("/").pop() || "0"));
  if (!res.ok) throw new Error("config.json not found - deploy the suite or copy deployments/<network>.json here");
  return res.json();
}
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
export function makeProvider(cfg) {
  return new ethers.JsonRpcProvider(cfg.rpcUrl, Number(cfg.chainId), {
    staticNetwork: true
  });
}
const CHAIN_META = {
  1: {
    name: "Ethereum",
    rpc: "https://eth.llamarpc.com",
    explorer: "https://etherscan.io",
    currency: "ETH"
  },
  56: {
    name: "BNB Chain",
    rpc: "https://bsc-dataseed.binance.org",
    explorer: "https://bscscan.com",
    currency: "BNB"
  },
  137: {
    name: "Polygon",
    rpc: "https://polygon-rpc.com",
    explorer: "https://polygonscan.com",
    currency: "POL"
  }
};
const toHex = n => "0x" + Number(n).toString(16);
export async function openSession(cfg) {
  const provider = makeProvider(cfg);
  let pref = null;
  try {
    pref = localStorage.getItem("nijip2p-session-pref");
  } catch {}
  if (pref === "code" && hasAccount()) {
    const m = await currentMaterial();
    if (m) {
      const wallet = new ethers.Wallet(m.evmPriv, provider);
      return {
        provider,
        signer: wallet,
        address: wallet.address,
        kind: "code"
      };
    }
  }
  return null;
}
const CONTRACT_NAMES = {
  deal: "NijiDeal",
  court: "NijiCourt",
  usdc: "ERC20",
  usdt: "ERC20"
};
export function contractAt(cfg, key, providerOrSigner) {
  const addr = cfg[key];
  if (!addr) throw new Error(`config.json has no "${key}" - run the deploy`);
  const name = CONTRACT_NAMES[key] ?? key;
  const abi = ABIs[name];
  if (!abi) throw new Error(`no ABI bundled for ${name}`);
  return new ethers.Contract(addr, abi, providerOrSigner);
}
export const tokenAbi = ["function balanceOf(address) view returns (uint256)", "function approve(address,uint256) returns (bool)", "function allowance(address,address) view returns (uint256)", "function decimals() view returns (uint8)", "function symbol() view returns (string)"];
export const un = r => r && typeof r.toObject === "function" ? r.toObject() : r ?? {};
export const short = a => a ? a.slice(0, 6) + "…" + a.slice(-4) : "-";
const EXPLORERS = {
  1: "https://etherscan.io",
  56: "https://bscscan.com",
  137: "https://polygonscan.com"
};
export function txExplorerUrl(cfg, hash) {
  const base = EXPLORERS[Number(cfg?.chainId)];
  return base ? base + "/tx/" + hash : null;
}
export function addressExplorerUrl(cfg, addr) {
  const base = EXPLORERS[Number(cfg?.chainId)];
  return base ? base + "/address/" + addr : null;
}
export const fmt = (v, dec = 6) => Number(ethers.formatUnits(v, dec)).toLocaleString("en-IN", {
  maximumFractionDigits: 2
});
export const fmtZec = v => Number(ethers.formatUnits(v, 8)).toLocaleString("en-IN", {
  maximumFractionDigits: 4
});
export const fmtXmr = v => Number(ethers.formatUnits(v, 12)).toLocaleString("en-IN", {
  maximumFractionDigits: 6
});
export const rupee = paise => {
  const rupees = Number(paise) / 100;
  return "₹" + rupees.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(rupees) ? 0 : 2
  });
};
export const fiatFor = (rate, amount, decimals) => Number(rate) * Number(amount) / 10 ** decimals;
export const parseRateInr = input => {
  const s = String(input ?? "").trim().replace(/,/g, "");
  if (!s) return {
    err: "Enter a rate in ₹ per 1 unit"
  };
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return {
    err: "Rate must be a number with at most 2 decimals - e.g. 99 or 99.50"
  };
  const paise = Math.round(Number(s) * 100);
  if (!(paise > 0)) return {
    err: "Rate must be greater than ₹0"
  };
  return {
    paise: BigInt(paise),
    inr: Number(s)
  };
};
export const STATUS = {
  Deal: ["NONE", "TAKEN", "LOCKED", "PAID", "SETTLED", "REFUNDED", "VOIDED", "DISPUTED"]
};
export function revertText(e) {
  if (!e) return "";
  if (typeof e === "string") return e;
  if (e.reason) return e.reason;
  if (e.shortMessage) return e.shortMessage;
  if (e.data?.message) return e.data.message;
  if (e.info?.error?.message) return e.info.error.message.slice(0, 240);
  if (e.message?.includes("reverted")) return e.message.slice(0, 240);
  return e.message?.slice(0, 240) ?? "tx failed";
}