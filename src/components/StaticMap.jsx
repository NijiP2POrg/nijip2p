import { useLayoutEffect, useMemo, useRef, useState } from "react";
const lngToX = (lon, z) => (Number(lon) + 180) / 360 * 256 * 2 ** z;
const latToY = (lat, z) => {
  const s = Math.sin(Number(lat) * Math.PI / 180);
  const clamped = Math.max(-0.9999, Math.min(0.9999, s));
  return (0.5 - Math.log((1 + clamped) / (1 - clamped)) / (4 * Math.PI)) * 256 * 2 ** z;
};
const useDarkTheme = () => {
  const [dark, setDark] = useState(() => typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "dark");
  useLayoutEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() => setDark(el.getAttribute("data-theme") === "dark"));
    obs.observe(el, {
      attributes: true,
      attributeFilter: ["data-theme"]
    });
    return () => obs.disconnect();
  }, []);
  return dark;
};
export default function StaticMap({
  lat,
  lon,
  zoom = 15,
  height = 130,
  rect = null,
  label = "",
  className = ""
}) {
  const boxRef = useRef(null);
  const [width, setWidth] = useState(0);
  const [errs, setErrs] = useState(0);
  const dark = useDarkTheme();
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setWidth(el.getBoundingClientRect().width);
    measure();
    const obs = new ResizeObserver(measure);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  const grid = useMemo(() => {
    const la = Number(lat),
      lo = Number(lon);
    if (!Number.isFinite(la) || !Number.isFinite(lo) || !width || width < 40) return null;
    const z = Math.max(0, Math.min(19, Math.round(zoom)));
    const W = Math.round(width),
      H = Math.round(height);
    const px = lngToX(lo, z),
      py = latToY(la, z);
    const ox = px - W / 2,
      oy = py - H / 2;
    const x0 = Math.floor(ox / 256),
      x1 = Math.floor((ox + W) / 256);
    const y0 = Math.max(0, Math.floor(oy / 256)),
      y1 = Math.min(2 ** z - 1, Math.floor((oy + H) / 256));
    const tiles = [];
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        tiles.push({
          key: `${x}/${y}`,
          src: `https://tile.openstreetmap.org/${z}/${(x % 2 ** z + 2 ** z) % 2 ** z}/${y}.png`,
          left: Math.round(x * 256 - ox),
          top: Math.round(y * 256 - oy)
        });
      }
    }
    let box = null;
    if (rect) {
      const rx0 = lngToX(rect.lonMin, z) - ox,
        rx1 = lngToX(rect.lonMax, z) - ox;
      const ry0 = latToY(rect.latMax, z) - oy,
        ry1 = latToY(rect.latMin, z) - oy;
      box = {
        left: Math.round(rx0),
        top: Math.round(ry0),
        width: Math.max(8, Math.round(rx1 - rx0)),
        height: Math.max(8, Math.round(ry1 - ry0))
      };
    }
    return {
      tiles,
      box,
      total: tiles.length
    };
  }, [lat, lon, zoom, width, height, rect, dark]);
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) return null;
  const failed = grid && grid.total > 0 && errs >= grid.total;
  return <div ref={boxRef} className={"sm-box" + (dark ? " dark" : "") + (className ? " " + className : "")} style={{
    height
  }} role="img" aria-label={label || "map preview"}>
            {grid && !failed ? grid.tiles.map(t => <img key={t.key} src={t.src} alt="" width={256} height={256} loading="lazy" draggable={false} style={{
      position: "absolute",
      left: t.left,
      top: t.top
    }} onError={() => setErrs(n => n + 1)} />) : null}
            {grid && !failed && grid.box ? <span className="sm-cell" style={{
      left: grid.box.left,
      top: grid.box.top,
      width: grid.box.width,
      height: grid.box.height
    }} /> : null}
            {grid && !failed ? <span className="sm-pin" aria-hidden="true" /> : null}
            {failed ? <span className="sm-offline">map offline · {label}</span> : <span className="sm-attrib">© OpenStreetMap</span>}
        </div>;
}