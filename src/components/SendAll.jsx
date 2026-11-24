import React, { useEffect, useMemo, useRef, useState } from "react";
import { ethers } from "ethers";
import { revertText } from "../lib/chain.js";
import { liveGasPrice, finalTierPrice, getFeeTier, setFeeTier } from "../lib/rpc.js";
import { fmtAmount, txUrl } from "../lib/format.js";
import { Coin } from "../lib/brand.jsx";
const ERC20 = ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)", "function transfer(address,uint256) returns (bool)"];
const NATIVE_GAS = 21000n;
export const groupAddr = a => {
  const h = String(a).slice(2);
  return "0x " + (h.match(/.{1,4}/g) ?? []).join(" ");
};
export function Identicon({
  address,
  size = 40
}) {
  const cells = useMemo(() => {
    const h = ethers.getBytes(ethers.keccak256(ethers.toUtf8Bytes(String(address).toLowerCase())));
    const hue = Math.round(h[0] / 255 * 360);
    const hue2 = (hue + 40 + h[1] % 80) % 360;
    const on = [];
    for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) {
      if (h[2 + y * 3 + x] % 2 === 0) {
        on.push([x, y]);
        if (x < 2) on.push([4 - x, y]);
      }
    }
    return {
      on,
      fg: `hsl(${hue} 62% 52%)`,
      bg: `hsl(${hue2} 40% 90%)`
    };
  }, [address]);
  return <svg className="snd-ident" width={size} height={size} viewBox="0 0 5 5" aria-hidden="true" shapeRendering="crispEdges">
            <rect width="5" height="5" fill={cells.bg} />
            {cells.on.map(([x, y]) => <rect key={x + "-" + y} x={x} y={y} width="1" height="1" fill={cells.fg} />)}
        </svg>;
}
function validate(raw, me, cfg) {
  const v = raw.trim();
  if (!v) return {
    state: "empty"
  };
  if (!/^0x[0-9a-fA-F]*$/.test(v) || v.length > 42) return {
    state: "invalid",
    msg: "An address is 0x followed by 40 characters 0-9 and a-f."
  };
  if (v.length < 42) return {
    state: "typing",
    msg: v.length - 2 + " of 40 characters"
  };
  if (!ethers.isAddress(v)) return {
    state: "invalid",
    msg: "The capital letters do not match the address checksum. Copy the address again from its source."
  };
  const addr = ethers.getAddress(v);
  if (me && addr.toLowerCase() === me.toLowerCase()) return {
    state: "self",
    addr,
    msg: "This is your own account. Sending to it moves nothing and still costs fees."
  };
  const known = [["deal", "the NijiDeal escrow contract"], ["court", "the NijiCourt contract"], ["usdc", "the USDC token contract"], ["usdt", "the USDT token contract"], ["multicall", "the Multicall contract"]];
  for (const [k, name] of known) {
    if (cfg?.[k] && String(cfg[k]).toLowerCase() === addr.toLowerCase()) return {
      state: "blocked",
      addr,
      msg: "This is " + name + ". Funds sent to it cannot be recovered."
    };
  }
  if (addr === ethers.ZeroAddress) return {
    state: "blocked",
    addr,
    msg: "This is the zero address. Funds sent to it are destroyed."
  };
  return {
    state: "valid",
    addr
  };
}
export default function SendAll({
  cfg,
  provider,
  session,
  me,
  gasSym,
  gasCoin,
  onNav,
  onDone,
  onSent
}) {
  const [step, setStep] = useState("dest");
  const [raw, setRaw] = useState("");
  const [review, setReview] = useState(null);
  const [prepErr, setPrepErr] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [st, setSt] = useState({});
  const [running, setRunning] = useState(false);
  const runRef = useRef(false);
  const inputRef = useRef(null);
  const v = validate(raw, me, cfg);
  const [tier, setTierState] = useState(getFeeTier());
  const tierRef = useRef(tier);
  tierRef.current = tier;
  const pickTier = t => {
    setTierState(t);
    setFeeTier(t);
    setReview(r => r ? reprice(r, t) : r);
  };
  const reprice = (r, t) => {
    const gp = finalTierPrice(t, r.rec) ?? r.gasPrice;
    const items = r.items.map(it => {
      if (it.key !== "native") return it;
      const send = it.balance - NATIVE_GAS * gp > 0n ? it.balance - NATIVE_GAS * gp : 0n;
      return {
        ...it,
        amount: send,
        after: it.balance - send
      };
    });
    const tokenFee = r.items.filter(it => it.token).reduce((a, it) => a + it.gasLimit * gp, 0n);
    const native = items.find(it => it.key === "native");
    const fee = tokenFee + (native && native.amount > 0n ? NATIVE_GAS * gp : 0n);
    return {
      ...r,
      gasPrice: gp,
      tier: t,
      items,
      fee
    };
  };
  const feeAt = (r, t) => {
    if (!r) return null;
    const gp = finalTierPrice(t, r.rec) ?? 0n;
    const tokenFee = r.items.filter(it => it.token).reduce((a, it) => a + it.gasLimit * gp, 0n);
    const native = r.items.find(it => it.key === "native");
    return tokenFee + (native && native.balance - NATIVE_GAS * gp > 0n ? NATIVE_GAS * gp : 0n);
  };
  const allDone = review && review.items.every(it => st[it.key]?.s === "ok" || st[it.key]?.s === "skip");
  const failed = review ? review.items.find(it => st[it.key]?.s === "fail") : null;
  useEffect(() => {
    const back = step === "review" ? () => {
      setStep("dest");
      setReview(null);
    } : step === "sending" ? allDone || failed ? onDone : null : onDone;
    onNav?.({
      back,
      disabled: !back || running,
      title: step === "review" ? "Review" : step === "sending" ? allDone ? "Sent" : "Sending" : "Send all"
    });
  }, [step, running, allDone, !!failed]);
  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText();
      setRaw(String(t ?? "").trim());
    } catch {
      inputRef.current?.focus();
    }
  };
  const prepare = async () => {
    if (v.state !== "valid" || preparing) return;
    setPreparing(true);
    setPrepErr("");
    try {
      const to = v.addr;
      const rec = await liveGasPrice(provider);
      const gasPrice = finalTierPrice(tier, rec) ?? rec;
      const items = [];
      for (const [k, sym, name] of [["usdc", "USDC", "USD Coin"], ["usdt", "USDT", "Tether"]]) {
        if (!cfg[k]) continue;
        const c = new ethers.Contract(cfg[k], ERC20, provider);
        const [bal, dec] = await Promise.all([c.balanceOf(me), c.decimals()]);
        let gasLimit = 0n;
        if (bal > 0n) gasLimit = (await c.transfer.estimateGas(to, bal, {
          from: me
        })) * 12n / 10n;
        items.push({
          key: k,
          sym,
          name,
          coin: k,
          token: cfg[k],
          decimals: Number(dec),
          balance: bal,
          amount: bal,
          after: 0n,
          gasLimit
        });
      }
      const nativeBal = await provider.getBalance(me);
      const tokenFee = items.reduce((a, it) => a + it.gasLimit * gasPrice, 0n);
      const nativeFee = NATIVE_GAS * gasPrice;
      if (tokenFee > nativeBal) {
        throw new Error(`Not enough ${gasSym} for fees. The token transfers need about ${fmtAmount(tokenFee, 18, 6)} ${gasSym}; this account holds ${fmtAmount(nativeBal, 18, 6)}. Receive a little ${gasSym} first.`);
      }
      const nativeSend = nativeBal - tokenFee - nativeFee > 0n ? nativeBal - tokenFee - nativeFee : 0n;
      items.push({
        key: "native",
        sym: gasSym,
        name: "for fees",
        coin: gasCoin,
        token: null,
        decimals: 18,
        balance: nativeBal,
        amount: nativeSend,
        after: nativeBal - nativeSend,
        gasLimit: NATIVE_GAS
      });
      const live = items.filter(it => it.amount > 0n);
      if (!live.length) throw new Error("Nothing to send: this account holds no balances above the fee.");
      const reads = [];
      try {
        reads.push(await provider.getCode(to));
      } catch {}
      try {
        const u = String(cfg.readRpcUrl || cfg.rpcUrl || "");
        if (u) {
          const r = await fetch(u, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "eth_getCode",
              params: [to, "latest"]
            })
          });
          const j = await r.json();
          if (typeof j?.result === "string") reads.push(j.result);
        }
      } catch {}
      const hasCode = c => typeof c === "string" && c.toLowerCase() !== "0x";
      const isContract = reads.length > 0 && reads.some(hasCode);
      const is7702 = isContract && reads.filter(hasCode).every(c => {
        const s = c.toLowerCase();
        return s.length === 46 && s.startsWith("0xef0100");
      });
      const codeUnknown = reads.length === 0;
      setReview({
        to,
        gasPrice,
        rec,
        items,
        fee: tokenFee + (nativeSend > 0n ? nativeFee : 0n),
        isContract,
        is7702,
        codeUnknown
      });
      setStep("review");
    } catch (e) {
      setPrepErr(e?.message && !e.code ? e.message : revertText(e));
    } finally {
      setPreparing(false);
    }
  };
  const run = async keys => {
    if (runRef.current || !review) return;
    runRef.current = true;
    setRunning(true);
    try {
      const rec = await liveGasPrice(provider);
      const gasPrice = finalTierPrice(tierRef.current, rec) ?? rec;
      for (const it of review.items) {
        if (!keys.includes(it.key)) continue;
        if (it.amount === 0n && it.key !== "native") {
          setSt(m => ({
            ...m,
            [it.key]: {
              s: "skip"
            }
          }));
          continue;
        }
        setSt(m => ({
          ...m,
          [it.key]: {
            s: "run"
          }
        }));
        try {
          let tx;
          if (it.token) {
            const c = new ethers.Contract(it.token, ERC20, session.signer);
            const bal = await c.balanceOf(me);
            if (bal === 0n) {
              setSt(m => ({
                ...m,
                [it.key]: {
                  s: "skip",
                  note: "nothing left to send"
                }
              }));
              continue;
            }
            if (bal < it.gasLimit * gasPrice) {
              setSt(m => ({
                ...m,
                [it.key]: {
                  s: "skip",
                  note: "not enough " + gasSym + " for the gas"
                }
              }));
              continue;
            }
            tx = await c.transfer(review.to, bal, {
              gasPrice,
              gasLimit: it.gasLimit
            });
          } else {
            const bal = await provider.getBalance(me);
            const gas = it.gasLimit * gasPrice;
            if (bal <= gas) {
              setSt(m => ({
                ...m,
                [it.key]: {
                  s: "skip",
                  note: "not enough " + gasSym + " for the gas"
                }
              }));
              continue;
            }
            const margin = (bal - gas) / 200n;
            const value = bal - gas - margin;
            let gasLimit = it.gasLimit;
            if (review.isContract) {
              try {
                const est = await provider.estimateGas({
                  from: me,
                  to: review.to,
                  value,
                  gasPrice
                });
                gasLimit = est * 12n / 10n;
              } catch {
                setSt(m => ({
                  ...m,
                  [it.key]: {
                    s: "skip",
                    note: "this contract cannot receive " + gasSym
                  }
                }));
                continue;
              }
              if (bal < gasLimit * gasPrice + value) {
                setSt(m => ({
                  ...m,
                  [it.key]: {
                    s: "skip",
                    note: "not enough " + gasSym + " for the gas"
                  }
                }));
                continue;
              }
            }
            tx = await session.signer.sendTransaction({
              to: review.to,
              value,
              gasPrice,
              gasLimit
            });
          }
          setSt(m => ({
            ...m,
            [it.key]: {
              s: "run",
              hash: tx.hash
            }
          }));
          const rc = await tx.wait();
          if (!rc || rc.status === 0) throw new Error("the transaction was reverted on-chain");
          setSt(m => ({
            ...m,
            [it.key]: {
              s: "ok",
              hash: rc.hash
            }
          }));
        } catch (e) {
          setSt(m => ({
            ...m,
            [it.key]: {
              ...m[it.key],
              s: "fail",
              err: revertText(e)
            }
          }));
          break;
        }
      }
    } finally {
      runRef.current = false;
      setRunning(false);
      onSent?.();
    }
  };
  const start = () => {
    setStep("sending");
    setSt({});
    run(review.items.map(it => it.key));
  };
  const retry = () => run(review.items.filter(it => !["ok", "skip"].includes(st[it.key]?.s)).map(it => it.key));
  if (step === "dest") {
    const tone = {
      invalid: "bad",
      self: "warn",
      blocked: "bad",
      valid: "ok"
    }[v.state] ?? "";
    return <div className="snd">
                <div className="wt-sub-scroll">
                    <p className="wt-screen-sub">Sends every {gasSym}, USDC and USDT in this account to one address. Paste the destination - there are no suggestions.</p>
                    <label className="snd-label" htmlFor="snd-dest">Destination address</label>
                    <div className={"snd-field " + tone}>
                        <input id="snd-dest" ref={inputRef} className="snd-input mono" value={raw} onChange={e => setRaw(e.target.value)} inputMode="text" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} enterKeyHint="next" placeholder="0x…" aria-invalid={tone === "bad" || undefined} aria-describedby="snd-state" onKeyDown={e => {
            if (e.key === "Enter") prepare();
          }} />
                        <div className="snd-tools">
                            <button type="button" className="snd-tool" onClick={paste}>Paste</button>
                            <button type="button" className="snd-tool" onClick={() => {
              setRaw("");
              inputRef.current?.focus();
            }} disabled={!raw}>Clear</button>
                        </div>
                    </div>
                    <div id="snd-state" className={"snd-state " + tone} role="status" aria-live="polite">
                        {v.state === "valid" ? "Valid address. Check it against the source, character by character." : v.msg ?? "Paste the address that should receive everything."}
                    </div>
                    {v.addr && v.state !== "invalid" ? <div className={"snd-eyeball " + tone}>
                            <Identicon address={v.addr} />
                            <span className="mono snd-grouped">{groupAddr(v.addr)}</span>
                        </div> : null}
                    {prepErr ? <div className="snd-err" role="alert">{prepErr}</div> : null}
                </div>
                <div className="wt-sub-foot">
                    <button className="btn accent block" onClick={prepare} disabled={v.state !== "valid" || preparing}>
                        {preparing ? <span className="spinner" aria-hidden="true" /> : null}{preparing ? "Reading balances…" : "Review"}
                    </button>
                </div>
            </div>;
  }
  const list = review.items;
  const fmtIt = (it, val) => fmtAmount(val, it.decimals, it.token ? 2 : 6);
  if (step === "review") {
    return <div className="snd">
                <div className="wt-sub-scroll">
                    <dl className="snd-sum">
                        <div className="snd-row"><dt>From</dt><dd className="mono">{groupAddr(me)}</dd></div>
                        <div className="snd-row snd-to">
                            <dt>To</dt>
                            <dd>
                                <span className="snd-to-line"><Identicon address={review.to} size={32} /><span className="mono">{groupAddr(review.to)}</span></span>
                                <CopyLine text={review.to} />
                            </dd>
                        </div>
                    </dl>
                    {review.is7702 ? <div className="snd-warn">This address is a smart account (ERC-7702): a wallet address that delegated its code. Tokens sent here arrive when the wallet supports them - confirm it handles USDC / USDT before sending.</div> : review.isContract ? <div className="snd-warn">This address is a smart contract. Continue only if you know it accepts these tokens - a contract that cannot handle them may lock them forever. Modern wallet apps often use smart accounts: their addresses hold code too, and tokens arrive fine when the wallet supports the token.</div> : review.codeUnknown ? <div className="snd-warn">Could not verify this address on-chain just now - check it on BscScan before sending.</div> : null}
                    <div className="snd-assets" role="list" aria-label="What will be sent">
                        {list.map(it => <div className="snd-asset" role="listitem" key={it.key}>
                                <Coin id={it.coin} size={28} title={it.sym} />
                                <div className="t"><b>{it.sym}</b><span>{it.key === "native" ? "after fees" : it.name}</span></div>
                                <div className="v">
                                    <b className="mono">{fmtIt(it, it.amount)}</b>
                                    <span className="mono">{fmtIt(it, it.balance)} → {fmtIt(it, it.after)}</span>
                                </div>
                            </div>)}
                    </div>
                    <dl className="snd-sum">
                        <div className="snd-row"><dt>Network</dt><dd>{cfg.network === "local" || cfg.mode === "local" ? "Local network" : "BNB Chain"}</dd></div>
                        <div className="snd-row"><dt>Fee speed</dt><dd>
                            <div className="snd-tiers" role="radiogroup" aria-label="Network fee speed">
                                {[["economy", "Slow"], ["standard", "Standard"], ["fast", "Fast"]].map(([id, name]) => {
                  const f = feeAt(review, id);
                  return <button type="button" key={id} role="radio" aria-checked={tier === id} className={"snd-tier" + (tier === id ? " on" : "")} onClick={() => pickTier(id)}>
                                            <b>{name}</b>
                                            <span className="mono">{f != null ? "≈ " + fmtAmount(f, 18, 6) + " " + gasSym : "—"}</span>
                                        </button>;
                })}
                            </div>
                        </dd></div>
                        <div className="snd-row"><dt>Est. fees</dt><dd className="mono">≈ {fmtAmount(review.fee, 18, 6)} {gasSym}</dd></div>
                    </dl>
                </div>
                <div className="wt-sub-foot">
                    <button className="btn danger block snd-go" onClick={start}>Send all</button>
                    <p className="snd-final">This cannot be reversed.</p>
                </div>
            </div>;
  }
  return <div className="snd">
            <div className="wt-sub-scroll">
                <div className={"snd-head " + (allDone ? "ok" : failed ? "bad" : "")} role="status" aria-live="polite">
                    {allDone ? <span className="snd-big-tick" aria-hidden="true">✓</span> : failed ? <span className="snd-big-x" aria-hidden="true">!</span> : <span className="spinner" aria-hidden="true" />}
                    <b>{allDone ? "Sent" : failed ? failed.sym + " did not send" : "Sending…"}</b>
                    <span>{allDone ? "Everything reached " + groupAddr(review.to).slice(0, 12) + "…" : failed ? "Nothing after it was attempted. Earlier transfers are final." : "Keep this screen open until every line is ticked."}</span>
                </div>
                <ol className="snd-steps">
                    {list.map(it => {
          const s = st[it.key] ?? {
            s: "wait"
          };
          const url = s.hash ? txUrl(cfg, s.hash) : null;
          return <li key={it.key} className={"snd-step " + s.s}>
                                <span className="snd-mark" aria-hidden="true">{s.s === "ok" ? "✓" : s.s === "fail" ? "!" : s.s === "skip" ? "–" : s.s === "run" ? <span className="spinner" /> : ""}</span>
                                <div className="t">
                                    <b>{it.sym} <span className="mono">{fmtIt(it, it.amount)}</span></b>
                                    <span>
                                        {s.s === "ok" ? "Confirmed" : s.s === "run" ? s.hash ? "Waiting for confirmation" : "Signing" : s.s === "fail" ? s.err : s.s === "skip" ? "Skipped - " + (s.note ?? "zero balance") : "Waiting"}
                                    </span>
                                    {s.hash ? url ? <a className="snd-tx mono" href={url} target="_blank" rel="noreferrer noopener">{s.hash.slice(0, 10)}…{s.hash.slice(-6)} · BscScan ↗</a> : <span className="snd-tx mono">{s.hash.slice(0, 10)}…{s.hash.slice(-6)}</span> : null}
                                </div>
                            </li>;
        })}
                </ol>
            </div>
            <div className="wt-sub-foot">
                {allDone ? <button className="btn accent block" onClick={onDone}>Done</button> : failed ? <>
                        <button className="btn danger block" onClick={retry} disabled={running}>Retry {list.filter(it => !["ok", "skip"].includes(st[it.key]?.s)).map(it => it.sym).join(" + ")}</button>
                        <button className="btn ghost block" onClick={onDone} disabled={running}>Back to account</button>
                    </> : <button className="btn block" disabled><span className="spinner" aria-hidden="true" />Sending…</button>}
            </div>
        </div>;
}
function CopyLine({
  text
}) {
  const [done, setDone] = useState(false);
  return <button type="button" className="snd-copy" onClick={() => navigator.clipboard?.writeText(text).then(() => {
    setDone(true);
    setTimeout(() => setDone(false), 1200);
  }).catch(() => {})}>
            {done ? "Copied ✓" : "Copy full address"}
        </button>;
}