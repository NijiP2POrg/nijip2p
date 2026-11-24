import { ethers } from "ethers";
export const PRESENCE_KIND = 20001;
export const PRESENCE_REPUBLISH_MS = 20 * 60 * 1000;
export const PRESENCE_TTL_MS = 30 * 60 * 1000;
const seenSigs = new Set();
export function presenceMessage(tradeId, role, address, npub) {
  return `NijiP2P trade ${tradeId}: ${role} ${address} uses nostr key ${npub}`;
}
export async function signPresence(signer, tradeId, role, address, npub) {
  return signer.signMessage(presenceMessage(tradeId, role, address, npub));
}
export async function publishPresence({
  relay,
  identity,
  session,
  tradeId,
  role
}) {
  if (!relay || !identity || !session) return;
  const bucket = Math.floor(Date.now() / PRESENCE_REPUBLISH_MS);
  const dedupeKey = bucket + "|" + tradeId + "|" + role + "|" + identity.pk;
  if (seenSigs.has(dedupeKey)) return;
  seenSigs.add(dedupeKey);
  const sig = await signPresence(session.signer, tradeId, role, session.address, identity.pk);
  const event = {
    kind: PRESENCE_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags: [["t", "trade:" + tradeId], ["p", identity.pk]],
    content: JSON.stringify({
      type: "presence",
      tradeId,
      role,
      address: session.address,
      npub: identity.pk,
      sig
    })
  };
  const sealed = await import("nostr-tools").then(NT => NT.finalizeEvent(event, hexToBytes(identity.sk)));
  relay.publish(sealed);
}
export function verifyPresence(ev) {
  try {
    if (ev.kind !== PRESENCE_KIND) return null;
    const pl = JSON.parse(ev.content);
    if (pl?.type !== "presence" || !pl.tradeId || !pl.role || !pl.address || !pl.npub || !pl.sig) return null;
    const recovered = ethers.verifyMessage(presenceMessage(pl.tradeId, pl.role, pl.address, pl.npub), pl.sig);
    if (recovered.toLowerCase() !== String(pl.address).toLowerCase()) return null;
    if (ev.pubkey !== pl.npub) return null;
    return {
      tradeId: String(pl.tradeId),
      role: pl.role,
      address: pl.address.toLowerCase(),
      npub: pl.npub,
      at: ev.created_at
    };
  } catch {
    return null;
  }
}
function hexToBytes(hex) {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}
export function peersForTrade(presence, tradeId, {
  seller,
  buyer
} = {}) {
  const t = presence?.[String(tradeId)] ?? {};
  const out = {};
  const all = Array.isArray(t._all) && t._all.length ? t._all : ["Seller", "Buyer", "Arbiter"].filter(r => t[r]).map(r => ({
    role: r,
    ...t[r]
  }));
  for (const role of ["Seller", "Buyer", "Arbiter"]) {
    const cands = all.filter(e => e.role === role && e.npub && String(e.npub).length > 20);
    if (!cands.length) continue;
    let pick = null;
    if (role === "Seller" && seller) pick = cands.find(e => e.address === String(seller).toLowerCase());else if (role === "Buyer" && buyer) pick = cands.find(e => e.address === String(buyer).toLowerCase());else if (role === "Arbiter") pick = cands[cands.length - 1];
    if (!pick) pick = cands.filter(e => !e.address).pop();
    if (pick) out[role] = pick.npub;
  }
  return out;
}
export async function securePeersForTrade(presence, tradeId, {
  seller,
  buyer,
  arbiterOk,
  nowMs = Date.now()
}) {
  const t = presence?.[String(tradeId)] ?? {};
  const all = Array.isArray(t._all) && t._all.length ? t._all : [];
  const fresh = e => {
    const ts = Number(e.at ?? 0);
    if (!(ts > 0)) return false;
    const tsMs = ts < 1e12 ? ts * 1000 : ts;
    return nowMs - tsMs <= PRESENCE_TTL_MS;
  };
  const verifiedOnly = role => all.filter(e => e.role === role && !e.learnedFromChat && e.address && e.npub && fresh(e));
  const out = {};
  const sellerHit = seller ? verifiedOnly("Seller").find(e => e.address === String(seller).toLowerCase()) : null;
  if (sellerHit) out.Seller = sellerHit.npub;
  const buyerHit = buyer ? verifiedOnly("Buyer").find(e => e.address === String(buyer).toLowerCase()) : null;
  if (buyerHit) out.Buyer = buyerHit.npub;
  if (arbiterOk) {
    for (const e of verifiedOnly("Arbiter").sort((a, b) => Number(b.at) - Number(a.at))) {
      let ok = false;
      try {
        ok = !!(await arbiterOk(e.address));
      } catch {
        ok = false;
      }
      if (ok) {
        out.Arbiter = e.npub;
        break;
      }
    }
  }
  return out;
}
export function myRoleFor(trade, me, sessionIsArbiter) {
  if (!me) return null;
  if (trade && String(trade.seller).toLowerCase() === me.toLowerCase()) return "Seller";
  if (trade && String(trade.buyer).toLowerCase() === me.toLowerCase()) return "Buyer";
  if (sessionIsArbiter) return "Arbiter";
  return null;
}