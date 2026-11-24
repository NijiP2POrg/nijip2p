import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppCtx } from "../AppCtx.jsx";
import { sendSealed } from "../chat/nostr.js";
import { short } from "./chain.js";
import { fmtDur, txUrl, statusLabel, explainRevert } from "./format.js";
import { useIsMobile } from "./mscreen.js";
import { VENUE_TAG, parseVenuePin } from "./cashSessions.js";
import { cellDisplay } from "./geo.js";
let toastSeq = 0;
const toastListeners = new Set();
export function toast(title, {
  body = "",
  tone = "",
  timeout = 5200
} = {}) {
  const id = ++toastSeq;
  toastListeners.forEach(l => l({
    id,
    title,
    body,
    tone,
    out: false
  }));
  if (timeout) setTimeout(() => toastListeners.forEach(l => l({
    id,
    out: true
  })), timeout);
  return id;
}
export function ToastHost() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const l = t => {
      if (t.out) {
        setItems(xs => xs.map(x => x.id === t.id ? {
          ...x,
          leaving: true
        } : x));
        setTimeout(() => setItems(xs => xs.filter(x => x.id !== t.id)), 190);
      } else {
        setItems(xs => [...xs.filter(x => x.id !== t.id), t].slice(-4));
      }
    };
    toastListeners.add(l);
    return () => toastListeners.delete(l);
  }, []);
  if (items.length === 0) return null;
  return <div className="toasts" role="status" aria-live="polite">
            {items.map(t => <div key={t.id} className={"toast " + t.tone + (t.leaving ? " out" : "")}>
                    <div>
                        <div className="t-title">{t.title}</div>
                        {t.body ? <div className="t-body">{t.body}</div> : null}
                    </div>
                    <button className="t-close" aria-label="dismiss" onClick={() => toastListeners.forEach(l => l({
        id: t.id,
        out: true
      }))}>✕</button>
                </div>)}
        </div>;
}
let promptSetter = null;
const setterRef = {
  current: null
};
export function promptDialog({
  title,
  body,
  value = "",
  confirmLabel = "Confirm",
  tone = ""
}) {
  return new Promise(resolve => {
    if (promptSetter) promptSetter({
      kind: "text",
      title,
      body,
      value,
      confirmLabel,
      tone,
      resolve
    });else resolve(null);
  });
}
export function amountSheet({
  title = "Amount",
  context = "",
  note = "",
  maxValue = "",
  value = "",
  balance = "",
  fiatOf = null,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel"
}) {
  return new Promise(resolve => {
    if (promptSetter) promptSetter({
      kind: "amount",
      title,
      context,
      note,
      maxValue,
      value,
      balance,
      fiatOf,
      confirmLabel,
      cancelLabel,
      resolve
    });else resolve(null);
  });
}
export function PromptHost() {
  const [cfg, setCfg] = useState(null);
  const [val, setVal] = useState("");
  useEffect(() => {
    const setter = c => {
      setCfg(c);
      setVal(c.value ?? "");
    };
    setterRef.current = setter;
    promptSetter = setter;
    return () => {
      if (promptSetter === setter) promptSetter = null;
    };
  }, []);
  const close = v => {
    if (cfg) {
      cfg.resolve(v);
      setCfg(null);
    }
  };
  useEffect(() => {
    if (!cfg) return;
    const onKey = e => {
      if (e.key === "Escape") close(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cfg]);
  if (!cfg) return null;
  if (cfg.kind === "amount") {
    let live = null;
    try {
      live = cfg.fiatOf ? cfg.fiatOf(val) : null;
    } catch {
      live = null;
    }
    let ctx = cfg.context;
    try {
      if (typeof ctx === "function") ctx = ctx(val);
    } catch {
      ctx = "";
    }
    return <div className="modal-overlay" onMouseDown={e => {
      if (e.target === e.currentTarget) close(null);
    }}>
                <div className="modal amount-sheet" role="dialog" aria-modal="true" aria-label={cfg.title}>
                    <h3>{cfg.title}</h3>
                    {ctx ? <p className="as-context mono">{ctx}</p> : null}
                    {cfg.note ? <p className="as-note">{cfg.note}</p> : null}
                    <div className="as-input">
                        <input autoFocus inputMode="decimal" value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => {
            if (e.key === "Enter") close(val);
          }} aria-label={cfg.title} placeholder="0.00" />
                        <button type="button" className="as-max" onClick={() => setVal(cfg.maxValue)} disabled={!cfg.maxValue} title={cfg.maxValue ? "Fill the maximum in one tap" : "Reading the token decimals"}>MAX</button>
                    </div>
                    {live || cfg.balance ? <div className="as-live small dim">
                            {live ? <><b>≈ {live}</b> fiat</> : null}
                            {live && cfg.balance ? " · " : null}
                            {cfg.balance ? <>balance <b>{cfg.balance}</b></> : null}
                        </div> : null}
                    <button className="btn accent block as-go" onClick={() => close(val)}>{cfg.confirmLabel}</button>
                    <button type="button" className="as-cancel" onClick={() => close(null)}>{cfg.cancelLabel}</button>
                </div>
            </div>;
  }
  return <div className="modal-overlay" onMouseDown={e => {
    if (e.target === e.currentTarget) close(null);
  }}>
            <div className="modal" role="dialog" aria-modal="true" aria-label={cfg.title}>
                <h3>{cfg.title}</h3>
                {cfg.body ? <p className="m-body">{cfg.body}</p> : null}
                <input autoFocus value={val} onChange={e => setVal(e.target.value)} onKeyDown={e => {
        if (e.key === "Enter") close(val);
      }} style={{
        width: "100%",
        minHeight: 38,
        padding: "8px 10px",
        fontSize: 16
      }} />
                <div className="m-actions">
                    <button className="btn ghost" onClick={() => close(null)}>Cancel</button>
                    <button className={"btn " + (cfg.tone || "accent")} onClick={() => close(val)}>{cfg.confirmLabel}</button>
                </div>
            </div>
        </div>;
}
let confirmSetter = null;
export function confirmDialog({
  title,
  body,
  confirmLabel = "Confirm",
  tone = ""
}) {
  return new Promise(resolve => {
    if (confirmSetter) confirmSetter({
      title,
      body,
      confirmLabel,
      tone,
      resolve
    });else resolve(false);
  });
}
export function ConfirmHost() {
  const [cfg, setCfg] = useState(null);
  useEffect(() => {
    confirmSetter = setCfg;
    return () => {
      if (confirmSetter === setCfg) confirmSetter = null;
    };
  }, []);
  const close = v => {
    if (cfg) {
      cfg.resolve(v);
      setCfg(null);
    }
  };
  useEffect(() => {
    if (!cfg) return;
    const onKey = e => {
      if (e.key === "Escape") close(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cfg]);
  if (!cfg) return null;
  return <div className="modal-overlay" onMouseDown={e => {
    if (e.target === e.currentTarget) close(false);
  }}>
            <div className="modal" role="dialog" aria-modal="true" aria-label={cfg.title}>
                <h3>{cfg.title}</h3>
                <p className="m-body">{cfg.body}</p>
                <div className="m-actions">
                    <button className="btn ghost" onClick={() => close(false)}>Go back</button>
                    <button className={"btn " + (cfg.tone || "primary")} autoFocus onClick={() => close(true)}>{cfg.confirmLabel}</button>
                </div>
            </div>
        </div>;
}
export function Button({
  busy,
  spin,
  children,
  tone = "",
  ghost,
  small,
  tiny,
  block,
  className,
  disabled,
  ...rest
}) {
  const cls = ["btn", tone, ghost ? "ghost" : "", small ? "small" : "", tiny ? "tiny" : "", block ? "block" : "", className].filter(Boolean).join(" ");
  const working = !!busy || !!spin;
  return <button className={cls} disabled={disabled || !!busy} {...rest}>
            {working ? <span className="spinner" aria-hidden="true" /> : null}
            {children}
        </button>;
}
export function Panel({
  title,
  sub,
  children,
  kicker,
  right,
  className
}) {
  return <section className={"panel" + (className ? " " + className : "")}>
            {right ? <div className="panel-head">
                    <div style={{
        minWidth: 0
      }}>
                        {kicker ? <p className="kicker">{kicker}</p> : null}
                        {title ? <h3>{title}</h3> : null}
                        {sub ? <p className="sub">{sub}</p> : null}
                    </div>
                    {right}
                </div> : <>
                    {kicker ? <p className="kicker">{kicker}</p> : null}
                    {title ? <h3>{title}</h3> : null}
                    {sub ? <p className="sub">{sub}</p> : null}
                </>}
            {children}
        </section>;
}
export function Field({
  label,
  hint,
  hintClass,
  children
}) {
  return <div className="field">
            {label ? <label title={label}>{label}</label> : null}
            {children}
            {hint ? <div className={"hint " + (hintClass ?? "")}>{hint}</div> : null}
        </div>;
}
export function Badge({
  tone = "",
  pulse,
  children
}) {
  return <span className={"badge " + tone + (pulse ? " pulse" : "")}>{children}</span>;
}
const STATUS_TONE = {
  SETTLED: "ok",
  DISPUTED: "danger",
  PAID: "warn",
  LOCKED: "accent",
  TAKEN: "accent",
  REFUNDED: "",
  NONE: ""
};
export function Status({
  name,
  value
}) {
  const tone = STATUS_TONE[value] ?? "";
  return <Badge tone={tone} pulse={value === "PAID" || value === "DISPUTED"}>
            <span className="dot" /><span title={`${name} desk · contract state ${value}`}>{statusLabel(value)}</span>
        </Badge>;
}
export function NeedsYou() {
  return <Badge tone="accent" pulse><span className="dot" />Your move</Badge>;
}
export function sortOpenTrades(list, needsYouOf, stuckOf) {
  const rank = t => needsYouOf(t) ? 0 : stuckOf && stuckOf(t) ? 2 : 1;
  return [...list].sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r) return r;
    return (Number(b.id) || 0) - (Number(a.id) || 0);
  });
}
export function Err({
  text,
  action
}) {
  if (!text) return null;
  const {
    headline,
    doNow,
    detail
  } = explainRevert(text);
  const hint = action ?? doNow;
  return <div className="err" role="alert">
            <div className="err-what">{headline}</div>
            {hint ? <div className="err-do">{hint}</div> : null}
            {detail && detail !== headline ? <details className="err-details">
                    <summary>The raw reason</summary>
                    <pre>{detail}</pre>
                </details> : null}
        </div>;
}
export function OkBox({
  children
}) {
  if (!children) return null;
  return <div className="ok-box">✓ {children}</div>;
}
export function TxLine({
  hash,
  cfg
}) {
  if (!hash) return null;
  const url = cfg ? txUrl(cfg, hash) : null;
  return <div className="txline">
            <span title={hash}>Transaction {short(hash)}</span>
            {url ? <a href={url} target="_blank" rel="noreferrer">Open in explorer ↗</a> : null}
            <Copy text={hash} label="Copy hash" />
        </div>;
}
export function Copy({
  text,
  label
}) {
  const [done, setDone] = useState(false);
  return <span className="mono" style={{
    cursor: "pointer"
  }} title="Click to copy" onClick={e => {
    e.stopPropagation();
    navigator.clipboard?.writeText(String(text)).then(() => {
      setDone(true);
      setTimeout(() => setDone(false), 900);
    });
  }}>
            {label ?? text}{done ? " ✓" : ""}
        </span>;
}
export function KV({
  rows
}) {
  return <div className="kv">
            {rows.map(([k, v], i) => <React.Fragment key={i}>
                    <div className="k">{k}</div>
                    <div>{v}</div>
                </React.Fragment>)}
        </div>;
}
export function EmptyState({
  children
}) {
  return <div className="empty">{children}</div>;
}
export function DeskGate({
  title = "This desk is not configured on this deployment",
  missing,
  cfg
}) {
  return <section className="panel desk-gate" role="note">
            <p className="kicker">Desk offline</p>
            <h3>{title}</h3>
            <p className="sub">
                The app reads every address from <span className="mono">config.json</span> next to the page.
                The record that loaded is missing {missing.length > 1 ? "these fields" : "this field"}, so nothing
                here can read from or write to the chain. The interface will not guess addresses.
            </p>
            <div className="kv" style={{
      margin: "10px 0"
    }}>
                {missing.map(k => <React.Fragment key={k}>
                        <div className="k mono">{k}</div>
                        <div className="mono" style={{
          color: "var(--danger)"
        }}>empty</div>
                    </React.Fragment>)}
            </div>
            <div className="note">
                <b>To light this desk up:</b> edit <span className="mono">config.json</span> (the operator-side
                deployment record), set {missing.map(k => <span className="mono" key={k}>{k}</span>)}, and reload.
                Everything else in the app keeps working - the other desks, this page's reading material, and the
                how-it-walkthrough remain browsable.
            </div>
        </section>;
}
export function MobileFold({
  summary,
  children,
  defaultOpen = false,
  note
}) {
  const isM = useIsMobile();
  if (!isM) return <>{children}</>;
  return <details className="m-fold" open={defaultOpen}>
            <summary>
                <span className="m-fold-chev" aria-hidden="true">▸</span>
                <span className="m-fold-t">{summary}</span>
                {note ? <span className="m-fold-n">{note}</span> : null}
            </summary>
            <div className="m-fold-body">{children}</div>
        </details>;
}
export function Countdown({
  seconds,
  prefix = "",
  dangerBelow = 60
}) {
  const [left, setLeft] = useState(() => Math.max(0, Math.floor(Number(seconds ?? 0))));
  useEffect(() => {
    setLeft(Math.max(0, Math.floor(Number(seconds ?? 0))));
  }, [seconds]);
  useEffect(() => {
    if (left <= 0) return;
    const t = setInterval(() => setLeft(v => Math.max(0, v - 1)), 1000);
    return () => clearInterval(t);
  }, [left > 0]);
  if (!seconds || seconds <= 0) return <span className="small dim">-</span>;
  return <span className={"countdown" + (left < dangerBelow ? " danger" : "")} title={left < dangerBelow ? "Less than a minute remains in this window" : "Time remaining in this window"}>
            {prefix}{fmtDur(left)}
        </span>;
}
export function Steps({
  items
}) {
  return <div className="steps">
            {items.map((s, i) => <div className="step" key={i}>
                    <div className="n">{String(i + 1).padStart(2, "0")}</div>
                    <div className="t">{s.t}</div>
                    <div className="d">{s.d}</div>
                </div>)}
        </div>;
}
export function MiniFlow({
  steps,
  current,
  branches = []
}) {
  const idx = steps.findIndex(s => s.k === current);
  const onBranch = branches.filter(b => b.on);
  return <div className="mf" role="img" aria-label={"trade flow: " + steps.map(s => s.t).join(" then ")}>
            <div className="mf-track">
                {steps.map((s, i) => {
        const isNow = s.k === current;
        const isDone = idx >= 0 && i < idx;
        return <span key={s.k} className={"mf-step" + (isNow ? " now" : isDone ? " done" : "")}>
                            <span className="mf-ball">{isDone ? "✓" : i + 1}</span>
                            <span className="mf-t">{s.t}</span>
                        </span>;
      })}
            </div>
            {onBranch.map(b => <p key={b.label} className={"mf-branch" + (b.hot ? " hot" : b.good ? " good" : "")}>{b.label}</p>)}
        </div>;
}
export function TradeCard({
  id,
  summary = [],
  status,
  needsYou = false,
  countdown = null,
  closed = false,
  children
}) {
  const [open, setOpen] = useState(!closed);
  useEffect(() => {
    if (!closed) setOpen(true);
  }, [closed, id]);
  return <div className={"trade-card" + (closed ? " closed" : "")}>
            <div className="trade-card-head">
                <button className="tc-toggle" onClick={() => setOpen(v => !v)} aria-expanded={open} aria-label={open ? "Collapse trade details" : "Expand trade details"}>
                    <span className={"tc-chev" + (open ? " open" : "")} aria-hidden="true">▸</span>
                    <span className="id">#{id}</span>
                </button>
                {summary.map(([k, v]) => <span className="tc-sum" key={k}><span className="k">{k}</span>{v}</span>)}
                <span className="spacer" />
                {needsYou ? <NeedsYou /> : null}
                {status}
                {countdown}
            </div>
            {open ? <div className="trade-card-body">{children}</div> : null}
        </div>;
}
export async function postTradeMessage({
  relay,
  identity,
  me,
  tradeId,
  peers,
  text,
  setInbox
}) {
  if (!relay || !identity?.sk) throw new Error("the chat relay is offline");
  const topic = "trade:" + tradeId;
  const list = Object.keys(peers ?? {}).filter(r => r !== me && peers[r]);
  if (!list.length) return false;
  let sent = 0;
  for (const role of list) {
    try {
      sendSealed(relay, {
        payload: {
          type: "chat",
          text,
          from: me,
          tradeId
        },
        toPk: peers[role],
        senderTradeSk: identity.sk,
        topic
      });
      sent++;
    } catch {}
  }
  if (!sent) return false;
  setInbox?.(prev => [...prev.slice(-200), {
    payload: {
      type: "chat",
      text,
      from: me,
      tradeId,
      topic
    },
    mine: true,
    at: Date.now()
  }]);
  return true;
}
function renderThreadBody(m) {
  const t = m?.payload?.text;
  if (typeof t === "string" && t.startsWith("[rail-pick]")) {
    try {
      const j = JSON.parse(t.slice("[rail-pick]".length));
      return <span><b>Buyer’s rail</b> · {j.rail}{j.custom ? ` - ${j.custom}` : ""} <span className="dim">, the buyer committed to this rail when claiming</span></span>;
    } catch {}
  }
  if (typeof t === "string" && t.startsWith("[tg-room]")) {
    try {
      const j = JSON.parse(t.slice("[tg-room]".length));
      if (j?.v === 1 && typeof j.link === "string" && /^https:\/\/t\.me\//.test(j.link)) {
        return <span><b>Telegram group</b> · {j.title || "private trade group"} <span className="dim">, the invite link and QR live in the Telegram card below</span></span>;
      }
    } catch {}
  }
  if (typeof t === "string" && t.startsWith(VENUE_TAG)) {
    const pin = parseVenuePin(t);
    if (pin) {
      const where = pin.city && pin.state ? pin.city + ", " + pin.state + " · " : "";
      const what = pin.kind === "words" && pin.words ? `venue words ${pin.words} · code ${pin.code}` : `pinpoint ${cellDisplay(pin)} · code ${pin.code}`;
      return <span><b>Venue pin</b> · {where}{what} <span className="dim">, sealed for this meetup; your check-in buttons use it directly</span></span>;
    }
  }
  return t ?? JSON.stringify(m?.payload).slice(0, 200);
}
export function TradeChat({
  tradeId,
  peers = {},
  me,
  label = "Chat",
  collapsedByDefault = true,
  closed = false
}) {
  const {
    cfg,
    relay,
    relayStatus,
    identity,
    inbox,
    setInbox,
    publishPresence,
    queryPresenceFor
  } = useContext(AppCtx);
  const [open, setOpen] = useState(!collapsedByDefault);
  const [text, setText] = useState("");
  const [to, setTo] = useState("all");
  const announced = useRef(false);
  const logRef = useRef(null);
  const topic = "trade:" + tradeId;
  const resolved = peers;
  const thread = useMemo(() => inbox.filter(m => m.payload?.topic === topic && (m.payload?.type === "chat" || m.payload?.type === "sys")).slice(-60), [inbox, topic]);
  useEffect(() => {
    if (open && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [open, thread.length]);
  useEffect(() => {
    if (open && !announced.current) {
      announced.current = true;
      try {
        publishPresence?.(tradeId, me);
      } catch {}
    }
  }, [open]);
  const peerRole = me === "Seller" ? "Buyer" : "Seller";
  const peersRef = useRef(peers);
  peersRef.current = peers;
  useEffect(() => {
    if (!open || closed || !queryPresenceFor) return;
    const tick = () => {
      if (document.hidden) return;
      if (!peersRef.current[peerRole]) queryPresenceFor(tradeId).catch(() => {});
      try {
        publishPresence?.(tradeId, me);
      } catch {}
    };
    tick();
    const t = setInterval(tick, 12000);
    return () => clearInterval(t);
  }, [open, closed, tradeId, peerRole, queryPresenceFor]);
  const targets = Object.keys(resolved).filter(r => r !== me && resolved[r]);
  const send = () => {
    const body = text.trim();
    if (!body || !relay) return;
    try {
      publishPresence?.(tradeId, me);
    } catch {}
    const list = to === "all" ? targets : [to];
    if (list.length === 0) {
      queryPresenceFor?.(tradeId).catch(() => {});
      toast("Connecting to the other side", {
        body: "Their handshake is being fetched from the relay now - try again in a few seconds.",
        tone: "warn"
      });
      return;
    }
    let sent = 0;
    for (const role of list) {
      try {
        sendSealed(relay, {
          payload: {
            type: "chat",
            text: body,
            from: me,
            tradeId
          },
          toPk: resolved[role],
          senderTradeSk: identity.sk,
          topic
        });
        sent++;
      } catch (e) {
        toast("The message did not send", {
          body: String(e?.message ?? e),
          tone: "err"
        });
      }
    }
    if (sent > 0) {
      setInbox(prev => [...prev.slice(-200), {
        payload: {
          type: "chat",
          text: body,
          from: me,
          tradeId,
          topic
        },
        mine: true,
        at: Date.now()
      }]);
      setText("");
    }
  };
  const relayOk = Object.values(relayStatus ?? {}).some(s => s === "open");
  const who = ["Seller", "Buyer", "Arbiter"].filter(r => r !== me && (resolved[r] || r !== "Arbiter"));
  const missing = who.filter(r => !resolved[r]);
  return <div className={"chat-panel" + (open ? " open" : "") + (closed ? " closed" : "")}>
            <button type="button" className="chat-head" onClick={() => setOpen(v => !v)} aria-expanded={open} aria-label={(open ? "Hide " : "Show ") + "the sealed trade chat"}>
                <span className={"dot " + (closed ? "" : relayOk ? "ok" : "bad")} title={closed ? "Trade closed - the thread is read-only" : relayOk ? "Chat relay connected - messages are sealed end to end; relays store ciphertext they cannot open" : "Chat relay offline - messages you send queue until it returns"} />
                <b>{label}</b>
                <span className="chat-who">
                    {who.map(r => <span key={r} className={"chat-role" + (resolved[r] ? " on" : "")} title={resolved[r] ? r + " is in the thread - sealed to their key" : r + " has not appeared yet"}>{r}{resolved[r] ? " ✓" : " …"}</span>)}
                </span>
                <span className="spacer" />
                {thread.length ? <span className="chat-count" title={thread.length + " message" + (thread.length === 1 ? "" : "s") + " in this thread"}>{thread.length}</span> : null}
                <span className={"chat-chev" + (open ? " open" : "")} aria-hidden="true">▸</span>
            </button>
            {open ? <>
                    <div className="chatlog" ref={logRef}>
                        {thread.length === 0 ? <div className="msg sys"><div className="body">No messages yet - everything here is sealed end to end; relays store ciphertext they cannot open.</div></div> : null}
                        {thread.map((m, i) => <div key={i} className={"msg" + (m.mine ? " mine" : "") + (m.payload?.type === "sys" ? " sys" : "")}>
                                {!m.mine && m.payload?.type !== "sys" ? <div className="who">{m.payload?.from ?? short(m.senderPk)} · {m.authOk === false ? "signature not verified" : "signature verified"}</div> : null}
                                <div className="body">{renderThreadBody(m)}</div>
                            </div>)}
                    </div>
                    <div className="chat-input">
                        {closed ? <span className="dim small">This trade is closed; the thread is read-only.</span> : null}
                        {targets.length > 1 ? <select className="chip select" style={{
          background: "var(--surface)",
          color: "var(--ink)",
          borderColor: "var(--line-strong)"
        }} value={to} onChange={e => setTo(e.target.value)} aria-label="Message recipient">
                                <option value="all">Everyone</option>
                                {targets.map(r => <option key={r} value={r}>{r}</option>)}
                            </select> : null}
                        {closed ? null : <input value={text} placeholder={targets.length === 0 ? "Connecting to the other side…" : "Type a message…"} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} aria-label="Message" />}
                        {closed ? null : <Button small primary={false} tone="accent" onClick={send} disabled={!text.trim()} title="Sealed to the selected parties">Send</Button>}
                    </div>
                    {!closed && missing.length > 0 ? <div className="chat-missing">
                            <span>{missing.join(" & ")} {missing.length === 1 ? "is" : "are"} connecting - their handshake is fetched from the relay automatically.</span>
                            <button type="button" className="rp-link" title="Sign and announce your chat key once more" onClick={() => {
          try {
            publishPresence?.(tradeId, me);
          } catch {}
        }}>announce my key</button>
                        </div> : null}
                </> : null}
        </div>;
}