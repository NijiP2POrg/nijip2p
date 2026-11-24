import React, { useEffect, useRef } from "react";
const BG = 0x0e1013;
const BLUE = 0x8fa8ff;
const TEAL = 0x5ec9c0;
const GOLD = 0xdfb356;
export default function Hero3D({
  className = ""
}) {
  const hostRef = useRef(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      host.classList.add("h3d-still");
      return undefined;
    }
    let dead = false;
    let teardown = () => {};
    (async () => {
      let THREE;
      try {
        THREE = await import("three");
      } catch {
        return;
      }
      if (dead || !host.isConnected) return;
      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(BG, 0.13);
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
      camera.position.set(0, 0.5, 6.6);
      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
          powerPreference: "high-performance"
        });
      } catch {
        return;
      }
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.12;
      host.appendChild(renderer.domElement);
      const scene_ = new THREE.Group();
      scene.add(scene_);
      scene.add(new THREE.HemisphereLight(0x27324a, 0x05070a, 0.9));
      const lBlue = new THREE.PointLight(BLUE, 30, 12, 1.8);
      lBlue.position.set(-3.2, 1.6, 2.4);
      scene.add(lBlue);
      const lTeal = new THREE.PointLight(TEAL, 22, 12, 1.8);
      lTeal.position.set(3.2, -1.2, 2.6);
      scene.add(lTeal);
      const lTop = new THREE.PointLight(0xffffff, 8, 10, 1.8);
      lTop.position.set(0, 3.4, -2);
      scene.add(lTop);
      const vault = new THREE.Group();
      scene_.add(vault);
      const metal = new THREE.MeshStandardMaterial({
        color: 0x18202e,
        metalness: 0.78,
        roughness: 0.34
      });
      const glowEdge = new THREE.MeshStandardMaterial({
        color: 0x0d1420,
        metalness: 0.5,
        roughness: 0.3,
        emissive: BLUE,
        emissiveIntensity: 0.32
      });
      const ringGeo = new THREE.TorusGeometry(1.06, 0.045, 12, 6);
      const top = new THREE.Mesh(ringGeo, glowEdge);
      top.rotation.x = Math.PI / 2;
      top.position.y = 0.42;
      vault.add(top);
      const bottom = new THREE.Mesh(ringGeo, glowEdge);
      bottom.rotation.x = Math.PI / 2;
      bottom.position.y = -0.42;
      vault.add(bottom);
      const pillarGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.9, 10);
      for (let i = 0; i < 6; i += 1) {
        const a = i / 6 * Math.PI * 2 + Math.PI / 6;
        const p = new THREE.Mesh(pillarGeo, metal);
        p.position.set(Math.cos(a) * 1.06, 0, Math.sin(a) * 1.06);
        vault.add(p);
      }
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 1), new THREE.MeshStandardMaterial({
        color: 0x223,
        emissive: BLUE,
        emissiveIntensity: 1.5,
        metalness: 0.2,
        roughness: 0.4,
        flatShading: true
      }));
      vault.add(core);
      const coreLight = new THREE.PointLight(BLUE, 4, 5, 1.6);
      vault.add(coreLight);
      const stage = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.01, 8, 90), new THREE.MeshBasicMaterial({
        color: TEAL,
        transparent: true,
        opacity: 0.32
      }));
      stage.rotation.x = Math.PI / 2;
      stage.position.y = -1.22;
      scene_.add(stage);
      const texLoader = new THREE.TextureLoader();
      const coinMat = (tex, tint) => new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        side: THREE.DoubleSide,
        color: tint
      });
      const texUsdc = texLoader.load("./assets/coins/usdc.png");
      const texUsdt = texLoader.load("./assets/coins/usdt.png");
      texUsdc.colorSpace = THREE.SRGBColorSpace;
      texUsdt.colorSpace = THREE.SRGBColorSpace;
      const coinGeo = new THREE.CircleGeometry(0.3, 40);
      const rimGeo = new THREE.TorusGeometry(0.3, 0.024, 10, 40);
      const orbitA = new THREE.Group();
      orbitA.rotation.set(0.42, 0, 0.12);
      scene_.add(orbitA);
      const coinA = new THREE.Group();
      coinA.position.set(2.05, 0, 0);
      coinA.add(new THREE.Mesh(coinGeo, coinMat(texUsdc, 0xffffff)));
      coinA.add(new THREE.Mesh(rimGeo, new THREE.MeshStandardMaterial({
        color: 0xbfd3ff,
        metalness: 0.9,
        roughness: 0.25
      })));
      orbitA.add(coinA);
      const orbitB = new THREE.Group();
      orbitB.rotation.set(-0.34, 0, -0.1);
      scene_.add(orbitB);
      const coinB = new THREE.Group();
      coinB.position.set(-2.45, 0.15, 0.4);
      coinB.add(new THREE.Mesh(coinGeo, coinMat(texUsdt, 0xffffff)));
      coinB.add(new THREE.Mesh(rimGeo, new THREE.MeshStandardMaterial({
        color: 0x59d6c2,
        metalness: 0.9,
        roughness: 0.25
      })));
      orbitB.add(coinB);
      const N = 260;
      const pGeo = new THREE.BufferGeometry();
      const pPos = new Float32Array(N * 3);
      const pCol = new Float32Array(N * 3);
      const pd = [];
      for (let i = 0; i < N; i += 1) {
        pd.push({
          a: Math.random() * Math.PI * 2,
          r: 0.5 + Math.random() * 2.6,
          s: 0.25 + Math.random() * 0.75,
          w: Math.random()
        });
        const c = new THREE.Color(i % 3 === 0 ? GOLD : i % 3 === 1 ? BLUE : TEAL);
        pCol[i * 3] = c.r;
        pCol[i * 3 + 1] = c.g;
        pCol[i * 3 + 2] = c.b;
      }
      pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
      pGeo.setAttribute("color", new THREE.BufferAttribute(pCol, 3));
      const pMat = new THREE.PointsMaterial({
        size: 0.05,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true
      });
      const points = new THREE.Points(pGeo, pMat);
      scene_.add(points);
      const NB = 120;
      const bGeo = new THREE.BufferGeometry();
      const bPos = new Float32Array(NB * 3);
      bGeo.setAttribute("position", new THREE.BufferAttribute(bPos, 3));
      const bMat = new THREE.PointsMaterial({
        size: 0.06,
        color: BLUE,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const burst = new THREE.Points(bGeo, bMat);
      scene_.add(burst);
      let visible = true;
      const io = new IntersectionObserver(en => {
        visible = en[0].isIntersecting && !document.hidden;
      }, {
        threshold: 0.04
      });
      io.observe(host);
      const onVis = () => {
        visible = !document.hidden;
      };
      document.addEventListener("visibilitychange", onVis);
      let px = 0,
        py = 0;
      const onPoint = e => {
        const r = host.getBoundingClientRect();
        const cx = r.left + r.width / 2,
          cy = r.top + r.height / 2;
        px = Math.max(-1, Math.min(1, ((e.touches ? e.touches[0].clientX : e.clientX) - cx) / (r.width * 0.6)));
        py = Math.max(-1, Math.min(1, ((e.touches ? e.touches[0].clientY : e.clientY) - cy) / (r.height * 0.6)));
      };
      host.addEventListener("pointermove", onPoint);
      host.addEventListener("touchmove", onPoint, {
        passive: true
      });
      const resize = () => {
        const w = host.clientWidth || 1,
          h = host.clientHeight || 1;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      const ro = new ResizeObserver(resize);
      ro.observe(host);
      resize();
      const clock = new THREE.Clock();
      let raf = 0;
      const tick = () => {
        raf = requestAnimationFrame(tick);
        if (!visible) return;
        const t = clock.getElapsedTime();
        const dt = Math.min(0.05, clock.getDelta());
        vault.rotation.y = t * 0.28 + px * 0.5;
        vault.rotation.x = -0.06 + py * 0.24;
        vault.position.y = Math.sin(t * 0.85) * 0.07;
        const pulse = 1 + Math.sin(t * 2.2) * 0.06;
        core.scale.setScalar(pulse);
        core.rotation.y = -t * 0.6;
        core.material.emissiveIntensity = 1.35 + Math.sin(t * 2.2) * 0.45;
        coreLight.intensity = 3.2 + Math.sin(t * 2.2) * 1.1;
        orbitA.rotation.y = t * 0.42;
        coinA.rotation.y = t * 1.5;
        coinA.position.y = Math.sin(t * 1.1) * 0.1;
        orbitB.rotation.y = -t * 0.33;
        coinB.rotation.y = -t * 1.2 + 1.4;
        coinB.position.y = 0.15 + Math.sin(t * 0.9 + 2) * 0.12;
        const pos = pGeo.attributes.position.array;
        for (let i = 0; i < N; i += 1) {
          const d = pd[i];
          d.a += d.s * dt * 0.9;
          d.r = Math.max(0.34, d.r - dt * (0.18 + 0.12 * Math.abs(Math.sin(d.a * 2 + t * 0.3))));
          if (d.r <= 0.35) {
            d.r = 1.7 + Math.random() * 1.6;
            d.a = Math.random() * Math.PI * 2;
          }
          const y = Math.sin(d.a * 1.6 + t * 0.5) * 0.22 * (d.r / 2.6);
          pos[i * 3] = Math.cos(d.a) * d.r;
          pos[i * 3 + 1] = y;
          pos[i * 3 + 2] = Math.sin(d.a) * d.r * 0.78;
        }
        pGeo.attributes.position.needsUpdate = true;
        const bp = bGeo.attributes.position.array;
        for (let i = 0; i < NB; i += 1) {
          const life = (t * 0.55 + i / NB) % 1;
          const a = i / NB * Math.PI * 2 + t * 0.22;
          const r = 0.32 + life * 2.3;
          bp[i * 3] = Math.cos(a) * r;
          bp[i * 3 + 1] = life * 1.15 - 0.35;
          bp[i * 3 + 2] = Math.sin(a) * r * 0.8;
        }
        bGeo.attributes.position.needsUpdate = true;
        bMat.opacity = 0.55;
        camera.position.x += (px * 0.55 - camera.position.x) * 0.06;
        camera.position.y += (0.5 - py * 0.3 - camera.position.y) * 0.06;
        camera.lookAt(0, 0.05, 0);
        renderer.render(scene, camera);
      };
      tick();
      teardown = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        io.disconnect();
        document.removeEventListener("visibilitychange", onVis);
        scene.traverse(o => {
          if (o.geometry) o.geometry.dispose();
          const m = o.material;
          if (m) {
            if (m.map) m.map.dispose();
            m.dispose();
          }
        });
        renderer.dispose();
        if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
      };
    })();
    return () => {
      dead = true;
      teardown();
    };
  }, []);
  return <div ref={hostRef} className={"h3d " + className} aria-hidden="true" />;
}