import React, { useEffect, useState } from "react";
import { networkMeta, getCustomRpc, setCustomRpc, clearCustomRpc, validateRpc, rpcFor } from "../lib/networks.js";
import { Button, Field, Err } from "../lib/ui.jsx";
export default function RpcSettings({
  chainId,
  onClose,
  onApplied
}) {
  const meta = networkMeta(chainId);
  const [value, setValue] = useState(() => getCustomRpc(chainId));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [savedCustom, setSavedCustom] = useState(() => getCustomRpc(chainId));
  const isCustom = !!savedCustom;
  const effective = rpcFor(chainId);
  const apply = async () => {
    const url = value.trim();
    if (!url) {
      setStatus({
        tone: "err",
        text: "Enter an RPC URL, or press “Use the default”."
      });
      return;
    }
    setBusy(true);
    setStatus(null);
    const res = await validateRpc(url, chainId);
    setBusy(false);
    if (!res.ok) {
      setStatus({
        tone: "err",
        text: res.error
      });
      return;
    }
    setCustomRpc(chainId, url);
    setSavedCustom(url);
    setStatus({
      tone: "ok",
      text: `It answered as chain ${res.chainId} (${meta?.name ?? chainId}) - connected.`
    });
    onApplied?.(url);
  };
  const useDefault = () => {
    clearCustomRpc(chainId);
    setValue("");
    setSavedCustom("");
    setStatus({
      tone: "ok",
      text: "Now using the public default endpoint."
    });
    onApplied?.(rpcFor(chainId));
  };
  return <div className="modal-overlay" onMouseDown={e => {
    if (e.target === e.currentTarget) onClose?.();
  }}>
            <div className="modal" style={{
      maxWidth: 520
    }} role="dialog" aria-modal="true" aria-label="RPC settings">
                <div className="wallet-head">RPC settings for {meta?.name ?? "this network"}</div>

                <div className="rpc-row">
                    <span className="rpc-key">Default endpoint</span>
                    <span className="mono small dim" style={{
          wordBreak: "break-all"
        }}>{meta?.defaultRpc ?? "-"}</span>
                </div>

                <div className="rpc-row">
                    <span className="rpc-key">In use right now</span>
                    <span className="mono small" style={{
          wordBreak: "break-all"
        }}>
                        {effective || "-"}{isCustom ? <span className="badge accent" style={{
            marginLeft: 8
          }}>custom</span> : <span className="badge" style={{
            marginLeft: 8
          }}>default</span>}
                    </span>
                </div>

                <Field label="Your own RPC URL" hint="It may contain credentials. It is stored only in this browser, never logged, and never shown in errors.">
                    <input value={value} onChange={e => setValue(e.target.value)} className="mono" placeholder="https://…" spellCheck={false} aria-label="Custom RPC URL" />
                </Field>

                {status ? status.tone === "ok" ? <div className="ok-box" style={{
        marginTop: 10
      }}>✓ {status.text}</div> : <Err text={status.text} /> : null}

                <div className="m-actions" style={{
        marginTop: 16
      }}>
                    <Button ghost onClick={onClose}>Close</Button>
                    <Button ghost onClick={useDefault} disabled={!isCustom} title="Forget the custom endpoint and go back to the public default">Use the default</Button>
                    <Button tone="accent" busy={busy} disabled={!value.trim()} onClick={apply}>Check &amp; use this</Button>
                </div>
            </div>
        </div>;
}