import { verifyEvent, getEventHash } from "nostr-tools";
export const ROOM_ANNOUNCE_KIND = 20003;
const HEX64 = /^[0-9a-f]{64}$/;
export function verifyRoomAnnouncement(ev, pinnedPubkey) {
  try {
    if (!pinnedPubkey || typeof pinnedPubkey !== "string" || !HEX64.test(pinnedPubkey.toLowerCase())) return null;
    if (ev?.kind !== ROOM_ANNOUNCE_KIND) return null;
    if (getEventHash(ev) !== ev.id) return null;
    if (!verifyEvent(ev)) return null;
    if (ev.pubkey.toLowerCase() !== pinnedPubkey.toLowerCase()) return null;
    const pl = JSON.parse(ev.content);
    if (pl?.type !== "simplex-room" || pl?.v !== 1) return null;
    if (!pl.botPk || ev.pubkey !== pl.botPk) return null;
    if (!pl.tradeId || !pl.chain || typeof pl.contract !== "string" || !pl.contract.startsWith("0x")) return null;
    const seats = {};
    for (const role of ["Buyer", "Seller"]) {
      const s = pl.seats?.[role];
      if (!s || typeof s.link !== "string" || !s.link.startsWith("https://") || !HEX64.test(s.token ?? "")) return null;
      seats[role] = {
        link: s.link,
        token: s.token
      };
    }
    return {
      tradeId: String(pl.tradeId),
      chain: pl.chain,
      contract: pl.contract,
      seats,
      botPk: pl.botPk,
      at: ev.created_at ?? 0
    };
  } catch {
    return null;
  }
}
export function claimMessage(tradeId, role, seatToken) {
  return `NijiP2P trade ${tradeId}: ${role} claim ${seatToken}`;
}
export function claimCodeToCopy(msg, sig) {
  return msg + "\n" + sig;
}
export function myRoomRole(trade, myAddress) {
  if (!myAddress || !trade) return null;
  const me = String(myAddress).toLowerCase();
  if (String(trade.buyer ?? "").toLowerCase() === me) return "Buyer";
  if (String(trade.seller ?? "").toLowerCase() === me) return "Seller";
  return null;
}
export function announcementMatchesTrade(ann, {
  tradeId,
  chainId,
  contract
}) {
  if (!ann) return false;
  return String(ann.tradeId) === String(tradeId) && Number(ann.chain) === Number(chainId) && ann.contract.toLowerCase() === String(contract ?? "").toLowerCase();
}