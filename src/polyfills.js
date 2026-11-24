import { Buffer } from "buffer";
if (typeof window !== "undefined") {
  if (!window.global) window.global = window;
  if (!window.Buffer) window.Buffer = Buffer;
  if (!window.process) {
    window.process = {
      env: {},
      browser: true,
      version: "",
      versions: {
        node: ""
      },
      platform: "browser",
      nextTick: (fn, ...args) => setTimeout(() => fn(...args), 0),
      cwd: () => "/"
    };
  }
}