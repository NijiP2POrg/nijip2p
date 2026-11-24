import { ethers } from "ethers";
import { withTimeout, isRangeError } from "./rpc.js";
export const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11";
const MC = new ethers.Interface(["function tryAggregate(bool requireSuccess, tuple(address target, bytes callData)[] calls) returns (tuple(bool success, bytes returnData)[] returnData)"]);
const SELECTOR = MC.getFunction("tryAggregate").selector;
async function individual(provider, calls, blockTag) {
  const out = new Array(calls.length);
  for (let i = 0; i < calls.length; i += 1) {
    const c = calls[i];
    try {
      const data = await withTimeout(provider.call({
        to: c.target,
        data: c.data,
        ...(blockTag != null ? {
          blockTag
        } : {})
      }), 20000, "read " + (c.label || "call"));
      out[i] = {
        success: true,
        returnData: data
      };
    } catch {
      out[i] = {
        success: false,
        returnData: "0x"
      };
    }
  }
  return out;
}
async function runChunk(provider, address, part, blockTag) {
  const payload = part.map(c => ({
    target: c.target,
    callData: c.data
  }));
  let data;
  try {
    data = MC.encodeFunctionData("tryAggregate", [false, payload]);
  } catch {
    return individual(provider, part, blockTag);
  }
  try {
    const raw = await withTimeout(provider.call({
      to: address,
      data,
      ...(blockTag != null ? {
        blockTag
      } : {})
    }), 25000, "multicall");
    if (!raw || raw === "0x") return individual(provider, part, blockTag);
    const [results] = MC.decodeFunctionResult("tryAggregate", raw);
    if (!results || results.length !== part.length) return individual(provider, part, blockTag);
    return part.map((_, i) => ({
      success: Boolean(results[i]?.[0] ?? results[i]?.success),
      returnData: results[i]?.[1] ?? results[i]?.returnData ?? "0x"
    }));
  } catch (e) {
    if (isRangeError(e)) throw e;
    return individual(provider, part, blockTag);
  }
}
export async function aggregateReads(provider, address, calls, {
  chunk = 150,
  concurrency = 4,
  blockTag
} = {}) {
  if (!calls?.length) return [];
  const out = new Array(calls.length);
  const parts = [];
  for (let i = 0; i < calls.length; i += chunk) parts.push([i, calls.slice(i, i + chunk)]);
  let cursor = 0;
  const workers = Array.from({
    length: Math.min(concurrency, parts.length)
  }, async () => {
    while (cursor < parts.length) {
      const [start, part] = parts[cursor];
      cursor += 1;
      let res;
      try {
        res = await runChunk(provider, address, part, blockTag);
      } catch {
        res = await individual(provider, part, blockTag);
      }
      for (let i = 0; i < res.length; i += 1) out[start + i] = res[i];
    }
  });
  await Promise.all(workers);
  return out;
}
export { SELECTOR };