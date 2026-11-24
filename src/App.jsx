import React, { useEffect, useMemo, useRef, useState } from "react";
import { loadConfig, openSession, makeProvider, contractAt, revertText, short } from "./lib/chain.js";
import { useActivity, getActivity } from "./lib/activity.js";
import { getSelectedChainId, setSelectedChainId, rpcFor, networkMeta } from "./lib/networks.js";
import NetworkSelector from "./components/NetworkSelector.jsx";
import RpcSettings from "./components/RpcSettings.jsx";
import { RelayPool, identityFor, openSealed } from "./chat/nostr.js";
import { verifyPresence } from "./chat/presence.js";
import { verifyRoomAnnouncement, ROOM_ANNOUNCE_KIND } from "./lib/simplexRoom.js";
import AuthSheet from "./components/AuthSheet.jsx";
import { LogoMark } from "./lib/brand.jsx";
import Account from "./views/Account.jsx";
import { pkFromSk } from "./chat/nostr.js";
import { currentMaterial } from "./lib/account.js";
import { arbiterAddress } from "./lib/arbiterInfo.js";
import { toast, ToastHost, ConfirmHost, PromptHost, Err, DeskGate, MobileFold } from "./lib/ui.jsx";
import { useIsMobile } from "./lib/mscreen.js";
import { networkName } from "./lib/format.js";
import Home from "./views/Home.jsx";
import Landing from "./views/Landing.jsx";
import Tos from "./views/Tos.jsx";
import HowItWorks from "./views/HowItWorks.jsx";
import NijiDesk from "./views/desks/NijiDesk.jsx";
import { verifyOfferRails, parseBoardNudge, OFFER_RAILS_KIND, BOARD_NUDGE_KIND, loadLocalAnns, saveLocalAnn, loadRailsQueue, saveRailsQueue, enqueueRailsJob } from "./lib/offerRails.js";
import { armIdleLock, takeLockNote } from "./lib/lock.js";
import { hostKind } from "./lib/routes.js";
import { RailsModalHost } from "./components/OfferRails.jsx";
export { AppCtx } from "./AppCtx.jsx";
import { AppCtx } from "./AppCtx.jsx";
const SOCIAL_ICONS = {
  chat: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 11.6c0 4.2-4 7.4-9 7.4-1 0-2-.1-2.9-.4L4 20l1.2-3.6C3.8 15.1 3 13.4 3 11.6 3 7.4 7 4.2 12 4.2s9 3.2 9 7.4z" /></svg>,
  github: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.3a9.8 9.8 0 0 0-3.1 19.1c.5.1.7-.2.7-.5v-1.8c-2.8.6-3.4-1.2-3.4-1.2-.4-1.1-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.6 1.1 1.6 1.1.9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.2-.4-1.2.1-2.6 0 0 .9-.3 2.8 1a9.4 9.4 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.6.6.7 1 1.6 1 2.7 0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.9v2.7c0 .3.2.6.7.5A9.8 9.8 0 0 0 12 2.3z" /></svg>,
  x: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.8 3h3.1l-6.8 7.8L22 21h-6.3l-4.9-6.4L5.2 21H2.1l7.3-8.3L2 3h6.4l4.4 5.9L17.8 3zm-1.1 16.1h1.7L7.6 4.7H5.8l10.9 14.4z" /></svg>,
  simplex: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20.5 4.5h-17c-.55 0-1 .45-1 1v9c0 .55.45 1 1 1h2.9l-1.1 3.7 4.3-3.7h10.9c.55 0 1-.45 1-1v-9c0-.55-.45-1-1-1z" /><path d="M9.4 7.9l5.2 5.2M14.6 7.9l-5.2 5.2" /></svg>,
  telegram: <img src="./assets/icons/telegram.png" width="18" height="18" alt="" aria-hidden="true" draggable={false} />
};
const socialLinks = soc => [{
  key: "chat",
  name: "Community chat",
  url: soc?.chat ?? ""
}, {
  key: "simplex",
  name: "SimpleX",
  url: soc?.simplex ?? ""
}, {
  key: "telegram",
  name: "Telegram",
  url: soc?.telegram ?? ""
}, {
  key: "github",
  name: "GitHub",
  url: soc?.github ?? ""
}, {
  key: "x",
  name: "X",
  url: soc?.x ?? ""
}];
const TABS = [["home", "Overview"], ["remote", "Remote Escrow"], ["cash", "In-Person Cash"], ["how", "How it works"]];
const TAB_IDS = TABS.map(([id]) => id);
function tabFromPath() {
  let p = "";
  try {
    p = String(window.location.pathname || "/");
  } catch {
    return "home";
  }
  const seg = p.replace(/^\/+/, "").replace(/\/+$/, "").split("/")[0].toLowerCase();
  if (seg === "tos") return "tos";
  return TAB_IDS.includes(seg) ? seg : "home";
}
function routeFromHash() {
  const host = hostKind();
  let h = "";
  try {
    h = window.location.hash || "";
  } catch {}
  if (host === "app") {
    if (h.startsWith("#/tos")) return {
      view: "tos",
      tab: "home"
    };
    const fromHash = h.startsWith("#/app") ? h.slice(5).replace(/^\/+/, "") : "";
    if (TAB_IDS.includes(fromHash)) return {
      view: "app",
      tab: fromHash
    };
    const t = tabFromPath();
    if (t === "tos") return {
      view: "tos",
      tab: "home"
    };
    return {
      view: "app",
      tab: t
    };
  }
  if (host === "other" && h.startsWith("#/app")) {
    const t = h.slice(5).replace(/^\/+/, "");
    return {
      view: "app",
      tab: TAB_IDS.includes(t) ? t : "home"
    };
  }
  return {
    view: "landing",
    tab: "home"
  };
}
const BN_SHORT = {
  home: "Home",
  remote: "Remote",
  cash: "Cash",
  how: "How"
};
const BN_ICONS = {
  home: <>
            <img className="tbi" src="./assets/icons/tab-home.png" width="22" height="22" alt="" draggable={false} />
            <img className="tbi-on" src="./assets/icons/tab-home-on.png" width="22" height="22" alt="" draggable={false} />
        </>,
  remote: <>
            <img className="tbi" src="./assets/icons/tab-stables.png" width="22" height="22" alt="" draggable={false} />
            <img className="tbi-on" src="./assets/icons/tab-stables-on.png" width="22" height="22" alt="" draggable={false} />
        </>,
  cash: <>
            <img className="tbi" src="./assets/icons/tab-cash.png" width="22" height="22" alt="" draggable={false} />
            <img className="tbi-on" src="./assets/icons/tab-cash-on.png" width="22" height="22" alt="" draggable={false} />
        </>,
  how: <>
            <img className="tbi" src="./assets/icons/tab-how.png" width="22" height="22" alt="" draggable={false} />
            <img className="tbi-on" src="./assets/icons/tab-how-on.png" width="22" height="22" alt="" draggable={false} />
        </>
};
const initialTheme = () => {
  try {
    const saved = localStorage.getItem("nijip2p-theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch {}
  return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};
function buildActiveConfig(raw, chainId, rpcUrl) {
  if (!raw) return null;
  const id = Number(chainId);
  if (id === Number(raw.chainId)) return {
    ...raw,
    chainId: id,
    rpcUrl,
    deployed: true
  };
  const alt = raw.networks?.[String(id)];
  if (alt) return {
    ...alt,
    chainId: id,
    rpcUrl,
    deployed: true,
    network: alt.network ?? raw.network,
    relays: alt.relays ?? raw.relays ?? [],
    simplexBotPubkey: alt.simplexBotPubkey ?? raw.simplexBotPubkey ?? "",
    social: alt.social ?? raw.social ?? null
  };
  const meta = networkMeta(id);
  return {
    chainId: id,
    rpcUrl,
    network: meta?.name ?? "Unknown network",
    mode: "mainnet",
    deployed: false,
    relays: []
  };
}
export default function App() {
  const [rawConfig, setRawConfig] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [rpcUrl, setRpcUrl] = useState("");
  const [cfgErr, setCfgErr] = useState("");
  const [session, setSession] = useState(null);
  const [tab, setTab] = useState(() => routeFromHash().tab);
  const [route, setRoute] = useState(routeFromHash);
  const [relay, setRelay] = useState(null);
  const [relayStatus, setRelayStatus] = useState({});
  const [inbox, setInbox] = useState([]);
  const [presence, setPresence] = useState({});
  const absorbPresence = p => setPresence(prev => {
    const tid = String(p.tradeId);
    const t = {
      ...(prev[tid] ?? {})
    };
    const all = Array.isArray(t._all) ? [...t._all] : [];
    const k = p.role + "|" + p.npub;
    if (!all.some(x => x.role + "|" + x.npub === k)) all.push({
      role: p.role,
      address: p.address,
      npub: p.npub,
      at: p.at
    });
    t._all = all.slice(-40);
    const cur = t[p.role];
    if (cur?.npub === p.npub) return {
      ...prev,
      [tid]: t
    };
    t[p.role] = {
      address: p.address,
      npub: p.npub,
      at: p.at
    };
    return {
      ...prev,
      [tid]: t
    };
  });
  const [offerAnns, setOfferAnns] = useState(() => {
    try {
      return loadLocalAnns();
    } catch {
      return {};
    }
  });
  const [boardNudge, setBoardNudge] = useState(null);
  const [rooms, setRooms] = useState({});
  const presenceWarned = useRef(new Set());
  const [identity, setIdentity] = useState(null);
  const [acctOpen, setAcctOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [theme, setTheme] = useState(initialTheme);
  const [guestHidden, setGuestHidden] = useState(() => {
    try {
      return sessionStorage.getItem("nijip2p-guestbar") === "hide";
    } catch {
      return false;
    }
  });
  const [netErr, setNetErr] = useState("");
  const [rpcOpen, setRpcOpen] = useState(false);
  const activeChainId = chainId;
  const activeRpcUrl = rpcUrl;
  const cfg = useMemo(() => buildActiveConfig(rawConfig, activeChainId, activeRpcUrl), [rawConfig, activeChainId, activeRpcUrl]);
  const provider = useMemo(() => cfg && cfg.rpcUrl ? makeProvider(cfg) : null, [cfg]);
  const acts = useActivity();
  const actTabs = useMemo(() => new Set(acts.map(a => a.tab)), [acts]);
  const seenActs = useRef(null);
  useEffect(() => {
    if (seenActs.current === null) {
      seenActs.current = new Set(acts.map(a => a.key));
      return;
    }
    const fresh = acts.filter(a => !seenActs.current.has(a.key));
    fresh.forEach(a => seenActs.current.add(a.key));
    const relevant = fresh.filter(a => a.tab !== tab);
    if (!relevant.length) return;
    const a = relevant.find(x => x.hot) ?? relevant[0];
    toast("Needs you · " + a.title, {
      body: a.action,
      tone: "warn",
      timeout: 7000
    });
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) {
        new Notification("nijip2p - " + a.title, {
          body: a.action
        });
      }
    } catch {}
  }, [acts, tab]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("nijip2p-theme", theme);
    } catch {}
  }, [theme]);
  useEffect(() => {
    const onHash = () => {
      const r = routeFromHash();
      setRoute(r);
      if (r.view === "app") setTab(r.tab);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const goTab = id => {
    setTab(id);
    setRoute({
      view: "app",
      tab: id
    });
    try {
      if (hostKind() === "app") {
        history.replaceState(null, "", id === "home" ? "/" : "/" + id);
      } else {
        history.replaceState(null, "", "#/app/" + id);
      }
    } catch {}
  };
  useEffect(() => {
    try {
      window.scrollTo({
        top: 0,
        behavior: "instant"
      });
    } catch {
      window.scrollTo(0, 0);
    }
    setAcctOpen(false);
  }, [tab, route.view]);
  useEffect(() => {
    loadConfig().then(c => {
      setRawConfig(c);
      const isSandbox = c.network === "local" || c.mode === "local";
      const sel = isSandbox ? Number(c.chainId) : getSelectedChainId(c.chainId);
      const url = isSandbox ? c.rpcUrl || rpcFor(sel) : rpcFor(sel);
      setChainId(sel);
      setRpcUrl(url);
    }).catch(e => setCfgErr(e.message));
  }, []);
  useEffect(() => {
    if (takeLockNote()) toast("Locked", {
      body: "This device locked after inactivity. Sign in with your anonymous code to continue.",
      tone: "warn"
    });
  }, []);
  useEffect(() => {
    if (!cfg) return;
    let pref = null;
    try {
      pref = localStorage.getItem("nijip2p-session-pref");
    } catch {}
    let dead = false;
    openSession(cfg).then(s => {
      if (!dead) setSession(s);
    }).catch(e => {
      if (!dead) setCfgErr(revertText(e));
    });
    return () => {
      dead = true;
    };
  }, [cfg]);
  useEffect(() => {
    if (session?.kind !== "code") return;
    return armIdleLock();
  }, [session?.kind]);
  const [isArbiter, setIsArbiter] = useState(false);
  useEffect(() => {
    if (!cfg || !session) {
      setIsArbiter(false);
      return;
    }
    let dead = false;
    (async () => {
      try {
        const arb = contractAt(cfg, "court", provider);
        const yes = await arb.isArbiter(session.address);
        if (!dead) setIsArbiter(!!yes);
      } catch {
        if (!dead) setIsArbiter(false);
      }
    })();
    return () => {
      dead = true;
    };
  }, [cfg, provider, session?.address]);
  const role = isArbiter ? "Arbiter" : "Trader";
  useEffect(() => {
    if (!cfg || !session) {
      setIdentity(null);
      return;
    }
    if (session.kind === "code") {
      let dead = false;
      currentMaterial().then(m => {
        if (!dead && m) setIdentity({
          sk: m.nostrSk,
          pk: pkFromSk(m.nostrSk)
        });
      });
      return () => {
        dead = true;
      };
    }
    setIdentity(identityFor(session.address));
  }, [cfg, session?.address, session?.kind]);
  useEffect(() => {
    if (!cfg) return;
    const pool = new RelayPool((url, st) => setRelayStatus(s => ({
      ...s,
      [url]: st
    })));
    setRelay(pool);
    pool.connect(cfg.relays ?? []);
    const filters = [{
      kinds: [20001],
      since: Math.floor(Date.now() / 1000) - 86400 * 7
    }];
    filters.push({
      kinds: [OFFER_RAILS_KIND],
      since: Math.floor(Date.now() / 1000) - 86400 * 7
    });
    if (identity) filters.push({
      kinds: [1059],
      "#p": [identity.pk],
      since: Math.floor(Date.now() / 1000) - 86400 * 7
    });
    if (cfg.simplexBotPubkey) filters.push({
      kinds: [ROOM_ANNOUNCE_KIND],
      since: Math.floor(Date.now() / 1000) - 86400 * 7
    });
    filters.push({
      kinds: [BOARD_NUDGE_KIND],
      since: Math.floor(Date.now() / 1000) - 300
    });
    pool.subscribe(filters);
    pool.handlers.add(ev => {
      if (cfg.simplexBotPubkey && ev.kind === ROOM_ANNOUNCE_KIND) {
        const ann = verifyRoomAnnouncement(ev, cfg.simplexBotPubkey);
        if (ann) {
          const key = ann.chain + ":" + ann.tradeId + ":" + String(ann.contract).toLowerCase();
          setRooms(prev => (prev[key]?.at ?? 0) >= ann.at ? prev : {
            ...prev,
            [key]: ann
          });
        }
        return;
      }
      const nudge = parseBoardNudge(ev);
      if (nudge) {
        setBoardNudge(prev => nudge.at >= (prev?.at ?? 0) ? nudge : prev);
        return;
      }
      const railAnn = verifyOfferRails(ev);
      if (railAnn) {
        const key = railAnn.desk + "|" + railAnn.chainId + "|" + railAnn.offerId;
        setOfferAnns(prev => (prev[key]?.at ?? 0) >= railAnn.at ? prev : {
          ...prev,
          [key]: railAnn
        });
        saveLocalAnn(railAnn);
        return;
      }
      const p = verifyPresence(ev);
      if (p) {
        absorbPresence(p);
        return;
      }
      const opened = identity ? openSealed(ev, identity.sk) : null;
      if (opened?.payload) {
        if (opened.authOk === false) return;
        const pl = opened.payload;
        if (pl?.tradeId && pl?.from) {
          const claimed = String(pl.from);
          if (claimed !== "Arbiter") {
            setPresence(prev => {
              const tid = String(pl.tradeId);
              const t = {
                ...(prev[tid] ?? {})
              };
              const all = Array.isArray(t._all) ? [...t._all] : [];
              const k = claimed + "|" + ev.pubkey;
              if (!all.some(x => x.role + "|" + x.npub === k)) all.push({
                role: claimed,
                address: null,
                npub: ev.pubkey,
                at: Date.now(),
                learnedFromChat: true
              });
              t._all = all.slice(-40);
              if (t[claimed]?.npub === ev.pubkey) return {
                ...prev,
                [tid]: t
              };
              t[claimed] = {
                address: t[claimed]?.address ?? null,
                npub: ev.pubkey,
                at: Date.now(),
                learnedFromChat: true
              };
              return {
                ...prev,
                [tid]: t
              };
            });
          }
        }
        setInbox(prev => [...prev.slice(-200), {
          ...opened,
          event: ev,
          mine: false,
          at: Date.now()
        }]);
      }
    });
    return () => pool.close();
  }, [cfg, identity?.pk]);
  const publishPresence = async (tradeId, tradeRole) => {
    const {
      publishPresence: pub
    } = await import("./chat/presence.js");
    try {
      await pub({
        relay,
        identity,
        session,
        tradeId,
        role: tradeRole
      });
    } catch (e) {
      const k = tradeId + "|" + tradeRole;
      if (!presenceWarned.current.has(k)) {
        presenceWarned.current.add(k);
        toast("Your chat key was not announced", {
          body: "The signature request was declined. Open the trade chat once - it announces on open - or answer a message. Chat still works without it.",
          tone: "warn",
          timeout: 6000
        });
      }
    }
  };
  const publishOfferRails = async ({
    desk,
    offerId,
    rails,
    custom,
    city,
    state,
    rate,
    cell
  }) => {
    const {
      signAndPublishOfferRails
    } = await import("./lib/offerRails.js");
    const {
      ann,
      sent
    } = await signAndPublishOfferRails({
      relay,
      identity,
      session,
      desk,
      chainId: cfg.chainId,
      offerId,
      rails,
      custom,
      city,
      state,
      rate,
      cell
    });
    const key = desk + "|" + Number(cfg.chainId) + "|" + ann.offerId;
    setOfferAnns(prev => ({
      ...prev,
      [key]: ann
    }));
    saveLocalAnn(ann);
    if (!sent) enqueueRailsJob({
      desk,
      offerId: String(offerId),
      rails,
      custom,
      city,
      state,
      rate,
      cell
    });
    return {
      ...ann,
      sent
    };
  };
  const queueOfferRails = async ({
    desk,
    offerId,
    rails,
    custom,
    city,
    state,
    rate,
    cell
  }) => {
    enqueueRailsJob({
      desk,
      offerId: String(offerId),
      rails,
      custom,
      city,
      state,
      rate,
      cell
    });
    drainRailsQueue();
  };
  const drainingRef = useRef(false);
  const drainRailsQueue = async () => {
    if (drainingRef.current) return;
    if (!session || session.kind !== "code") return;
    const open = Object.values(relayStatus ?? {}).some(s => s === "open");
    if (!open || !relay || !identity) return;
    const q = loadRailsQueue();
    if (!q.length) return;
    drainingRef.current = true;
    const done = [];
    try {
      let rest = q;
      while (rest.length) {
        const job = rest[0];
        try {
          await publishOfferRails(job);
          done.push(job);
          rest = rest.slice(1);
          saveRailsQueue(rest);
        } catch {
          break;
        }
      }
    } finally {
      drainingRef.current = false;
    }
    if (done.length) {
      toast("Payment rails published", {
        body: done.length === 1 ? "The rail declaration for offer #" + done[0].offerId + " went out once the relay reconnected." : done.length + " rail declarations went out once the relay reconnected.",
        tone: "ok"
      });
    }
  };
  useEffect(() => {
    drainRailsQueue();
  }, [relayStatus, relay, identity, session?.address]);
  useEffect(() => {
    const t = setInterval(() => drainRailsQueue(), 20000);
    return () => clearInterval(t);
  }, []);
  const disconnect = () => {
    try {
      localStorage.removeItem("nijip2p-session-pref");
    } catch {}
    setSession(null);
    setIdentity(null);
    toast("Signed out", {
      body: "The page continues in read-only mode.",
      tone: "ok",
      timeout: 2400
    });
  };
  const switchNetwork = async id => {
    setNetErr("");
    const meta = networkMeta(id);
    if (!meta) return;
    setChainId(id);
    setRpcUrl(rpcFor(id));
    setSelectedChainId(id);
  };
  const applyRpc = url => {
    setRpcUrl(url);
  };
  const deployedChainIds = useMemo(() => {
    if (!rawConfig) return [];
    const ids = [Number(rawConfig.chainId)];
    if (rawConfig.networks) for (const k of Object.keys(rawConfig.networks)) ids.push(Number(k));
    return ids;
  }, [rawConfig]);
  const queryPresenceFor = async tradeId => {
    if (!relay || tradeId == null) return 0;
    let evs = [];
    try {
      evs = await relay.query({
        kinds: [20001],
        "#t": ["trade:" + String(tradeId)]
      }, 3500);
    } catch {
      return 0;
    }
    for (const ev of evs) {
      const p = verifyPresence(ev);
      if (p) absorbPresence(p);
    }
    return evs.length;
  };
  const queryRailAnnFor = async (desk, chainId, offerId) => {
    if (!relay || offerId == null) return 0;
    let evs = [];
    try {
      evs = await relay.query({
        kinds: [OFFER_RAILS_KIND],
        "#t": ["offer:" + String(offerId)],
        since: Math.floor(Date.now() / 1000) - 86400 * 30
      }, 3500);
    } catch {
      return 0;
    }
    for (const ev of evs) {
      const ann = verifyOfferRails(ev);
      if (!ann) continue;
      const key = ann.desk + "|" + ann.chainId + "|" + ann.offerId;
      setOfferAnns(prev => (prev[key]?.at ?? 0) >= ann.at ? prev : {
        ...prev,
        [key]: ann
      });
      saveLocalAnn(ann);
    }
    return evs.length;
  };
  const ctx = useMemo(() => ({
    cfg,
    provider,
    session,
    me: session?.address ?? null,
    role,
    relay,
    relayStatus,
    identity,
    inbox,
    setInbox,
    presence,
    publishPresence,
    offerAnns,
    publishOfferRails,
    queueOfferRails,
    rooms,
    boardNudge,
    queryPresenceFor,
    queryRailAnnFor
  }), [cfg, provider, session, role, relay, relayStatus, identity, inbox, presence, offerAnns, rooms, boardNudge]);
  const isM = useIsMobile();
  if (route.view === "landing") {
    return <>
                <Landing social={rawConfig?.social ?? null} onCreate={() => setAuthOpen(true)} />
                <ToastHost />
                <ConfirmHost />
            </>;
  }
  if (route.view === "tos") {
    return <>
                <Tos social={rawConfig?.social ?? null} />
                <ToastHost />
                <ConfirmHost />
            </>;
  }
  if (cfgErr) {
    return <div className="page">
                <h1 className="h1">The deployment file failed to load</h1>
                <p className="lead">
                    This app reads contract addresses from <span className="mono">config.json</span> next to the page.
                    Restore it from the deployment record (<span className="mono">deployments/&lt;network&gt;.json</span>) and reload.
                </p>
                <Err text={cfgErr} />
            </div>;
  }
  if (!cfg || !provider) {
    return <div className="page">
                <div className="skel" style={{
        width: 220,
        height: 26
      }} />
                <div className="skel mt16" style={{
        width: "70%"
      }} />
                <div className="skel mt8" style={{
        width: "55%"
      }} />
            </div>;
  }
  const relayOpen = Object.values(relayStatus).filter(s => s === "open").length;
  const relayTotal = (cfg.relays ?? []).length;
  const views = {
    home: <Home onCreate={() => setAuthOpen(true)} />,
    remote: <NijiDesk key="desk-remote" cash={false} />,
    cash: <NijiDesk key="desk-cash" cash={true} />,
    how: <HowItWorks />
  };
  const openAuth = () => setAuthOpen(true);
  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(session.address);
      toast("Address copied", {
        body: short(session.address) + " is on your clipboard.",
        tone: "ok"
      });
    } catch {
      toast("Copy failed", {
        body: "The browser refused the clipboard - long-press the address instead.",
        tone: "warn"
      });
    }
  };
  const acctControls = session ? <>
            {}
            <button className="addr-chip" onClick={copyAddress} title={"Your address, tap to copy" + (isArbiter ? " (arbiter)" : "")}>
                <span className={"dot" + (isArbiter ? " warn" : "")} />{short(session.address)}{isArbiter ? " · arbiter" : ""}
            </button>
            <button className="icon-btn" onClick={disconnect} title="Disconnect and keep browsing read-only" aria-label="Sign out">⏏</button>
        </> : <button className="topbar-btn primary" onClick={openAuth} title="Create or sign in to an anonymous account stored in this browser">
            Sign in
        </button>;
  return <AppCtx.Provider value={ctx}>
            <header className="topbar">
                <div className="topbar-inner">
                    <span className="brand" onClick={() => goTab("home")} role="button" tabIndex={0} onKeyDown={e => e.key === "Enter" && goTab("home")}>
                        <LogoMark size={21} ring={false} className="brand-mark" />
                        nijip2p
                    </span>
                    {}
                    {isM ? <span className="m-desk-name">{TABS.find(([id]) => id === tab)?.[1] ?? ""}</span> : null}
                    <span className="spacer" />
                    <span className="chip hide-sm" title={"Encrypted chat relays reachable: " + relayOpen + " of " + relayTotal + ". Chat needs at least one."}>
                        <span className={"dot " + (relayOpen > 0 ? "ok" : relayTotal ? "bad" : "")} />
                        Chat relays {relayOpen}/{relayTotal}
                    </span>
                    <NetworkSelector chainId={cfg.chainId} mode={cfg.mode} deployedChainIds={deployedChainIds} onSelect={switchNetwork} onOpenRpc={() => setRpcOpen(true)} />
                    {netErr ? <span className="chip" title={netErr} style={{
          color: "#f28b7d"
        }}>Network problem - hover for details</span> : null}
                    {isM ? null : acctControls}
                    <button className="icon-btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} aria-label="Switch color theme">
                        {theme === "dark" ? "☀" : "☾"}
                    </button>
                    {acctOpen ? !session ? <AuthSheet onClose={() => setAcctOpen(false)} /> : <Account onClose={() => setAcctOpen(false)} /> : null}
                    {authOpen ? <AuthSheet onClose={() => setAuthOpen(false)} /> : null}
                    {rpcOpen ? <RpcSettings chainId={cfg.chainId} onClose={() => setRpcOpen(false)} onApplied={applyRpc} /> : null}
                </div>
            </header>
            <nav className="nav">
                <div className="nav-inner" role="tablist">
                    {TABS.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} className={"nav-tab" + (tab === id ? " on" : "")} onClick={() => goTab(id)}>
                            {label}
                        </button>)}
                </div>
            </nav>
            {!session && !guestHidden ? <div className="guestbar">
                    <span className="gb-text">
                        Read-only. Sign in to publish offers, chat, and settle trades.
                    </span>
                    <button className="gb-close" aria-label="Dismiss the read-only notice" onClick={() => {
        try {
          sessionStorage.setItem("nijip2p-guestbar", "hide");
        } catch {}
        setGuestHidden(true);
      }}>✕</button>
                </div> : null}
            {isM ? <div className="m-actions">
                    {session ? acctControls : <button className="topbar-btn primary" onClick={openAuth} title="Create or sign in to an anonymous account stored in this browser">
                            Sign in
                        </button>}
                </div> : null}
            <main className="page">
                {cfg.deployed === false ? <div>
                        <h1 className="h1">No nijip2p contracts on {networkName(cfg)} yet</h1>
                        <p className="lead">
                            There is no deployment record for {networkName(cfg)}. The loaded config contains no contract or token
                            addresses for it. The app will not guess addresses, so trading stays off until a real deployment
                            record is added.
                        </p>
                        <div className="note warn">
                            <b>What this means:</b> switching networks and setting an RPC endpoint still work, but there is nothing to read
                            or write on {networkName(cfg)} because no verified contract addresses exist. Deploy the contracts on this chain,
                            add its <span className="mono">deployments/&lt;network&gt;.json</span> record, then reload.
                        </div>
                    </div> : views[tab]}
            </main>
            <nav className="bottomnav" aria-label="App sections">
                <div className="bn-in">
                    {TABS.map(([id]) => <button key={id} className={"bn-item" + (tab === id ? " on" : "")} onClick={() => goTab(id)} aria-label={BN_SHORT[id]} aria-current={tab === id ? "page" : undefined}>
                            <span className="bn-ico" aria-hidden="true">{BN_ICONS[id]}{actTabs.has(id) ? <span className="bn-dot" /> : null}</span>
                            <span>{BN_SHORT[id]}</span>
                        </button>)}
                </div>
            </nav>
            <footer className="footer">
                <div className="footer-inner">
                    <span>Open source. Non-custodial. The contracts take no cut.</span>
                    <span className="socials" aria-label="Community links">
                        {socialLinks(cfg.social).map(s => s.url ? <a key={s.key} className="soc-ico" href={s.url} target="_blank" rel="noreferrer noopener" title={s.name} aria-label={s.name}>
                                    {SOCIAL_ICONS[s.key]}
                                </a> : <span key={s.key} className="soc-ico soc-soon" title={s.name + " - link coming soon"} aria-label={s.name + " (link coming soon)"} aria-disabled="true">
                                    {SOCIAL_ICONS[s.key]}
                                </span>)}
                    </span>
                    <span className="spacer" />
                    <span>{networkName(cfg)}</span>
                </div>
            </footer>
            <ToastHost />
            <ConfirmHost />
            <PromptHost />
            <RailsModalHost />
        </AppCtx.Provider>;
}