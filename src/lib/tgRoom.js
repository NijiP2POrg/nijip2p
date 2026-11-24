const trim = u => String(u ?? "").replace(/\/+$/, "");
let tgSubs = new Set();
let tgTimer = null;
let tgLast = "unknown";
let tgSubsUrl = "";
async function tgProbe(url) {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 4000);
    const r = await fetch(trim(url) + "/health", {
      signal: ctl.signal
    });
    clearTimeout(t);
    const j = await r.json().catch(() => null);
    return r.ok && j?.ok === true ? "ok" : "down";
  } catch {
    return "down";
  }
}
async function tgTick() {
  const url = tgSubsUrl;
  const st = url ? await tgProbe(url) : "off";
  if (st !== tgLast) {
    tgLast = st;
    tgSubs.forEach(f => f(st));
  }
}
export function onTgHealth(apiUrl, cb) {
  tgSubs.add(cb);
  tgSubsUrl = trim(apiUrl) || "";
  if (!tgTimer) {
    tgTick();
    tgTimer = setInterval(tgTick, 30000);
  } else cb(tgLast);
  return () => {
    tgSubs.delete(cb);
    if (!tgSubs.size) {
      clearInterval(tgTimer);
      tgTimer = null;
      tgLast = "unknown";
      tgSubsUrl = "";
    }
  };
}
export async function createTgGroup(cfg, signer, {
  tradeId,
  chainId,
  contract
}) {
  const msg = `NijiP2P trade ${tradeId}: telegram group`;
  const sig = await signer.signMessage(msg);
  const r = await fetch(trim(cfg.telegramApiUrl) + "/group", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      tradeId: String(tradeId),
      chainId,
      contract: String(contract ?? ""),
      address: await signer.getAddress(),
      sig
    })
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || j?.ok !== true || !j?.link) throw new Error(j?.error ?? "the Telegram sidecar refused the request");
  return j;
}
export async function deleteTgGroup(cfg, signer, {
  tradeId,
  chainId,
  contract
}) {
  const msg = `NijiP2P trade ${tradeId}: telegram group`;
  const sig = await signer.signMessage(msg);
  const r = await fetch(trim(cfg.telegramApiUrl) + "/group/delete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      tradeId: String(tradeId),
      chainId,
      contract: String(contract ?? ""),
      address: await signer.getAddress(),
      sig
    })
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || j?.ok !== true) throw new Error(j?.error ?? "the Telegram sidecar refused the delete");
  return j;
}
export const TG_ROOM_TAG = "[tg-room]";
export const tgRoomMessage = (link, title) => TG_ROOM_TAG + JSON.stringify({
  v: 1,
  link,
  title: String(title ?? "")
});
export function parseTgRoom(text) {
  try {
    if (typeof text !== "string" || !text.startsWith(TG_ROOM_TAG)) return null;
    const pl = JSON.parse(text.slice(TG_ROOM_TAG.length));
    if (pl?.v !== 1 || typeof pl.link !== "string" || !/^https:\/\/t\.me\//.test(pl.link)) return null;
    return {
      link: pl.link,
      title: String(pl.title ?? "")
    };
  } catch {
    return null;
  }
}