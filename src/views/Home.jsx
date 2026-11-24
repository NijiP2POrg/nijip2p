import React, { useEffect, useState, useContext } from "react";
import { ethers } from "ethers";
import { AppCtx } from "../AppCtx.jsx";
import { contractAt, short } from "../lib/chain.js";
import { fmtToken, networkName } from "../lib/format.js";
import { LogoMark, Coin } from "../lib/brand.jsx";
import Account from "./Account.jsx";
import { useActivity } from "../lib/activity.js";
import { appHref } from "../lib/routes.js";
function WalletCard({
  manageOpen = false,
  onToggleManage,
  onCreate,
  children
}) {
  const {
    cfg,
    provider: p,
    me,
    session
  } = useContext(AppCtx);
  const [bal, setBal] = useState(null);
  const [dec, setDec] = useState({});
  useEffect(() => {
    let dead = false;
    const read = async () => {
      if (!me || !p || !cfg?.usdc || !cfg?.usdt) {
        setBal(null);
        return;
      }
      const out = {};
      const d = {
        ...dec
      };
      for (const k of ["usdc", "usdt"]) {
        try {
          const c = contractAt(cfg, k, p);
          const [b, dv] = await Promise.all([c.balanceOf(me), c.decimals()]);
          out[k] = b;
          d[k] = Number(dv);
        } catch {
          out[k] = null;
        }
      }
      try {
        out.native = await p.getBalance(me);
      } catch {
        out.native = null;
      }
      if (!dead) {
        setBal(out);
        setDec(d);
      }
    };
    read();
    const t = setInterval(read, 30000);
    return () => {
      dead = true;
      clearInterval(t);
    };
  }, [me, p, cfg?.usdc, cfg?.usdt]);
  const tile = (k, sym) => <div className="wc-bal" key={k}>
            <Coin id={k} size={22} title={sym} />
            <div className="wc-amt">
                <span className="v">{bal ? bal[k] !== null && bal[k] !== undefined ? fmtToken(bal[k], dec[k]) : "—" : "—"}</span>
                <span className="s">{sym}</span>
            </div>
        </div>;
  return <section className="wallet-card">
            <div className="wc-top">
                <span className="wc-brand"><LogoMark size={26} ring={false} /> nijip2p</span>
                    <span className="chip" title="The network this app is pointed at">
                        <span className={"dot " + (cfg?.mode === "live" ? "ok" : "warn")} />{cfg ? networkName(cfg) : "network"}
                    </span>
            </div>
            <div className="wc-mid">
                {me ? <div className="wc-me">
                        <div className="wc-label">Your account</div>
                        <div className="wc-addr mono" title={me}>{short(me)}</div>
                    </div> : <div className="wc-me">
                        <div className="wc-label">Read-only</div>
                        <div className="wc-addr">Sign in to publish offers, chat and settle trades.</div>
                    </div>}
                {session ? <span className="badge ok"><span className="dot" />connected</span> : null}
                {!session && onCreate ? <button className="btn primary" onClick={onCreate} title="Open the account page: create a private code or sign in with one">
                        Create account
                    </button> : null}
            </div>
            <div className="wc-bals">
                {tile("usdc", "USDC")}
                {tile("usdt", "USDT")}
                <div className="wc-bal">
                    <span className="wc-eth" aria-hidden="true">Ξ</span>
                    <div className="wc-amt">
                        <span className="v">{bal?.native ? Number(ethers.formatEther(bal.native)).toFixed(4) : "—"}</span>
                        <span className="s">for fees</span>
                    </div>
                </div>
            </div>
            {onToggleManage ? <button className="wc-manage" onClick={onToggleManage} aria-expanded={manageOpen}>
                    <span>Manage account</span>
                    <span className={"acct-chev" + (manageOpen ? " open" : "")} aria-hidden="true">▾</span>
                </button> : null}
            {children ? <div className="wc-manage-body">{children}</div> : null}
        </section>;
}
const MARKETS = [{
  href: appHref("remote"),
  coins: ["usdc", "usdt"],
  name: "Remote Escrow",
  sits: "USDC / USDT locked the moment the seller chooses - never before",
  stat: "free post",
  fact: "Lock after take"
}, {
  href: appHref("cash"),
  coins: ["usdc", "usdt"],
  name: "In-Person Escrow",
  sits: "the seller locks AT the table - you hand cash only after the chain shows the lock",
  stat: "gps venue",
  fact: "7-day window"
}];
function MarketBoard() {
  return <div className="market-grid">
            {MARKETS.map(m => <a className="market-card" key={m.href} href={m.href}>
                    <div className="mc-top">
                        <span className="mc-coins">{m.coins.map(c => <Coin key={c} id={c} size={26} title={c} />)}</span>
                        <span className="mc-live"><span className="dot" />live</span>
                    </div>
                    <div className="mc-name">{m.name}</div>
                    <div className="mc-sits">{m.sits}</div>
                    <div className="mc-foot">
                        <span className="mc-stat">{m.stat}</span>
                        <span className="mc-fact">{m.fact}</span>
                        <span className="mc-go">Open the desk →</span>
                    </div>
                </a>)}
        </div>;
}
function NeedsYou() {
  const items = useActivity();
  const [alerts, setAlerts] = useState(() => typeof Notification !== "undefined" && Notification.permission === "granted");
  const enableAlerts = async () => {
    try {
      const r = await Notification.requestPermission();
      setAlerts(r === "granted");
    } catch {}
  };
  if (!items.length) return null;
  return <div className="act-wrap">
            <div className="act-head">
                <h2 className="h2" style={{
        margin: 0
      }}>Needs you</h2>
                {typeof Notification !== "undefined" && !alerts ? <button className="btn tiny ghost" onClick={enableAlerts} title="Get a system notification when a counterparty acts while the tab is in the background">Enable alerts</button> : null}
            </div>
            {items.map(it => <a key={it.key} className={"act-row" + (it.hot ? " hot" : "")} href={appHref(it.tab)}>
                    <span className={"act-desk d-" + it.desk}>{it.desk}</span>
                    <div className="act-txt">
                        <b>{it.title}</b>
                        <span>{it.action}</span>
                    </div>
                    <span className="act-go">→</span>
                </a>)}
        </div>;
}
export default function Home({
  onCreate
}) {
  const app = useContext(AppCtx);
  const [manage, setManage] = useState(false);
  return <div>
            <WalletCard manageOpen={manage} onCreate={onCreate} onToggleManage={app?.session ? () => setManage(v => !v) : undefined}>
                {manage ? <Account embedded bare /> : null}
            </WalletCard>

            <NeedsYou />

            <h2 className="h2">Live markets</h2>
            <p className="sub">Two desks, one rule: the coin locks before any fiat moves.</p>
            <MarketBoard />

            <p className="small dim" style={{
      margin: "16px 2px 0"
    }}>
                Every rule, window and state is explained step by step on the{" "}
                <a href={appHref("how")}>How it works</a> tab.
            </p>
        </div>;
}