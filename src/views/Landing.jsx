import React, { useEffect, useRef, useState } from "react";
import { LogoMark, Coin } from "../lib/brand.jsx";
import { openAppHref, appHref } from "../lib/routes.js";
const APP = openAppHref("home");
function Reveal({
  children,
  as: Tag = "div",
  className = "",
  delay = 0
}) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver !== "function") return;
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (en.isIntersecting) {
        el.classList.add("in");
        io.disconnect();
      }
    }), {
      rootMargin: "0px 0px -8% 0px"
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <Tag ref={ref} className={"rv " + className} style={delay ? {
    transitionDelay: delay + "ms"
  } : undefined}>
      {children}
    </Tag>;
}
function MockCard() {
  const [left, setLeft] = useState(19 * 60 + 42);
  useEffect(() => {
    const id = setInterval(() => setLeft(s => s > 0 ? s - 1 : 19 * 60 + 42), 1000);
    return () => clearInterval(id);
  }, []);
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  return <div className="orbit-card" aria-hidden="true">
      <div className="mock-float">
        <div className="mock-card">
          <div className="mock-head">
            <span className="mock-id">Offer #47 · Remote desk</span>
            <span className="badge ok"><span className="dot" />Locked</span>
          </div>
          <div className="mock-row"><span className="k">You sell</span><span className="v inline-coin"><Coin id="usdc" size={15} title="USDC" />$100 USDC · BNB Chain</span></div>
          <div className="mock-row"><span className="k">You receive</span><span className="v acc">₹10,048 · CDM</span></div>
          <div className="mock-cycle">
            <span className="m-rail" />
            <span className="m-node done"><i />published</span>
            <span className="m-node now"><i />locked</span>
            <span className="m-node"><i />paid</span>
            <span className="m-node"><i />settled</span>
          </div>
          <div className="mock-foot">
            <span className="countdown">{mm}:{ss} to pay</span>
            <span className="badge accent">escrowed</span>
          </div>
        </div>
      </div>
    </div>;
}
function OrbitHero() {
  return <div className="orbit" aria-hidden="true">
      <MockCard />
    </div>;
}
const FLOW = [{
  n: "1",
  t: "Talk",
  d: "Claim an offer - nothing locks yet. Agree the amount and the rail in a sealed chat"
}, {
  n: "2",
  t: "Lock",
  d: "The seller escrows into the public contract - the exact amount, at the moment they choose"
}, {
  n: "3",
  t: "Settle",
  d: "Buyer marks paid, seller releases - and the contract pays out. Disputes get one binary ruling"
}];
const ESCROW_ROWS = [{
  coins: ["usdc", "usdt"],
  style: "Remote escrow",
  spec: "The seller escrows the exact agreed amount - only when ready",
  chains: "BNB CHAIN",
  contract: "NijiDeal"
}, {
  coins: ["usdc", "usdt"],
  style: "In-person escrow",
  spec: "The seller locks the escrow before the meet - you hand cash only after the chain shows the lock",
  chains: "BNB CHAIN",
  contract: "NijiDeal"
}];
function ProtocolFlow() {
  return <div className="proto-flow">
      <div className="flow-strip">
        {FLOW.map(s => <div className="flow-cell" key={s.n}>
            <span className="flow-n">{s.n}</span>
            <b>{s.t}</b>
            <p>{s.d}</p>
          </div>)}
      </div>
      <div className="esc-card">
        <span className="esc-cap">ONE CONTRACT · TWO DESKS · ZERO LEVERAGE</span>
        {ESCROW_ROWS.map(r => <div className="esc-row" key={r.contract}>
            <span className="esc-coins">
              {r.coins.map(c => <Coin key={c} id={c} size={22} title={c.toUpperCase()} />)}
            </span>
            <div className="esc-txt">
              <b>{r.style}</b>
              <span>{r.spec}</span>
              <span className="esc-meta">{r.contract} · {r.chains.toLowerCase()}</span>
            </div>
          </div>)}
      </div>
      <div className="esc-note">
        <b>Disputed? The arbiter is already attached to your trade.</b>
        <span>Both sides share evidence, he rules once, and the contract enforces it - publicly.</span>
      </div>
      <div className="esc-note">
        <b>Sealed chat, every step.</b>
        <span>Rails, amounts and references move as ciphertext - the relay stores it and cannot open it.</span>
      </div>
    </div>;
}
const RAIL_TEASER = [{
  name: "UPI",
  tier: "high"
}, {
  name: "NEFT · IMPS · RTGS",
  tier: "high"
}, {
  name: "CDM",
  tier: "low"
}, {
  name: "Cardless ATM → CDM",
  tier: "low"
}, {
  name: "Gift cards",
  tier: "none"
}, {
  name: "Cash in person · Proof-of-Record",
  tier: "none"
}];
const CASH_FEATURES = [{
  t: "Lock before the meet",
  d: "The seller locks the escrow first - see it on-chain before you go",
  img: "./assets/icons/checkin.png"
}, {
  t: "GPS venue pin",
  d: "The seller drops the precise GPS location when the offer goes live - it stays on the public offer, never your address",
  img: "./assets/icons/gps.png"
}, {
  t: "One-time code",
  d: "Sealed to the chat, never on-chain",
  img: "./assets/icons/code.png"
}, {
  t: "7-day window",
  d: "Contract-enforced - the mid-handover race is impossible",
  img: "./assets/icons/pay.png"
}, {
  t: "Binary rulings",
  d: "Disputes end in one ruling - buyer or seller",
  img: "./assets/icons/duress.png"
}, {
  t: "Coded exits only",
  d: "Release, refund or ruling - nothing else can move funds",
  img: "./assets/icons/exit.png"
}];
const CASH_CAPS = ["7-day window", "Every ruling public", "Funds move only by code"];
const STATS = [["$0", "protocol fees"], ["0", "KYC checks"], ["2", "desks, one contract"], ["1", "chain - BNB"]];
const ONCHAIN = [["The contracts are the exchange", "Every token, note and key share is held by a public contract - never by a company. No server can move a trade; only the coded outcomes can."], ["Anyone can watch it live", "Offers, locks, timers and rulings are written on-chain for anyone to read, at public addresses the app shows you. Every state can be checked."], ["People only break ties", "A human arbiter is attached to every trade, present from the start, sealed out of the chat until a dispute opens it. Then buyer and seller share their evidence with him directly. One binary ruling: buyer or seller, and the contract enforces it. He never touches the funds, and every ruling is published on-chain."]];
const SELL = [["Post an offer", "Posting is free - it locks nothing."], ["Lock the escrow", "The exact agreed amount, at the moment you choose."], ["Confirm the payment", "The proof lives in the sealed chat."], ["Release", "One press pays the buyer."]];
const BUY = [["Claim an offer", "Terms and rate are on-chain."], ["Verify the lock", "See the escrow on-chain before any fiat moves."], ["Pay the fiat", "Over the rail you agreed on - inside the window the contract enforces."], ["Receive", "No release? Dispute; the arbiter rules binary."]];
const SELL_NOTE = "Buyer never pays? The window ends in an automatic refund - or you dispute instantly.";
const BUY_NOTE = "Every timer is enforced by the contract, not by promises.";
const SEES_PUBLIC = ["Every offer: token, size, rate", "Every trade state, timestamped, forever", "The wallet addresses behind each side", "Every dispute ruling - and its public note"];
const STAYS_PRIVATE = ["Your fiat leg: rail, handles, payment references", "Your chat: end-to-end sealed - the relay holds ciphertext, not words", "Your one-time code - sealed to the trade, shared in the chat, never on-chain; the public offer carries the pinned meetup spot"];
const CEX_GAINS = [["Coins never touch our books", "Escrow contracts hold every trade - not a company balance sheet."], ["No sign-up, no KYC database", "Your account is a code generated on your device. We hold no identity file - and no way to reset one."], ["People, not a desk", "Every offer is someone who locked their own coins."], ["Disputes go to the arbiter", "Both sides share their evidence with the arbiter in the sealed chat. He rules once: buyer or seller, and the contract enforces the ruling."]];
const CEX_TRADEOFFS = [["You hold the keys", "No reset link exists - keep the recovery code safe."], ["Public by design", "Offers, locks and rulings are readable on-chain. Your chat, fiat details and one-time code stay sealed."], ["No price ladder", "You read offers and pick - slower, but visible."], ["Thinner liquidity", "A marketplace of people, not an order book."]];
const FAQ = [["Do I need an account?", "No. Browse every offer as a guest. Sign in only when you publish, take, or chat - and even then your account is a private code created on your device."], ["What does it cost?", "Nothing. The protocol charges no fee - the only cost is the network's own gas."], ["What if the buyer never pays?", "The seller can dispute the moment the escrow is locked - on the remote desk or the in-person cash desk - and the arbiter rules. If nobody disputes, the seller also has a second way out: once the payment window ends (20 minutes on the remote desk, 7 days on the in-person cash desk) anyone can trigger the automatic refund, and the escrowed funds go back to the seller."], ["Is it custodial?", "No. Coins lock in escrow before fiat moves, and only the coded outcomes - release, refund, ruling - can move them."], ["Is it private?", "Only where we say it is. The escrow is public by design: offers, locks, releases and rulings stay readable on-chain forever. Kept private between the two of you: the chat (end-to-end encrypted) and your fiat details. The pinned meetup spot is public on the offer; your one-time code is the only thing sealed to the trade. We collect nothing - but on-chain activity is pseudonymous, not anonymous."], ["Is cash in person actually safe?", "The order is the safety: the seller locks the escrow before the meet, you confirm the lock on-chain, then you hand over the cash. No lock, no cash - and a 7-day window plus a binary arbiter ruling stand behind every trade."]];
const ICO_SELL = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 17.5 9.5 12l3.5 3.5L20 8.5" /><path d="M15 8.5h5v5" />
  </svg>;
