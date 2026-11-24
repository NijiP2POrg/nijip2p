import React, { useContext, useEffect, useMemo, useState } from "react";
import { AppCtx } from "../App.jsx";
import { ABIs, short } from "../lib/chain.js";
import { arbiterAddress } from "../lib/arbiterInfo.js";
import { networkName } from "../lib/format.js";
import { Panel, Badge, Copy, KV } from "../lib/ui.jsx";
const CONTRACT_ORDER = [["deal", "NijiDeal", "The escrow", "Holds every trade for both desks - Remote and In-Person. Posting locks nothing; the seller escrows the exact agreed amount, at the moment they choose. Every exit is a coded outcome: release, refund, or a court ruling."], ["court", "NijiCourt", "The dispute court", "Holds the arbiter set and forces binary rulings on disputed trades - all to the buyer or all to the seller. It can never route funds anywhere else, and the arbiter set can never shrink to zero."]];
const NUMBERS = [{
  k: "0",
  v: "protocol fees",
  d: "No cut, no treasury, no take-rate. The only cost is gas."
}, {
  k: "0",
  v: "locked at posting",
  d: "An offer escrows nothing. The seller locks the exact amount, only when ready."
}, {
  k: "20 min",
  v: "remote pay window",
  d: "Lock to mark-paid. After it, anyone can push the automatic refund."
}, {
  k: "7 days",
  v: "in-person window",
  d: "Contract-enforced - it makes the mid-handover refund race impossible."
}, {
  k: "2",
  v: "dispute outcomes",
  d: "Binary by design: all to the buyer, or all to the seller. No partial slices."
}, {
  k: "1 tx",
  v: "to end a griefing attempt",
  d: "A claim that never locks is voided by either party and the offer reopens."
}];
const STATE_GROUPS = [{
  id: "remote",
  kicker: "Remote Escrow · 20-minute pay window",
  title: "A remote deal, state by state",
  sub: "From a free posting to a settled trade - and the three exits that are not settlement.",
  steps: [{
    n: "1",
    t: "Open",
    fn: "postOffer",
    d: "The seller publishes size, rate and rails. Nothing is escrowed - the posting moves no tokens."
  }, {
    n: "2",
    t: "Taken",
    fn: "takeOffer",
    d: "A buyer claims it. The sealed chat opens; still nothing is locked. Either party can void and the offer reopens."
  }, {
    n: "3",
    t: "Locked",
    fn: "lockFunds",
    d: "The seller escrows the exact negotiated amount. The pay window starts - and both parties gain the dispute button."
  }, {
    n: "4",
    t: "Paid",
    fn: "markPaid",
    d: "The buyer announces the fiat payment. This also blocks the automatic refund - the double-dip is closed."
  }, {
    n: "5",
    t: "Settled",
    fn: "confirmRelease",
    d: "The seller confirms; the contract pays the buyer in full."
  }],
  branches: ["Voided - a take that never locked; the offer is reusable", "Refunded - window expired unpaid (anyone can push it), or a seller-win ruling", "Disputed - frozen for the court; one binary ruling ends it"]
}, {
  id: "cash",
  kicker: "In-Person Escrow · 7-day pay window",
  title: "An in-person deal, state by state",
  sub: "The same machine - the difference is when the lock happens: before you meet.",
  steps: [{
    n: "1",
    t: "Open",
    fn: "postOffer",
    d: "The seller posts with a pinned ~150 m venue square - broadcast with the public offer so buyers can see the spot - and a one-time code that travels only in the sealed chat."
  }, {
    n: "2",
    t: "Taken",
    fn: "takeOffer",
    d: "A buyer claims it and they meet. Nothing has been escrowed - a no-show costs a tap, not money."
  }, {
    n: "3",
    t: "Locked before the meet",
    fn: "lockFunds",
    d: "The seller locks the escrow before the meetup. The buyer checks the lock on-chain before any cash moves."
  }, {
    n: "4",
    t: "Cash handed",
    fn: "markPaid",
    d: "The buyer taps after the notes change hands. The 7-day auto-refund is now blocked - the mid-handover race is impossible."
  }, {
    n: "5",
    t: "Settled",
    fn: "confirmRelease",
    d: "The seller confirms; the contract pays the buyer in full."
  }],
  branches: ["Voided - a take before any lock; nothing was ever at risk", "Refunded - 7 days unpaid, or a seller-win ruling", "Disputed - frozen for the court; one binary ruling ends it"]
}];
const WALKTHROUGHS = [{
  id: "remote",
  pill: "Remote",
  kicker: "A remote deal, end to end",
  phases: [{
    n: "1",
    t: "Post",
    items: ["Seller publishes size, rate, token and rails - free, no approval, no escrow", "The listing appears on the public board instantly"]
  }, {
    n: "2",
    t: "Claim + talk",
    items: ["A buyer claims it; the sealed chat opens", "They agree the exact amount and the rail"]
  }, {
    n: "3",
    t: "Lock",
    items: ["The seller escrows the agreed amount - one transaction", "The 20-minute pay window starts; both dispute buttons go live"]
  }, {
    n: "4",
    t: "Pay",
    items: ["The buyer sends fiat over the agreed rail and marks it paid", "The mark blocks the automatic refund"]
  }, {
    n: "5",
    t: "Release",
    items: ["The seller confirms; the contract pays the buyer", "Ghosted either way? One dispute, one binary ruling"]
  }],
  caps: ["Posting is free", "20-minute window", "Funds move only by code"],
  note: "Every timer here is enforced by NijiDeal - the app only reads it."
}, {
  id: "cash",
  pill: "In-Person",
  kicker: "A cash deal, end to end",
  phases: [{
    n: "1",
    t: "Post",
    items: ["The seller pins the venue (~150 m square) and generates a one-time code", "The square rides the public announcement; the exact spot and code travel sealed in the chat - the chain never sees either"]
  }, {
    n: "2",
    t: "Claim + meet",
    items: ["A buyer claims it; they agree the spot and time", "No-show? Either party voids - nothing was ever locked"]
  }, {
    n: "3",
    t: "Lock before the meet",
    items: ["The seller locks the escrow up front - one transaction", "The buyer verifies the lock on-chain before any cash moves"]
  }, {
    n: "4",
    t: "Hand the cash",
    items: ["Cash changes hands; the buyer taps 'cash handed'", "The 7-day auto-refund is now blocked - the race is impossible"]
  }, {
    n: "5",
    t: "Release",
    items: ["The seller counts and confirms; the contract pays the buyer", "Anything off? The dispute button was live since the lock"]
  }],
  caps: ["7-day window", "Lock before cash", "Funds move only by code"],
  note: "The order is the safety: no lock, no cash. The escrow protects the buyer; locking only after a real buyer takes the offer protects the seller."
}];
const AVAILABILITY = [{
  chain: "BNB Chain",
  id: "chain 56",
  rows: [["Remote Escrow (USDC/USDT)", "deployed", "accent"], ["In-Person Escrow (USDC/USDT)", "deployed", "accent"], ["NijiCourt (dispute resolution)", "deployed", "accent"]]
}, {
  chain: "Ethereum",
  id: "chain 1",
  rows: [["Remote Escrow", "not yet", "dim"], ["In-Person Escrow", "not yet", "dim"], ["NijiCourt", "not yet", "dim"]]
}, {
  chain: "Polygon",
  id: "chain 137",
  rows: [["Remote Escrow", "not yet", "dim"], ["In-Person Escrow", "not yet", "dim"], ["NijiCourt", "not yet", "dim"]]
}];
const FN_DOCS = {
  NijiDeal: {
    postOffer: "publish an offer - free, moves no tokens; online payWindow 20 min to 7 days, cash must be exactly 7 days",
    cancelOffer: "seller withdraws an offer that has no active trade; moves no funds",
    takeOffer: "a buyer claims an offer - one active trade per offer, nothing is locked",
    voidTake: "buyer or seller aborts a TAKEN trade; the offer reopens and stays reusable",
    lockFunds: "seller escrows 0 < amount <= maxAmount; starts the pay window and records the balance delta actually received",
    markPaid: "buyer marks payment while the pay window is open; PAID permanently blocks refundExpired",
    confirmRelease: "seller confirms receipt; 100% of the escrow pays the buyer",
    refundExpired: "anyone returns the escrow to the seller once the pay window passed in LOCKED",
    dispute: "buyer or seller freezes a LOCKED or PAID trade for the court; requires an arbiter to be set",
    arbiterResolve: "only the arbiter pinned at dispute time - binary: 100% to the buyer, else 100% to the seller",
    tradeClock: "view - status plus seconds left in the pay window (0 when not LOCKED or already expired)",
    setArbiter: "owner - set the arbiter (NijiCourt) address; zero address rejected",
    pause: "owner - freezes postOffer, lockFunds, confirmRelease, refundExpired and arbiterResolve; take/void/markPaid/dispute stay live",
    unpause: "owner - lifts the emergency pause",
    USDC: "view - immutable USDC token address this escrow accepts",
    USDT: "view - immutable USDT token address this escrow accepts",
    arbiter: "view - current arbiter (court) address that new disputes will pin",
    MIN_PAY_WINDOW: "view - 1,200 seconds (20 minutes), the remote desk floor",
    MAX_PAY_WINDOW: "view - 604,800 seconds (7 days), the cash window and the ceiling for both desks",
    offerCounter: "view - id of the last offer posted",
    tradeCounter: "view - id of the last trade opened",
    offers: "view - full Offer record by id: seller, token, maxAmount, rate, payWindow, cash, cancelled, activeTradeId",
    trades: "view - full Trade record by id: parties, token, amount, rate, status, lockedAt, paidAt, arbiterPin",
    paused: "view - true while the owner's emergency pause is active",
    owner: "view - current owner (Ownable2Step)",
    pendingOwner: "view - nominated owner waiting to accept; zero when no transfer is pending",
    acceptOwnership: "pending owner - completes the two-step ownership transfer",
    transferOwnership: "owner - nominates a new owner; effective only after acceptOwnership",
    renounceOwnership: "owner - renounces ownership; Ownable2Step refuses while a transfer is pending"
  },
  NijiCourt: {
    addArbiter: "owner - add an arbiter wallet; must be non-zero and not already registered",
    removeArbiter: "owner - remove an arbiter; refused when only one remains (LAST_ARBITER)",
    setDeal: "owner - re-wire the escrow; trades already DISPUTED keep their pinned court",
    resolve: "arbiter - force a binary ruling into NijiDeal and emit the public rationale note",
    isArbiter: "view - whether a wallet is in the arbiter set",
    arbiterCount: "view - number of live arbiters; can never shrink to zero",
    deal: "view - the NijiDeal escrow this court resolves into",
    owner: "view - current owner (Ownable2Step)",
    pendingOwner: "view - nominated owner waiting to accept; zero when no transfer is pending",
    acceptOwnership: "pending owner - completes the two-step ownership transfer",
    transferOwnership: "owner - nominates a new owner; effective only after acceptOwnership",
    renounceOwnership: "owner - renounces ownership; Ownable2Step refuses while a transfer is pending"
  }
};
export default function HowItWorks() {
  const {
    cfg
  } = useContext(AppCtx);
  const [which, setWhich] = useState("NijiDeal");
  const meta = useMemo(() => CONTRACT_ORDER.map(([key, name, friendly, blurb]) => ({
    key,
    name,
    friendly,
    blurb,
    addr: cfg?.[key] ?? null,
    abi: ABIs[name] ?? []
  })), [cfg]);
  const current = meta.find(m => m.name === which) ?? meta[0];
  const fns = (current.abi ?? []).filter(x => x.type === "function");
  const missingDoc = fns.filter(f => !(FN_DOCS[current.name] ?? {})[f.name]).length;
  const fnGroups = useMemo(() => {
    const tx = [],
      view = [];
    for (const f of fns) (f.stateMutability === "view" || f.stateMutability === "pure" ? view : tx).push(f);
    return {
      tx,
      view
    };
  }, [current.name]);
  const [mtab, setMtab] = useState("numbers");
  const [walk, setWalk] = useState("remote");
  const walkthrough = WALKTHROUGHS.find(c => c.id === walk) ?? WALKTHROUGHS[0];
  const [barTop, setBarTop] = useState(108);
  useEffect(() => {
    const m = () => {
      const tb = document.querySelector(".topbar");
      setBarTop((tb?.offsetHeight ?? 64) + 8);
    };
    m();
    window.addEventListener("resize", m);
    return () => window.removeEventListener("resize", m);
  }, []);
  const FnCard = f => {
    const mut = f.stateMutability === "view" || f.stateMutability === "pure";
    const doc = (FN_DOCS[current.name] ?? {})[f.name];
    const sig = f.name + "(" + (f.inputs ?? []).map(i => i.type ?? "").join(",") + ")";
    return <div className="fn-card" key={f.name}>
                <div className="fn-head">
                    <b className="mono">{f.name}</b>
                    <Badge tone={mut ? "ok" : "accent"}>{mut ? "view" : "tx"}</Badge>
                </div>
                <div className="mono small dim" style={{
        overflowWrap: "anywhere"
      }}>{sig}</div>
                {doc ? <p className="small">{doc}</p> : null}
            </div>;
  };
  return <div>
            <h1 className="h1">How it works</h1>
            <p className="lead">
                One escrow contract, two desks, one dispute court. The roles, the
                timers, the states and the honest limits - every claim here can be
                checked against the deployed code.
            </p>

            <div className="m-seg" role="tablist" aria-label="How it works sections" style={{
      top: barTop + "px"
    }}>
                {[["numbers", "Numbers"], ["functions", "Functions"], ["states", "States"], ["walk", "Walkthroughs"], ["limits", "Limits"]].map(([id, label]) => <button key={id} role="tab" aria-selected={mtab === id} className={"m-seg-btn" + (mtab === id ? " on" : "")} onClick={() => setMtab(id)}>{label}</button>)}
            </div>

            {mtab === "numbers" ? <>
                <h2 className="h2">The numbers, as designed</h2>
                <div className="num-grid">
                    {NUMBERS.map(r => <div className="num-card" key={r.k + r.v}>
                            <span className="num-k">{r.k}</span>
                            <span className="num-v">{r.v}</span>
                            <p>{r.d}</p>
                        </div>)}
                </div>

                <h2 className="h2">The deployed contracts</h2>
                <Panel kicker={`network: ${networkName(cfg)}`} sub="Names and addresses exactly as deployed, so the ABIs stay verifiable.">
                    <div className="ct-list">
                        {meta.map(m => <div className="ct-card" key={m.name}>
                                <div className="ct-head">
                                    <b className="mono">{m.name}</b>
                                    {m.addr ? <Copy text={m.addr} label={short(m.addr)} /> : <Badge tone="warn">not on this network</Badge>}
                                </div>
                                <div className="ct-friendly">{m.friendly}</div>
                                <p>{m.blurb}</p>
                            </div>)}
                    </div>
                </Panel>

                <h2 className="h2">What runs where</h2>
                <Panel kicker="BNB Chain is the deployment target" sub="One chain, one contract for both desks. The addresses your app loads come from the deployment record this page loaded.">
                    <div className="av-list">
                        {AVAILABILITY.map(c => <div className="av-card" key={c.chain}>
                                <div className="av-head"><b>{c.chain}</b><span className="mono small dim">{c.id}</span></div>
                                {c.rows.map(([desk, state, tone]) => <div className="av-row" key={desk}>
                                        <span>{desk}</span>
                                        {tone === "accent" ? <Badge tone="accent">{state}</Badge> : <span className="dim small">{state}</span>}
                                    </div>)}
                            </div>)}
                    </div>
                </Panel>

                <h2 className="h2">The dispute court</h2>
                {arbiterAddress(cfg) ? <Panel kicker="read from the deployment record this page loaded" sub="The arbiter wallet registered in NijiCourt for this deployment - shown exactly as recorded.">
                        <div className="row" style={{
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10
        }}>
                            <span className="mono" style={{
            fontSize: 13
          }}>{arbiterAddress(cfg)}</span>
                            <Copy text={arbiterAddress(cfg)} label="Copy address" />
                        </div>
                        <ul className="list-plain" style={{
          marginTop: 12
        }}>
                            <li><b>What it can do:</b> rule on a disputed trade - all to the buyer or all to the seller - with the ruling and its rationale landing on-chain.</li>
                            <li><b>What it cannot do:</b> touch undisputed funds, rule funds to itself, or move anything outside a dispute. The court only ever routes to the two parties.</li>
                            <li><b>How it sees the trade:</b> a dispute opens the conversation to the arbiter desk so it can rule; the ruling and its note then land on-chain. Until then, your chat stays sealed between the two of you.</li>
                        </ul>
                    </Panel> : <Panel kicker="not configured in this deployment record">
                        <div className="note warn">
                            <b>No arbiter is registered for this network yet.</b> Trading works - locks, windows and
                            refunds are automatic - but a disputed trade cannot be ruled until the operator registers one.
                        </div>
                    </Panel>}
            </> : null}

            {mtab === "functions" ? <>
                <h2 className="h2">Contract function reference</h2>
                <Panel sub={`Every function on ${current.name} - the ${current.friendly} contract - with its exact signature and a one-line description.`}>
                    <div className="row" style={{
          marginBottom: 12,
          flexWrap: "wrap"
        }}>
                        {meta.map(m => <button key={m.name} className={"btn small " + (m.name === which ? "" : "ghost")} onClick={() => setWhich(m.name)}>
                                {m.friendly}
                                <span className="mono" style={{
              display: "block",
              fontSize: 9.5,
              opacity: 0.75
            }}>{m.name}</span>
                            </button>)}
                    </div>
                    {fnGroups.tx.length ? <div className="fn-group"><b>state-changing</b><span className="dim small">{fnGroups.tx.length}</span></div> : null}
                    <div className="fn-list">{fnGroups.tx.map(FnCard)}</div>
                    {fnGroups.view.length ? <div className="fn-group"><b>read-only views</b><span className="dim small">{fnGroups.view.length}</span></div> : null}
                    <div className="fn-list">{fnGroups.view.map(FnCard)}</div>
                    {missingDoc > 0 ? <p className="small" style={{
          marginTop: 8,
          color: "var(--warn)"
        }}>
                            {missingDoc} function{missingDoc === 1 ? "" : "s"} on this contract have no description yet - the signature is shown exactly as compiled.
                        </p> : null}
                    <p className="small" style={{
          marginTop: 8
        }}>
                        How the two contracts talk, in one line: the app calls NijiDeal directly for the whole trade
                        lifecycle; when a trade is disputed, NijiCourt forces the ruling into NijiDeal, which pays the
                        buyer or the seller. There is nothing else on-chain to trust.
                    </p>
                </Panel>
            </> : null}

            {mtab === "states" ? <>
                <h2 className="h2">The states a deal passes through</h2>
                <div className="stack-list">
                    {STATE_GROUPS.map(g => <Panel key={g.id} title={g.title} kicker={g.kicker} sub={g.sub}>
                            <StateRail steps={g.steps} branches={g.branches} />
                        </Panel>)}
                </div>
            </> : null}

            {mtab === "walk" ? <>
                <h2 className="h2">Two deals, end to end</h2>
                <div className="sub-seg" role="tablist" aria-label="Pick a walkthrough">
                    {WALKTHROUGHS.map(c => <button key={c.id} role="tab" aria-selected={walk === c.id} className={walk === c.id ? "on" : ""} onClick={() => setWalk(c.id)}>{c.pill}</button>)}
                </div>
                <Panel key={walkthrough.id} kicker={walkthrough.kicker}>
                    <RailTimeline phases={walkthrough.phases} caps={walkthrough.caps} note={walkthrough.note} />
                </Panel>
            </> : null}

            {mtab === "limits" ? <>
                <h2 className="h2">What proves what, and who wins a dispute</h2>
                <Panel title="The proof behind each desk">
                    <KV rows={[["Both desks", "the escrow itself: NijiDeal holds the tokens, so no proof is needed - the lock is the proof"], ["In-person trades", "the order of operations: the seller locks first, cash second - the buyer verifies the lock on-chain before handing anything over"], ["Rulings", "the court's forced call lands on-chain with the ruling wallet and a public rationale note"]]} />
                </Panel>
                <Panel title="Every deadlock, and its exit">
                    <KV rows={[["A claim that never locks", "either party voids it; the offer reopens - the griefer paid gas and gained nothing"], ["Locked, then the buyer disappears", "the seller disputes instantly - no waiting - or lets the window refund automatically"], ["A false paid claim", "the seller disputes the same second; with no proof in the chat, the seller wins"], ["Paid, then the seller disappears", "the buyer disputes; the court releases to the buyer"], ["The court itself", "binary rulings only - it can never route funds to itself, and every ruling is public"], ["A paused protocol", "state and evidence stay live; funds park safely until the pause lifts"]]} />
                </Panel>

                <h2 className="h2">What the code guarantees, and what it does not</h2>
                <Panel sub="The guarantees, the deliberate trust, and the honest limits.">
                    <ul className="list-plain">
                        <li><b>On-chain:</b> built on official OpenZeppelin 5.x primitives, reentrancy guards on every path that moves funds, and the locked amount recorded as the actual balance delta - the contract never owes more than it holds.</li>
                        <li><b>Nothing locks until the seller locks:</b> griefing a listing costs the griefer gas and costs you one tap. This single ordering removes the hostage attacks escrow boards usually carry.</li>
                        <li><b>The arbiter, stated as deliberate trust:</b> a disputed trade ends in one binary ruling. The court cannot pay itself, cannot touch undisputed funds, and its set can never shrink to zero - but a ruling is a human decision, and you see it on-chain.</li>
                        <li><b>Trade privacy, stated exactly:</b> the interface keeps a claimed trade between its two parties - the board shows it with no amounts and no parties. But the chain itself is a public record: every take, lock, release and ruling is readable by anyone, forever. Privacy lives in what never goes on-chain - your chat, your fiat details, your exact spot - not in the chain.</li>
                        <li><b>The fiat leg is invisible:</b> rails, handles and references live in the sealed chat. The contracts are payment-rail-blind by design.</li>
                        <li><b>In-person venues stay off-chain:</b> the public offer advertises only the coarse ~150 m square. Your exact pin and the one-time code travel sealed between the two of you; the chain never sees where you met.</li>
                        <li><b>Chat:</b> relays only ever see ciphertext - plus the fact that two pseudonymous accounts exchanged a message. That metadata is the honest limit.</li>
                        <li><b>If a device is compromised:</b> no protocol can protect funds from a stolen device or code. Keep your recovery code backed up offline.</li>
                        <li><b>The honest ceiling:</b> code raises the price of bad behaviour to gas, taps and rulings - it cannot make people honest. The design makes dishonesty expensive, visible and final.</li>
                    </ul>
                </Panel>
            </> : null}
        </div>;
}
function StateRail({
  steps,
  branches
}) {
  return <div>
            <div className="tl">
                {steps.map(s => <div className="tl-ph" key={s.n + s.t}>
                        <span className="tl-n">{s.n}</span>
                        <div>
                            <span className="tl-t">{s.t}</span>
                            <div className="tl-fn">{s.fn}</div>
                            <ul><li>{s.d}</li></ul>
                        </div>
                    </div>)}
            </div>
            {branches?.length ? <div className="tl-caps" style={{
      marginTop: 4
    }}>
                    {branches.map(c => <span className="tl-cap" key={c}>{c}</span>)}
                </div> : null}
        </div>;
}
function RailTimeline({
  phases,
  caps,
  note
}) {
  return <div>
            <div className="tl">
                {phases.map(ph => <div className="tl-ph" key={ph.n}>
                        <span className="tl-n">{ph.n}</span>
                        <div>
                            <span className="tl-t">{ph.t}</span>
                            <ul>{ph.items.map(it => <li key={it}>{it}</li>)}</ul>
                        </div>
                    </div>)}
            </div>
            {caps ? <div className="tl-caps" style={{
      marginTop: 4
    }}>
                    {caps.map(c => <span className="tl-cap" key={c}>{c}</span>)}
                </div> : null}
            {note ? <div className="tl-note">{note}</div> : null}
        </div>;
}