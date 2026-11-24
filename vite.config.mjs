import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { transform } from "esbuild";
const CRITICAL = ["src/lib/account.js", "src/lib/secrets.js", "src/lib/lock.js", "src/lib/chain.js", "src/lib/rpc.js", "src/lib/multicall.js", "src/lib/board.js", "src/lib/boardStore.js", "src/lib/format.js", "src/components/SendAll.jsx", "src/components/AuthSheet.jsx", "src/views/Account.jsx", "src/views/desks/NijiDesk.jsx", "src/chat/presence.js", "src/lib/offerRails.js", "src/components/SimplexRoom.jsx", "src/lib/tgRoom.js", "src/lib/ui.jsx", "src/lib/paymentRails.js"];
const CRITICAL_RE = new RegExp("(" + CRITICAL.map(f => f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\//g, "[/\\\\]")).join("|") + ")$");
function selectiveMinify() {
  return {
    name: "selective-minify",
    apply: "build",
    enforce: "post",
    renderChunk: {
      order: "post",
      async handler(code, chunk) {
        if (chunk.name === "critical") {
          return {
            code: code.replace(/\/\*\s*@__PURE__\s*\*\//g, ""),
            map: null
          };
        }
        const out = await transform(code, {
          minify: true,
          target: "es2020",
          loader: "js",
          legalComments: "none"
        });
        return {
          code: out.code,
          map: null
        };
      }
    }
  };
}
export default defineConfig({
  plugins: [react(), nodePolyfills({
    include: ["buffer", "crypto", "stream", "util", "path", "events", "http", "https", "fs", "process"]
  }), selectiveMinify()],
  define: {
    global: "globalThis",
    "process.env": "{}"
  },
  base: "./",
  server: {
    proxy: {
      "/rpc": {
        target: "http://127.0.0.1:8545",
        changeOrigin: true,
        rewrite: p => p.replace(/^\/rpc/, "")
      },
      "/nostr": {
        target: "ws://127.0.0.1:8546",
        ws: true
      }
    }
  },
  build: {
    outDir: "dist",
    minify: false,
    sourcemap: false,
    chunkSizeWarningLimit: 4e3,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const norm = id.replace(/\\/g, "/");
          if (norm.includes("node_modules/three")) return "hero3d";
          if (norm.includes("node_modules")) return "vendor";
          if (CRITICAL_RE.test(norm)) return "critical";
        }
      }
    }
  }
});