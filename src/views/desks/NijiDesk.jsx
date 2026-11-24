import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ethers } from "ethers";
import { AppCtx } from "../../AppCtx.jsx";
import { contractAt, tokenAbi, rupee, parseRateInr, fiatFor, short, STATUS, revertText, un, ABIs, makeProvider } from "../../lib/chain.js";
import { getBoardSource } from "../../lib/boardDb.js";
import { explainDbError, gasPriceOf, liveGasPrice, finalTierPrice, getFeeTier, setFeeTier } from "../../lib/rpc.js";
import { fmtAmount } from "../../lib/format.js";
import { Panel, Field, Button, Badge, Err, OkBox, TxLine, Status, Copy, MiniFlow, Countdown, TradeChat, EmptyState, TradeCard, sortOpenTrades, toast, confirmDialog, promptDialog, amountSheet, DeskGate } from "../../lib/ui.jsx";
import { peersForTrade } from "../../chat/presence.js";
import SimplexRoom from "../../components/SimplexRoom.jsx";
import TelegramRoom from "../../components/TelegramRoom.jsx";
import { deleteTgGroup } from "../../lib/tgRoom.js";
import { annForOffer, getPick, rememberPick, offerIdFromReceipt, publishBoardNudge, meetCodeOf } from "../../lib/offerRails.js";
import { RailPicker, RailChips, RailDrawer, chooseRails, annLabel } from "../../components/OfferRails.jsx";
import { Coin } from "../../lib/brand.jsx";
import { reportActivity } from "../../lib/activity.js";
import { postTradeMessage } from "../../lib/ui.jsx";
import { makeMapPin, cellFromUint64, geohashBounds } from "../../lib/geo.js";
import { VENUE_TAG, venuePinMessage, parseVenuePin } from "../../lib/cashSessions.js";
import MapPicker from "../../components/MapPicker.jsx";
import StaticMap from "../../components/StaticMap.jsx";
const TOKEN_DECIMALS = {
  "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d": 18,
  "0x55d398326f99059ff775485246999027b3197955": 18
};
const REMOTE_WINDOW = 20 * 60;
const CASH_WINDOW = 7 * 24 * 60 * 60;
const GAS_USED_KEY = "nijip2p-gasused-v1";
const DEFAULT_GAS = 160000;
const gasUsedFor = action => {
  try {
    const all = JSON.parse(localStorage.getItem(GAS_USED_KEY) ?? "{}");
    const v = Number(all?.[action]);
    return Number.isFinite(v) && v > 0 ? v : DEFAULT_GAS;
  } catch {
    return DEFAULT_GAS;
  }
};
const recordGasUsed = (action, rc) => {
  const v = Number(rc?.gasUsed);
  if (!Number.isFinite(v) || v <= 0) return;
  try {
    const all = JSON.parse(localStorage.getItem(GAS_USED_KEY) ?? "{}");
    all[action] = v;
    localStorage.setItem(GAS_USED_KEY, JSON.stringify(all));
  } catch {}
};
const USD_KEY = "nijip2p-bnbusd-v1";
const usdMemo = {
  at: 0,
  usd: null
};
const readUsdCache = () => {
  try {
    const v = JSON.parse(localStorage.getItem(USD_KEY) ?? "null");
    const usd = Number(v?.usd);
    return Number.isFinite(usd) && usd > 0 ? usd : null;
  } catch {
    return null;
  }
};
const grabUsd = async (url, pick) => {
  try {
    const res = await Promise.race([fetch(url), new Promise((_, rej) => setTimeout(() => rej(new Error("usd timeout")), 8000))]);
    if (!res.ok) return null;
    const v = pick(await res.json());
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
};
const fetchUsd = async () => {
  if (usdMemo.usd != null && Date.now() - usdMemo.at < 60000) return usdMemo.usd;
  let usd = await grabUsd("https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd", j => Number(j?.binancecoin?.usd));
  if (usd == null) usd = await grabUsd("https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT", j => Number(j?.price));
  if (usd == null) return readUsdCache();
  usdMemo.usd = usd;
  usdMemo.at = Date.now();
  try {
    localStorage.setItem(USD_KEY, JSON.stringify({
      usd,
      at: usdMemo.at
    }));
  } catch {}
  return usd;
};
const cellGeohashOf = pin => pin && (pin.kind === "gps" || pin.kind === "map") ? cellFromUint64(pin.cell) ?? "" : "";
function PinView({
  pin
}) {
  if (!pin) return null;
  let hash = null;
  try {
    hash = pin.kind === "gps" || pin.kind === "map" ? cellFromUint64(pin.cell) : null;
  } catch {
    hash = null;
  }
  const b = hash ? geohashBounds(hash) : null;
  const ctr = b ? {
    lat: (b.latMin + b.latMax) / 2,
    lon: (b.lonMin + b.lonMax) / 2
  } : null;
  const osm = ctr ? `https://www.openstreetmap.org/?mlat=${ctr.lat.toFixed(6)}&mlon=${ctr.lon.toFixed(6)}#map=17/${ctr.lat.toFixed(6)}/${ctr.lon.toFixed(6)}` : null;
  const gmaps = ctr ? `https://www.google.com/maps/search/?api=1&query=${ctr.lat.toFixed(6)},${ctr.lon.toFixed(6)}` : null;
  return <div className="venue-pin">
            {ctr ? <StaticMap className="vp-map" lat={ctr.lat} lon={ctr.lon} zoom={17} height={140} rect={b} label="The meetup square, ~150 m across" /> : null}
            <div className="vp-facts">
                <div className="fact"><div className="k">Meetup code</div><div className="v mono">{pin.code ?? "at the meet"}</div></div>
            </div>
            <div className="vp-links">
                {pin.code ? <Copy text={pin.code} label="Copy code" /> : null}
                {osm ? <a href={osm} target="_blank" rel="noreferrer">Open in OpenStreetMap ↗</a> : null}
                {gmaps ? <a href={gmaps} target="_blank" rel="noreferrer">Open in Google Maps ↗</a> : null}
            </div>
        </div>;
}
function PinPicker({
  pin,
  onPin
}) {
  const [mapOpen, setMapOpen] = useState(false);
  return <div>
            {!pin ? <Button tiny tone="accent" onClick={() => setMapOpen(true)}>Set the meetup spot</Button> : <div className="vp-row">
                    <Button tiny tone="ghost" onClick={() => setMapOpen(true)}>Change the spot</Button>
                </div>}
            <div style={{
      marginTop: 8
    }}><PinView pin={pin} /></div>
            <MapPicker open={mapOpen} onClose={() => setMapOpen(false)} onPick={({
      lat,
      lon
    }) => {
      setMapOpen(false);
      onPin(makeMapPin({
        lat,
        lon
      }));
    }} />
        </div>;
}
export default function NijiDesk({
  cash = false
}) {
  const {
    cfg,
    provider,
    session,
    me,
    relay,
    identity,
    inbox,
    setInbox,
    presence,
    offerAnns,
    publishOfferRails,
    queueOfferRails,
    boardNudge,
    publishPresence,
    queryRailAnnFor
  } = useContext(AppCtx);
  const p = provider;
  const readProvider = useMemo(() => {
    if (!cfg?.readRpcUrl || !cfg?.chainId) return provider;
    try {
      return makeProvider({
        rpcUrl: cfg.readRpcUrl,
        chainId: cfg.chainId
      });
    } catch {
      return provider;
    }
  }, [cfg?.readRpcUrl, cfg?.chainId, provider]);
  const missingKeys = ["deal", "usdc", "usdt"].filter(k => !cfg?.[k]);
  const deskKey = cash ? "cash" : "remote";
  const deskLabel = cash ? "In-Person Escrow" : "Remote Escrow";
  const [amount, setAmount] = useState("100");
  const [rate, setRate] = useState("92");
  const [tokenKey, setTokenKey] = useState("usdc");
  const busyRef = useRef("");
  const [busy, setBusy] = useState("");
  const busyKey = (label, id) => id != null ? `${label}:${id}` : label;
  const runGated = async (key, fn) => {
    if (busyRef.current) return false;
    busyRef.current = key;
    setBusy(key);
    try {
      return await fn();
    } finally {
      busyRef.current = "";
      setBusy("");
    }
  };
  const otherAction = key => busy !== "" && busy !== key;
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [txh, setTxh] = useState("");
  const PAGE = Number(cfg?.pageSize) > 0 ? Number(cfg?.pageSize) : 50;
  const [visibleOffers, setVisibleOffers] = useState(PAGE);
  useEffect(() => {
    setVisibleOffers(PAGE);
  }, [cash, cfg?.pageSize]);
  const [pin, setPin] = useState(null);
  const [pinSent, setPinSent] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("nijip2p-cash-pinsent-v1") ?? "{}");
    } catch {
      return {};
    }
  });
  const pinRef = useRef(pin);
  pinRef.current = pin;
  const pinSentRef = useRef(pinSent);
  pinSentRef.current = pinSent;
  const tradesRef = useRef([]);
  const [verifiedCodes, setVerifiedCodes] = useState({});
  const updatePin = next => setPin(next);
  const [decl, setDecl] = useState({
    rails: ["upi"],
    custom: ""
  });
  const [railInfo, setRailInfo] = useState(undefined);
  const listRef = useRef(null);
  const engine = useMemo(() => {
    if (missingKeys.length) return null;
    const pass = {
      ...cfg,
      abi: ABIs.NijiDeal,
      desk: cash ? "cash" : "remote"
    };
    return getBoardSource(pass);
  }, [cfg.deal, cfg.chainId, cfg.rpcUrl, cfg.readRpcUrl, cfg.supabaseUrl, cfg.supabaseAnonKey, cash]);
  const [board, setBoard] = useState(() => engine?.state ?? null);
  const [syncing, setSyncing] = useState(false);
  useEffect(() => {
    if (!engine) return;
    const unsub = engine.subscribe(s => setBoard(s));
    return () => {
      try {
        unsub();
      } catch {}
    };
  }, [engine]);
  const offers = useMemo(() => {
    const list = board?.offers ?? null;
    if (!list) return null;
    const allTrades = board?.trades ?? {};
    const tradeState = o => {
      const active = o.activeTradeId;
      if (active === 0n) return "";
      const t = allTrades[String(active)];
      if (!t) return "";
      return STATUS.Deal[Number(t.status)] ?? "";
    };
    return list.filter(o => Boolean(o.cash) === cash).filter(o => !o.cancelled).filter(o => tradeState(o) !== "SETTLED" && tradeState(o) !== "REFUNDED").map(o => tradeState(o) === "VOIDED" ? {
      ...o,
      activeTradeId: 0n
    } : o).sort((a, b) => Number(BigInt(b.id) - BigInt(a.id)));
  }, [board?.offers, board?.trades, cash]);
  const trades = useMemo(() => {
    const all = board?.trades ?? {};
    if (!me) return all;
    const out = {};
    for (const [id, t] of Object.entries(all)) {
      const mine = String(t.buyer).toLowerCase() === String(me).toLowerCase() || String(t.seller).toLowerCase() === String(me).toLowerCase();
      if (mine) out[id] = t;
    }
    return out;
  }, [board?.trades, me]);
  const payLeft = board?.payLeft ?? {};
  tradesRef.current = trades;
  const disputeReasons = board?.reasons ?? {};
  const txBy = board?.txBy ?? {};
  const readFailed = !board?.lastSyncedAt && !!board?.error;
  const dec = board?.decimals ?? {};
  const myTokenBal = me ? board?.balance?.[tokenKey] ?? null : null;
  useEffect(() => {
    const CAP = cash ? 2 : 4;
    const fit = () => {
      const el = listRef.current;
      if (!el) return;
      const lines = el.querySelectorAll(".offer-line");
      if (lines.length <= CAP) {
        el.style.maxHeight = "";
        el.style.overflowY = "";
        el.classList.remove("is-scroll");
        return;
      }
      const listTop = el.getBoundingClientRect().top;
      const last = lines[CAP - 1].getBoundingClientRect();
      el.style.maxHeight = Math.ceil(last.bottom - listTop + 6) + "px";
      el.style.overflowY = "auto";
      el.style.overscrollBehavior = "contain";
      el.style.scrollBehavior = "smooth";
      el.style.scrollbarWidth = "thin";
      el.classList.toggle("is-scroll", el.scrollHeight > el.clientHeight + 2);
    };
    fit();
    const t = setTimeout(fit, 350);
    window.addEventListener("resize", fit);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", fit);
    };
  }, [offers]);
  const esc = missingKeys.length ? null : contractAt(cfg, "deal", p);
  const nudgeSeen = useRef(new Map());
  useEffect(() => {
    if (!engine || !boardNudge) return;
    const {
      offerId,
      tradeId
    } = boardNudge;
    const st = engine.state ?? {};
    const offers = st.offers ?? [];
    const trades = st.trades ?? {};
    const mine = offerId != null && offers.some(o => String(o.id) === String(offerId)) || tradeId != null && trades[String(tradeId)] != null;
    if (!mine) return;
    const key = String(boardNudge.id ?? String(offerId) + ":" + String(tradeId));
    const last = nudgeSeen.current.get(key) ?? 0;
    if (Date.now() - last < 20000) return;
    nudgeSeen.current.set(key, Date.now());
    engine.absorbReceipt({
      ...(offerId != null ? {
        offerId
      } : {}),
      ...(tradeId != null ? {
        tradeId
      } : {})
    }).catch(() => {});
  }, [boardNudge, engine]);
  const railTries = useRef(new Map());
  const annsRef = useRef(offerAnns);
  annsRef.current = offerAnns;
  const [railMissing, setRailMissing] = useState(() => new Set());
  useEffect(() => {
    if (!engine || !queryRailAnnFor) return;
    const tick = () => {
      if (document.hidden) return;
      const offers = engine.state?.offers ?? [];
      const chainId = Number(cfg?.chainId ?? 0);
      for (const o of offers) {
        const id = String(o.id);
        if (o.cancelled || o.activeTradeId && o.activeTradeId !== 0n) continue;
        const akey = deskKey + "|" + chainId + "|" + id;
        if (annsRef.current?.[akey]) continue;
        const at = railTries.current.get(id) ?? {
          t: 0,
          n: 0
        };
        if (Date.now() - at.t < 45000 || at.n >= 5) continue;
        railTries.current.set(id, {
          t: Date.now(),
          n: at.n + 1
        });
        queryRailAnnFor(deskKey, chainId, id).catch(() => {});
        if (at.n + 1 >= 5) setRailMissing(prev => {
          if (prev.has(id)) return prev;
          const n = new Set(prev);
          n.add(id);
          return n;
        });
      }
    };
    tick();
    const t = setInterval(tick, 30000);
    return () => clearInterval(t);
  }, [engine, queryRailAnnFor, deskKey, cfg?.chainId]);
  const refresh = () => {
    if (!engine) return Promise.resolve(null);
    setSyncing(true);
    return engine.sync({
      provider: readProvider,
      user: me
    }).catch(() => null).finally(() => setSyncing(false));
  };
  useEffect(() => {
    if (!engine) return;
    refresh();
    const ms = engine?.state?.source === "database" ? Number(cfg.dbPollIntervalMs) > 0 ? Number(cfg.dbPollIntervalMs) : 4000 : Number(cfg.pollIntervalMs) > 0 ? Number(cfg.pollIntervalMs) : 30000;
    const t = setInterval(() => {
      if (!document.hidden) refresh();
    }, ms);
    const onShow = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("focus", onShow);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("focus", onShow);
    };
  }, [engine, me, cfg.pollIntervalMs]);
  if (missingKeys.length) {
    return <DeskGate title={`The ${deskLabel} desk is not configured on this deployment`} missing={missingKeys} cfg={cfg} />;
  }
  useEffect(() => {
    if (!me) {
      reportActivity(deskKey, []);
      return;
    }
    const items = [];
    for (const t of Object.values(trades)) {
      const status = STATUS.Deal[Number(t.status)] ?? "";
      const isSeller = String(t.seller ?? "").toLowerCase() === me.toLowerCase();
      const isBuyer = String(t.buyer ?? "").toLowerCase() === me.toLowerCase();
      if (!isSeller && !isBuyer) continue;
      const tid = t.id.toString();
      const base = {
        desk: deskKey,
        tab: deskKey,
        tradeId: tid,
        title: "Trade #" + tid
      };
      if (status === "TAKEN") {
        if (isSeller) items.push({
          ...base,
          key: `${deskKey}:${tid}:lock`,
          action: "Buyer waiting - lock the escrow when ready",
          hot: true
        });
      } else if (status === "LOCKED") {
        if (isBuyer && payLeft[tid]) items.push({
          ...base,
          key: `${deskKey}:${tid}:pay`,
          action: cash ? "At the table? Hand the cash, then mark it handed" : "Pay the fiat - the window is running",
          hot: true
        });
        if (isSeller && !payLeft[tid]) items.push({
          ...base,
          key: `${deskKey}:${tid}:refund`,
          action: "Payment window ended - refund the escrow",
          hot: true
        });
      } else if (status === "PAID") {
        if (isSeller) items.push({
          ...base,
          key: `${deskKey}:${tid}:release`,
          action: cash ? "Cash in hand? Confirm and release" : "Fiat marked paid - confirm and release",
          hot: true
        });else items.push({
          ...base,
          key: `${deskKey}:${tid}:wait`,
          action: "Paid - waiting for the seller to release"
        });
      } else if (status === "DISPUTED") {
        items.push({
          ...base,
          key: `${deskKey}:${tid}:dispute`,
          action: "Disputed - the arbiter is deciding",
          hot: false
        });
      }
    }
    reportActivity(deskKey, items);
  }, [trades, me, payLeft, cash]);
  const needSession = () => {
    if (!session) {
      toast("Connect an account first", {
        body: "The page stays read-only until you do.",
        tone: "warn"
      });
      return false;
    }
    return true;
  };
  const send = async (label, fn, ids = {}, afterReceipt = null) => {
    if (!needSession()) return false;
    const title = TX_TITLES[label] ?? label;
    const go = await chooseFee(title, label);
    if (!go) return false;
    setErr("");
    setOk("");
    setTxh("");
    let tx;
    try {
      tx = await fn();
    } catch (e) {
      setErr(revertText(e));
      toast(`${title} did not go through`, {
        body: revertText(e),
        tone: "err"
      });
      return false;
    }
    setTxh(tx.hash);
    setOk(`${title} sent - confirming on-chain`);
    refresh();
    tx.wait().then(async rc => {
      try {
        recordGasUsed(label, rc);
      } catch {}
      if (rc.status === 0) {
        setErr(`${title} was reverted on-chain`);
        toast(`${title} did not go through`, {
          body: "The transaction was reverted on-chain.",
          tone: "err"
        });
        refresh();
        return;
      }
      setOk(`${title}, confirmed on-chain`);
      setTxh(rc.hash);
      toast(title, {
        body: "Confirmed, transaction " + short(rc.hash),
        tone: "ok"
      });
      try {
        engine?.applyReceipt(rc, ids);
      } catch {}
      try {
        publishBoardNudge({
          relay,
          identity,
          ...(ids?.offerId != null ? {
            offerId: ids.offerId
          } : {}),
          ...(ids?.tradeId != null ? {
            tradeId: ids.tradeId
          } : {})
        });
      } catch {}
      refresh();
      if (afterReceipt) {
        try {
          await afterReceipt(rc);
        } catch {}
      }
    }).catch(e => {
      setErr(revertText(e));
      toast(`${title} did not go through`, {
        body: revertText(e),
        tone: "err"
      });
      refresh();
    });
    return true;
  };
  const TX_TITLES = {
    postOffer: cash ? "In-person offer published" : "Offer published",
    cancelOffer: "Offer withdrawn",
    takeOffer: "Offer claimed",
    voidTake: "Take voided - the offer is back",
    lockFunds: cash ? "Escrow locked before the meet" : "Escrow locked",
    markPaid: cash ? "Cash marked as handed" : "Fiat marked as paid",
    confirmRelease: "Buyer paid out",
    refundExpired: "Refund executed",
    dispute: "Dispute filed"
  };
  const tokenSymbol = addr => String(cfg.usdc).toLowerCase() === String(addr).toLowerCase() ? "USDC" : "USDT";
  const decOf = addr => {
    const key = String(addr ?? cfg[tokenKey] ?? "").toLowerCase();
    const known = dec[key];
    if (known != null) return known;
    return TOKEN_DECIMALS[key] ?? null;
  };
  const fmt = (v, addr) => fmtAmount(v, decOf(addr ?? cfg[tokenKey]));
  const parseAmt = (s, addr) => {
    const d = decOf(addr);
    if (d == null) return null;
    return ethers.parseUnits(/^\d+(\.\d+)?$/.test(s || "") ? s : "0", d);
  };
  const rateP = parseRateInr(rate);
  const txo = async () => ({
    gasPrice: await gasPriceOf(provider)
  });
  const [feeAsk, setFeeAsk] = useState(null);
  const [feeTierSel, setFeeTierSel] = useState(() => getFeeTier());
  const [recPrice, setRecPrice] = useState(null);
  const [usd, setUsd] = useState(() => readUsdCache());
  useEffect(() => {
    if (!feeAsk) return undefined;
    return () => {
      feeAsk.resolve(false);
    };
  }, [feeAsk]);
  useEffect(() => {
    if (!provider) return;
    let dead = false;
    liveGasPrice(provider).then(gp => {
      if (!dead) setRecPrice(gp);
    }).catch(() => {});
    return () => {
      dead = true;
    };
  }, [provider]);
  useEffect(() => {
    let dead = false;
    fetchUsd().then(v => {
      if (!dead && v != null) setUsd(v);
    }).catch(() => {});
    return () => {
      dead = true;
    };
  }, [feeAsk]);
  const chooseFee = (label, action) => new Promise(resolve => setFeeAsk({
    label,
    action,
    resolve
  }));
  const feeAnswer = go => {
    const a = feeAsk;
    setFeeAsk(null);
    if (a) a.resolve(go);
  };
  const FeeSheet = feeAsk ? (() => {
    const tiers = [["economy", "Slow", "never below the network minimum"], ["standard", "Standard", "the network's usual price"], ["fast", "Fast", "pays a bit more, lands first"]];
    const rec = recPrice ?? null;
    const gas = gasUsedFor(feeAsk.action);
    const cost = gp => {
      if (!gp) return "—";
      const bnb = Number(gp) * gas / 1e18;
      const bnbStr = "≈ " + (bnb >= 0.001 ? bnb.toFixed(5) : bnb.toFixed(8)) + " BNB";
      if (usd == null) return bnbStr;
      const usdVal = bnb * usd;
      return bnbStr + " · ≈ $" + (usdVal < 0.1 ? usdVal.toFixed(4) : usdVal.toFixed(2));
    };
    return createPortal(<div className="modal-overlay" onMouseDown={e => {
      if (e.target === e.currentTarget) feeAnswer(false);
    }}>
                <div className="modal fee-sheet" role="dialog" aria-modal="true" aria-label="Choose the network fee">
                    <h3>{feeAsk.label}</h3>
                    <p className="fee-sub">Pick what you pay per unit of gas. The contract burns the same gas either way, only the price changes.</p>
                    <div className="fee-opts">
                        {tiers.map(([id, name, sub]) => {
            const gp = finalTierPrice(id, rec);
            return <button key={id} className={"fee-opt" + (feeTierSel === id ? " on" : "")} onClick={() => {
              setFeeTierSel(id);
              setFeeTier(id);
            }}>
                                    <span className="fee-name">{name}</span>
                                    <span className="fee-cost mono">{cost(gp)}</span>
                                    <span className="fee-sub2">{sub}</span>
                                </button>;
          })}
                    </div>
                    <div className="fee-actions">
                        <button className="btn ghost" onClick={() => feeAnswer(false)}>Cancel</button>
                        <button className="btn accent" onClick={() => feeAnswer(true)}>{feeAsk.label}</button>
                    </div>
                </div>
            </div>, document.body);
  })() : null;
  const allowanceMemo = useRef({
    token: "",
    at: 0,
    value: 0n
  });
  const needApprove = async (amt, tokenAddr) => {
    const memo = allowanceMemo.current;
    if (memo.token === tokenAddr && Date.now() - memo.at < 300000 && memo.value >= amt) return;
    const t = new ethers.Contract(tokenAddr, tokenAbi, session.signer);
    const cur = await t.allowance(me, cfg.deal).catch(() => 0n);
    allowanceMemo.current = {
      token: tokenAddr,
      at: Date.now(),
      value: cur
    };
    if (cur < amt) {
      await (await t.approve(cfg.deal, amt, {
        gasPrice: await gasPriceOf(provider)
      })).wait();
      allowanceMemo.current = {
        token: tokenAddr,
        at: Date.now(),
        value: amt
      };
    }
  };
  const PUB_MAX = 3;
  const PUB_WINDOW_MS = 60_000;
  const publishTicks = () => {
    try {
      const all = JSON.parse(localStorage.getItem("nijip2p-publish-ticks-v1") ?? "{}");
      const now = Date.now();
      return (all[String(me ?? "").toLowerCase()] ?? []).filter(t => now - t < PUB_WINDOW_MS);
    } catch {
      return [];
    }
  };
  const recordPublishTick = () => {
    try {
      const all = JSON.parse(localStorage.getItem("nijip2p-publish-ticks-v1") ?? "{}");
      const k = String(me ?? "").toLowerCase();
      const now = Date.now();
      all[k] = (all[k] ?? []).filter(t => now - t < PUB_WINDOW_MS).concat(now).slice(-PUB_MAX);
      localStorage.setItem("nijip2p-publish-ticks-v1", JSON.stringify(all));
    } catch {}
  };
  const publish = () => runGated("postOffer", async () => {
    if (!needSession()) return false;
    let max;
    try {
      max = parseAmt(amount || "0", cfg[tokenKey]);
    } catch {
      setErr("Enter a valid amount.");
      return false;
    }
    if (max == null) {
      setErr("Reading the token decimals - one moment, then post again.");
      return false;
    }
    if (max <= 0n) {
      setErr("The amount must be greater than zero.");
      return false;
    }
    const rateParsed = parseRateInr(rate);
    if (rateParsed.err) {
      setErr(rateParsed.err);
      return false;
    }
    if (cash && !pin) {
      setErr("Drop the venue pin first - buyers need the meetup spot and code.");
      return false;
    }
    const ticks = publishTicks();
    if (ticks.length >= PUB_MAX) {
      const waitS = Math.max(1, Math.ceil((PUB_WINDOW_MS - (Date.now() - ticks[0])) / 1000));
      const msg = `Publish limit: ${PUB_MAX} offers per minute - the next slot opens in ${waitS}s.`;
      setErr(msg);
      toast("Publish rate limit", {
        body: msg,
        tone: "warn"
      });
      return false;
    }
    const go = await chooseFee(cash ? "Post in-person offer" : "Publish offer", "postOffer");
    if (!go) return false;
    setErr("");
    setOk("");
    setTxh("");
    try {
      const tx = await esc.connect(session.signer).postOffer(cfg[tokenKey], max, rateParsed.paise, cash ? CASH_WINDOW : REMOTE_WINDOW, cash, await txo("postOffer"));
      const rc = await tx.wait();
      try {
        recordGasUsed("postOffer", rc);
      } catch {}
      if (rc.status === 0) throw new Error("the transaction was reverted on-chain");
      recordPublishTick();
      const title = cash ? "In-person offer published" : "Offer published";
      setOk(`${title}, confirmed on-chain`);
      setTxh(rc.hash);
      toast(title, {
        body: "Confirmed, transaction " + short(rc.hash),
        tone: "ok"
      });
      if (cash) setPin(null);
      const newId = offerIdFromReceipt(rc, esc.interface);
      try {
        engine?.applyReceipt(rc, newId != null ? {
          offerId: newId
        } : {});
      } catch {}
      try {
        if (newId != null) publishBoardNudge({
          relay,
          identity,
          offerId: newId
        });
      } catch {}
      if (newId != null) {
        try {
          const rails = cash ? ["inperson"] : decl.rails;
          const ann = await publishOfferRails({
            desk: deskKey,
            offerId: newId,
            rails,
            custom: decl.custom,
            cell: cash ? cellGeohashOf(pin) : undefined
          });
          toast(ann.sent ? "Rails declared" : "Rails saved - syncs when the relay returns", {
            body: "Buyers see “" + annLabel(ann) + "” on your offer",
            tone: ann.sent ? "ok" : "info"
          });
        } catch (e) {
          queueOfferRails({
            desk: deskKey,
            offerId: newId,
            rails: cash ? ["inperson"] : decl.rails,
            custom: decl.custom,
            cell: cash ? cellGeohashOf(pin) : undefined
          });
        }
      }
      refresh();
    } catch (e) {
      setErr(revertText(e));
      toast(cash ? "The in-person offer was not published" : "The offer was not published", {
        body: revertText(e),
        tone: "err"
      });
    }
  });
  const cancelOffer = o => runGated(busyKey("cancelOffer", o.id), async () => {
    const yes = await confirmDialog({
      title: "Withdraw offer #" + o.id.toString() + "?",
      body: "Nothing was ever locked - this just takes the listing off the board.",
      confirmLabel: "Withdraw",
      tone: "danger"
    });
    if (yes) await send("cancelOffer", async () => esc.connect(session.signer).cancelOffer(o.id, await txo("cancelOffer")), {
      offerId: o.id
    });
  });
  const take = o => runGated(busyKey("takeOffer", o.id), async () => {
    if (!needSession()) return false;
    const ann = annForOffer(offerAnns, {
      desk: deskKey,
      chainId: cfg.chainId,
      offerId: o.id,
      seller: o.seller
    });
    let pick = null;
    if (ann && (ann.rails.length || ann.custom) && !cash) {
      pick = await chooseRails({
        mode: "pick",
        ann
      });
      if (!pick) return;
    }
    const live = await esc.offers(o.id);
    if (live.cancelled || BigInt(live.activeTradeId) !== 0n) {
      await refresh();
      toast("This offer is no longer open", {
        body: "It was withdrawn or taken by another buyer. The board has been refreshed.",
        tone: "warn"
      });
      return false;
    }
    const done = await send("takeOffer", async () => esc.connect(session.signer).takeOffer(o.id, await txo("takeOffer")), {
      offerId: o.id
    });
    if (done && pick) {
      rememberPick({
        desk: deskKey,
        chainId: cfg.chainId,
        offerId: o.id,
        pick
      });
      refresh();
      const t0 = Date.now();
      const iv = setInterval(() => {
        const tr = Object.values(engine?.state?.trades ?? {}).find(x => x.offerId.toString() === o.id.toString() && x.buyer.toLowerCase() === me.toLowerCase());
        if (tr) {
          clearInterval(iv);
          postTradeMessage({
            relay,
            identity,
            me: "Buyer",
            tradeId: `${deskKey}:${tr.id.toString()}`,
            peers: peersForTrade(presence, tr.id, tr),
            setInbox,
            text: "[rail-pick]" + JSON.stringify({
              rail: pick.rail,
              custom: pick.custom ?? ""
            })
          }).catch(() => {});
        } else if (Date.now() - t0 > 15000) clearInterval(iv);
      }, 1200);
    }
  });
  const voidTake = t => runGated(busyKey("voidTake", t.id), async () => {
    const yes = await confirmDialog({
      title: "Void this take?",
      body: "Nothing was ever locked. The trade is dropped and the offer goes back on the board.",
      confirmLabel: "Void the take",
      tone: "danger"
    });
    if (yes) {
      const done = await send("voidTake", async () => esc.connect(session.signer).voidTake(t.id, await txo("voidTake")), {
        tradeId: t.id,
        offerId: t.offerId
      });
      if (done && cfg?.telegramApiUrl && session?.signer) {
        try {
          await deleteTgGroup(cfg, session?.signer, {
            tradeId: t.id.toString(),
            chainId: cfg.chainId,
            contract: cfg.deal
          });
        } catch {}
      }
      if (done) await refresh();
    }
  });
  const lockFunds = t => runGated(busyKey("lockFunds", t.id), async () => {
    const sym = tokenSymbol(t.token);
    const max = offers.find(o => o.id.toString() === t.offerId.toString())?.maxAmount ?? 0n;
    const maxStr = fmt(max, t.token);
    const d = decOf(t.token);
    const input = await amountSheet({
      title: "Lock the escrow",
      context: v => {
        const typed = String(v ?? "").replace(/,/g, "");
        const shown = /^\d+(\.\d+)?$/.test(typed) ? typed : maxStr.replace(/,/g, "");
        return `${shown} ${sym} → buyer ${short(t.buyer)}`;
      },
      note: cash ? "The 7-day window starts on your lock." : "The 20-minute window starts on your lock.",
      maxValue: maxStr.replace(/,/g, ""),
      value: maxStr.replace(/,/g, ""),
      balance: me && myTokenBal !== null && String(cfg[tokenKey]).toLowerCase() === String(t.token).toLowerCase() ? `${fmt(myTokenBal, t.token)} ${sym}` : "",
      fiatOf: v => {
        const n = Number(String(v).replace(/,/g, ""));
        if (!Number.isFinite(n) || n <= 0 || d == null) return null;
        return rupee(fiatFor(t.rate, n * 10 ** d, d));
      },
      confirmLabel: "Lock escrow",
      cancelLabel: "Cancel"
    });
    if (input == null) return;
    let amt;
    try {
      amt = parseAmt(input, t.token);
    } catch {
      toast("Invalid amount", {
        body: "Use digits, e.g. 100 or 99.50",
        tone: "err"
      });
      return;
    }
    if (amt == null) {
      toast("Reading the token decimals", {
        body: "One moment, then try again.",
        tone: "warn"
      });
      return;
    }
    if (amt <= 0n || amt > BigInt(max)) {
      toast("Out of range", {
        body: `The locked amount must be between 0 and ${fmt(max, t.token)} ${sym}.`,
        tone: "err"
      });
      return;
    }
    try {
      await needApprove(amt, t.token);
    } catch (e) {
      setErr(revertText(e));
      return;
    }
    const live = await esc.trades(t.id);
    if (Number(live.status) !== 1) {
      await refresh();
      toast("This trade moved on", {
        body: "It is no longer waiting for the escrow lock. The board has been refreshed.",
        tone: "warn"
      });
      return false;
    }
    await send("lockFunds", async () => esc.connect(session.signer).lockFunds(t.id, amt, await txo("lockFunds")), {
      tradeId: t.id,
      offerId: t.offerId
    }, cash ? () => sendVenuePin(t, true) : null);
  });
  const pendingPin = t => cash && pinRef.current && !pinSentRef.current[t.id.toString()];
  const sendVenuePin = async (t, auto = false) => {
    if (!cash || !pinRef.current) return;
    const tid = t.id.toString();
    if (pinSentRef.current[tid]) return;
    const peers = peersForTrade(presence, t.id, t);
    let sent = false;
    try {
      sent = await postTradeMessage({
        relay,
        identity,
        me: "Seller",
        tradeId: tid,
        peers,
        text: venuePinMessage(pinRef.current, {}, {
          includeCode: false
        }),
        setInbox
      });
    } catch {
      sent = false;
    }
    if (sent) {
      setPinSent(m => {
        const n = {
          ...m,
          [tid]: true
        };
        try {
          sessionStorage.setItem("nijip2p-cash-pinsent-v1", JSON.stringify(n));
        } catch {}
        return n;
      });
      if (!auto) toast("Venue pin sent", {
        body: "The meetup spot went to the sealed thread.",
        tone: "ok"
      });
    } else if (!auto) {
      toast("The pin will retry", {
        body: "The relay was unreachable - it sends automatically the moment the relay returns.",
        tone: "warn"
      });
    }
  };
  useEffect(() => {
    const t = setInterval(() => {
      for (const tr of Object.values(tradesRef.current)) {
        if (["SETTLED", "REFUNDED", "VOIDED"].includes(STATUS.Deal[Number(tr.status)] ?? "")) continue;
        const myRole = me && String(tr.seller).toLowerCase() === String(me).toLowerCase() ? "Seller" : me && String(tr.buyer).toLowerCase() === String(me).toLowerCase() ? "Buyer" : null;
        if (myRole) {
          try {
            publishPresence?.(tr.id, myRole);
          } catch {}
        }
        if (pendingPin(tr)) sendVenuePin(tr, true);
      }
    }, 60000);
    return () => clearInterval(t);
  }, [cash, me]);
  const announcedRef = useRef(new Set());
  useEffect(() => {
    if (!publishPresence) return;
    for (const tr of Object.values(trades)) {
      if (["SETTLED", "REFUNDED", "VOIDED"].includes(STATUS.Deal[Number(tr.status)] ?? "")) continue;
      const tid = tr.id.toString();
      if (announcedRef.current.has(tid)) continue;
      const myRole = me && String(tr.seller).toLowerCase() === String(me).toLowerCase() ? "Seller" : me && String(tr.buyer).toLowerCase() === String(me).toLowerCase() ? "Buyer" : null;
      if (!myRole) continue;
      announcedRef.current.add(tid);
      try {
        publishPresence(tr.id, myRole);
      } catch {}
    }
  }, [cash, trades, me, publishPresence]);
  const markPaid = t => runGated(busyKey("markPaid", t.id), async () => {
    const yes = await confirmDialog({
      title: cash ? "Mark the cash as handed?" : "Mark the fiat as paid?",
      body: cash ? "Only tap this AFTER the cash is physically in the seller's hand. This blocks the auto-refund for the whole 7-day window." : "Only tap this AFTER the fiat actually left your account. This blocks the auto-refund.",
      confirmLabel: cash ? "Cash handed" : "I've paid",
      tone: "accent"
    });
    if (yes) {
      const live = await esc.trades(t.id);
      if (Number(live.status) !== 2) {
        await refresh();
        toast("This trade moved on", {
          body: "It is no longer waiting for a payment mark. The board has been refreshed.",
          tone: "warn"
        });
        return;
      }
      await send("markPaid", async () => esc.connect(session.signer).markPaid(t.id, await txo("markPaid")), {
        tradeId: t.id
      });
    }
  });
  const confirmRelease = t => runGated(busyKey("confirmRelease", t.id), async () => {
    const sym = tokenSymbol(t.token);
    const yes = await confirmDialog({
      title: "Release " + fmt(t.amount, t.token) + " " + sym + " to the buyer?",
      body: cash ? "Confirm ONLY if the cash is in your hand. The contract pays out instantly." : "Confirm ONLY if the fiat arrived. The contract pays out instantly.",
      confirmLabel: "Release the escrow",
      tone: "accent"
    });
    if (yes) await send("confirmRelease", async () => esc.connect(session.signer).confirmRelease(t.id, await txo("confirmRelease")), {
      tradeId: t.id
    });
  });
  const refundExpired = t => runGated(busyKey("refundExpired", t.id), async () => {
    await send("refundExpired", async () => esc.connect(session.signer).refundExpired(t.id, await txo("refundExpired")), {
      tradeId: t.id,
      offerId: t.offerId
    });
  });
  const dispute = t => runGated(busyKey("dispute", t.id), async () => {
    const reason = await promptDialog({
      title: "File a dispute",
      body: "A short line - the evidence itself stays in the sealed chat.",
      value: "",
      confirmLabel: "Dispute",
      tone: "danger"
    });
    if (reason == null) return;
    await send("dispute", async () => esc.connect(session.signer).dispute(t.id, reason || "", await txo("dispute")), {
      tradeId: t.id
    });
  });
  const isParty = t => {
    if (!me) return true;
    return String(t.buyer).toLowerCase() === me.toLowerCase() || String(t.seller).toLowerCase() === me.toLowerCase();
  };
  const needsYouOf = t => {
    if (!me) return false;
    const st = STATUS.Deal[Number(t.status)] ?? "";
    const amSeller = String(t.seller).toLowerCase() === me.toLowerCase();
    const amBuyer = String(t.buyer).toLowerCase() === me.toLowerCase();
    const left = payLeft[t.id.toString()];
    return st === "TAKEN" && amSeller || st === "LOCKED" && (amBuyer && left || amSeller && !left) || st === "PAID" && amSeller;
  };
  const stuckOf = t => {
    const st = STATUS.Deal[Number(t.status)] ?? "";
    return st === "LOCKED" && !payLeft[t.id.toString()];
  };
  const cashOfTrade = t => {
    const c = (board?.cashByOffer ?? {})[String(t.offerId)];
    return c == null ? null : Boolean(c);
  };
  const openTrades = sortOpenTrades(Object.values(trades).filter(t => {
    const st = STATUS.Deal[Number(t.status)] ?? "";
    if (!isParty(t) || ["SETTLED", "REFUNDED", "VOIDED"].includes(st)) return false;
    const c = cashOfTrade(t);
    return c == null ? true : c === cash;
  }), needsYouOf, stuckOf);
  const closedTrades = Object.values(trades).filter(t => {
    const st = STATUS.Deal[Number(t.status)] ?? "";
    if (!isParty(t) || !["SETTLED", "REFUNDED", "VOIDED"].includes(st)) return false;
    const c = cashOfTrade(t);
    return c == null ? true : c === cash;
  });
  const heroCopy = cash ? {
    title: "In-person escrow",
    lead: "Post free. Lock before the meet. Cash moves only after the chain shows the lock."
  } : {
    title: "Remote escrow",
    lead: "Post free. Claim an offer, agree the terms - the seller locks, then you pay."
  };
  const CYCLE = cash ? {
    steps: [{
      k: "TAKEN",
      t: "Claimed",
      fn: "takeOffer",
      by: "buyer",
      d: "the trade is open - still nothing locked"
    }, {
      k: "LOCKED",
      t: "Locked before the meet",
      fn: "lockFunds",
      by: "seller",
      d: "the seller locks the escrow before you meet"
    }, {
      k: "PAID",
      t: "Cash handed",
      fn: "markPaid",
      by: "buyer",
      d: "the buyer tapped after the cash moved"
    }, {
      k: "SETTLED",
      t: "Settled",
      fn: "confirmRelease",
      by: "seller",
      d: "the escrow pays the buyer"
    }],
    branches: [{
      label: "Voided - a take before any lock; the offer reopens",
      good: true
    }, {
      label: "Refunded - 7 days unpaid, or a seller-win ruling",
      good: true
    }, {
      label: "Disputed - binary arbiter ruling from the sealed chat",
      hot: true
    }]
  } : {
    steps: [{
      k: "TAKEN",
      t: "Claimed",
      fn: "takeOffer",
      by: "buyer",
      d: "the trade is open - still nothing locked"
    }, {
      k: "LOCKED",
      t: "Locked",
      fn: "lockFunds",
      by: "seller",
      d: "the exact negotiated amount is escrowed"
    }, {
      k: "PAID",
      t: "Paid",
      fn: "markPaid",
      by: "buyer",
      d: "the buyer sent fiat over the agreed rail"
    }, {
      k: "SETTLED",
      t: "Settled",
      fn: "confirmRelease",
      by: "seller",
      d: "the escrow pays the buyer"
    }],
    branches: [{
      label: "Voided - a take before any lock; the offer reopens",
      good: true
    }, {
      label: "Refunded - 20 minutes unpaid, or a seller-win ruling",
      good: true
    }, {
      label: "Disputed - binary arbiter ruling from the sealed chat",
      hot: true
    }]
  };
  const OfferLine = ({
    o
  }) => {
    const mine = me && String(o.seller).toLowerCase() === me.toLowerCase();
    const taken = o.activeTradeId !== 0n;
    const sym = tokenSymbol(o.token);
    const d = decOf(o.token);
    const ann = annForOffer(offerAnns, {
      desk: deskKey,
      chainId: cfg.chainId,
      offerId: o.id,
      seller: o.seller
    });
    const isCashOffer = Boolean(o.cash);
    const deskBadge = <Badge tone={isCashOffer ? "accent" : "ok"}>{isCashOffer ? "In-person · 7d" : "Remote · 20m"}</Badge>;
    if (taken && !mine) {
      return <div className="offer-line taken" key={o.id.toString()}>
                    <div className="ol-top">
                        <Coin id={String(cfg.usdc).toLowerCase() === String(o.token).toLowerCase() ? "usdc" : "usdt"} size={20} title={sym} />
                        <span className="ol-rate">—</span>
                        <span className="ol-amt">in trade</span>
                        <span className="ol-act">{deskBadge}<span className="badge">Claimed</span></span>
                    </div>
                    <div className="ol-sub">
                        <span className="ol-meta mono">#{o.id.toString()} · in trade - it shows here only for its buyer and seller until it finishes</span>
                    </div>
                </div>;
    }
    return <div className="offer-line" key={o.id.toString()} title={"#" + o.id.toString() + " · " + fmt(o.maxAmount, o.token) + " " + sym + " @ " + rupee(o.rate) + " · total " + rupee(fiatFor(o.rate, o.maxAmount, d)) + " · seller " + o.seller}>
                <div className="ol-top">
                    <Coin id={String(cfg.usdc).toLowerCase() === String(o.token).toLowerCase() ? "usdc" : "usdt"} size={20} title={sym} />
                    <span className="ol-rate">{rupee(o.rate)}</span>
                    <span className="ol-amt">{fmt(o.maxAmount, o.token)} {sym}</span>
                    <span className="ol-act">{deskBadge}
                        {taken ? <span className="badge">trade #{o.activeTradeId.toString()}</span> : mine ? <span className="ol-btns">
                                <Button tiny tone="danger-ghost" spin={busy === busyKey("cancelOffer", o.id)} disabled={otherAction(busyKey("cancelOffer", o.id))} onClick={() => cancelOffer(o)}>Withdraw</Button>
                            </span> : <Button tiny tone="accent" spin={busy === busyKey("takeOffer", o.id)} disabled={!session || otherAction(busyKey("takeOffer", o.id))} title={!session ? "Connect an account first" : "Claims this offer for you - nothing locks until the seller locks"} onClick={() => take(o)}>Take</Button>}
                    </span>
                </div>
                <div className="ol-sub">
                    <RailChips ann={ann} missing={railMissing.has(o.id.toString()) ? "none" : undefined} onInfo={setRailInfo} compact />
                    <span className="ol-meta mono" title={"Seller " + o.seller}>
                        <b>{rupee(fiatFor(o.rate, o.maxAmount, d))}</b> · #{o.id.toString()} · {mine ? "you" : short(o.seller)}
                    </span>
                </div>
                {cash && ann?.cell ? (() => {
        const b = geohashBounds(ann.cell);
        const ctr = b ? {
          lat: (b.latMin + b.latMax) / 2,
          lon: (b.lonMin + b.lonMax) / 2
        } : null;
        return ctr ? <div className="venue-pin">
                            <div className="vp-mapwrap">
                                {}
                                <StaticMap lat={ctr.lat} lon={ctr.lon} zoom={16} height={76} rect={b} label="Meetup area - the highlighted square is ~150 m across" />
                                <div className="vp-links">
                                    <a href={`https://www.openstreetmap.org/?mlat=${ctr.lat.toFixed(6)}&mlon=${ctr.lon.toFixed(6)}#map=17/${ctr.lat.toFixed(6)}/${ctr.lon.toFixed(6)}`} target="_blank" rel="noreferrer">Open in OpenStreetMap ↗</a>
                                    <a href={`https://www.google.com/maps/search/?api=1&query=${ctr.lat.toFixed(6)},${ctr.lon.toFixed(6)}`} target="_blank" rel="noreferrer">Open in Google Maps ↗</a>
                                </div>
                            </div>
                        </div> : null;
      })() : null}
            </div>;
  };
  const TradeRow = ({
    t
  }) => {
    const status = STATUS.Deal[Number(t.status)] ?? "";
    const amSeller = me && String(t.seller).toLowerCase() === me.toLowerCase();
    const amBuyer = me && String(t.buyer).toLowerCase() === me.toLowerCase();
    const counterparty = amSeller ? t.buyer : t.seller;
    const sym = tokenSymbol(t.token);
    const closed = ["SETTLED", "REFUNDED", "VOIDED"].includes(status);
    const locked = status === "LOCKED" || status === "PAID" || status === "DISPUTED";
    const escrowed = locked || status === "SETTLED" || status === "REFUNDED";
    const offer = offers.find(o => o.id.toString() === t.offerId.toString());
    const localLeft = (() => {
      if (status !== "LOCKED") return null;
      const win = Number(offer?.payWindow ?? 0);
      const locked2 = Number(t.lockedAt ?? 0);
      if (!win || !locked2) return null;
      return locked2 + win - Math.floor(Date.now() / 1000);
    })();
    const windowLeft = localLeft != null ? localLeft : payLeft[t.id.toString()] ?? null;
    const needsYou = status === "TAKEN" && amSeller || status === "LOCKED" && (amBuyer && windowLeft != null && windowLeft > 0 || amSeller && windowLeft != null && windowLeft <= 0) || status === "PAID" && amSeller;
    return <TradeCard key={t.id.toString()} id={t.id.toString()} closed={closed} needsYou={needsYou} status={<Status name="DEAL" value={status} />} summary={[["Escrow", escrowed ? `${fmt(t.amount, t.token)} ${sym}` : `up to ${offer ? fmt(offer.maxAmount, offer.token) : "-"} ${sym}`], ["Rate", `${rupee(t.rate)} per 1 ${sym}`], ...(amSeller || amBuyer ? [["With", <span className="mono" key="cp">{short(counterparty)}</span>]] : [])]} tx={txBy[t.id.toString()]}>
                <MiniFlow steps={CYCLE.steps} current={status} branches={CYCLE.branches.map(b => ({
        ...b,
        on: b.label.startsWith("Voided") && status === "VOIDED" || b.label.startsWith("Refunded") && status === "REFUNDED" || b.label.startsWith("Disputed") && status === "DISPUTED"
      }))} />

                {status === "LOCKED" && windowLeft != null && windowLeft > 0 ? <Countdown seconds={windowLeft} prefix={cash ? "Cash window " : "Payment window "} /> : null}

                {(() => {
        const pickMsg = (inbox ?? []).find(m2 => m2?.payload?.tradeId === `${deskKey}:${t.id.toString()}` && typeof m2?.payload?.text === "string" && m2.payload.text.startsWith("[rail-pick]"));
        if (!pickMsg) return null;
        try {
          const j = JSON.parse(pickMsg.payload.text.slice("[rail-pick]".length));
          return <div className="note small">Buyer’s rail: <b>{j.rail}</b>{j.custom ? ` - ${j.custom}` : ""}</div>;
        } catch {
          return null;
        }
      })()}
                <div className="vp-facts">
                    <div className="fact"><div className="k">{escrowed ? "Escrow" : "Max"}</div><div className="v mono">{escrowed ? fmt(t.amount, t.token) : offer ? fmt(offer.maxAmount, offer.token) : "-"} {sym}</div></div>
                    <div className="fact"><div className="k">Fiat value</div><div className="v mono">{escrowed ? rupee(fiatFor(t.rate, t.amount, decOf(t.token))) : "-"}</div></div>
                    {amSeller || amBuyer ? <div className="fact"><div className="k">With</div><div className="v mono">{short(counterparty)}</div></div> : null}
                </div>

                {closed ? <div className="trade-done">
                        <span className="tick">✓</span>
                        <b>{status === "SETTLED" ? "Settled" : status === "REFUNDED" ? "Refunded" : "Voided"}</b>
                        <span className="dim">{escrowed ? `${fmt(t.amount, t.token)} ${sym} · ${rupee(t.rate)} per 1 · ${rupee(fiatFor(t.rate, t.amount, decOf(t.token)))}` : "nothing was ever locked"}</span>
                        {txBy[t.id.toString()] ? <span className="dim">· tx <Copy text={txBy[t.id.toString()]} label={short(txBy[t.id.toString()])} /></span> : null}
                    </div> : <div className="row-actions">
                    {}
                    {status === "TAKEN" && amSeller ? <Button className="ra-primary" tone="accent" spin={busy === busyKey("lockFunds", t.id)} disabled={otherAction(busyKey("lockFunds", t.id))} onClick={() => lockFunds(t)}>
                            Lock escrow now
                        </Button> : null}
                    {}
                    {status === "LOCKED" && amBuyer && windowLeft != null && windowLeft > 0 && (!cash || verifiedCodes[t.id.toString()]) ? <Button className="ra-primary" tone="accent" spin={busy === busyKey("markPaid", t.id)} disabled={otherAction(busyKey("markPaid", t.id))} onClick={() => markPaid(t)}>
                            {cash ? "Cash handed" : "I've paid"}
                        </Button> : null}
                    {status === "PAID" && amSeller ? <Button className="ra-primary" tone="accent" spin={busy === busyKey("confirmRelease", t.id)} disabled={otherAction(busyKey("confirmRelease", t.id))} onClick={() => confirmRelease(t)}>
                            Confirm &amp; release
                        </Button> : null}

                    {}
                    {status === "TAKEN" && amBuyer ? <div className="ra-wait"><Badge tone="warn">Waiting for the seller to lock the escrow</Badge></div> : null}
                    {status === "LOCKED" && amSeller ? <div className="ra-wait"><Badge tone="warn">{cash ? "Waiting for the cash handover" : "Waiting for the fiat"}</Badge></div> : null}
                    {status === "PAID" && amBuyer ? <div className="ra-wait"><Badge tone="warn">Paid - waiting for the seller to release</Badge></div> : null}
                    {status === "DISPUTED" ? <div className="ra-wait">
                            <Badge tone="warn">Disputed - the arbiter is deciding</Badge>
                            {disputeReasons[t.id.toString()] ? <div className="note small" style={{
            marginTop: 6
          }}>Filed: “{disputeReasons[t.id.toString()]}”</div> : null}
                        </div> : null}

                    {}
                    {status === "TAKEN" && amSeller ? <Button className="ra-half" tiny tone="ghost" spin={busy === busyKey("voidTake", t.id)} disabled={otherAction(busyKey("voidTake", t.id))} onClick={() => voidTake(t)}>Void</Button> : null}
                    {status === "TAKEN" && amBuyer ? <Button className="ra-half" tiny tone="ghost" spin={busy === busyKey("voidTake", t.id)} disabled={otherAction(busyKey("voidTake", t.id))} onClick={() => voidTake(t)}>I'm out - void</Button> : null}
                    {status === "LOCKED" && windowLeft != null && windowLeft <= 0 ? <Button className="ra-half" tiny tone="ghost" spin={busy === busyKey("refundExpired", t.id)} disabled={otherAction(busyKey("refundExpired", t.id))} onClick={() => refundExpired(t)}>Window over - refund</Button> : null}
                    {}
                    {(status === "LOCKED" || status === "PAID") && (amSeller || amBuyer) ? <Button className="ra-half" tiny tone="danger-ghost" spin={busy === busyKey("dispute", t.id)} disabled={otherAction(busyKey("dispute", t.id))} onClick={() => dispute(t)}>Dispute</Button> : null}
                </div>}

                {cash && (amSeller || amBuyer) && !closed ? (() => {
        const chatPin = (() => {
          const msg = (inbox ?? []).find(m => m?.payload?.tradeId === t.id.toString() && typeof m?.payload?.text === "string" && m.payload.text.startsWith(VENUE_TAG));
          return msg ? parseVenuePin(msg.payload.text) : null;
        })();
        const ann = annForOffer(offerAnns, {
          desk: deskKey,
          chainId: cfg.chainId,
          offerId: t.offerId,
          seller: t.seller
        });
        const spotPin = ann?.cell != null ? {
          kind: "map",
          cell: ann.cell
        } : chatPin && chatPin.cell != null ? chatPin : amSeller && pin || null;
        const mapId = "niji-spot-" + t.id.toString();
        const peers = peersForTrade(presence, t.id, t);
        const theirPk = amSeller ? peers.Buyer : peers.Seller;
        const meetCode = theirPk && identity?.sk ? meetCodeOf(identity.sk, theirPk, t.id.toString()) : null;
        const codeLive = status === "LOCKED" || status === "PAID" || status === "DISPUTED";
        const verified = !!verifiedCodes[t.id.toString()];
        const spotBlock = spotPin ? <div className="venue-pin">
                            <Button tiny tone="accent" onClick={e => {
            const el = document.getElementById(mapId);
            if (!el) return;
            el.hidden = !el.hidden;
            e.currentTarget.textContent = el.hidden ? "Open the meetup map" : "Hide the meetup map";
          }}>Open the meetup map</Button>
                            <div id={mapId} hidden>
                                <PinView pin={spotPin} />
                                {amSeller ? <div className="vp-links"><Copy text={venuePinMessage(spotPin, {}, {
                includeCode: false
              })} label="Copy the meetup spot" /></div> : null}
                            </div>
                        </div> : <div className="note small dim">The meetup spot comes from the offer's posted location.</div>;
        if (!codeLive) {
          return <div>
                                {spotBlock}
                                {amSeller ? <div className="note small dim">The meetup code appears here the moment you lock the escrow - reveal it to the buyer only at the meet.</div> : <div className="note small dim">The verify step appears here once the seller locks the escrow on-chain.</div>}
                            </div>;
        }
        if (amSeller) {
          return <div>
                                {spotBlock}
                                {meetCode ? <div className="venue-pin">
                                        <div className="vp-facts">
                                            <div className="fact"><div className="k">Meetup code</div><div className="v mono" style={{
                    fontSize: 24,
                    letterSpacing: 2
                  }}>{meetCode}</div></div>
                                        </div>
                                        <div className="note small">Give this code to the buyer only at the meet. They must type it into their card before they can confirm the cash handover.</div>
                                    </div> : <div className="note small dim">The meetup code unlocks once the sealed-chat handshake completes - it never travels anywhere.</div>}
                            </div>;
        }
        if (verified) {
          return <div>
                                {spotBlock}
                                <div className="venue-pin">
                                    <div className="vp-facts">
                                        <div className="fact"><div className="k">Seller verified</div><div className="v mono">✓ code matches</div></div>
                                    </div>
                                    <div className="note small">Hand over the cash, then confirm below.</div>
                                </div>
                            </div>;
        }
        return <div>
                            {spotBlock}
                            <div className="venue-pin">
                                <div className="vp-facts">
                                    <div className="fact"><div className="k">Verify the seller</div><div className="v mono">{meetCode ? "type the code they tell you" : "waiting for the chat handshake"}</div></div>
                                </div>
                                {meetCode ? <div>
                                        <div className="note small">Ask the seller for the meetup code and type it here. Only the real seller knows it - do not hand over cash until it verifies.</div>
                                        <div className="row" style={{
                gap: 6,
                marginTop: 6
              }}>
                                            <input id={"niji-code-" + t.id.toString()} inputMode="numeric" placeholder="6-digit code" style={{
                  flex: 1,
                  minWidth: 0
                }} maxLength={6} />
                                            <Button tiny tone="accent" onClick={() => {
                  const typed = String(document.getElementById("niji-code-" + t.id.toString())?.value ?? "").trim();
                  if (!/^\d{6}$/.test(typed)) {
                    toast("Enter the 6-digit code", {
                      body: "The seller gives it to you at the meet.",
                      tone: "warn"
                    });
                    return;
                  }
                  if (typed === meetCode) {
                    setVerifiedCodes(m => ({
                      ...m,
                      [t.id.toString()]: true
                    }));
                    toast("Seller verified", {
                      body: "The code matches. Hand over the cash, then confirm below.",
                      tone: "ok"
                    });
                  } else {
                    toast("Doesn't match", {
                      body: "That is not the seller's code - do not hand over any cash.",
                      tone: "err"
                    });
                  }
                }}>Verify</Button>
                                        </div>
                                    </div> : <div className="note small dim">The code check unlocks once the sealed-chat handshake completes - the code itself never travels anywhere.</div>}
                            </div>
                        </div>;
      })() : null}

                {(amSeller || amBuyer) && !closed ? <TradeChat tradeId={t.id.toString()} closed={closed} peers={peersForTrade(presence, t.id, t)} me={amSeller ? "Seller" : "Buyer"} /> : null}
                {amSeller || amBuyer ? <SimplexRoom tradeId={t.id.toString()} trade={t} contract={cfg.deal} amBuyer={amBuyer} amSeller={amSeller} isArbiter={false} closed={closed} /> : null}
                {(amSeller || amBuyer) && status !== "VOIDED" ? <TelegramRoom tradeId={t.id.toString()} trade={t} contract={cfg.deal} amBuyer={amBuyer} amSeller={amSeller} closed={closed} /> : null}
            </TradeCard>;
  };
  return <div>
            <h1 className="h1">{heroCopy.title}</h1>
            <p className="lead">{heroCopy.lead}</p>

            <Err text={err} />
            {ok ? <OkBox>{ok}{txh ? <TxLine hash={txh} /> : null}</OkBox> : null}

            <Panel title={cash ? "Post an in-person offer" : "Publish an offer"}>
                <div className="form-grid">
                    <Field label={`Max amount in ${tokenKey.toUpperCase()}`}>
                        <input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" />
                    </Field>
                    <Field label={`Rate, ₹ per 1 ${tokenKey.toUpperCase()}`} hint={rateP.err ?? `That is ${rupee(rateP.paise ?? 0n)} per 1 ${tokenKey.toUpperCase()}`}>
                        <input value={rate} onChange={e => setRate(e.target.value)} inputMode="decimal" placeholder="92" />
                    </Field>
                    <Field label="Token">
                        <select value={tokenKey} onChange={e => setTokenKey(e.target.value)}>
                            <option value="usdc">USDC</option>
                            <option value="usdt">USDT</option>
                        </select>
                    </Field>
                </div>

                {cash ? <PinPicker pin={pin} onPin={updatePin} /> : null}

                {cash ? null : <div className="form-grid">
                        <Field label="Payment rails">
                            <RailPicker value={decl} onChange={setDecl} onInfo={setRailInfo} />
                        </Field>
                    </div>}

                <div className="row-actions">
                    <Button tone="accent" spin={busy === "postOffer"} disabled={otherAction("postOffer")} onClick={publish}>
                        {cash ? "Post in-person offer" : "Publish offer"}
                    </Button>
                </div>
                <div className="note small dim">
                    Locks up to <b>{fmt(parseAmt(amount || "0", cfg[tokenKey]))} {tokenKey.toUpperCase()}</b>
                    {" · "}{decOf(cfg[tokenKey]) == null ? "reading the token…" : rateP.err ? "set a rate to see the fiat value" : <>≈ <b>{rupee(fiatFor(rateP.paise ?? 0n, parseAmt(amount || "0", cfg[tokenKey]), decOf(cfg[tokenKey])))}</b></>}
                    {me && myTokenBal !== null ? <> · balance {fmt(myTokenBal)} {tokenKey.toUpperCase()}</> : null}
                </div>
            </Panel>

            <Panel title={cash ? "In-person offers" : "Open offers"} sub="Claim one to open the sealed chat." right={<Button tiny ghost spin={syncing} onClick={() => refresh()} title="Re-read from the chain">Refresh</Button>}>
                {readFailed ? <EmptyState>
                        <b>The chain did not answer</b>
                        <div className="small dim">{board?.error ? explainDbError(board.error) : "The board feed was unreachable while reading the offers."}</div>
                        <Button tone="ghost" onClick={() => refresh()}>Retry</Button>
                    </EmptyState> : offers === null ? <EmptyState><span className="small dim">Reading the board from the chain…</span></EmptyState> : <div className="offer-list" ref={listRef}>
                        <div className="board-status small dim">
                            {board?.error && board?.stale ? "The board feed hiccuped - showing your saved board. Retrying…" : board?.catchingUp ? "Catching up with the chain - the rest lands on the next cycle…" : syncing ? "Checking the chain…" : "Live · block " + Number(board?.blockNumber || 0).toLocaleString()}
                            {board?.stale && board?.savedAt ? " · saved " + new Date(board.savedAt).toLocaleTimeString() : null}
                        </div>
                        {!offers.length ? <EmptyState>
                                <b>The board is empty</b>
                                <div className="small dim">Publish the first one above.</div>
                            </EmptyState> : <>
                                <div className="ob-head mono" aria-hidden="true">
                                    <span />
                                    <span>₹ / coin</span>
                                    <span>size</span>
                                    <span />
                                </div>
                                {offers.slice(0, visibleOffers).map(o => OfferLine({
            o
          }))}
                                {offers.length > visibleOffers ? <div className="row" style={{
            justifyContent: "center",
            padding: "8px 0 2px"
          }}>
                                        <Button tiny tone="ghost" onClick={() => setVisibleOffers(v => v + PAGE)}>
                                            Show {Math.min(PAGE, offers.length - visibleOffers)} more · {offers.length - visibleOffers} hidden
                                        </Button>
                                    </div> : null}
                            </>}
                    </div>}
            </Panel>

            <Panel title="Live trades">
                {}
                {openTrades.length ? openTrades.map(t => TradeRow({
        t
      })) : <EmptyState><b>No open trades</b><div className="small dim">A trade shows here for its buyer and seller only - the on-chain record of states stays public.</div></EmptyState>}
            </Panel>

            <Panel title="Completed trades" sub="Settled, refunded and voided deals - yours only, with their settlement transactions.">
                {closedTrades.length ? closedTrades.map(t => TradeRow({
        t
      })) : <EmptyState><b>Nothing completed yet</b><div className="small dim">Finished deals land here with their settlement transaction.</div></EmptyState>}
            </Panel>

            <RailDrawer railId={railInfo} onClose={() => setRailInfo(undefined)} />
            {FeeSheet}
        </div>;
}