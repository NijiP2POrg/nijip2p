import { ethers } from "ethers";
import { convKey } from "../chat/nostr.js";
import { RAILS, IN_STATES } from "./paymentRails.js";
export const OFFER_RAILS_KIND = 20002;
export const BOARD_NUDGE_KIND = 20078;
export const DESKS = ["remote", "cash"];
export const DESK_LABEL = {
  remote: "Remote escrow",
  cash: "In-person escrow"
};
const RAIL_IDS = new Set(RAILS.map(r => r.id));
const STATE_CODES = new Set(IN_STATES.map(([c]) => c));
export const CUSTOM_MAX = 80;
export const CITY_MAX = 40;
export function cleanCustom(s) {
  const out = String(s ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return out.slice(0, CUSTOM_MAX);
}
const cleanCity = s => String(s ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, CITY_MAX);
function sanitizeRegion(state, city) {
  const st = String(state ?? "").toUpperCase();
  const ct = cleanCity(city);
  if (!st && !ct) return {
    state: "",
    city: ""
  };
  if (!STATE_CODES.has(st)) return {
    err: "Pick a state from the list."
  };
  if (!ct) return {
    err: "Add the city for the in-person meetup."
  };
  return {
    state: st,
    city: ct
  };
}
const cleanRate = r => {
  const s = String(r ?? "").trim();
  if (!s) return {
    rate: ""
  };
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(s)) return {
    err: "Rate must be a plain rupee amount, like 92 or 92.50."
  };
  return {
    rate: s
  };
};
export const cleanCell = c => {
  const s = String(c ?? "").trim().toLowerCase();
  return /^[0123456789bcdefghjkmnpqrstuvwxyz]{7}$/.test(s) ? s : "";
};
export function sanitizeRailSelection(rails, custom, region, rate) {
  const ids = [...new Set((Array.isArray(rails) ? rails : []).filter(r => RAIL_IDS.has(r)))];
  const cus = cleanCustom(custom);
  const reg = sanitizeRegion(region?.state, region?.city);
  if (reg.err) return reg;
  const rt = cleanRate(rate);
  if (rt.err) return rt;
  if (!ids.length && !cus) return {
    err: "Pick at least one payment rail - or describe a custom one."
  };
  if (ids.length > 6) return {
    err: "Too many rails selected."
  };
  return {
    rails: ids,
    custom: cus,
    state: reg.state,
    city: reg.city,
    rate: rt.rate
  };
}
export function offerRailsMessage({
  chainId,
  desk,
  offerId,
  address,
  rails,
  custom,
  npub,
  state,
  city,
  rate,
  cell
}) {
  const lines = ["NijiP2P offer rails", `chain ${chainId} ${desk} offer ${offerId}`, `seller ${address}`, `accepts [${(rails ?? []).join(",")}]`, `custom [${custom ?? ""}]`, `chat key ${npub}`];
  if (state && city) lines.push(`region [${city}, ${state}]`);
  if (rate) lines.push(`rate [${rate} INR per coin]`);
  if (cell) lines.push(`cell [${cell}]`);
  return lines.join("\n");
}
export async function buildOfferRailsEvent({
  identity,
  session,
  desk,
  chainId,
  offerId,
  rails,
  custom,
  city,
  state,
  rate,
  cell
}) {
  if (!identity || !session) throw new Error("Connect an account first.");
  if (!DESKS.includes(desk)) throw new Error("Unknown desk.");
  const clean = sanitizeRailSelection(rails, custom, {
    state,
    city
  }, rate);
  if (clean.err) throw new Error(clean.err);
  const cl = cleanCell(cell);
  const npub = identity.pk;
  const msg = offerRailsMessage({
    chainId,
    desk,
    offerId: offerId.toString(),
    address: session.address,
    rails: clean.rails,
    custom: clean.custom,
    npub,
    state: clean.state,
    city: clean.city,
    rate: clean.rate,
    cell: cl
  });
  const sig = await session.signer.signMessage(msg);
  const content = JSON.stringify({
    type: "offer-rails",
    v: cl ? 3 : 2,
    desk,
    chainId,
    offerId: offerId.toString(),
    address: session.address,
    rails: clean.rails,
    custom: clean.custom,
    city: clean.city,
    state: clean.state,
    rate: clean.rate,
    ...(cl ? {
      cell: cl
    } : {}),
    npub,
    sig
  });
  const bytes = new Uint8Array(identity.sk.match(/.{1,2}/g).map(h => parseInt(h, 16)));
  const NT = await import("nostr-tools");
  const event = NT.finalizeEvent({
    kind: OFFER_RAILS_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags: [["t", "offer:" + offerId], ["p", npub]],
    content
  }, bytes);
  const ann = {
    desk,
    chainId: Number(chainId),
    offerId: offerId.toString(),
    rails: clean.rails,
    custom: clean.custom,
    city: clean.city,
    state: clean.state,
    rate: clean.rate,
    ...(cl ? {
      cell: cl
    } : {}),
    address: session.address.toLowerCase(),
    at: event.created_at
  };
  return {
    ann,
    event
  };
}
export async function signAndPublishOfferRails({
  relay,
  identity,
  session,
  desk,
  chainId,
  offerId,
  rails,
  custom,
  city,
  state,
  rate,
  cell
}) {
  const {
    ann,
    event
  } = await buildOfferRailsEvent({
    identity,
    session,
    desk,
    chainId,
    offerId,
    rails,
    custom,
    city,
    state,
    rate,
    cell
  });
  let sent = false;
  try {
    relay.publish(event);
    sent = true;
  } catch {}
  return {
    ann,
    sent
  };
}
export async function publishBoardNudge({
  relay,
  identity,
  offerId,
  tradeId
}) {
  if (!relay || !identity?.sk || offerId == null && tradeId == null) return false;
  try {
    const bytes = new Uint8Array(identity.sk.match(/.{1,2}/g).map(h => parseInt(h, 16)));
    const NT = await import("nostr-tools");
    const tags = [];
    if (offerId != null) tags.push(["offer", String(offerId)]);
    if (tradeId != null) tags.push(["trade", String(tradeId)]);
    const event = NT.finalizeEvent({
      kind: BOARD_NUDGE_KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: ""
    }, bytes);
    relay.publish(event);
    return true;
  } catch {
    return false;
  }
}
export function meetCodeOf(mySk, theirPk, tradeId) {
  try {
    if (!mySk || !theirPk || tradeId == null) return null;
    const ck = convKey(mySk, theirPk);
    const h = ethers.keccak256(ethers.concat([ck, ethers.toUtf8Bytes("niji-meet:" + String(tradeId))]));
    return String(BigInt(h) % 1000000n).padStart(6, "0");
  } catch {
    return null;
  }
}
export function parseBoardNudge(ev) {
  try {
    if (ev.kind !== BOARD_NUDGE_KIND) return null;
    const offerTag = (ev.tags ?? []).find(t => t[0] === "offer");
    const tradeTag = (ev.tags ?? []).find(t => t[0] === "trade");
    const offerId = offerTag ? String(offerTag[1]) : null;
    const tradeId = tradeTag ? String(tradeTag[1]) : null;
    if (offerId == null && tradeId == null) return null;
    return {
      id: String(ev.id ?? String(offerId) + ":" + String(tradeId) + ":" + Number(ev.created_at)),
      offerId,
      tradeId,
      at: Number(ev.created_at) * 1000
    };
  } catch {
    return null;
  }
}
export function verifyOfferRails(ev) {
  try {
    if (ev.kind !== OFFER_RAILS_KIND) return null;
    const pl = JSON.parse(ev.content);
    if (pl?.type !== "offer-rails") return null;
    if (pl.v !== 1 && pl.v !== 2 && pl.v !== 3) return null;
    if (!pl.address || !pl.npub || !pl.sig || !pl.offerId || !pl.desk) return null;
    if (!DESKS.includes(pl.desk)) return null;
    const cell = pl.v === 3 ? cleanCell(pl.cell) : "";
    const clean = sanitizeRailSelection(pl.rails, pl.custom, {
      state: pl.v >= 2 ? pl.state : "",
      city: pl.v >= 2 ? pl.city : ""
    }, pl.v >= 2 ? pl.rate : "");
    if (clean.err) return null;
    if (ev.pubkey !== pl.npub) return null;
    const msg = offerRailsMessage({
      chainId: pl.chainId,
      desk: pl.desk,
      offerId: pl.offerId,
      address: pl.address,
      rails: clean.rails,
      custom: clean.custom,
      npub: pl.npub,
      state: clean.state,
      city: clean.city,
      rate: clean.rate,
      cell
    });
    const recovered = ethers.verifyMessage(msg, pl.sig);
    if (recovered.toLowerCase() !== String(pl.address).toLowerCase()) return null;
    return {
      desk: pl.desk,
      chainId: Number(pl.chainId),
      offerId: String(pl.offerId),
      rails: clean.rails,
      custom: clean.custom,
      city: clean.city,
      state: clean.state,
      rate: clean.rate,
      ...(cell ? {
        cell
      } : {}),
      address: pl.address.toLowerCase(),
      at: ev.created_at
    };
  } catch {
    return null;
  }
}
export function annForOffer(offerAnns, {
  desk,
  chainId,
  offerId,
  seller
}) {
  if (!offerAnns || offerId == null || !seller) return null;
  const a = offerAnns[`${desk}|${Number(chainId)}|${offerId.toString()}`];
  if (!a) return null;
  if (a.address !== String(seller).toLowerCase()) return null;
  return a;
}
const ANNS_KEY = "nijip2p-offer-rails-store-v2";
export const annKey = a => `${a.desk}|${Number(a.chainId)}|${String(a.offerId)}`;
export function loadLocalAnns() {
  try {
    return JSON.parse(localStorage.getItem(ANNS_KEY) ?? "{}") ?? {};
  } catch {
    return {};
  }
}
export function saveLocalAnn(ann) {
  try {
    if (!ann?.desk || ann.offerId == null) return;
    const all = loadLocalAnns();
    const k = annKey(ann);
    if (all[k]?.at >= ann.at) return;
    all[k] = ann;
    const keys = Object.keys(all);
    if (keys.length > 400) for (const old of keys.sort((a, b) => (all[a].at ?? 0) - (all[b].at ?? 0)).slice(0, keys.length - 400)) delete all[old];
    localStorage.setItem(ANNS_KEY, JSON.stringify(all));
  } catch {}
}
const RAILS_QUEUE_KEY = "nijip2p-rails-queue-v2";
export function loadRailsQueue() {
  try {
    const q = JSON.parse(localStorage.getItem(RAILS_QUEUE_KEY) ?? "[]");
    return Array.isArray(q) ? q : [];
  } catch {
    return [];
  }
}
export function saveRailsQueue(q) {
  try {
    localStorage.setItem(RAILS_QUEUE_KEY, JSON.stringify(q.slice(-24)));
  } catch {}
}
export function enqueueRailsJob(job) {
  const q = loadRailsQueue().filter(j => !(j.desk === job.desk && String(j.offerId) === String(job.offerId)));
  q.push({
    ...job,
    at: Date.now()
  });
  saveRailsQueue(q);
  return q;
}
const PICK_KEY = "nijip2p-rail-pick-v1";
const loadPicks = () => {
  try {
    return JSON.parse(localStorage.getItem(PICK_KEY) ?? "{}");
  } catch {
    return {};
  }
};
export function rememberPick({
  desk,
  chainId,
  offerId,
  pick
}) {
  try {
    const all = loadPicks();
    all[`${desk}|${Number(chainId)}|${offerId.toString()}`] = pick;
    localStorage.setItem(PICK_KEY, JSON.stringify(all));
  } catch {}
}
export function getPick({
  desk,
  chainId,
  offerId
}) {
  return loadPicks()[`${desk}|${Number(chainId)}|${offerId.toString()}`] ?? null;
}
export function offerIdFromReceipt(rc, iface, eventName = "OfferCreated") {
  try {
    for (const log of rc?.logs ?? []) {
      try {
        const parsed = iface.parseLog({
          topics: [...log.topics],
          data: log.data
        });
        if (parsed?.name === eventName && parsed.args?.id != null) return BigInt(parsed.args.id);
      } catch {}
    }
  } catch {}
  return null;
}