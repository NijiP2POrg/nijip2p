import { ethers } from "ethers";
import { aggregateReads, MULTICALL3 } from "./multicall.js";
const STATUS_NAMES = ["NONE", "TAKEN", "LOCKED", "PAID", "SETTLED", "REFUNDED", "VOIDED", "DISPUTED"];
const TOKEN_ABI = ["function decimals() view returns (uint8)", "function balanceOf(address) view returns (uint256)"];
const DEAL_ABI = ["function offers(uint256) view returns (uint256 id, address seller, address token, uint256 maxAmount, uint256 rate, uint64 payWindow, bool cash, bool cancelled, uint256 activeTradeId)", "function trades(uint256) view returns (uint256 id, uint256 offerId, address seller, address buyer, address token, uint256 amount, uint256 rate, uint8 status, uint64 lockedAt, uint64 paidAt, address arbiterPin)"];
const DEC_KEY = "nijip2p-decimals-v1";
const BALANCE_MS = 15000;
const TOKEN_DECIMALS = {
  "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d": 18,
  "0x55d398326f99059ff775485246999027b3197955": 18
};
const engines = new Map();
const jstr = v => JSON.stringify(v, (k, x) => typeof x === "bigint" ? x.toString() : x);
function readDecCache() {
  try {
    const v = JSON.parse(localStorage.getItem(DEC_KEY) ?? "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}
function writeDecCache(v) {
  try {
    localStorage.setItem(DEC_KEY, JSON.stringify(v));
  } catch {}
}
function emptyState() {
  return {
    offers: [],
    trades: {},
    myTradeIds: [],
    payLeft: {},
    decimals: readDecCache(),
    balance: null,
    txBy: {},
    cashByOffer: {},
    reasons: {},
    blockNumber: 0,
    lastSyncedAt: 0,
    syncing: false,
    stale: false,
    error: "",
    ready: false,
    source: "database",
    catchingUp: false
  };
}
class DatabaseBoard {
  constructor(cfg) {
    this.cfg = cfg;
    this.desk = cfg.desk === "cash" ? "cash" : "remote";
    this.key = "db:" + Number(cfg.chainId) + ":" + String(cfg.deal).toLowerCase() + ":" + this.desk;
    this.state = emptyState();
    this.state.decimals = {
      ...TOKEN_DECIMALS,
      ...this.state.decimals
    };
    this.subs = new Set();
    this.inFlight = null;
    this.user = "";
    this.lastBalanceAt = 0;
    this.absorb = {
      offers: new Map(),
      trades: new Map()
    };
    this._lastSig = "";
    this.closed = false;
    this._hb = null;
    this._hbBusy = false;
    this.startHeartbeat();
  }
  get base() {
    return String(this.cfg.supabaseUrl ?? "").trim().replace(/\/$/, "");
  }
  get anon() {
    return String(this.cfg.supabaseAnonKey ?? "").trim();
  }
  subscribe(fn) {
    this.subs.add(fn);
    fn(this.state);
    return () => this.subs.delete(fn);
  }
  set(patch) {
    this.state = {
      ...this.state,
      ...patch
    };
    const t = patch.trades ?? this.state.trades ?? {};
    const sig = JSON.stringify([(patch.offers ?? this.state.offers ?? []).map(o => String(o.id) + ":" + o.activeTradeId.toString() + ":" + (o.cancelled ? 1 : 0)).join("|"), Object.keys(t).sort().map(k => k + ":" + Number(t[k].status)).join("|"), jstr(patch.balance ?? this.state.balance ?? {}), jstr(patch.cashByOffer ?? this.state.cashByOffer ?? {}), jstr(patch.txBy ?? this.state.txBy ?? {}), jstr(Object.fromEntries(Object.entries(patch.payLeft ?? this.state.payLeft ?? {}).map(([k, v]) => [k, Math.round(Number(v) / 30)]))), jstr(patch.decimals ?? this.state.decimals ?? {}), patch.error ?? "", patch.stale ?? false, patch.ready ?? false, patch.syncing ?? false, patch.catchingUp ?? false]);
    if (sig === this._lastSig) return;
    this._lastSig = sig;
    for (const fn of this.subs) {
      try {
        fn(this.state);
      } catch {}
    }
  }
  async get(path) {
    let lastErr = null;
    for (let i = 0; i < 3; i += 1) {
      try {
        const res = await fetch(`${this.base}/rest/v1${path}`, {
          headers: {
            apikey: this.anon
          }
        });
        if (res.ok) return res.json();
        if (res.status === 401 || res.status === 403) throw new Error("database " + res.status);
        lastErr = new Error("database " + res.status);
      } catch (e) {
        if (String(e?.message ?? e).startsWith("database 401") || String(e?.message ?? e).startsWith("database 403")) throw e;
        lastErr = e;
      }
      await new Promise(r => setTimeout(r, 400 * (i + 1)));
    }
    throw lastErr ?? new Error("database read failed");
  }
  async sync({
    provider,
    user
  } = {}) {
    if (this.closed) return this.state;
    const next = String(user ?? "").toLowerCase();
    if (next !== this.user) {
      this.user = next;
      this.lastBalanceAt = 0;
      this.offerById = null;
      this.offerBlock = 0;
      this.inFlight = null;
    }
    if (this.inFlight) return this.inFlight;
    const runFor = this.user;
    this.inFlight = this.refresh(provider).catch(e => {
      this.set({
        error: String(e?.message ?? e ?? "database read failed"),
        syncing: false,
        stale: true
      });
      return this.state;
    }).finally(() => {
      if (runFor === this.user) this.inFlight = null;
    });
    return this.inFlight;
  }
  async paged(path, pageSize = 1000, cap = 20000) {
    const out = [];
    for (let offset = 0; offset < cap; offset += pageSize) {
      const sep = path.includes("?") ? "&" : "?";
      const rows = await this.get(`${path}${sep}limit=${pageSize}&offset=${offset}`);
      if (!Array.isArray(rows) || !rows.length) break;
      out.push(...rows);
      if (rows.length < pageSize) break;
    }
    return out;
  }
  toOffer(row) {
    const active = BigInt(row.active_trade_id);
    return {
      id: String(row.id),
      seller: String(row.seller).toLowerCase(),
      token: String(row.token).toLowerCase(),
      maxAmount: BigInt(row.max_amount),
      rate: BigInt(row.rate),
      payWindow: Number(row.pay_window),
      cash: Boolean(row.cash),
      cancelled: Boolean(row.cancelled),
      activeTradeId: active
    };
  }
  voidedTrades(row, trades) {
    const active = BigInt(row.active_trade_id);
    if (active === 0n) return false;
    const t = trades?.[String(active)];
    if (!t) return false;
    const name = STATUS_NAMES[Number(t.status)] ?? "";
    return name === "VOIDED";
  }
  deadTrades(row, trades) {
    const active = BigInt(row.active_trade_id);
    if (active === 0n) return false;
    const t = trades?.[String(active)];
    if (!t) return false;
    const name = STATUS_NAMES[Number(t.status)] ?? "";
    return name === "SETTLED" || name === "REFUNDED";
  }
  visible(row, trades) {
    if (Boolean(row.cancelled)) return false;
    if (this.deadTrades(row, trades)) return false;
    if (this.voidedTrades(row, trades)) return true;
    return this.desk === "cash" ? Boolean(row.cash) : !Boolean(row.cash);
  }
  async refresh(provider) {
    const chain = Number(this.cfg.chainId);
    const me = this.user;
    const stateRows = await this.get(`/indexer_state?chain_id=eq.${chain}&select=last_block,updated_at`);
    const head = Number(stateRows?.[0]?.last_block ?? 0);
    const tradeRows = me ? await this.paged(`/trades?chain_id=eq.${chain}&or=(buyer.eq.${me},seller.eq.${me})&select=*&order=id.desc`, 500, 5000) : null;
    const trades = tradeRows ? {} : {
      ...(this.state.trades ?? {})
    };
    const payLeft = {};
    const myTradeIds = [];
    const needWindow = new Map();
    for (const t of tradeRows ?? []) {
      const id = String(t.id);
      myTradeIds.push(id);
      trades[id] = {
        id,
        offerId: BigInt(t.offer_id),
        seller: String(t.seller).toLowerCase(),
        buyer: String(t.buyer).toLowerCase(),
        token: String(t.token).toLowerCase(),
        amount: BigInt(t.amount),
        rate: BigInt(t.rate),
        status: BigInt(Number(t.status)),
        lockedAt: BigInt(t.locked_at),
        paidAt: BigInt(t.paid_at),
        arbiterPin: String(t.arbiter_pin).toLowerCase()
      };
      if (STATUS_NAMES[Number(t.status)] === "LOCKED") needWindow.set(String(t.offer_id), id);
    }
    const txBy = {};
    if (myTradeIds.length) {
      try {
        const ids = myTradeIds.map(x => encodeURIComponent(x)).join(",");
        const evRows = await this.get(`/event_log?chain_id=eq.${chain}&trade_id=in.(${ids})&name=in.(TradeSettled,TradeRefunded,TradeVoided)&select=trade_id,tx_hash,block_number,log_index&order=block_number.asc,log_index.asc`);
        for (const e of evRows ?? []) txBy[String(e.trade_id)] = e.tx_hash;
      } catch {}
    }
    const cashByOffer = {
      ...(this.state.cashByOffer ?? {})
    };
    if (myTradeIds.length) {
      try {
        const offIds = [...new Set(Object.values(trades).map(t => String(t.offerId)))];
        for (let i = 0; i < offIds.length; i += 100) {
          const chunk = offIds.slice(i, i + 100).map(x => encodeURIComponent(x)).join(",");
          const rows = await this.get(`/offers?chain_id=eq.${chain}&id=in.(${chunk})&select=id,cash`);
          for (const r of rows ?? []) cashByOffer[String(r.id)] = Boolean(r.cash);
        }
      } catch {}
    }
    const nowMs = Date.now();
    for (const [id, a] of this.absorb.trades) {
      if (nowMs - a.at > 90000) {
        this.absorb.trades.delete(id);
        continue;
      }
      trades[id] = a.obj;
      if (a.tx) txBy[id] = a.tx;
    }
    if (!this.offerById) this.offerById = new Map();
    if (!this.offerBlock) this.offerBlock = 0;
    if (!this.offerById.size || head < this.offerBlock) {
      const rows = await this.paged(`/offers?chain_id=eq.${chain}&select=*&order=id.desc`);
      this.offerById = new Map();
      for (const r of rows) if (this.visible(r, trades)) this.offerById.set(String(r.id), this.toOffer(r));
      this.offerBlock = head;
    } else if (head > this.offerBlock) {
      const rows = await this.paged(`/offers?chain_id=eq.${chain}&updated_block=gte.${this.offerBlock}&select=*`);
      for (const r of rows) {
        const id = String(r.id);
        if (this.visible(r, trades)) this.offerById.set(id, this.toOffer(r));else this.offerById.delete(id);
      }
      this.offerBlock = head;
    } else if (tradeRows) {
      const rows = await this.paged(`/offers?chain_id=eq.${chain}&select=*&order=id.desc`);
      this.offerById = new Map();
      for (const r of rows) if (this.visible(r, trades)) this.offerById.set(String(r.id), this.toOffer(r));
    }
    for (const [id, a] of this.absorb.offers) {
      if (nowMs - a.at > 90000) {
        this.absorb.offers.delete(id);
        continue;
      }
      const rowShaped = {
        id,
        cancelled: a.obj.cancelled,
        active_trade_id: a.obj.activeTradeId.toString(),
        cash: a.obj.cash
      };
      if (this.visible(rowShaped, trades)) this.offerById.set(id, a.obj);else this.offerById.delete(id);
    }
    if (needWindow.size) {
      const ids = [...needWindow.keys()];
      for (let i = 0; i < ids.length; i += 100) {
        const chunk = ids.slice(i, i + 100).map(x => encodeURIComponent(x)).join(",");
        const rows = await this.get(`/offers?chain_id=eq.${chain}&id=in.(${chunk})&select=id,pay_window`);
        for (const r of rows ?? []) this.offerWindow = {
          ...(this.offerWindow || {}),
          [String(r.id)]: Number(r.pay_window)
        };
      }
    }
    for (const [offerId, tradeId] of needWindow) {
      const t = trades[tradeId];
      const window = Number(this.offerWindow?.[offerId] ?? 0);
      if (!window || Number(t.lockedAt) <= 0) continue;
      const left = Number(t.lockedAt) + window - Math.floor(Date.now() / 1000);
      if (left > 0) payLeft[tradeId] = left;
    }
    const reasons = {};
    if (me && myTradeIds.length) {
      try {
        const ids = myTradeIds.map(x => encodeURIComponent(x)).join(",");
        const rows = await this.get(`/disputes?chain_id=eq.${chain}&trade_id=in.(${ids})&select=trade_id,reason`);
        for (const d of rows ?? []) reasons[String(d.trade_id)] = d.reason ?? "";
      } catch {}
    }
    const offers = [...this.offerById.values()].sort((a, b) => {
      const x = BigInt(a.id);
      const y = BigInt(b.id);
      return x === y ? 0 : x > y ? -1 : 1;
    });
    const patch = {
      offers,
      trades,
      myTradeIds,
      payLeft,
      reasons,
      txBy,
      cashByOffer,
      decimals: {
        ...TOKEN_DECIMALS,
        ...this.state.decimals
      },
      lastSyncedAt: stateRows?.[0]?.updated_at ? Date.parse(stateRows[0].updated_at) : Date.now(),
      error: "",
      stale: false,
      ready: true,
      syncing: false
    };
    if (head > 0) {
      patch.blockNumber = head;
      patch.catchingUp = false;
    } else {
      patch.catchingUp = true;
    }
    this.set(patch);
    if (provider && me && Date.now() - this.lastBalanceAt > BALANCE_MS) {
      const bal = await this.readBalances(provider).catch(() => ({}));
      this.lastBalanceAt = Date.now();
      this.set(bal);
    }
    return this.state;
  }
  async readBalances(provider) {
    const cfg = this.cfg;
    const mc = cfg.multicall || MULTICALL3;
    const tok = new ethers.Interface(TOKEN_ABI);
    const calls = [];
    const meta = [];
    for (const k of ["usdc", "usdt"]) {
      const addr = cfg[k];
      if (!addr) continue;
      if (this.state.decimals[addr] == null) {
        calls.push({
          target: addr,
          data: tok.encodeFunctionData("decimals", []),
          label: "decimals"
        });
        meta.push({
          kind: "decimals",
          key: addr
        });
      }
      calls.push({
        target: addr,
        data: tok.encodeFunctionData("balanceOf", [this.user]),
        label: k + " balance"
      });
      meta.push({
        kind: "balance",
        key: k
      });
    }
    if (!calls.length) return {};
    const res = await aggregateReads(provider, mc, calls, {
      chunk: 50
    });
    const decimals = {
      ...this.state.decimals
    };
    const balance = {
      ...(this.state.balance || {})
    };
    for (let i = 0; i < meta.length; i += 1) {
      const r = res[i];
      if (!r?.success) continue;
      try {
        if (meta[i].kind === "decimals") decimals[meta[i].key] = Number(tok.decodeFunctionResult("decimals", r.returnData)[0]);else balance[meta[i].key] = ethers.toBigInt(r.returnData);
      } catch {}
    }
    writeDecCache(decimals);
    return {
      decimals,
      balance
    };
  }
  chainReader() {
    if (this._reader) return this._reader;
    const url = String(this.cfg.readRpcUrl || this.cfg.rpcUrl || "").trim();
    if (!url || !this.cfg.deal) return null;
    const p = new ethers.JsonRpcProvider(url, Number(this.cfg.chainId), {
      staticNetwork: true,
      batchMaxCount: 1,
      pollingInterval: 4000,
      cacheTimeout: 250
    });
    this._reader = new ethers.Contract(this.cfg.deal, DEAL_ABI, p);
    return this._reader;
  }
  mergeAbsorbedOffersNow() {
    const nowMs = Date.now();
    const map = new Map((this.state.offers ?? []).map(o => [String(o.id), o]));
    for (const [id, a] of this.absorb.offers) {
      if (nowMs - a.at > 90000) {
        this.absorb.offers.delete(id);
        continue;
      }
      const rowShaped = {
        id,
        cancelled: a.obj.cancelled,
        active_trade_id: a.obj.activeTradeId.toString(),
        cash: a.obj.cash
      };
      if (this.visible(rowShaped, this.state.trades ?? {})) map.set(id, a.obj);else map.delete(id);
    }
    const offers = [...map.values()].sort((a, b) => {
      const x = BigInt(a.id);
      const y = BigInt(b.id);
      return x === y ? 0 : x > y ? -1 : 1;
    });
    this.set({
      offers
    });
  }
  mergeAbsorbedTradesNow() {
    const nowMs = Date.now();
    const trades = {
      ...(this.state.trades ?? {})
    };
    const txBy = {
      ...(this.state.txBy ?? {})
    };
    for (const [id, a] of this.absorb.trades) {
      if (nowMs - a.at > 90000) {
        this.absorb.trades.delete(id);
        continue;
      }
      trades[id] = a.obj;
      if (a.tx) txBy[id] = a.tx;
    }
    this.set({
      trades,
      txBy
    });
  }
  async absorbReceipt({
    offerId,
    tradeId,
    tx
  } = {}) {
    const c = this.chainReader();
    if (!c) return;
    const now = Date.now();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        if (offerId != null) {
          const o = await c.offers(BigInt(offerId));
          const obj = {
            id: String(offerId),
            seller: String(o.seller).toLowerCase(),
            token: String(o.token).toLowerCase(),
            maxAmount: BigInt(o.maxAmount),
            rate: BigInt(o.rate),
            payWindow: Number(o.payWindow),
            cash: Boolean(o.cash),
            cancelled: Boolean(o.cancelled),
            activeTradeId: BigInt(o.activeTradeId)
          };
          this.absorb.offers.set(obj.id, {
            obj,
            at: now
          });
          if (obj.activeTradeId !== 0n && tradeId == null) tradeId = obj.activeTradeId;
          this.mergeAbsorbedOffersNow();
        }
        if (tradeId != null) {
          const t = await c.trades(BigInt(tradeId));
          const st = Number(t.status);
          const obj = {
            id: String(tradeId),
            offerId: BigInt(t.offerId),
            seller: String(t.seller).toLowerCase(),
            buyer: String(t.buyer).toLowerCase(),
            token: String(t.token).toLowerCase(),
            amount: BigInt(t.amount),
            rate: BigInt(t.rate),
            status: BigInt(st),
            lockedAt: BigInt(t.lockedAt),
            paidAt: BigInt(t.paidAt),
            arbiterPin: String(t.arbiterPin).toLowerCase(),
            tx: ["SETTLED", "REFUNDED", "VOIDED"].includes(STATUS_NAMES[st] ?? "") ? tx ?? null : undefined
          };
          this.absorb.trades.set(obj.id, {
            obj,
            at: now,
            tx: obj.tx
          });
          this.mergeAbsorbedTradesNow();
        }
        await this.sync({
          user: this.user
        }).catch(() => {});
        return;
      } catch {
        if (attempt < 2) await new Promise(r => setTimeout(r, 500));
      }
    }
  }
  startHeartbeat() {
    if (this._hb) return;
    this._hb = setInterval(() => {
      this.heartbeat().catch(() => {});
    }, 3000);
  }
  stopHeartbeat() {
    if (this._hb) {
      clearInterval(this._hb);
      this._hb = null;
    }
  }
  async heartbeat() {
    if (this.closed || this._hbBusy) return;
    if (typeof document !== "undefined" && document.hidden) return;
    const st = this.state ?? {};
    const trades = st.trades ?? {};
    const c = this.chainReader();
    if (!c) return;
    const ids = Object.keys(trades).filter(id => {
      const nm = STATUS_NAMES[Number(trades[id].status)] ?? "";
      return !["SETTLED", "REFUNDED", "VOIDED"].includes(nm);
    });
    if (!ids.length) return;
    this._hbBusy = true;
    try {
      await Promise.allSettled(ids.map(async id => {
        const cur = trades[id];
        let t;
        try {
          t = await c.trades(BigInt(id));
        } catch {
          return;
        }
        const nst = Number(t.status);
        if (nst === Number(cur.status)) return;
        const obj = {
          id: String(id),
          offerId: BigInt(t.offerId),
          seller: String(t.seller).toLowerCase(),
          buyer: String(t.buyer).toLowerCase(),
          token: String(t.token).toLowerCase(),
          amount: BigInt(t.amount),
          rate: BigInt(t.rate),
          status: BigInt(nst),
          lockedAt: BigInt(t.lockedAt),
          paidAt: BigInt(t.paidAt),
          arbiterPin: String(t.arbiterPin).toLowerCase(),
          tx: ["SETTLED", "REFUNDED", "VOIDED"].includes(STATUS_NAMES[nst] ?? "") ? cur.tx ?? null : undefined
        };
        this.absorb.trades.set(obj.id, {
          obj,
          at: Date.now(),
          tx: obj.tx
        });
        this.mergeAbsorbedTradesNow();
      }));
    } finally {
      this._hbBusy = false;
    }
  }
  applyReceipt(rc, ids = {}) {
    for (const ms of [900, 3000, 7000]) {
      setTimeout(() => {
        this.sync({
          user: this.user
        }).catch(() => {});
      }, ms);
    }
    if (ids && (ids.offerId != null || ids.tradeId != null)) {
      const payload = {
        ...ids,
        tx: rc?.hash
      };
      setTimeout(() => {
        this.absorbReceipt(payload).catch(() => {});
      }, 250);
    }
  }
  async disputeReason() {
    return this.state.reasons;
  }
  close() {
    this.stopHeartbeat();
    this.closed = true;
    this.subs.clear();
  }
}
export function getBoardSource(cfg) {
  const url = String(cfg?.supabaseUrl ?? "").trim();
  const key = String(cfg?.supabaseAnonKey ?? "").trim();
  if (url && key) {
    const k = "db:" + Number(cfg.chainId) + ":" + (cfg.deal ?? "") + ":" + (cfg.desk ?? "");
    if (!engines.has(k)) engines.set(k, new DatabaseBoard(cfg));
    return engines.get(k);
  }
  return null;
}
export { STATUS_NAMES };