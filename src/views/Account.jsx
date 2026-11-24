import React, { useContext, useEffect, useRef, useState } from "react";
import { ethers } from "ethers";
import { AppCtx } from "../AppCtx.jsx";
import { tokenAbi, short, revertText } from "../lib/chain.js";
import { liveGasPrice, finalTierPrice, getFeeTier } from "../lib/rpc.js";
import { gasSymbol, networkName, fmtStable, fmtEthAmt, fmtToken } from "../lib/format.js";
import { hasAccount, storedCode, forgetAccount, loginWithCode, createAccount, setHotCode } from "../lib/account.js";
import { lockMinutes, setLockMinutes, lockNow, CHOICES } from "../lib/lock.js";
import { Button, Field, Badge, Copy, Err, toast, confirmDialog } from "../lib/ui.jsx";
import { Coin } from "../lib/brand.jsx";
import SendAll, { groupAddr } from "../components/SendAll.jsx";
const reducedMotion = () => {
  try {
    return matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};
function StageCopy({
  text,
  label
}) {
  const [done, setDone] = useState(false);
  return <button type="button" className="wt-copy mono" aria-label={label + (done ? " - copied" : "")} onClick={() => navigator.clipboard?.writeText(String(text)).then(() => {
    setDone(true);
    setTimeout(() => setDone(false), 900);
  }).catch(() => {})}>
            {label}{done ? " ✓" : ""}
        </button>;
}
function QrImg({
  text,
  size = 168,
  alt = "QR code showing the deposit address"
}) {
  const [dataUrl, setDataUrl] = useState("");
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const mod = await import("qrcode-generator");
        const qrcode = mod.default ?? mod;
        const qr = qrcode(0, "M");
        qr.addData(text);
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
        if (!dead) setDataUrl(canvas.toDataURL("image/png"));
      } catch (e) {
        if (!dead) setDataUrl("");
      }
    })();
    return () => {
      dead = true;
    };
  }, [text]);
  return dataUrl ? <img src={dataUrl} width={size} height={size} alt={alt} style={{
    borderRadius: 6,
    border: "1px solid var(--line)",
    background: "#fff"
  }} /> : <div className="skel" style={{
    width: size,
    height: size
  }} />;
}
export default function Account({
  onClose,
  embedded = false,
  defaultOpen = true,
  bare = false
}) {
  const {
    cfg,
    provider,
    session,
    me
  } = useContext(AppCtx);
  const [panel, setPanel] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [justCreated, setJustCreated] = useState(false);
  const [lockMin, setLockMin] = useState(() => lockMinutes());
  const [code, setCode] = useState(hasAccount() ? storedCode() : "");
  const [loginInput, setLoginInput] = useState("");
  const [dest, setDest] = useState("");
  const [busy, setBusy] = useState("");
  const [balances, setBalances] = useState(null);
  const [tokenDec, setTokenDec] = useState({});
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(defaultOpen);
  const autoOpened = useRef(false);
  const [view, setView] = useState("");
  const [leaving, setLeaving] = useState(false);
  const [sendNav, setSendNav] = useState({});
  const [balTick, setBalTick] = useState(0);
  const openView = v => {
    setLeaving(false);
    setSendNav({});
    setView(v);
  };
  const finishClose = () => {
    setLeaving(false);
    setView("");
    setSendNav({});
  };
  const closeView = () => {
    if (reducedMotion()) finishClose();else setLeaving(true);
  };
  const isCode = session?.kind === "code";
  const address = session?.address ?? "";
  const gasSym = gasSymbol(cfg?.chainId);
  useEffect(() => {
    if (!me || !provider) return;
    let dead = false;
    (async () => {
      const out = {
        native: null,
        usdc: null,
        usdt: null
      };
      const d = {};
      try {
        out.native = await provider.getBalance(me);
      } catch {}
      for (const k of ["usdc", "usdt"]) {
        if (!cfg[k]) continue;
        try {
          const c = new ethers.Contract(cfg[k], tokenAbi, provider);
          const [b, dv] = await Promise.all([c.balanceOf(me), c.decimals()]);
          out[k] = b;
          d[k] = Number(dv);
        } catch {}
      }
      if (!dead) {
        setBalances(out);
        setTokenDec(d);
      }
    })();
    return () => {
      dead = true;
    };
  }, [me, provider, cfg, balTick]);
  const decOf = k => tokenDec[k] != null ? tokenDec[k] : 18;
  const fmtBal = k => fmtToken(balances?.[k] ?? 0n, decOf(k));
  const usdTotal = () => {
    const a = balances?.usdc != null ? Number(ethers.formatUnits(balances.usdc, decOf("usdc"))) : 0;
    const b = balances?.usdt != null ? Number(ethers.formatUnits(balances.usdt, decOf("usdt"))) : 0;
    return (a + b).toLocaleString("en-US", {
      maximumFractionDigits: 2
    });
  };
  const hasTokens = !!balances && ((balances.usdc ?? 0n) > 0n || (balances.usdt ?? 0n) > 0n);
  const hasGas = !!balances && (balances.native ?? 0n) > 0n;
  const readFailed = !!balances && (balances.native === null || cfg?.usdc && balances.usdc === null || cfg?.usdt && balances.usdt === null);
  const funding = !balances ? null : hasTokens ? hasGas ? "ready" : "needs-gas" : readFailed ? "unknown" : "unfunded";
  useEffect(() => {
    if (!embedded || autoOpened.current) return;
    if (funding === "unfunded") {
      autoOpened.current = true;
      setOpen(true);
    }
  }, [embedded, funding]);
  const doCreate = async () => {
    setBusy("create");
    setErr("");
    try {
      try {
        localStorage.setItem("nijip2p-session-pref", "code");
      } catch {}
      const r = await createAccount();
      setHotCode(r.code);
      setCode(r.code);
      setShowCode(true);
      setJustCreated(true);
      toast("Anonymous account created", {
        body: "The anonymous code is the account. Back it up before you continue.",
        tone: "ok"
      });
    } catch (e) {
      setErr(revertText(e));
    } finally {
      setBusy("");
    }
  };
  const doLogin = async () => {
    setBusy("login");
    setErr("");
    try {
      try {
        localStorage.setItem("nijip2p-session-pref", "code");
      } catch {}
      const r = await loginWithCode(loginInput);
      setHotCode(r.code);
      toast("Signed in", {
        body: "The account was restored from your anonymous code.",
        tone: "ok"
      });
      setTimeout(() => window.location.reload(), 500);
    } catch (e) {
      setErr(revertText(e));
      setBusy("");
    }
  };
  const doLogout = async () => {
    await forgetAccount();
    toast("Signed out here", {
      body: "Your anonymous code alone restores this account.",
      tone: "ok"
    });
    setTimeout(() => window.location.reload(), 500);
  };
  const doSweep = async () => {
    if (!session?.signer) return;
    let destAddr;
    try {
      destAddr = ethers.getAddress(dest.trim());
    } catch {
      setErr("That destination is not a valid address.");
      return;
    }
    if (destAddr.toLowerCase() === me.toLowerCase()) {
      setErr("That is this very account - pick a different destination address.");
      return;
    }
    const yes = await confirmDialog({
      title: "Send every balance to " + short(destAddr) + "?",
      body: "This sweeps the gas token plus all USDC and USDT in separate transactions. Confirmed transfers cannot be reversed.",
      confirmLabel: "Sweep everything",
      tone: "danger"
    });
    if (!yes) return;
    setBusy("sweep");
    setErr("");
    try {
      const out = [];
      const rec = await liveGasPrice(provider);
      const gasPrice = finalTierPrice(getFeeTier(), rec) ?? rec;
      const balance = await provider.getBalance(me);
      const gasCost = gasPrice * 21000n;
      if (balance > gasCost) {
        const tx = await session.signer.sendTransaction({
          to: destAddr,
          value: balance - gasCost,
          gasPrice,
          gasLimit: 21000n
        });
        const rc = await tx.wait();
        out.push({
          symbol: gasSym,
          hash: rc.hash
        });
      }
      for (const [k, sym] of [["usdc", "USDC"], ["usdt", "USDT"]]) {
        if (!cfg[k]) continue;
        const t = new ethers.Contract(cfg[k], ["function transfer(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)"], session.signer);
        const bal = await t.balanceOf(me);
        if (bal === 0n) continue;
        const tx = await t.transfer(destAddr, bal, {
          gasPrice
        });
        const rc = await tx.wait();
        out.push({
          symbol: sym,
          hash: rc.hash
        });
      }
      if (!out.length) throw new Error("Nothing to sweep: this account holds no balances.");
      toast("Sweep on its way", {
        body: out.map(o => o.symbol).join(" + ") + " → " + short(destAddr),
        tone: "ok"
      });
      setErr("");
      setDest("");
    } catch (e) {
      setErr(revertText(e));
    } finally {
      setBusy("");
    }
  };
  const activeChip = !session ? null : <span className="active-chip" title="How this session signs">
            <span className="dot" aria-hidden="true" />
            Signing with: your anonymous code
        </span>;
  const addrRow = <div className="row" style={{
    alignItems: "center"
  }}>
            <input readOnly value={address} className="mono" style={{
      fontSize: 12
    }} aria-label="Deposit address" onFocus={e => e.target.select()} />
            <Copy text={address} label="Copy address" />
        </div>;
  const balRow = (sym, v, fmtFn) => <tr key={sym}>
            <td className="a">{sym}</td>
            <td className="v">{v === null || v === undefined ? <span className="unavailable">unavailable</span> : fmtFn(v)}</td>
            <td className="v" title="The protocol has no price feed, so fiat value is never estimated">-</td>
        </tr>;
  const balTable = <table className="bal-table">
            <thead>
                <tr><th>Asset</th><th>Amount</th><th>Fiat value</th></tr>
            </thead>
            <tbody>
                {balances ? [balRow(gasSym, balances.native, v => fmtEthAmt(v, 6)), cfg?.usdc ? balRow("USDC", balances.usdc, v => fmtToken(v, decOf("usdc"))) : null, cfg?.usdt ? balRow("USDT", balances.usdt, v => fmtToken(v, decOf("usdt"))) : null] : <tr><td className="a" colSpan={3} style={{
          textTransform: "none",
          letterSpacing: 0
        }}>Reading balances from the chain…</td></tr>}
            </tbody>
        </table>;
  const balHint = funding === "needs-gas" ? <div className="bal-hint" style={{
    color: "var(--warn)"
  }}>Your tokens arrived. Send a little {gasSym} to your deposit address to cover chain fees, then you can trade.</div> : funding === "unfunded" ? <div className="bal-hint">Nothing here yet. Send some {gasSym} for chain fees plus the USDC or USDT you want to trade.</div> : funding === "unknown" ? <div className="bal-hint">Some balances could not be read, so they show as unavailable rather than zero. Check the RPC connection and reopen this panel.</div> : null;
  const qrCol = <div style={{
    textAlign: "center"
  }}>
            <QrImg text={address} alt={`QR code of the deposit address ${address}`} />
        </div>;
  const moneyBlocks = <div className="acct-grid">
            <div style={{
      display: "flex",
      flexDirection: "column",
      gap: 10
    }}>
                <div className="acct-block">
                    <div className="k">1 · Fund it, at your deposit address</div>
                    {addrRow}
                    <div className="small dim">
                        Send some {gasSym} for chain fees plus the USDC or USDT you plan to trade.
                        Tokens you escrow leave this address; settlements pay back into it.
                    </div>
                </div>
                <div className="acct-block">
                    <div className="k">2 · Balances, read live from the chain</div>
                    {balTable}
                    {balHint}
                </div>
                <div className="acct-block" style={{
        borderColor: "var(--warn-border)",
        background: "var(--warn-wash)"
      }}>
                    <div className="k" style={{
          color: "var(--warn)"
        }}>3 · Back up your anonymous code offline</div>
                    {justCreated || storedCode() ? <div className="row" style={{
          alignItems: "center"
        }}>
                            <input readOnly value={showCode ? code : code.replace(/[A-Z0-9]/g, "•")} className="mono" style={{
            fontSize: 13
          }} aria-label="Your anonymous code" onFocus={e => e.target.select()} />
                            <Button tiny ghost onClick={() => setShowCode(v => !v)}>{showCode ? "Hide" : "Reveal"}</Button>
                            <Copy text={code} label="Copy code" />
                        </div> : <div className="small dim">Your code is not stored on this device. It lives only in your offline backup. This session lives in the tab until you close it.</div>}
                    {justCreated ? <div className="row" style={{
          alignItems: "center",
          gap: 8,
          marginTop: 8
        }}>
                            <Button small tone="accent" onClick={() => window.location.reload()}>I saved the code, continue</Button>
                            <span className="small dim">There is no reset and no custodian. Write it on paper; do not screenshot it.</span>
                        </div> : <div className="small dim">Anyone who holds this code holds the funds. There is no reset and no custodian. Write it on paper; do not screenshot it.</div>}
                </div>
                <div className="acct-block">
                    <div className="k">4 · Lock this device</div>
                    <div className="row" style={{
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap"
        }}>
                        <select value={lockMin} aria-label="Auto-lock after inactivity" className="mono" style={{
            fontSize: 13,
            minHeight: 38
          }} onChange={e => {
            const m = parseInt(e.target.value, 10);
            setLockMinutes(m);
            setLockMin(m);
          }}>
                            {CHOICES.map(m => <option key={m} value={m}>{m === 0 ? "Auto-lock off" : `After ${m} min idle`}</option>)}
                        </select>
                        <Button tiny ghost onClick={lockNow}>Lock now</Button>
                    </div>
                    <div className="small dim">Locking wipes the stored code and every derived key from this browser - the same model as locking a device. Returning needs your anonymous code.</div>
                </div>
            </div>
            {qrCol}
        </div>;
  const body = session ? <>
            <div className="row" style={{
      gap: 8,
      padding: "0 2px 8px",
      alignItems: "center",
      flexWrap: "wrap"
    }}>
                {activeChip}
                <span className="small dim mono">{short(address)}</span>
            </div>
            <div className="small dim" style={{
      padding: "0 2px 8px"
    }}>
                This address <b>is</b> your account, derived from your nijip2p anonymous code in this browser. The same anonymous code restores the account here and in the command-line tool. Only signed transactions ever leave this device.
            </div>
            {moneyBlocks}

            {isCode ? <div className="acct-block" style={{
      marginTop: 10
    }}>
                    <div className="k">5 · Sweep, empty the account</div>
                    <div className="small dim" style={{
        marginBottom: 6
      }}>
                        Sends every {gasSym}, USDC, and USDT balance to one address in separate transactions. Use it to empty or rotate this account. Confirmed transfers cannot be reversed.
                    </div>
                    <div className="row">
                        <input value={dest} onChange={e => setDest(e.target.value)} className="mono" placeholder="0x… address to receive everything" aria-label="Sweep destination" spellCheck={false} />
                        <Button small busy={busy === "sweep"} disabled={!ethers.isAddress(dest.trim())} title={ethers.isAddress(dest.trim()) ? "Send every balance here" : "Paste a valid 0x… address first"} onClick={doSweep}>Sweep everything</Button>
                    </div>
                </div> : null}

            <div className="row" style={{
      gap: 8,
      marginTop: 10
    }}>
                <Button tiny ghost onClick={doLogout}>Sign out on this device</Button>
                <span className="small dim">The anonymous code alone restores this account.</span>
            </div>
        </> : <>
            <div className="small dim" style={{
      padding: "0 2px 8px"
    }}>
                An anonymous account signs everything: publishing offers, escrowing tokens, chatting, settling.
                You can keep browsing read-only - every contract view stays public.
            </div>
            <div className="acct-grid">
                <div className="acct-block">
                    <div className="k">Create an anonymous account</div>
                    <div className="small dim" style={{
          minHeight: 52
        }}>
                        An anonymous code in the shape PS-XXXX-… is generated on this device, and it <b>is</b> the account: the signing key, the chat identity and the private notes all derive from it. Back it up - anyone holding the code holds the funds.
                    </div>
                    <div><Button busy={busy === "create"} onClick={doCreate}>Create the account</Button></div>
                    <div className="small dim">It starts empty. Fund it with gas and tokens before trading.</div>
                </div>
            </div>
            <Field label="Already have an anonymous code? Sign in" hint="Letter case and dashes do not matter - the same anonymous code always restores the same account">
                <div className="row">
                    <input value={loginInput} onChange={e => setLoginInput(e.target.value)} className="mono" placeholder="PS-XXXX-XXXX-…" aria-label="Your nijip2p anonymous code" spellCheck={false} />
                    <Button small busy={busy === "login"} disabled={!loginInput.trim()} onClick={doLogin}>Sign in</Button>
                </div>
            </Field>
        </>;
  const errBox = <Err text={err} />;
  const badge = !session ? null : funding === "ready" ? <Badge tone="ok" pulse><span className="dot" />Ready to trade</Badge> : funding === "needs-gas" ? <Badge tone="warn"><span className="dot" />Needs chain gas</Badge> : funding === "unfunded" ? <Badge tone="warn"><span className="dot" />Unfunded</Badge> : funding === "unknown" ? <Badge tone="warn"><span className="dot" />Balances unreadable</Badge> : null;
  const kicker = !session ? "Set up before trading" : funding === "ready" ? "Funded and ready" : funding === "needs-gas" ? `Add ${gasSym} for chain fees` : funding === "unfunded" ? "Fund it before trading" : funding === "unknown" ? "Balances unreadable" : "Reading the balances";
  const acctTitle = !session ? "Set up your account" : "Anonymous account";
  const modalTitle = !session ? "Create or restore your anonymous account" : "Your anonymous account";
  if (embedded) {
    if (bare) {
      if (!session) {
        return <div className="acct-bare">{body}{errBox}</div>;
      }
      const gasCoin = {
        1: "eth",
        56: "bnb",
        137: "pol"
      }[Number(cfg?.chainId)] ?? "eth";
      const gasLogo = <Coin id={gasCoin} size={22} title={gasSym} />;
      const balLine = (logo, sym, tag, v, fmt) => <div className="acct-bal" key={sym}>
                    {logo}
                    <div className="t"><b>{sym}</b><span>{tag}</span></div>
                    <span className={"v" + (balances && v === null ? " un" : "")}>
                        {balances ? v !== null && v !== undefined ? fmt(v) : "unavailable" : "…"}
                    </span>
                </div>;
      const assetRows = 1 + (cfg?.usdc ? 1 : 0) + (cfg?.usdt ? 1 : 0);
      const homeView = <>
                    <div className="wt-head wt-bar">
                        <div className="wt-id">
                            <b>Anonymous account</b>
                            <span className="mono">{short(address)}</span>
                        </div>
                        <StageCopy text={address} label="Copy address" />
                    </div>

                    <div className="wt-total">
                        <span className="wt-total-v">
                            {balances ? "$" + usdTotal() : "…"}
                        </span>
                        <span className="wt-total-s">
                            {gasSym} {balances && balances.native !== null ? fmtEthAmt(balances.native, 5) : "—"} for fees
                        </span>
                    </div>

                    <div className="wt-actions">
                        <button className="wt-pill" onClick={() => openView("receive")}>Receive</button>
                        {isCode ? <button className="wt-pill" onClick={() => openView("send")}>Send all</button> : null}
                        <button className="wt-pill" onClick={doLogout}>Sign out</button>
                    </div>

                    <div className="wt-assets">
                        <div className="wt-assets-cap">Assets</div>
                        {balances ? <>
                                <div className="wt-asset">
                                    <Coin id={gasCoin} size={30} title={gasSym} />
                                    <div className="t"><b>{gasSym}</b><span>{networkName(cfg)}</span></div>
                                    <span className="v">{balances.native !== null ? fmtEthAmt(balances.native, 6) : "—"}</span>
                                </div>
                                {cfg?.usdc ? <div className="wt-asset">
                                    <Coin id="usdc" size={30} title="USDC" />
                                    <div className="t"><b>USDC</b><span>USD Coin</span></div>
                                    <span className="v">{balances.usdc !== null ? fmtToken(balances.usdc, decOf("usdc")) : "—"}</span>
                                </div> : null}
                                {cfg?.usdt ? <div className="wt-asset">
                                    <Coin id="usdt" size={30} title="USDT" />
                                    <div className="t"><b>USDT</b><span>Tether</span></div>
                                    <span className="v">{balances.usdt !== null ? fmtToken(balances.usdt, decOf("usdt")) : "—"}</span>
                                </div> : null}
                            </> : <>
                                {Array.from({
              length: assetRows
            }, (_, i) => <div className="wt-asset wt-asset-skel" key={i} aria-hidden="true"><span className="skel" /><span className="skel" /></div>)}
                                <span className="wt-sr" role="status">Reading the chain…</span>
                            </>}
                    </div>
                </>;
      const subTitle = view === "receive" ? "Receive" : sendNav.title || "Send all";
      const subBack = view === "send" ? sendNav.back : closeView;
      const subBackDisabled = view === "send" ? !!sendNav.disabled : false;
      return <div className="acct-bare wt">
                    <div className={"wt-stage" + (view ? " has-sub" : "") + (leaving ? " leaving" : "")}>
                        <div className="wt-view wt-home" aria-hidden={view && !leaving ? true : undefined} {...view && !leaving ? {
            inert: ""
          } : {}}>
                            {homeView}
                        </div>
                        {view ? <section className={"wt-view wt-sub" + (leaving ? " out" : "")} aria-label={subTitle} onAnimationEnd={e => {
            if (leaving && e.target === e.currentTarget) finishClose();
          }}>
                                <div className="wt-bar wt-sub-bar">
                                    <button type="button" className="wt-bar-back" onClick={() => subBack?.()} disabled={subBackDisabled || !subBack} aria-label="Back">← Back</button>
                                    <b className="wt-bar-t">{subTitle}</b>
                                </div>
                                {view === "receive" ? <div className="wt-sub-scroll wt-screen">
                                        <div className="wt-qrwrap"><QrImg text={address} size={168} alt={"QR code of the deposit address " + address} /></div>
                                        <p className="wt-verify-hint">Verify it: scan this code with another wallet - it must decode to exactly this address.</p>
                                        <div className="acct-addr-grouped mono">{groupAddr(address)}</div>
                                        <div className="acct-addr-row"><StageCopy text={address} label="Copy the address" /></div>
                                        <p className="acct-sec-note">Fund with <b>{gasSym}</b> for chain fees plus the USDC / USDT you plan to trade. Escrows leave this address; settlements pay back into it.</p>
                                    </div> : null}
                                {view === "send" && isCode ? <SendAll cfg={cfg} provider={provider} session={session} me={me} gasSym={gasSym} gasCoin={gasCoin} onNav={setSendNav} onDone={closeView} onSent={() => setBalTick(n => n + 1)} /> : null}
                            </section> : null}
                    </div>
                </div>;
    }
    return <section className="panel acct-embed">
                <div className="acct-collapse" onClick={() => setOpen(v => !v)} role="button" tabIndex={0} aria-expanded={open} aria-label="Show or hide the account panel" onKeyDown={e => (e.key === "Enter" || e.key === " ") && setOpen(v => !v)}>
                    <div style={{
          minWidth: 0
        }}>
                        <p className="kicker">{kicker}</p>
                        <h3>{acctTitle}</h3>
                        <p className="sub">
                            {session ? <>Signing as <span className="mono">{short(address)}</span> · anonymous account</> : "No account yet. Create or restore an anonymous account; meanwhile everything stays browsable read-only."}
                        </p>
                    </div>
                    <span className="spacer" />
                    {badge}
                    {balances ? <span className="mono small dim" style={{
          whiteSpace: "nowrap"
        }}>
                            {gasSym} {balances.native !== null ? fmtEthAmt(balances.native, 4) : "-"}
                            {" · "}USDC {balances.usdc !== null ? fmtToken(balances.usdc, decOf("usdc")) : "-"}
                            {" · "}USDT {balances.usdt !== null ? fmtToken(balances.usdt, decOf("usdt")) : "-"}
                        </span> : null}
                    <span className={"acct-chev" + (open ? " open" : "")} aria-hidden="true">▾</span>
                </div>
                {open ? <div className="acct-body">{body}{errBox}</div> : null}
            </section>;
  }
  return <div className="modal-overlay" onMouseDown={e => {
    if (e.target === e.currentTarget) onClose?.();
  }}>
            <div className="modal" style={{
      maxWidth: 560
    }} role="dialog" aria-modal="true" aria-label={modalTitle}>
                <div className="wallet-head">{modalTitle}</div>
                {body}
                {err ? errBox : null}
            </div>
        </div>;
}