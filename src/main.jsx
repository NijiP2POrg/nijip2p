import "./polyfills.js";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";
import "./styles-v4.css";
import "./styles-mobile.css";
import "./styles-wallet.css";
import { hydrateSecrets, migrateLegacy } from "./lib/secrets.js";
class Boundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      err: null
    };
  }
  static getDerivedStateFromError(err) {
    return {
      err
    };
  }
  render() {
    if (this.state.err) {
      return <div className="page">
                    <h1 className="h1">Render failure</h1>
                    <pre className="note mono" style={{
          whiteSpace: "pre-wrap"
        }}>{String(this.state.err?.stack ?? this.state.err)}</pre>
                </div>;
    }
    return this.props.children;
  }
}
const LEGACY_SECRET_KEYS = ["nijip2p-account-code", "nijip2p-local-session-key"];
const boot = (async () => {
  try {
    await hydrateSecrets();
  } catch {}
  try {
    for (const k of LEGACY_SECRET_KEYS) await migrateLegacy(k);
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("nijip2p-nostr-sk-")) {
        await migrateLegacy(k);
        i--;
      }
    }
  } catch {}
})();
Promise.race([boot, new Promise(r => setTimeout(r, 4000))]).finally(() => {
  createRoot(document.getElementById("root")).render(<Boundary><App /></Boundary>);
});