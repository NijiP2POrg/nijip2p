import * as NT from "nostr-tools";
import { getBytes } from "ethers";
import { getSecret, setSecret } from "../lib/secrets.js";
const B = x => typeof x === "string" ? getBytes(x.startsWith("0x") ? x : "0x" + x) : x;
const enc = new TextEncoder();
const dec = new TextDecoder();
const now = () => Math.floor(Date.now() / 1000);
function n44() {
  const m = NT.nip44 ?? NT.nip44?.default;
  if (!m) throw new Error("nostr-tools nip44 missing");
  return m.v2 ?? m;
}
export function convKey(skHex, pkHex) {
  const m = n44();
  const gk = m.utils?.getConversationKey ?? m.getConversationKey;
  return gk(B(skHex), pkHex);
}
function seal_encrypt(plain, ck) {
  const m = n44();
  return (m.encrypt ?? m.v2?.encrypt)(plain, ck);
}
function seal_decrypt(ct, ck) {
  const m = n44();
  return (m.decrypt ?? m.v2?.decrypt)(ct, ck);
}
export function pkFromSk(skHex) {
  return NT.getPublicKey(B(skHex));
}
export class RelayPool {
  constructor(onStatus) {
    this.sockets = new Map();
    this.retries = new Map();
    this.timers = new Map();
    this.handlers = new Set();
    this.subId = "ps-" + Math.random().toString(16).slice(2, 10);
    this.onStatus = onStatus ?? (() => {});
    this.closed = false;
  }
  connect(urls) {
    this.closed = false;
    for (const url of urls) this._open(url);
  }
  _open(url) {
    if (this.sockets.has(url)) return;
    this._clearTimer(url);
    this.onStatus(url, "connecting");
    let ws;
    try {
      ws = new WebSocket(url);
    } catch {
      this.onStatus(url, "error");
      this._scheduleReconnect(url);
      return;
    }
    this.sockets.set(url, ws);
    ws.onopen = () => {
      this.retries.set(url, 0);
      this.onStatus(url, "open");
      this._resubscribe(url);
    };
    ws.onerror = () => {
      if (ws.readyState === WebSocket.CONNECTING) this.onStatus(url, "error");
    };
    ws.onclose = () => {
      this.sockets.delete(url);
      if (!this.closed) {
        this.onStatus(url, "connecting");
        this._scheduleReconnect(url);
      } else this.onStatus(url, "closed");
    };
    ws.onmessage = async e => {
      let text = e.data;
      if (typeof text !== "string") {
        try {
          text = text instanceof Blob ? await text.text() : new TextDecoder().decode(text);
        } catch {
          return;
        }
      }
      let msg;
      try {
        msg = JSON.parse(text);
      } catch {
        return;
      }
      if (msg[0] === "EVENT" && msg[2]) this.handlers.forEach(h => h(msg[2], url));
    };
  }
  _scheduleReconnect(url) {
    if (this.closed || this.timers.has(url)) return;
    const attempt = (this.retries.get(url) ?? 0) + 1;
    this.retries.set(url, attempt);
    const delay = Math.min(15000, 800 * 2 ** Math.min(attempt - 1, 4));
    const t = setTimeout(() => {
      this.timers.delete(url);
      this._open(url);
    }, delay);
    this.timers.set(url, t);
  }
  _clearTimer(url) {
    const t = this.timers.get(url);
    if (t) {
      clearTimeout(t);
      this.timers.delete(url);
    }
  }
  _resubscribe(url) {
    if (!this._filters) return;
    const ws = this.sockets.get(url);
    if (ws?.readyState === 1) ws.send(JSON.stringify(["REQ", this.subId, ...this._filters]));
  }
  subscribe(filters) {
    this._filters = filters;
    for (const url of this.urls()) this._resubscribe(url);
  }
  urls() {
    return [...this.sockets.keys()];
  }
  publish(event) {
    for (const url of this.urls()) {
      const ws = this.sockets.get(url);
      if (ws?.readyState === 1) ws.send(JSON.stringify(["EVENT", event]));
    }
  }
  sendIfOpen(url, msg) {
    const ws = this.sockets.get(url);
    if (ws?.readyState === 1) ws.send(msg);
  }
  query(filter, ms = 3500) {
    const qid = this.subId + "-q" + Math.random().toString(16).slice(2, 8);
    const events = [];
    const onEv = ev => events.push(ev);
    this.handlers.add(onEv);
    for (const url of this.urls()) this.sendIfOpen(url, JSON.stringify(["REQ", qid, filter]));
    return new Promise(resolve => setTimeout(() => {
      this.handlers.delete(onEv);
      for (const url of this.urls()) this.sendIfOpen(url, JSON.stringify(["CLOSE", qid]));
      resolve(events);
    }, ms));
  }
  close() {
    this.closed = true;
    for (const url of [...this.timers.keys()]) this._clearTimer(url);
    for (const ws of this.sockets.values()) {
      try {
        ws.close();
      } catch {}
    }
    this.sockets.clear();
  }
}
export function identityFor(address) {
  const storeKey = "nijip2p-nostr-sk-" + (address ?? "guest");
  let sk = getSecret(storeKey);
  if (!sk) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    sk = [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
    void setSecret(storeKey, sk);
  }
  return {
    sk,
    pk: pkFromSk(sk)
  };
}
export function sendSealed(pool, {
  payload,
  toPk,
  senderTradeSk,
  topic
}) {
  const body = JSON.stringify({
    ...payload,
    topic,
    ts: now()
  });
  const sealSk = senderTradeSk;
  const sealEvent = NT.finalizeEvent({
    kind: 13,
    created_at: now() - Math.floor(Math.random() * 300),
    tags: [],
    content: seal_encrypt(body, convKey(sealSk, toPk))
  }, B(sealSk));
  const wrapSkBytes = crypto.getRandomValues(new Uint8Array(32));
  const wrapSk = [...wrapSkBytes].map(b => b.toString(16).padStart(2, "0")).join("");
  const wrapEvent = NT.finalizeEvent({
    kind: 1059,
    created_at: now() - Math.floor(Math.random() * 600),
    tags: [["p", toPk], ["t", topic ?? "general"]],
    content: seal_encrypt(JSON.stringify(sealEvent), convKey(wrapSk, toPk))
  }, B(wrapSk));
  pool.publish(wrapEvent);
  return wrapEvent.id;
}
export function openSealed(wrapEvent, mySessionSk) {
  try {
    const inner = seal_decrypt(wrapEvent.content, convKey(mySessionSk, wrapEvent.pubkey));
    const sealEvent = JSON.parse(inner);
    const payload = JSON.parse(seal_decrypt(sealEvent.content, convKey(mySessionSk, sealEvent.pubkey)));
    const ok = NT.verifyEvent({
      ...sealEvent,
      id: sealEvent.id,
      pubkey: sealEvent.pubkey,
      sig: sealEvent.sig
    });
    return {
      payload,
      senderPk: sealEvent.pubkey,
      authOk: !!ok
    };
  } catch {
    return null;
  }
}