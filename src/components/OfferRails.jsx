import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppCtx } from "../AppCtx.jsx";
import { RAILS, IN_STATES, FREEZE_MECHANICS, FREEZE_PLAYBOOK, ARBITRATOR_CODE, POR_ARTIFACTS, CEREMONY } from "../lib/paymentRails.js";
import { arbiterAddress } from "../lib/arbiterInfo.js";
import { CUSTOM_MAX, CITY_MAX } from "../lib/offerRails.js";
import { Badge, Button, KV, Steps, toast } from "../lib/ui.jsx";
const RISK_TONE = {
  HIGH: "danger",
  MEDIUM: "warn",
  LOW: "teal",
  NONE: "ok"
};
const RiskBadge = ({
  label,
  risk
}) => <Badge tone={RISK_TONE[risk.level] ?? ""}><span className="dot" />{label}: {risk.level}</Badge>;
export function annLabel(ann) {
  if (!ann) return "";
  const names = (ann.rails ?? []).map(id => RAILS.find(r => r.id === id)?.short ?? id);
  if (ann.custom) names.push("Custom: " + ann.custom);
  if (ann.city && ann.state) names.push(ann.city + ", " + ann.state);
  return names.join(" · ");
}
export function RegionChip({
  ann,
  onInfo
}) {
  if (!ann?.city || !ann?.state) return null;
  return <button type="button" className="rt loc" onClick={() => onInfo("inperson")} title={"Meetup region declared by the seller: " + ann.city + ", " + ann.state + ". The exact venue is committed on-chain as a hash and revealed in the sealed thread - never public."}>
            {ann.city} · {ann.state}
        </button>;
}
export function RailChips({
  ann,
  onInfo,
  compact,
  missing
}) {
  if (!ann) {
    return missing === "none" ? <span className="rail-none" title="No rail declaration has arrived for this offer after several checks. The rulebook applies either way.">no rails declared yet</span> : <span className="rail-none" title="The seller's signed rail declaration is syncing to this device - the chips appear the moment it arrives. The rulebook applies either way.">rails · syncing…</span>;
  }
  if (compact) {
    return <span className="rail-chips compact">
                {ann.rails.map(id => {
        const r = RAILS.find(x => x.id === id);
        if (!r) return null;
        const tone = RISK_TONE[r.lien.level];
        return <button key={id} type="button" className={"rt" + (tone === "danger" ? " bad" : tone === "warn" ? " warn" : "")} onClick={() => onInfo(id)} title={r.name + " - open the rulebook" + (r.window?.note ? "\n\n" + r.window.note : "")}>
                            <span className={"dot " + (tone === "danger" ? "bad" : tone === "warn" ? "warn" : "ok")} />
                            {r.short}
                        </button>;
      })}
                {ann.custom ? <span className="rt custom" title={"Custom rail declared by the seller: “" + ann.custom + "”. Custom rails have no predefined arbiter defaults - the sealed chat is the only evidence."}>
                        Custom · {ann.custom}
                    </span> : null}
                <RegionChip ann={ann} onInfo={onInfo} />
            </span>;
  }
  return <span className="rail-chips">
            {ann.rails.map(id => {
      const r = RAILS.find(x => x.id === id);
      if (!r) return null;
      const warn = r.window?.fit === "warn";
      return <button key={id} type="button" className={"chip-rail" + (warn ? " warn" : "")} onClick={() => onInfo(id)} title={r.name + " - open the rulebook" + (r.window?.note ? "\n\n" + r.window.note : "")}>
                        <span className={"dot " + (RISK_TONE[r.lien.level] === "danger" ? "bad" : RISK_TONE[r.lien.level] === "warn" ? "warn" : "ok")} />
                        {r.short}
                    </button>;
    })}
            {ann.custom ? <span className="chip-rail custom" title={"Custom rail declared by the seller: “" + ann.custom + "”. Custom rails have no predefined arbiter defaults - the sealed chat is the only evidence."}>
                    Custom · {ann.custom}
                </span> : null}
            <RegionChip ann={ann} onInfo={onInfo} />
        </span>;
}
export function RailPicker({
  value,
  onChange,
  onInfo
}) {
  const {
    rails,
    custom
  } = value ?? {
    rails: [],
    custom: ""
  };
  const PICKABLE = RAILS.filter(r => r.id !== "inperson");
  const [showCustom, setShowCustom] = useState(false);
  useEffect(() => {
    if (custom) setShowCustom(true);
  }, [custom]);
  const toggle = id => {
    const next = rails.includes(id) ? rails.filter(x => x !== id) : [...rails, id];
    onChange({
      rails: next,
      custom,
      city: "",
      state: ""
    });
  };
  return <div className="rail-picker">
            <div className="rp-chips">
                {PICKABLE.map(r => {
        const on = rails.includes(r.id);
        const warn = r.window?.fit === "warn";
        return <span key={r.id} className={"rp-chip" + (on ? " on" : "") + (warn ? " warn" : "")}>
                            <button type="button" className="rp-toggle" aria-pressed={on} onClick={() => toggle(r.id)} title={r.name + (r.window?.note ? "\n\n" + r.window.note : "")}>
                                <span className={"dot " + (RISK_TONE[r.lien.level] === "danger" ? "bad" : RISK_TONE[r.lien.level] === "warn" ? "warn" : "ok")} />
                                {r.short}
                            </button>
                            <button type="button" className="rp-info" aria-label={"Open the " + r.name + " rulebook"} onClick={() => onInfo(r.id)} title={r.name + " - what it is, risks, limits, the full rulebook"}>i</button>
                        </span>;
      })}
                <span className={"rp-chip" + (showCustom ? " on" : "")}>
                    <button type="button" className="rp-toggle" aria-pressed={showCustom} onClick={() => {
          const on = !showCustom;
          setShowCustom(on);
          onChange({
            rails,
            custom: on ? custom : "",
            city: "",
            state: ""
          });
        }} title="A rail outside the predefined six - described in your own words">
                        <span className={"dot " + (showCustom ? "warn" : "")} />
                        Custom
                    </button>
                    <button type="button" className="rp-info" aria-label="What a custom rail means" onClick={() => onInfo(null)} title="What a custom rail means - and what it does not protect">i</button>
                </span>
            </div>
            {showCustom ? <input className="rp-custom" value={custom} maxLength={CUSTOM_MAX} inputMode="text" placeholder={"Describe the custom rail (" + CUSTOM_MAX + " characters max)"} onChange={e => onChange({
      rails,
      custom: e.target.value,
      city: "",
      state: ""
    })} spellCheck={false} /> : <button type="button" className="rp-add-custom" onClick={() => setShowCustom(true)}>
                    + describe a custom rail instead
                </button>}
            <div className="rp-note">
                Buyers see these on your offer and pick one when they take it. A rail&apos;s dot shows its freeze/lien tier.
                <button type="button" className="rp-link" onClick={() => onInfo(rails[0] ?? "upi")}>Open the rulebook</button> to read what each one means.
            </div>
        </div>;
}
let railsModalSetter = null;
export function chooseRails({
  mode,
  ann,
  current
}) {
  return new Promise(resolve => {
    if (railsModalSetter) railsModalSetter({
      mode,
      ann,
      current,
      resolve
    });else resolve(null);
  });
}
export function RailsModalHost() {
  const [cfg, setCfg] = useState(null);
  const [sel, setSel] = useState(new Set());
  const [custom, setCustom] = useState("");
  useEffect(() => {
    railsModalSetter = c => {
      setCfg(c);
      if (c?.mode === "declare") {
        setSel(new Set(c.current?.rails ?? []));
        setCustom(c.current?.custom ?? "");
      } else {
        setSel(new Set());
        setCustom("");
      }
    };
    return () => {
      railsModalSetter = null;
    };
  }, []);
  const close = v => {
    if (!cfg) return;
    if (v && cfg.mode === "pick") {
      const pick = [...sel][0] ?? null;
      cfg.resolve(pick === "custom" ? "custom" : pick);
    } else if (v && cfg.mode === "declare") {
      cfg.resolve({
        rails: [...sel].filter(x => x !== "custom"),
        custom: custom.trim()
      });
    } else cfg.resolve(null);
    setCfg(null);
  };
  useEffect(() => {
    if (!cfg) return;
    const onKey = e => {
      if (e.key === "Escape") close(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cfg]);
  if (!cfg) return null;
  const pickMode = cfg.mode === "pick";
  const ann = cfg.ann;
  const declaredRails = (ann?.rails ?? []).map(id => RAILS.find(r => r.id === id)).filter(Boolean);
  const canConfirm = pickMode ? sel.size === 1 : sel.size > 0 || custom.trim().length > 0;
  return <div className="modal-overlay" onMouseDown={e => {
    if (e.target === e.currentTarget) close(false);
  }}>
            <div className="modal modal-wide" role="dialog" aria-modal="true" aria-label={pickMode ? "Pick the payment rail" : "Declare payment rails"}>
                <h3>{pickMode ? "Which rail will you pay on?" : "Declare the payment rails for this offer"}</h3>
                {pickMode ? <p className="m-body">
                        The seller accepts {annLabel(ann)}. Pick the one you will actually use;
                        the trade&apos;s rulebook switches to it, and the arbiter reads the same text if a dispute ever lands.
                    </p> : <p className="m-body">
                        Published to every buyer as an account-signed announcement attached to this offer.
                        Nothing goes on-chain - the contracts stay payment-rail-blind.
                    </p>}
                <div className="rail-options">
                    {(pickMode ? declaredRails : RAILS.filter(r => r.id !== "inperson")).map(r => {
          const checked = sel.has(r.id);
          const warn = r.window?.fit === "warn";
          return <label key={r.id} className={"rail-option" + (checked ? " on" : "")}>
                                <input type={pickMode ? "radio" : "checkbox"} name="rail-option" checked={checked} onChange={() => {
              if (pickMode) setSel(new Set([r.id]));else setSel(prev => {
                const n = new Set(prev);
                n.has(r.id) ? n.delete(r.id) : n.add(r.id);
                return n;
              });
            }} />
                                <span className="ro-name">
                                    <span className={"dot " + (RISK_TONE[r.lien.level] === "danger" ? "bad" : RISK_TONE[r.lien.level] === "warn" ? "warn" : "ok")} />
                                    {r.name}
                                    <Badge tone={RISK_TONE[r.lien.level]}>{r.lien.level} lien</Badge>
                                </span>
                                <span className="ro-sub">{r.tag}</span>
                                {warn && r.window?.note ? <span className="ro-warn">{r.window.note}</span> : null}
                            </label>;
        })}
                    {pickMode && ann?.custom ? <label className={"rail-option" + (sel.has("custom") ? " on" : "")}>
                            <input type="radio" name="rail-option" checked={sel.has("custom")} onChange={() => setSel(new Set(["custom"]))} />
                            <span className="ro-name"><span className="dot warn" />Custom · {ann.custom}</span>
                            <span className="ro-sub">The seller described this rail in their own words - agree the details in the sealed chat before paying.</span>
                        </label> : null}
                    {!pickMode ? <label className={"rail-option" + (custom !== "" ? " on" : "")}>
                            <input type="checkbox" checked={custom !== ""} onChange={() => setCustom(custom !== "" ? "" : " ")} />
                            <span className="ro-name"><span className="dot warn" />Custom rail</span>
                            {custom !== "" ? <input className="rp-custom" value={custom} maxLength={CUSTOM_MAX} inputMode="text" spellCheck={false} placeholder={"Describe it (" + CUSTOM_MAX + " characters max)"} onChange={e => setCustom(e.target.value)} onClick={e => e.stopPropagation()} /> : <span className="ro-sub">Describe a rail outside the predefined six.</span>}
                            <span className="ro-warn">Custom rails have no predefined arbiter defaults - the sealed chat is the only evidence. Never follow links off-app.</span>
                        </label> : null}
                </div>
                <div className="m-actions">
                    <button className="btn ghost" onClick={() => close(false)}>{pickMode ? "Go back" : "Cancel"}</button>
                    <button className={"btn " + (pickMode ? "primary" : "accent")} disabled={!canConfirm} autoFocus onClick={() => close(true)}>
                        {pickMode ? "Take the offer on this rail" : "Save the declaration"}
                    </button>
                </div>
            </div>
        </div>;
}
function SessionCode() {
  const [code, setCode] = useState("");
  const [at, setAt] = useState("");
  const gen = () => {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    setCode(String(buf[0] % 1000000).padStart(6, "0"));
    setAt(new Date().toLocaleString());
  };
  return <div className="side-panel" style={{
    marginTop: 14
  }}>
            <div className="side-head">
                <div>
                    <h3>Session code</h3>
                    <p>one-time · generated fresh for this meet</p>
                </div>
            </div>
            <p style={{
      fontSize: 13,
      lineHeight: 1.6,
      color: "var(--muted)",
      margin: "0 0 12px"
    }}>
                Generate it when the meet is scheduled. Write it on paper, carry it, and let it
                appear in the check-in photo. If the code in the photo is not this code, the
                artifacts are not from this meet - the arbiter treats them as a replay.
            </p>
            {code ? <div className="ok-box" style={{
      fontFamily: "var(--mono)",
      fontSize: 20,
      letterSpacing: 4
    }}>
                    {code}<span style={{
        display: "block",
        fontSize: 11,
        letterSpacing: 0,
        marginTop: 6
      }}>generated {at}</span>
                </div> : null}
            <Button block tone={code ? "ghost" : "primary"} onClick={gen}>
                {code ? "Regenerate (starts a new record)" : "Generate the session code"}
            </Button>
        </div>;
}
const RuleList = ({
  items
}) => <ol className="rules-ol">{items.map((r, i) => <li key={i}>{r}</li>)}</ol>;
export function RailsRulebookLink({
  label = "Open the rail rulebook",
  className = "desk-link",
  railId = "upi"
}) {
  const [open, setOpen] = useState(undefined);
  return <>
            <button type="button" className={className} onClick={() => setOpen(railId)}>{label} →</button>
            <RailDrawer railId={open} onClose={() => setOpen(undefined)} onPick={setOpen} />
        </>;
}
export function RailDrawer({
  railId,
  onClose,
  onPick
}) {
  const {
    cfg
  } = useContext(AppCtx);
  const bodyRef = useRef(null);
  const rail = useMemo(() => RAILS.find(r => r.id === railId) ?? null, [railId]);
  const isCustom = railId === null;
  const railKey = railId === undefined || railId === false ? null : String(railId);
  useEffect(() => {
    if (railKey === null) return;
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [railKey]);
  useEffect(() => {
    if (railKey === null) return;
    const onKey = e => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [railKey, onClose]);
  const open = railId !== undefined && railId !== false;
  if (!open) return null;
  const jump = id => bodyRef.current?.querySelector("#" + id)?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
  return <div className="drawer-overlay" onMouseDown={e => {
    if (e.target === e.currentTarget) onClose();
  }}>
            <aside className="rail-drawer" role="dialog" aria-modal="true" aria-label={rail ? rail.name + " rulebook" : "Custom rails"}>
                <div className="rd-head">
                    <div className="rd-title">
                        <b>{rail ? rail.name : "Custom rails"}</b>
                        <span className="rail-tag">{rail ? rail.tag : "A rail outside the predefined six - declared by the seller in their own words"}</span>
                    </div>
                    <button className="t-close" aria-label="Close the rulebook" autoFocus onClick={onClose}>✕</button>
                </div>
                <div className="rd-switch">
                    <button className={"chip-rail" + (isCustom ? " sel" : "")} onClick={() => onPick(null)} title="What a custom rail means">Custom</button>
                    {RAILS.map(r => <button key={r.id} className={"chip-rail" + (rail?.id === r.id ? " sel" : "")} onClick={() => onPick(r.id)} title={r.name}>
                            {r.short}
                        </button>)}
                </div>
                <div className="rd-body" ref={bodyRef}>
                    {rail ? <>
                            <div className="rd-nav">
                                <button onClick={() => jump("rd-glance")}>At a glance</button>
                                <button onClick={() => jump("rd-why")}>Why this risk</button>
                                <button onClick={() => jump("rd-rules")}>The rules</button>
                                <button onClick={() => jump("rd-evidence")}>Evidence</button>
                                <button onClick={() => jump("rd-disputes")}>Disputes</button>
                            </div>

                            <div id="rd-glance" className="rd-sec">
                                <div className="rail-badges">
                                    <RiskBadge label="Freeze / lien risk" risk={rail.lien} />
                                    <RiskBadge label="Buyer-side risk" risk={rail.clawback} />
                                </div>
                                <div className="rail-risk-note note" style={{
              marginBottom: 6
            }}>{rail.lien.note}</div>
                                {rail.window?.fit === "warn" && rail.window.note ? <div className="note warn" style={{
              marginBottom: 6
            }}>{rail.window.note}</div> : null}
                                <KV rows={[["Speed", rail.speed], ...rail.caps, ["Works best for", rail.best]]} />
                            </div>

                            <div id="rd-why" className="rd-sec">
                                <h4>Why the risk reads like this</h4>
                                <p className="rail-why">{rail.why}</p>
                            </div>

                            <div id="rd-rules" className="rd-sec">
                                <h4>Buyer rules</h4>
                                <p className="small dim" style={{
              margin: "2px 0 0"
            }}>follow these and the buyer side of a dispute is already won before it starts</p>
                                <RuleList items={rail.buyerRules} />
                                <h4 style={{
              marginTop: 18
            }}>Seller rules</h4>
                                <p className="small dim" style={{
              margin: "2px 0 0"
            }}>the freeze-hygiene and release discipline for this rail</p>
                                <RuleList items={rail.sellerRules} />
                            </div>

                            <div id="rd-evidence" className="rd-sec">
                                <h4>Evidence the arbiter accepts</h4>
                                <ul className="rules-ol">{rail.evidence.map((e, i) => <li key={i}>{e}</li>)}</ul>
                                <div className="note mono" style={{
              marginTop: 12
            }}>
                                    Proof hierarchy on every rail: bank ledger credit &gt; reference number (UTR / CDM ref / redemption) &gt; in-app screenshot &gt; SMS. The ledger always wins.
                                </div>
                            </div>

                            <div id="rd-disputes" className="rd-sec">
                                <h4>If it goes to the arbiter</h4>
                                <p className="small dim" style={{
              margin: "2px 0 0"
            }}>predefined defaults - both sides know these before they trade</p>
                                <KV rows={rail.defaults} />
                                <h4 style={{
              marginTop: 18
            }}>Refuse these patterns</h4>
                                <div className="note warn">{rail.pitfalls.map((p, i) => <span key={i} style={{
                display: "block",
                margin: i ? "8px 0 0" : 0
              }}>- {p}</span>)}</div>
                            </div>

                            {rail.id === "inperson" ? <div className="rd-sec">
                                    <h4>The Proof-of-Record ceremony</h4>
                                    <p className="small dim" style={{
              margin: "2px 0 0"
            }}>six steps, in this order, every meet - the order itself is the protection</p>
                                    <Steps items={CEREMONY} />
                                    <KV rows={POR_ARTIFACTS} />
                                    <div className="note ok" style={{
              marginTop: 12
            }}>
                                        Why both sides want the record: with no artifacts, cash delivery is <b>unproven</b> and the predefined
                                        default returns the coins to the seller. With the full record, a dispute is decided by the artifacts,
                                        not by anyone's word.
                                    </div>
                                    <SessionCode />
                                    <h4 style={{
              marginTop: 18
            }}>Safety above every other rule</h4>
                                    <ul className="rules-ol">
                                        <li>Bank branch during banking hours is always the strongest room: guards, CCTV, counting machine, UV check, and an instant receipt.</li>
                                        <li>Daylight only, 09:00–17:00. Public CCTV zone if no branch is practical. Never vehicles, homes, hotel rooms or ATM alcoves.</li>
                                        <li>Last-minute location or companion changes are abort signals - use the abort word in the app and leave. The escrow stays locked either way.</li>
                                        <li>Robbery or duress: comply, stay safe, file the FIR, open the dispute with the FIR number. The predefined default on duress refunds the seller - nothing ever releases against violence.</li>
                                    </ul>
                                </div> : null}
                        </> : <div className="rd-sec">
                            <div className="note warn">
                                A custom rail is any payment route outside the predefined six. The seller describes it in their own
                                words, and that description travels as an account-signed announcement - it is their statement, verifiable
                                as coming from the offer's seller.
                            </div>
                            <h4>What a custom rail does not protect</h4>
                            <ul className="rules-ol">
                                <li>There are <b>no predefined arbiter defaults</b> for a custom rail. The predefined defaults on this page exist so both sides know the ruling before trading - a custom rail gives up exactly that.</li>
                                <li>The sealed chat is the only evidence. If the details of a custom rail live anywhere else, they do not exist for the arbiter.</li>
                                <li>Never follow links off-app. “Pay here instead” is the oldest scam shape on any rail, predefined or not.</li>
                                <li>The escrow protection is unchanged - the coins are locked before the fiat moves either way. What changes is only how a dispute gets decided.</li>
                            </ul>
                            <h4>If you use one</h4>
                            <ul className="rules-ol">
                                <li>Buyer: agree every detail in the sealed chat BEFORE paying, and keep the evidence the chat asks for.</li>
                                <li>Seller: release only on proof you would accept under the closest predefined rail's standard - the ledger standard, not screenshots.</li>
                                <li>Both: when in doubt, pick a predefined rail instead. The tiers exist because they were earned.</li>
                            </ul>
                        </div>}

                    {}
                    <div className="rd-gen">
                        <h4>The general rulebook - freezes, playbook, arbiter</h4>

                        <div className="rd-fold">
                            <details>
                                <summary>How an account actually gets frozen</summary>
                                <div className="rd-fold-body">
                                    <KV rows={FREEZE_MECHANICS} />
                                </div>
                            </details>
                            <details>
                                <summary>If your account gets frozen anyway - the playbook</summary>
                                <div className="rd-fold-body">
                                    <Steps items={FREEZE_PLAYBOOK} />
                                    <div className="note" style={{
                  marginTop: 12
                }}>
                                        The app hands you two of the four pieces for free: <b>export the sealed chat</b> from the trade thread and
                                        cite the <b>on-chain trade hashes</b>. Add your KYC and the bank statement line, and the representation
                                        writes itself. This section is the platform's predefined standard of cooperation - it is what the arbiter
                                        will ask to see.
                                    </div>
                                </div>
                            </details>
                            <details>
                                <summary>The arbitrator's code</summary>
                                <div className="rd-fold-body">
                                    {arbiterAddress(cfg) ? <div className="note" style={{
                  marginBottom: 12
                }}>
                                            Ruling arbiter in this deployment record: <span className="mono" style={{
                    fontSize: 13
                  }}>{arbiterAddress(cfg)}</span>
                                            {", "} shown as recorded, never a placeholder. They join a disputed trade's thread as a verified chat
                                            party and rule on disputed trades only; undisputed funds stay untouchable.
                                        </div> : <div className="note warn" style={{
                  marginBottom: 12
                }}>
                                            <b>No arbiter address is configured for this network yet.</b> The rules still apply, and the
                                            contract enforces them - but nothing can be ruled until the deployment record sets a real arbiter.
                                        </div>}
                                    <KV rows={ARBITRATOR_CODE} />
                                </div>
                            </details>
                            <details>
                                <summary>Honest limits</summary>
                                <div className="rd-fold-body">
                                    <div className="note warn">
                                        These rules are the platform's predefined defaults, not legal advice. Bank limits vary by
                                        account and change over time - confirm yours before a large trade. Thresholds quoted here (PAN at ₹50,000
                                        cash/day, the ₹10,00,000 CTR reporting line, s.106/s.497 BNSS) are the published general rules as of
                                        writing; a real freeze or a large in-person trade deserves professional advice. What the platform commits
                                        to is the evidence chain: sealed chat, on-chain hashes, and this rulebook standing still long enough to
                                        rely on.
                                    </div>
                                </div>
                            </details>
                        </div>
                        <div className="note" style={{
            marginTop: 12
          }}>
                            Trading on a rail means agreeing to its rulebook. Sellers declare which rails they accept on the offer;
                            buyers pick one when taking it; the sealed chat carries the rail's specifics (account numbers, references,
                            codes). The arbiter reads <b>these</b> rules first, then the chat.
                        </div>
                    </div>
                </div>
            </aside>
        </div>;
}