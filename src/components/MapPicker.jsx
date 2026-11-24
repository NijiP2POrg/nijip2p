import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "../lib/ui.jsx";
const INDIA = [20.5937, 78.9629];
const pinIcon = () => L.divIcon({
  className: "",
  iconSize: [26, 40],
  iconAnchor: [13, 38],
  html: `<div style="position:relative;width:26px;height:40px;filter:drop-shadow(0 3px 4px rgba(0,0,0,.45))">
             <div style="position:absolute;inset:0 0 8px 0;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:linear-gradient(145deg,#ff5470,#c2183a);border:2px solid #fff"></div>
             <div style="position:absolute;left:8px;top:7px;width:10px;height:10px;border-radius:50%;background:#fff"></div>
           </div>`
});
export default function MapPicker({
  open,
  initial,
  onClose,
  onPick
}) {
  const boxRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const layerRef = useRef(null);
  const [pos, setPos] = useState(initial ?? null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState("");
  const [base, setBase] = useState("osm");
  const [manual, setManual] = useState({
    lat: "",
    lon: ""
  });
  useEffect(() => {
    if (!open) return;
    setPos(initial ?? null);
    setResults([]);
    setQuery("");
    setSearchErr("");
    setManual({
      lat: "",
      lon: ""
    });
    const t = setTimeout(() => {
      if (!boxRef.current || mapRef.current) return;
      const map = L.map(boxRef.current, {
        center: initial ? [initial.lat, initial.lon] : INDIA,
        zoom: initial ? 16 : 5,
        zoomControl: true,
        attributionControl: true
      });
      mapRef.current = map;
      const layers = {
        osm: L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "© OpenStreetMap contributors"
        }),
        google: L.tileLayer("https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
          subdomains: ["0", "1", "2", "3"],
          maxZoom: 19,
          attribution: "© Google"
        })
      };
      layerRef.current = layers[base];
      layers[base].addTo(map);
      map.on("click", e => place(e.latlng.lat, e.latlng.lng));
      setTimeout(() => map.invalidateSize(), 60);
    }, 30);
    return () => {
      clearTimeout(t);
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch {}
      }
      mapRef.current = null;
      markerRef.current = null;
      layerRef.current = null;
    };
  }, [open]);
  const swapBase = k => {
    setBase(k);
    const map = mapRef.current;
    if (!map) return;
    if (layerRef.current) map.removeLayer(layerRef.current);
    layerRef.current = L.tileLayer(k === "google" ? "https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" : "https://tile.openstreetmap.org/{z}/{x}/{y}.png", k === "google" ? {
      subdomains: ["0", "1", "2", "3"],
      maxZoom: 19,
      attribution: "© Google"
    } : {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors"
    });
    layerRef.current.addTo(map);
  };
  const place = (lat, lon) => {
    const p = {
      lat: Number(lat),
      lon: Number(lon)
    };
    setPos(p);
    setManual({
      lat: p.lat.toFixed(6),
      lon: p.lon.toFixed(6)
    });
    const map = mapRef.current;
    if (!map) return;
    if (!markerRef.current) {
      markerRef.current = L.marker([p.lat, p.lon], {
        icon: pinIcon(),
        draggable: true
      }).addTo(map);
      markerRef.current.on("dragend", e => {
        const ll = e.target.getLatLng();
        place(ll.lat, ll.lng);
      });
    } else {
      markerRef.current.setLatLng([p.lat, p.lon]);
    }
  };
  const search = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchErr("");
    setResults([]);
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=6&accept-language=en&q=${encodeURIComponent(q)}`, {
        headers: {
          Accept: "application/json"
        }
      });
      const rows = await r.json();
      setResults(Array.isArray(rows) ? rows : []);
      if (!rows?.length) setSearchErr("Nothing found for that name - try a street, landmark or 'area, city'.");
    } catch {
      setSearchErr("Search needs internet. Drop the pin by tapping the map, or type coordinates below.");
    } finally {
      setSearching(false);
    }
  };
  const goto = row => {
    const lat = Number(row.lat),
      lon = Number(row.lon);
    mapRef.current?.flyTo([lat, lon], 16, {
      duration: 0.6
    });
    place(lat, lon);
  };
  const applyManual = () => {
    const lat = Number(manual.lat),
      lon = Number(manual.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) return;
    mapRef.current?.flyTo([lat, lon], 16, {
      duration: 0.6
    });
    place(lat, lon);
  };
  const confirm = async () => {
    if (!pos) return;
    let place2 = null;
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=16&accept-language=en&lat=${pos.lat}&lon=${pos.lon}`, {
        headers: {
          Accept: "application/json"
        }
      });
      const j = await r.json();
      const a = j?.address ?? {};
      place2 = {
        city: a.city || a.town || a.village || a.county || a.suburb || "",
        state: a.state || ""
      };
    } catch {}
    onPick({
      ...pos,
      place: place2
    });
  };
  const layerBtn = (k, label) => <button key={k} type="button" className={"seg-opt" + (base === k ? " on" : "")} onClick={() => swapBase(k)}>{label}</button>;
  if (!open) return null;
  return <div style={{
    position: "fixed",
    inset: 0,
    zIndex: 90,
    background: "rgba(3,6,12,.72)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 14
  }} onMouseDown={e => {
    if (e.target === e.currentTarget) onClose();
  }}>
            <div className="panel" style={{
      width: "min(720px, 96vw)",
      maxHeight: "92vh",
      display: "flex",
      flexDirection: "column",
      padding: 14,
      gap: 10,
      overflow: "hidden"
    }}>
                <div style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        flexWrap: "wrap"
      }}>
                    <b style={{
          fontSize: 16
        }}>Where is the meetup?</b>
                </div>
                <div style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap"
      }}>
                    <input style={{
          flex: 1,
          minWidth: 220
        }} placeholder="Search a place, street or landmark…" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => {
          if (e.key === "Enter") {
            e.preventDefault();
            search();
          }
        }} spellCheck={false} aria-label="Search the map" />
                    <Button tiny busy={searching} onClick={search}>Search</Button>
                    <span className="seg-token" role="radiogroup" aria-label="Basemap">
                        {layerBtn("osm", "OpenStreetMap")}
                        {layerBtn("google", "Google")}
                    </span>
                </div>
                {results.length ? <div style={{
        maxHeight: 132,
        overflow: "auto",
        border: "1px solid var(--line, #2a3140)",
        borderRadius: 8
      }}>
                        {results.map((row, i) => <button key={i} type="button" className="rp-link" style={{
          display: "block",
          width: "100%",
          textAlign: "left",
          padding: "6px 10px"
        }} onClick={() => goto(row)}>
                                {row.display_name}
                            </button>)}
                    </div> : null}
                {searchErr ? <div className="small" style={{
        color: "var(--warn, #e0a35a)"
      }}>{searchErr}</div> : null}
                <div ref={boxRef} style={{
        flex: 1,
        minHeight: 280,
        borderRadius: 10,
        overflow: "hidden",
        border: "1px solid var(--line, #2a3140)",
        background: "#0b0f16"
      }} aria-label="Tap the map to drop the venue pin" />
                <div style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        alignItems: "center"
      }}>
                    <span className="small dim">or coordinates:</span>
                    <input style={{
          width: 130
        }} inputMode="decimal" placeholder="lat" value={manual.lat} onChange={e => setManual(m => ({
          ...m,
          lat: e.target.value
        }))} aria-label="Latitude" />
                    <input style={{
          width: 130
        }} inputMode="decimal" placeholder="lon" value={manual.lon} onChange={e => setManual(m => ({
          ...m,
          lon: e.target.value
        }))} aria-label="Longitude" />
                    <Button tiny ghost onClick={applyManual}>Set</Button>
                    <span style={{
          flex: 1
        }} />
                    <Button tiny ghost onClick={onClose}>Cancel</Button>
                    <Button tiny tone="accent" disabled={!pos} onClick={confirm}>Use this spot</Button>
                </div>
            </div>
        </div>;
}