const ICO_BUY = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 7l5.5 5.5L13 9l7 7" /><path d="M15 16h5v-5" />
  </svg>;
const ICO_EYE = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" />
  </svg>;
const ICO_SEAL = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4.5" y="10.5" width="15" height="9.5" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /><path d="M12 14.5v2" />
  </svg>;
const LAND_SOCIAL = {
  chat: {
    name: "Community chat",
    svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 11.6c0 4.2-4 7.4-9 7.4-1 0-2-.1-2.9-.4L4 20l1.2-3.6C3.8 15.1 3 13.4 3 11.6 3 7.4 7 4.2 12 4.2s9 3.2 9 7.4z" /></svg>
  },
  simplex: {
    name: "SimpleX Chat",
    svg: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20.5 4.5h-17c-.55 0-1 .45-1 1v9c0 .55.45 1 1 1h2.9l-1.1 3.7 4.3-3.7h10.9c.55 0 1-.45 1-1v-9c0-.55-.45-1-1-1z" /><path d="M9.4 7.9l5.2 5.2M14.6 7.9l-5.2 5.2" /></svg>
  },
  telegram: {
    name: "Telegram",
    svg: <img src="./assets/icons/telegram.png" width="18" height="18" alt="" aria-hidden="true" draggable={false} />
  },
  github: {
    name: "GitHub",
    svg: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.3a9.8 9.8 0 0 0-3.1 19.1c.5.1.7-.2.7-.5v-1.8c-2.8.6-3.4-1.2-3.4-1.2-.4-1.1-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.6 1.1 1.6 1.1.9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.2-.4-1.2.1-2.6 0 0 .9-.3 2.8 1a9.4 9.4 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.6.6.7 1 1.6 1 2.7 0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.9v2.7c0 .3.2.6.7.5A9.8 9.8 0 0 0 12 2.3z" /></svg>
  },
  x: {
    name: "X (Twitter)",
    svg: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.8 3h3.1l-6.8 7.8L22 21h-6.3l-4.9-6.4L5.2 21H2.1l7.3-8.3L2 3h6.4l4.4 5.9L17.8 3zm-1.1 16.1h1.7L7.6 4.7H5.8l10.9 14.4z" /></svg>
  }
};
const LAND_SOCIAL_ORDER = ["chat", "simplex", "telegram", "github", "x"];
function LandSocial({
  social
}) {
  const soc = social ?? {};
  return <div className="land-foot-social" aria-label="Community links">
      {LAND_SOCIAL_ORDER.map(k => {
      const url = soc[k] ?? "";
      const m = LAND_SOCIAL[k];
      return url ? <a key={k} href={url} target="_blank" rel="noreferrer noopener" title={m.name} aria-label={m.name}>{m.svg}</a> : <span key={k} className="soc-soon" title={m.name + " - link coming soon"} aria-label={m.name + " (link coming soon)"} aria-disabled="true">{m.svg}</span>;
    })}
    </div>;
}
export default function Landing({
  social,
  onCreate
}) {
  return <div className="land">
      <header className="land-nav">
        <div className="land-nav-in">
          <a className="land-brand" href="#/" aria-label="nijip2p home">
            <LogoMark size={27} />
            <span>nijip2p</span>
          </a>
          <span className="land-nav-spacer" />
          <a className="land-btn primary sm" href={APP}>Open app</a>
        </div>
      </header>

      {}
      <section className="land-hero">
        <div className="land-hero-in">
          <Reveal>
            <h1 className="land-h1">
              Powered by smart contracts. <em>Not by promises.</em>
            </h1>
            <p className="land-lead">
              nijip2p is a peer-to-peer escrow service for stablecoin trades -
              online, or face to face over cash. Your coins never touch our
              hands: they sit in a public contract until a coded outcome - your
              release, an automatic refund, or a court ruling - moves them. We
              charge nothing, hold nothing, and can move nothing.
            </p>
            <div className="land-ctas">
              <a className="land-btn primary" href={APP}>Open the app <span className="arr">→</span></a>
              <a className="land-btn ghost" href="#protocol">See the whole protocol</a>
            </div>
          </Reveal>
          <Reveal className="land-hero-side" delay={90}>
            <OrbitHero />
          </Reveal>
        </div>
      </section>

      {}
      <section className="land-stats">
        <Reveal className="land-stats-in">
          {STATS.map(([n, l]) => <div className="stat" key={l}>
              <b>{n}</b>
              <span>{l}</span>
            </div>)}
        </Reveal>
      </section>

      {}
      <section className="land-sec" id="protocol">
        <div className="land-sec-in">
          <Reveal>
            <p className="land-kicker">Public by construction</p>
            <h2 className="land-h2">The escrow is entirely on-chain.</h2>
          </Reveal>
          <Reveal className="proto-wrap" delay={60}>
            <ProtocolFlow />
          </Reveal>
          <div className="proto-points">
            {ONCHAIN.map(([t, d], i) => <Reveal className="proto-point" key={t} delay={i * 70}>
                <span className="pp-n">{i + 1}</span>
                <div><b>{t}</b><p>{d}</p></div>
              </Reveal>)}
          </div>
          <Reveal className="proto-cta">
            <a className="land-btn ghost" href={openAppHref("how")}>Read the complete protocol walkthrough <span className="arr">→</span></a>
          </Reveal>
        </div>
      </section>

      {}
      <section className="land-sec" id="rails">
        <div className="land-sec-in">
          <Reveal>
            <h2 className="land-h2">Paid your way - even cash, face to face.</h2>
            <p className="land-sub">The seller sets the fiat rail on the offer: UPI, cash deposit, cardless ATM, gift cards, or cash in person. Handles and payment references move in the sealed chat. The escrow never sees your fiat.</p>
          </Reveal>
          <Reveal className="rail-strip" delay={60}>
            {RAIL_TEASER.map(r => <span className="rail-chip" key={r.name}>
                <span className={`dot ${r.tier}`} aria-hidden="true" />
                {r.name}
              </span>)}
          </Reveal>
          <Reveal>
            <p className="rail-note">The grade is stated plainly: red means a bank account can be frozen on a complaint, amber means low exposure, green means no bank account touches the trade.</p>
          </Reveal>
          <Reveal className="cash-card" delay={90}>
            <div className="cash-contract">
              <span className="dot" aria-hidden="true" />
              <span className="name">NijiDeal · In-Person</span>
              <span className="sep">·</span>
              <span>BNB Chain · live</span>
            </div>
            <h3>Cash, in person. <em>Escrowed on-chain.</em></h3>
            <p>
              Meet at the pinned spot, watch the seller lock on-chain, hand the
              cash, get paid. The lock comes first - the cash follows it.
            </p>
            <div className="cash-tiles">
              {CASH_FEATURES.map(f => <div className="cash-tile" key={f.t}>
                  <span className="ct-ico" aria-hidden="true"><img src={f.img} alt="" width={18} height={18} draggable={false} /></span>
                  <div className="ct-txt">
                    <b>{f.t}</b>
                    <p>{f.d}</p>
                  </div>
                </div>)}
            </div>
            <div className="tl-caps" style={{
            marginTop: 12,
            marginBottom: 14
          }}>
              {CASH_CAPS.map(c => <span className="tl-cap" key={c}>{c}</span>)}
            </div>
            <div className="cash-ctas">
              <a className="land-btn primary" href={APP}>Trade cash <span className="arr">→</span></a>
              <a className="land-btn ghost" href={openAppHref("how")}>See how it works <span className="arr">→</span></a>
            </div>
          </Reveal>
        </div>
      </section>

      {}
      <section className="land-sec">
        <div className="land-sec-in">
          <Reveal className="cta-card">
            <p className="cta-eyebrow">Your account</p>
            <h2>One private code. That is the whole account.</h2>
            <p className="cta-body">
              It is created on your device the first time you sign in - no
              name, no email, no phone, and no identity file on our side. It
              is encrypted where it lives, only your backup code can restore
              it, and no reset link exists. On-chain you are a wallet address
              - pseudonymous, not invisible.
            </p>
            <div className="code-tile" aria-hidden="true">
              <div className="code-bars">
                {[0, 1, 2, 3].map(g => <span className="grp" key={g}>
                    {[0, 1, 2, 3].map(b => <i key={b} />)}
                  </span>)}
              </div>
              <span className="code-cap">your recovery code, created once, backed up by you</span>
            </div>
            <button className="land-btn onaccent" onClick={onCreate ?? (() => {
            window.location.href = APP;
          })}>Create your code <span className="arr">→</span></button>
          </Reveal>
        </div>
      </section>

      {}
      <section className="land-sec" id="how">
        <div className="land-sec-in">
          <Reveal>
            <h2 className="land-h2">Four steps from both sides.</h2>
          </Reveal>
          <div className="flow-grid hscroll">
            <Reveal className="flow-card">
              <div className="flow-head">
                <span className="flow-ico">{ICO_SELL}</span>
                <div><h3>Selling</h3><span className="flow-tag">you lock first</span></div>
              </div>
              <div className="flow-steps">
                {SELL.map(([t, d], i) => <div className="flow-step" key={t}>
                    <span className="n">{i + 1}</span>
                    <div><b>{t}</b><p>{d}</p></div>
                  </div>)}
              </div>
              <p className="flow-note ok">{SELL_NOTE}</p>
            </Reveal>
            <Reveal className="flow-card" delay={90}>
              <div className="flow-head">
                <span className="flow-ico">{ICO_BUY}</span>
                <div><h3>Buying</h3><span className="flow-tag">you verify, then pay</span></div>
              </div>
              <div className="flow-steps">
                {BUY.map(([t, d], i) => <div className="flow-step" key={t}>
                    <span className="n">{i + 1}</span>
                    <div><b>{t}</b><p>{d}</p></div>
                  </div>)}
              </div>
              <p className="flow-note">{BUY_NOTE}</p>
            </Reveal>
          </div>
        </div>
      </section>

      {}
      <section className="land-sec" id="privacy">
        <div className="land-sec-in">
          <Reveal>
            <h2 className="land-h2">What the chain sees - and what it never will.</h2>
          </Reveal>
          <Reveal className="cmp-card" delay={60}>
            <div className="cmp-half">
              <div className="cmp-head">
                <span className="cmp-ico">{ICO_EYE}</span>
                <div><h3>On the public record</h3><span className="cmp-tag">anyone can verify</span></div>
              </div>
              <ul>{SEES_PUBLIC.map(r => <li key={r}>{r}</li>)}</ul>
            </div>
            <div className="cmp-half priv">
              <div className="cmp-head">
                <span className="cmp-ico">{ICO_SEAL}</span>
                <div><h3>Sealed, off the record</h3><span className="cmp-tag">between the two of you only</span></div>
              </div>
              <ul>{STAYS_PRIVATE.map(r => <li key={r}>{r}</li>)}</ul>
            </div>
          </Reveal>
        </div>
      </section>

      {}
      <section className="land-sec" id="versus">
        <div className="land-sec-in">
          <Reveal>
            <p className="land-kicker">Versus a centralized exchange</p>
            <h2 className="land-h2">Different on purpose.</h2>
          </Reveal>
          <div className="cex-grid hscroll">
            <Reveal className="cex-card">
              <div className="cex-head"><h3>What changes</h3><span className="cex-tag">the upside, stated plainly</span></div>
              {CEX_GAINS.map(([t, d]) => <div className="cex-item gain" key={t}><span className="m">+</span><div><b>{t}</b><p>{d}</p></div></div>)}
            </Reveal>
            <Reveal className="cex-card off" delay={90}>
              <div className="cex-head"><h3>What you take on</h3><span className="cex-tag">the trade-offs, stated equally plainly</span></div>
              {CEX_TRADEOFFS.map(([t, d]) => <div className="cex-item off" key={t}><span className="m">−</span><div><b>{t}</b><p>{d}</p></div></div>)}
            </Reveal>
          </div>
        </div>
      </section>

      {}
      <section className="land-sec land-sec-last" id="faq">
        <div className="land-sec-in land-sec-narrow">
          <Reveal>
            <h2 className="land-h2">Straight answers.</h2>
          </Reveal>
          <div className="land-faq">
            {FAQ.map(([q, a], i) => <Reveal key={q} delay={i * 40}>
                <details>
                  <summary>{q}</summary>
                  <p>{a}</p>
                </details>
              </Reveal>)}
          </div>
        </div>
      </section>

      <footer className="land-footer">
        <div className="land-foot-in">
          <div className="land-foot-top">
            <a className="land-brand" href="#/">
              <LogoMark size={24} />
              <span>nijip2p</span>
            </a>
            <nav className="land-foot-links" aria-label="Footer">
              <a href={APP}>Open the app</a>
              <a href="#rails">Payments</a>
              <a href="#protocol">Protocol</a>
              <a href="#privacy">Privacy</a>
              <a href="#faq">FAQ</a>
              <a href={appHref("tos")}>Terms</a>
            </nav>
          </div>
          <LandSocial social={social} />
          <p className="land-foot-note">
            nijip2p is non-custodial, non-profit, open-source software, provided as-is. Nothing here is financial or legal advice. Use of this interface is governed by the <a href={appHref("tos")} style={{
            color: "var(--accent-ink)"
          }}>Terms of Service</a>.
          </p>
          <p className="land-foot-contracts">NijiDeal · NijiCourt</p>
        </div>
      </footer>
    </div>;
}