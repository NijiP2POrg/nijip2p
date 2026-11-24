import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createAccount, loginWithCode, hasAccount, setHotCode } from "../lib/account.js";
import { revertText } from "../lib/chain.js";
import { Err, toast } from "../lib/ui.jsx";
import { LogoMark } from "../lib/brand.jsx";
import { appHref } from "../lib/routes.js";
const IcoKey = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="7.6" cy="12" r="3.85" />
        <path d="M11.45 12h8.8" />
        <path d="M16.4 12v2.9" />
        <path d="M19.5 12v2.2" />
    </svg>;
const IcoShield = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3.2 5 6v5.2c0 4.4 3 8 7 9.6 4-1.6 7-5.2 7-9.6V6l-7-2.8z" />
        <path d="M9.2 12.1l2 2 3.6-4" />
    </svg>;
const IcoArrow = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4.5 12h14" />
        <path d="M13 6.5 18.5 12 13 17.5" />
    </svg>;
const IcoClose = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" />
    </svg>;
const LAST_KEY = "nijip2p-last-auth";
const TOS_KEY = "nijip2p-tos-v1";
const CLIP_CLEAR_MS = 60000;
async function copySecret(text) {
  try {
    await navigator.clipboard.writeText(String(text));
    setTimeout(() => {
      navigator.clipboard.writeText("").catch(() => {});
    }, CLIP_CLEAR_MS);
    return true;
  } catch {
    return false;
  }
}
export default function AuthSheet({
  onClose
}) {
  const [step, setStep] = useState("hub");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [newCode, setNewCode] = useState("");
  const [revealed, setRevealed] = useState(true);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [mintPhase, setMintPhase] = useState(0);
  const [mintDone, setMintDone] = useState(false);
  const [retype, setRetype] = useState("");
  const [last, setLast] = useState(() => {
    try {
      return localStorage.getItem(LAST_KEY) || "";
    } catch {
      return "";
    }
  });
  const [tosOk, setTosOk] = useState(() => {
    try {
      return localStorage.getItem(TOS_KEY) === "agreed";
    } catch {
      return false;
    }
  });
  const agreeTos = v => {
    setTosOk(v);
    try {
      if (v) localStorage.setItem(TOS_KEY, "agreed");
    } catch {}
  };
  const inputRef = useRef(null);
  const sheetRef = useRef(null);
  const saved_code = hasAccount();
  useEffect(() => {
    const onKey = e => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => {
    sheetRef.current?.focus?.();
  }, []);
  const onCodeFocus = () => {
    setTimeout(() => inputRef.current?.scrollIntoView({
      block: "center",
      behavior: "smooth"
    }), 350);
  };
  const remember = v => {
    try {
      localStorage.setItem(LAST_KEY, v);
    } catch {}
    setLast(v);
  };
  const doCreate = async () => {
    if (busy) return;
    if (!tosOk) {
      toast("Agree to the Terms first", {
        body: "Tick the Terms of Service consent below - then create your account.",
        tone: "warn"
      });
      return;
    }
    setBusy("create");
    setErr("");
    remember("code");
    setStep("mint");
    setMintPhase(0);
    setMintDone(false);
    try {
      try {
        localStorage.setItem("nijip2p-session-pref", "code");
      } catch {}
      const t0 = Date.now();
      setTimeout(() => setMintPhase(1), 750);
      const r = await createAccount();
      setHotCode(r.code);
      const elapsed = Date.now() - t0;
      await new Promise(res => setTimeout(res, Math.max(0, 2100 - elapsed)));
      setMintPhase(2);
      await new Promise(res => setTimeout(res, 450));
      setNewCode(r.code);
      setMintDone(true);
      await new Promise(res => setTimeout(res, 1500));
      setBusy("");
      setStep("backup");
    } catch (e) {
      setErr(revertText(e));
      setBusy("");
      setStep("hub");
    }
  };
  const copyNewCode = async () => {
    if (await copySecret(newCode)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } else toast("Copy failed", {
      body: "Select the code by hand and copy it from your notes app instead.",
      tone: "warn"
    });
  };
  const finishBackup = () => {
    toast("You're in", {
      body: "The anonymous code is the account. Keep the backup offline.",
      tone: "ok"
    });
    setTimeout(() => window.location.reload(), 500);
  };
  const doLogin = async () => {
    if (!code.trim() || busy) return;
    if (!tosOk) {
      toast("Agree to the Terms first", {
        body: "Tick the Terms of Service consent below - then sign in.",
        tone: "warn"
      });
      return;
    }
    setBusy("login");
    setErr("");
    remember("code");
    try {
      try {
        localStorage.setItem("nijip2p-session-pref", "code");
      } catch {}
      const r = await loginWithCode(code);
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
  const codeGroups = newCode.replace(/^PS-/, "").split("-");
  const groups = codeGroups.length > 1 ? codeGroups : newCode.replace(/[^0-9A-Z]/gi, "").replace(/^PS/, "").match(/.{1,4}/g) ?? [];
  const MINT_CAPTIONS = ["Gathering private entropy…", "Deriving your keys, 200,000 rounds…", "Minting your anonymous code…"];
  const mintCaption = mintDone ? "Your anonymous code is ready. Saving it is next." : MINT_CAPTIONS[mintPhase] ?? MINT_CAPTIONS[0];
  const retypeClean = String(retype).toUpperCase().replace(/[^0-9A-Z]/g, "");
  const lastTwoClean = groups.slice(-2).join("").replace(/[^0-9A-Z]/g, "");
  return createPortal(<div className="modal-overlay" onMouseDown={e => {
    if (e.target === e.currentTarget) onClose?.();
  }}>
            <div className="modal auth-sheet" role="dialog" aria-modal="true" aria-label={step === "backup" ? "Back up your anonymous code" : step === "mint" ? "Creating your anonymous account" : "Sign in to nijip2p"} aria-busy={!!busy || undefined} ref={sheetRef} tabIndex={-1}>

                {}
                <div className="auth-head">
                    <LogoMark size={40} className="auth-mark" aria-hidden="true" />
                    <span className="auth-titles">
                        <h3>{step === "backup" ? "Back up your code" : step === "mint" ? "Creating your account" : "Sign in"}</h3>
                        <span className="auth-sub">
                            {step === "backup" ? "This code is the whole account - there is no reset and no custodian." : step === "mint" ? "Entropy in, keys out - nothing leaves this device." : "No email. No KYC. Your anonymous code is the whole account."}
                        </span>
                    </span>
                    <button className="auth-x" onClick={onClose} aria-label="Close the sign-in panel">{IcoClose}</button>
                </div>

                {}
                <div className="auth-body">
                    {step === "mint" ? <div className="mint-scene" role="status" aria-live="polite">
                            <div className={"mint-orb" + (mintDone ? " done" : "")}>
                                <svg className="mint-ring" viewBox="0 0 120 120" aria-hidden="true">
                                    <circle className="mint-ring-bg" cx="60" cy="60" r="54" />
                                    <circle className="mint-ring-fg" cx="60" cy="60" r="54" />
                                </svg>
                                <span className="mint-dot d1" aria-hidden="true" />
                                <span className="mint-dot d2" aria-hidden="true" />
                                <span className="mint-dot d3" aria-hidden="true" />
                                <span className="mint-core" aria-hidden="true"><LogoMark size={44} /></span>
                            </div>
                            <div className="mint-caption">{mintCaption}</div>
                            {mintDone && groups.length ? <button type="button" className="auth-codebox mint-code" aria-label="Your new anonymous code">
                                    <span className="cg prefix">PS</span>
                                    {groups.map((g, i) => <span key={i} className="cg" style={{
              animationDelay: 140 + i * 90 + "ms"
            }}>{g}</span>)}
                                </button> : null}
                        </div> : step === "hub" ? <>
                            <div className="auth-rows">
                                {}
                                <button className="auth-row lead" onClick={doCreate} disabled={!tosOk || !!busy} aria-busy={busy === "create" || undefined} title={tosOk ? undefined : "Agree to the Terms of Service first"}>
                                    <span className="auth-ico" aria-hidden="true">{IcoKey}</span>
                                    <span className="t">
                                        <b>{busy === "create" ? "Creating your account…" : "Create an anonymous account"}</b>
                                        <span>No name, no email - a private code generated on this device is the whole account</span>
                                    </span>
                                    {last === "code" && busy !== "create" ? <span className="auth-chip">Last used</span> : null}
                                    {busy === "create" ? <span className="spinner" aria-hidden="true" /> : <span className="go" aria-hidden="true">{IcoArrow}</span>}
                                </button>

                                <div className={"auth-code" + (busy === "login" ? " busy" : "")}>
                                    <input ref={inputRef} value={code} onChange={e => setCode(e.target.value)} onKeyDown={e => e.key === "Enter" && tosOk && doLogin()} onFocus={onCodeFocus} placeholder={tosOk ? "Sign in with an existing code" : "Agree to the Terms of Service first"} aria-label="Your nijip2p anonymous code" spellCheck={false} autoCapitalize="characters" autoCorrect="off" autoComplete="off" inputMode="text" enterKeyHint="go" disabled={busy === "create"} />
                                    {saved_code ? <span className="auth-chip">Saved</span> : null}
                                    <button className="go-btn" onClick={doLogin} disabled={!tosOk || !code.trim() || !!busy} aria-label={busy === "login" ? "Signing in" : "Sign in with this code"} title={tosOk ? "Sign in with this code" : "Agree to the Terms of Service first"}>
                                        {busy === "login" ? <span className="spinner light" aria-hidden="true" /> : IcoArrow}
                                    </button>
                                </div>
                                <div className="auth-code-hint">Letter case and dashes do not matter - the same code always restores the same account.</div>

                                {}
                                <label className="auth-confirm" style={{
              marginTop: 12
            }}>
                                    <input type="checkbox" checked={tosOk} onChange={e => agreeTos(e.target.checked)} />
                                    <span>I have read and agree to the <a href="#/tos" target="_blank" rel="noreferrer noopener">Terms of Service</a>.</span>
                                </label>
                            </div>

                            {err ? <div style={{
            marginTop: 10
          }}>{<Err text={err} />}</div> : null}
                        </> : <>
                            {}
                            <div className="auth-guard">
                                <span className="auth-guard-ico" aria-hidden="true">{IcoShield}</span>
                                <p>Anyone who holds this code <b>holds the funds</b>. Write it on paper - not a screenshot, not a cloud note.</p>
                            </div>

                            <button type="button" className={"auth-codebox" + (revealed ? "" : " hidden")} onClick={() => setRevealed(v => !v)} aria-label={revealed ? "Hide the code" : "Reveal the code"}>
                                {revealed ? <>
                                        <span className="cg prefix">PS</span>
                                        {groups.map((g, i) => <span key={i} className="cg">{g}</span>)}
                                    </> : <span className="cg masked">tap to reveal</span>}
                            </button>

                            <div className="auth-backup-actions">
                                <button className="btn" onClick={copyNewCode} disabled={!revealed}>{copied ? "Copied ✓" : "Copy code"}</button>
                                <button className="btn ghost" onClick={() => setRevealed(v => !v)}>{revealed ? "Hide" : "Reveal"}</button>
                            </div>
                            <div className="auth-code-hint">Copies leave the clipboard automatically after a minute.</div>

                            <label className="auth-confirm">
                                <input type="checkbox" checked={saved} onChange={e => setSaved(e.target.checked)} />
                                <span>I saved the code somewhere safe, offline.</span>
                            </label>

                            <div className="auth-code-hint" style={{
            marginTop: 10
          }}>
                                Prove the backup: re-type the <b>last two groups</b> of the code. There is no reset and no second copy - this session lives in the tab until you close it.
                            </div>
                            <div className="auth-code" style={{
            marginTop: 6
          }}>
                                <input value={retype} onChange={e => setRetype(e.target.value)} placeholder="re-type the last two groups" aria-label="Re-type the last two groups of your code" spellCheck={false} autoCapitalize="characters" autoCorrect="off" autoComplete="off" inputMode="text" />
                            </div>

                            {err ? <div style={{
            marginTop: 8
          }}>{<Err text={err} />}</div> : null}

                            <button className="btn accent auth-continue" onClick={finishBackup} disabled={!saved || retypeClean !== lastTwoClean}>
                                {saved && retypeClean === lastTwoClean ? "Continue to nijip2p" : "Confirm the backup to continue"}
                            </button>
                        </>}
                </div>

                {}
                <div className="auth-foot">
                    Non-custodial by design: your keys are derived from your code on this device, never stored anywhere, and the contract enforces every trade.{" "}
                    <a href={appHref("how")} onClick={onClose}>How it works</a>
                </div>
            </div>
        </div>, document.body);
}