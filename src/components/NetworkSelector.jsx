import React, { useState } from "react";
import { NETWORKS, LOCAL, networkMeta, rpcFor } from "../lib/networks.js";
export default function NetworkSelector({
  chainId,
  mode,
  deployedChainIds = [],
  onSelect,
  onOpenRpc
}) {
  const [open, setOpen] = useState(false);
  const meta = networkMeta(chainId);
  const includeLocal = mode === "local" || Number(chainId) === LOCAL.chainId;
  const list = [...NETWORKS, ...(includeLocal ? [LOCAL] : [])];
  return <div className="net-select">
            <button className="net-trigger" onClick={() => setOpen(v => !v)} aria-haspopup="menu" aria-expanded={open} title="Choose the network this app trades on">
                <span className={"dot " + (meta ? "ok" : "bad")} />
                <span className="net-name">{meta?.short ?? meta?.name ?? "Unknown network"}</span>
                <span className="net-chev" aria-hidden="true">▾</span>
            </button>

            {open ? <>
                    <div className="net-scrim" onClick={() => setOpen(false)} />
                    <div className="net-pop" role="menu" aria-label="Choose a network">
                        <div className="wallet-head">Pick the network</div>
                        {list.map(n => {
          const active = n.chainId === Number(chainId);
          const deployed = deployedChainIds.includes(n.chainId);
          return <button key={n.chainId} role="menuitem" className={"net-row" + (active ? " on" : "")} onClick={() => {
            setOpen(false);
            if (!active) onSelect(n.chainId);
          }}>
                                    <span className={"dot " + (active ? "ok" : deployed ? "ok" : "bad")} />
                                    <span className="net-row-name">{n.name}</span>
                                    <span className="net-row-chain mono">{n.chainId}</span>
                                    {active ? <span className="badge accent">Active</span> : deployed ? <span className="badge ok">Deployed</span> : <span className="badge">No deployment yet</span>}
                                </button>;
        })}
                        <div className="net-foot">
                            <button className="net-rpc" onClick={() => {
            setOpen(false);
            onOpenRpc?.();
          }}>
                                RPC settings for {meta?.name ?? "this network"}
                            </button>
                            <div className="small dim mono" style={{
            wordBreak: "break-all"
          }}>{rpcFor(chainId) || "no endpoint set"}</div>
                        </div>
                    </div>
                </> : null}
        </div>;
}