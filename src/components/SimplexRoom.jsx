import React, { useContext, useState } from "react";
import { AppCtx } from "../AppCtx.jsx";
import { claimMessage, claimCodeToCopy, myRoomRole } from "../lib/simplexRoom.js";
import { toast } from "../lib/ui.jsx";
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
          body: "Copy the link below and open it in the SimpleX app instead.",
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
const chainName = c => c === 1 ? "Ethereum" : c === 56 ? "BNB Chain" : c === 137 ? "Polygon" : "chain " + c;
export default function SimplexRoom({
  tradeId,
  trade,
  contract,
  amBuyer,
  amSeller,
  isArbiter,
  closed
}) {
  const {
    cfg,
    me,
    session,
    rooms
  } = useContext(AppCtx);
  const [claim, setClaim] = useState(null);
  const [busy, setBusy] = useState(false);
  if (!cfg?.simplexBotPubkey || closed) return null;
  const roomKey = cfg.chainId + ":" + String(tradeId) + ":" + String(contract ?? "").toLowerCase();
  const ann = rooms?.[roomKey];
  if (!ann) {
    return <div className="simplex-pending" role="note">
                <span className="dot" aria-hidden="true" />
                <span>SimpleX room · waiting for the relay bot&apos;s announcement for this trade - the room opens here the moment it posts one.</span>
            </div>;
  }
  const role = myRoomRole(trade, me);
  const seat = role ? ann.seats[role] : null;
  const doClaim = async () => {
    if (!session?.signer || !role || !seat) return;
    setBusy(true);
    try {
      const msg = claimMessage(tradeId, role, seat.token);
      const sig = await session.signer.signMessage(msg);
      setClaim({
        msg,
        sig
      });
      toast("Claim code ready", {
        body: "Copy it and paste it as a message in the SimpleX room.",
        tone: "ok"
      });
    } catch (e) {
      toast("The signature did not happen", {
        body: String(e?.message ?? e),
        tone: "warn"
      });
    } finally {
      setBusy(false);
    }
  };
  return <div className="chat-panel" style={{
    marginTop: 10
  }}>
            <div className="chat-head">
                <span className="dot ok" />
                <b style={{
        fontWeight: 600
      }}>SimpleX room</b>
                <span className="dim" title="An optional SimpleX group for this trade, relayed by the NijiP2P bot">
                    trade #{tradeId} · optional channel · {chainName(ann.chain)}
                </span>
                <span className="spacer" />
            </div>
            <div style={{
      padding: "10px 12px",
      display: "grid",
      gap: 10
    }}>
                <p className="dim small" style={{
        margin: 0
      }}>
                    The trade thread above is the default chat - sealed end to end, this platform cannot read it.
                    This room is the same trade as a group in the SimpleX app: it is relayed and logged by the
                    NijiP2P bot, and the transcript reaches the arbiter only if the trade goes to dispute.
                </p>

                {role ? <>
                        <div className="row" style={{
          flexWrap: "wrap",
          gap: 10,
          alignItems: "center"
        }}>
                            <span className="badge">{role} seat</span>
                            <QrReveal value={seat.link} label={role + " invite QR"} />
                            <CopyLine value={seat.link} label="Copy link" title="Copy the invite link - it opens the room in the SimpleX app" />
                        </div>
                        <div className="row" style={{
          flexWrap: "wrap",
          gap: 10,
          alignItems: "center"
        }}>
                            {claim ? <>
                                    <CopyLine value={claimCodeToCopy(claim.msg, claim.sig)} label="Copy claim code" title="Copy the claim code, then paste it as a message in the room" />
                                    <span className="dim small">claim code ready - paste it into the room as a message</span>
                                </> : <button className="btn tiny" onClick={doClaim} disabled={busy} title="One free signature - no transaction, no gas">
                                    {busy ? "Signing…" : "Claim my seat - sign once"}
                                </button>}
                        </div>
                        <p className="dim small" style={{
          margin: 0
        }}>
                            The signature proves the {role.toLowerCase()} of trade #{tradeId} owns this seat.
                            Once you claim, this seat's invite stops working - a leaked link is dead weight.
                        </p>
                    </> : isArbiter ? <p className="dim small" style={{
        margin: 0
      }}>
                        The relay bot adds you to this room when a dispute opens on-chain. Until then it is
                        the parties' room; the logged transcript is released to you only on a dispute.
                    </p> : <p className="dim small" style={{
        margin: 0
      }}>
                        Only this trade's buyer and seller hold seats. Each scans their own QR from their own app.
                    </p>}
            </div>
        </div>;
}