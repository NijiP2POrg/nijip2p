import React, { useContext, useEffect, useMemo, useState } from "react";
import { AppCtx } from "../AppCtx.jsx";
import { onTgHealth, createTgGroup, tgRoomMessage, parseTgRoom } from "../lib/tgRoom.js";
import { peersForTrade } from "../chat/presence.js";
import { toast, postTradeMessage } from "../lib/ui.jsx";
function QrReveal({
  value,
  label
}) {
  const [open, setOpen] = useState(false);
  const [dataUrl, setDataUrl] = useState("");
  const reveal = async () => {
    setOpen(v => !v);
    if (!dataUrl) {
      try {
        const mod = await import("qrcode-generator");
        const qrcode = typeof mod === "function" ? mod : mod.default ?? mod.q?.default ?? mod.q ?? mod;
        if (typeof qrcode !== "function") throw new Error("qr library missing");
        const qr = qrcode(0, "M");
        qr.addData(value);
        qr.make();
        const n = qr.getModuleCount();
        const scale = 4,
          quiet = 2,
          total = (n + quiet * 2) * scale;
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = total;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, total, total);
        ctx.fillStyle = "#000000";
        for (let r = 0; r < n; r++) {
          for (let c = 0; c < n; c++) {
            if (qr.isDark(r, c)) ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
          }
        }
        setDataUrl(canvas.toDataURL("image/png"));
      } catch {
        toast("The QR could not be rendered", {
          body: "Copy the link below and open it in Telegram instead.",
          tone: "warn"
        });
      }
    }
  };
  return <div className="row" style={{
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10
  }}>
            <button className="btn tiny ghost" onClick={reveal}>{open ? "Hide QR" : "Show QR"}</button>
            {open && dataUrl ? <img src={dataUrl} width={168} height={168} alt={label} style={{
      background: "#fff",
      padding: 8,
      borderRadius: 10,
      border: "1px solid var(--line)",
      maxWidth: 180
    }} /> : null}
        </div>;
}
function CopyLine({
  value,
  label,
  title
}) {
  return <button className="btn tiny ghost" title={title ?? "Click to copy"} onClick={() => navigator.clipboard?.writeText(String(value)).then(() => toast("Copied", {
    body: label ?? "On the clipboard.",
    tone: "ok"
  })).catch(() => {})}>
            {label ?? "Copy"}
        </button>;
}
const ROOMS_KEY = "nijip2p-tg-rooms-v1";
function loadSavedRoom(key) {
  try {
    const j = JSON.parse(localStorage.getItem(ROOMS_KEY) ?? "{}");
    const v = j[key];
    return v && typeof v.link === "string" ? v : null;
  } catch {
    return null;
  }
}
function saveRoom(key, room) {
  try {
    const j = JSON.parse(localStorage.getItem(ROOMS_KEY) ?? "{}");
    j[key] = {
      link: room.link,
      title: String(room.title ?? "")
    };
    localStorage.setItem(ROOMS_KEY, JSON.stringify(j));
  } catch {}
}
export default function TelegramRoom({
  tradeId,
  trade,
  contract,
  amBuyer,
  amSeller,
  closed
}) {
  const {
    cfg,
    relay,
    identity,
    presence,
    inbox,
    setInbox,
    session
  } = useContext(AppCtx);
  const [tg, setTg] = useState("unknown");
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState(null);
  const roomKey = (cfg?.chainId ?? "") + ":" + String(tradeId) + ":" + String(contract ?? "").toLowerCase();
  useEffect(() => cfg?.telegramApiUrl ? onTgHealth(cfg.telegramApiUrl, setTg) : undefined, [cfg?.telegramApiUrl]);
  useEffect(() => {
    if (!mine && cfg?.chainId != null) {
      const saved = loadSavedRoom(roomKey);
      if (saved) setMine(saved);
    }
  }, [mine, cfg?.chainId, roomKey]);
  const posted = useMemo(() => (inbox ?? []).map(m => m?.payload?.tradeId === String(tradeId) && typeof m?.payload?.text === "string" ? parseTgRoom(m.payload.text) : null).find(Boolean), [inbox, tradeId]);
  const room = mine ?? posted;
  const share = async info => {
    try {
      return await postTradeMessage({
        relay,
        identity,
        me: amSeller ? "Seller" : "Buyer",
        tradeId: String(tradeId),
        peers: peersForTrade(presence, trade.id, trade),
        setInbox,
        text: tgRoomMessage(info.link, info.title ?? "")
      });
    } catch {
      return false;
    }
  };
  const create = async () => {
    if (!cfg?.telegramApiUrl) return;
    setBusy(true);
    try {
      const res = await createTgGroup(cfg, session?.signer, {
        tradeId,
        chainId: cfg.chainId,
        contract
      });
      setMine({
        link: res.link,
        title: res.title ?? ""
      });
      saveRoom(roomKey, {
        link: res.link,
        title: res.title ?? ""
      });
      const label = res.existing ? "Telegram invite fetched" : "Telegram group ready";
      if (await share(res)) {
        toast(label, {
          body: "The invite link was shared to the sealed trade thread.",
          tone: "ok"
        });
      } else {
        toast(label, {
          body: "Delivery pending - the link retries automatically until the other side is reachable.",
          tone: "warn"
        });
        let tries = 0;
        const iv = setInterval(async () => {
          tries += 1;
          const ok = await share(res);
          if (ok || tries >= 12) {
            clearInterval(iv);
            if (ok) toast("Telegram invite delivered", {
              body: "The other side can see the group now.",
              tone: "ok"
            });
          }
        }, 8000);
      }
    } catch (e) {
      toast("The Telegram group did not open", {
        body: String(e?.message ?? e),
        tone: "err"
      });
    } finally {
      setBusy(false);
    }
  };
  if (!cfg?.telegramApiUrl) return null;
  if (closed && !room) return null;
  const open = tg === "ok";
  const dotCls = open ? "dot ok" : "dot bad";
  const statusText = open ? "active" : "unavailable here";
  return <div className="chat-panel" style={{
    marginTop: 10
  }}>
            <div className="chat-head">
                <span className={dotCls} aria-hidden="true" />
                <b style={{
        fontWeight: 600
      }}>Telegram group</b>
                <span className="dim" title={"Telegram sidecar is " + statusText}>
                    trade #{tradeId} · optional channel · {statusText}
                </span>
                <span className="spacer" />
            </div>
            <div style={{
      padding: "10px 12px",
      display: "grid",
      gap: 10
    }}>
                {!open ? <p className="dim small" style={{
        margin: 0
      }}>
                        Telegram is not available on this deployment right now - use the SimpleX room as the second chat. The dot turns green the moment the Telegram sidecar answers.
                    </p> : room ? <>
                        <p className="dim small" style={{
          margin: 0
        }}>
                            The private Telegram group for this trade is up. Join from your own account - the link is limited to this trade and the group carries the trade number in its title.
                        </p>
                        <div className="row" style={{
          flexWrap: "wrap",
          gap: 10,
          alignItems: "center"
        }}>
                            <a className="btn tiny" href={room.link} target="_blank" rel="noreferrer">Open in Telegram ↗</a>
                            <QrReveal value={room.link} label="Telegram invite QR" />
                            <CopyLine value={room.link} label="Copy link" title="Copy the invite link - it opens the private group in Telegram" />
                        </div>
                    </> : amSeller || amBuyer ? <>
                        <p className="dim small" style={{
          margin: 0
        }}>
                            {amSeller ? "Open a private Telegram group for this trade: one tap creates it, mints a limited invite link and shares it through the sealed thread." : "The seller's invite lands here when it arrives. If it never shows up, fetch it yourself - the same group is returned to either party."}
                        </p>
                        <div className="row" style={{
          flexWrap: "wrap",
          gap: 10,
          alignItems: "center"
        }}>
                            <button className="btn tiny" onClick={create} disabled={busy} title={amSeller ? "One free signature - no transaction, no gas" : "Free signature - returns the existing group, or opens it if the seller never did"}>
                                {busy ? "Working…" : amSeller ? "Create the Telegram group" : "Fetch the Telegram invite"}
                            </button>
                        </div>
                    </> : <p className="dim small" style={{
        margin: 0
      }}>
                        Only this trade's buyer and seller can open or join the Telegram group.
                    </p>}
            </div>
        </div>;
}