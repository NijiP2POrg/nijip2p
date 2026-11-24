import { ethers } from "ethers";
export const NETWORKS = {
  1: "Ethereum",
  56: "BNB Chain",
  137: "Polygon"
};
export function networkName(cfg) {
  const id = Number(cfg?.chainId);
  if (NETWORKS[id]) return NETWORKS[id];
  if (cfg?.mode === "local" || cfg?.network === "local") return "Local network";
  const n = String(cfg?.network ?? "").trim();
  if (n) return n.charAt(0).toUpperCase() + n.slice(1);
  return "Unknown network";
}
export const gasSymbol = chainId => Number(chainId) === 56 ? "BNB" : Number(chainId) === 137 ? "POL" : "ETH";
const EXPLORERS = {
  1: "https://etherscan.io",
  56: "https://bscscan.com",
  137: "https://polygonscan.com"
};
export function txUrl(cfg, hash) {
  const base = EXPLORERS[Number(cfg?.chainId)];
  return base && hash ? base + "/tx/" + hash : null;
}
export function addrUrl(cfg, addr) {
  const base = EXPLORERS[Number(cfg?.chainId)];
  return base && addr ? base + "/address/" + addr : null;
}
export function fmtAmount(v, decimals = 6, maxFrac = 2) {
  try {
    return Number(ethers.formatUnits(v ?? 0n, decimals)).toLocaleString("en-US", {
      maximumFractionDigits: maxFrac
    });
  } catch {
    return "-";
  }
}
export const fmtStable = (v, maxFrac = 2) => fmtAmount(v, 6, maxFrac);
export const fmtToken = (v, decimals, maxFrac = 2) => fmtAmount(v, Number(decimals ?? 18), maxFrac);
export const fmtEthAmt = (v, maxFrac = 6) => fmtAmount(v, 18, maxFrac);
export function fmtDur(total) {
  let s = Math.max(0, Math.floor(Number(total ?? 0)));
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  if (d) return h ? `${d}d ${h}h` : `${d}d`;
  if (h) return m ? `${h}h ${m}m` : `${h}h`;
  if (m) return s ? `${m}m ${s}s` : `${m}m`;
  return `${s}s`;
}
export const STATUS_LABELS = {
  NONE: "Not started",
  LOCKED: "Locked",
  TAKEN: "Taken",
  PAID: "Paid",
  SETTLED: "Settled",
  REFUNDED: "Refunded",
  DISPUTED: "Disputed"
};
export const statusLabel = v => STATUS_LABELS[v] ?? String(v ?? "-");
export const isClosedStatus = v => v === "SETTLED" || v === "REFUNDED";
const REVERT_MAP = [[/Failed to fetch|fetch failed|NetworkError|network error|ECONNREFUSED|ENOTFOUND|ERR_NETWORK|load failed/i, "The app could not reach the network.", "Check the network selector in the top bar, then open RPC settings and try a different endpoint. If you run a local node, make sure it is up."], [/timed? ?out|ETIMEDOUT|timeout/i, "The RPC endpoint accepted the request but never answered.", "Retry once; if it keeps hanging, switch to another endpoint in RPC settings."], [/429|too many requests|rate limit/i, "The public RPC endpoint is rate-limiting this browser.", "Wait a few seconds and refresh, or set a private endpoint in RPC settings."], [/missing revert data|CALL_EXCEPTION|contract does not exist|bad address checksum|is not a contract/i, "The contract could not be read at the configured address.", "The deployment record probably does not match this chain. Check the contract addresses in config.json and the network selector."], [/EnforcedPause|Pausable: paused/, "The protocol is paused right now.", "Every fund movement waits until the operator unpauses. Your trade state and chat keep working; try again later."], [/PAY_WINDOW_OVER/, "The payment window ended before the payment was marked.", "If the buyer did pay, raise a dispute so the arbiter can rule from the chat evidence. Otherwise the escrow can be refunded to the seller."], [/NOT_EXPIRED/, "The time window is still running; this action opens later.", "Wait for the countdown to reach zero; the button turns on by itself."], [/SELF_TAKE/, "A trader cannot take their own offer.", "Connect the account you buy with, or wait for another trader."], [/OFFER_UNAVAILABLE/, "This offer is gone - someone took or withdrew it first.", "Refresh the list and pick another open offer."], [/NOT_CANCELLABLE/, "This offer can no longer be withdrawn.", "An offer inside a live trade must finish first: settle, refund or dispute."], [/BAD_TOKEN/, "That token is not accepted here.", "This desk settles in USDC or USDT only."], [/CASH_WINDOW_7D/, "In-person offers must carry the full 7-day window.", "It is a security rule, not a preference - publish the offer again with the 7-day timer."], [/BAD_WINDOW/, "That payment window is out of range.", "Remote offers run 20 minutes to 7 days; in-person offers run exactly 7 days."], [/NOT_SELLER/, "Only this trade's seller can do that.", "Connect the account which published the offer."], [/NOT_BUYER/, "Only this trade's buyer can do that.", "Connect the account that claimed the offer."], [/NOT_PARTY/, "Only this trade's seller or buyer can do that.", "Connect an account that is part of the trade."], [/NOT_ARBITER|NO_ARBITER|ARBITER_REPOINTED|DISPUTE_NOT_PINNED/, "Only the arbiter may do that.", "Disputed trades are ruled by the on-chain court the dispute was pinned to."], [/LAST_ARBITER/, "The last arbiter cannot be removed; a ruling desk must always exist.", "Add the replacement first, then remove the old one."], [/BAD_STATUS/, "The trade moved on; this action no longer applies.", "Refresh and check the current step; the other side may have just acted."], [/BAD_AMOUNT|BAD_INPUT|TRANSFER_MISMATCH/, "One of the inputs is not valid.", "Check the amount - greater than zero and within the offer's max - and try again."], [/insufficient allowance|ERC20: insufficient allowance|"ALLOW"/, "The escrow is not allowed to move your tokens yet.", "Approve the escrow when the transaction asks; the lock flow does it automatically."], [/exceeds balance|"BAL"|ERC20: transfer amount exceeds balance/, "This account does not hold enough tokens for that.", "Check the balance on the account card, then try a smaller amount."], [/insufficient funds/i, "This account cannot cover the gas fee for this transaction.", "Send a little native token to the account address for gas, then try again."], [/user (rejected|denied)|rejected transaction|User rejected/i, "The signing request was declined.", "Try again and approve the prompt."], [/nonce too low/i, "A newer transaction from this account has already landed.", "Refresh; if the action still stands, retry it."], [/execution reverted(?!:)/i, "The contract turned the transaction away.", "Open the raw reason below; a refresh usually shows what changed."]];
export function explainRevert(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return {
    headline: "",
    doNow: "",
    detail: ""
  };
  for (const [re, what, now] of REVERT_MAP) {
    if (re.test(raw)) return {
      headline: what,
      doNow: now,
      detail: raw
    };
  }
  return {
    headline: raw,
    doNow: "",
    detail: ""
  };
}