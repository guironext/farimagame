"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const GAP = 1.08;

function pitXZ(i: number): [number, number] {
  const col = i < 6 ? i : 11 - i;
  return [(col - 2.5) * GAP, i < 6 ? 0.64 : -0.64];
}

function layoutSeeds(n: number, radius: number): Array<[number, number, number]> {
  const spots: Array<[number, number, number]> = [];
  let left = n;
  let layer = 0;
  while (left > 0 && layer < 8) {
    const take = Math.min(left, layer === 0 ? Math.min(n, 4) : 5 + layer);
    const ring = layer === 0 ? (take === 1 ? 0 : radius * 0.42) : Math.min(radius * 0.82, 0.14 + layer * 0.11);
    for (let k = 0; k < take; k++) {
      const a = (k / take) * Math.PI * 2 + layer * 0.5;
      spots.push([Math.cos(a) * ring, 0.07 + layer * 0.08, Math.sin(a) * ring]);
    }
    left -= take;
    layer++;
  }
  return spots;
}

function plaque(text: string, color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 160;
  const g = canvas.getContext("2d");
  if (!g) return new THREE.CanvasTexture(canvas);
  g.clearRect(0, 0, 256, 160);
  g.fillStyle = "rgba(18, 10, 6, 0.78)";
  g.beginPath();
  g.roundRect(28, 28, 200, 104, 36);
  g.fill();
  g.fillStyle = color;
  g.font = "700 78px sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 128, 84);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface SeedFlight {
  from: number;
  to: number;
  start: number;
  ms: number;
}

interface Props {
  pits: number[];
  store: [number, number];
  names: [string, string];
  turn: 0 | 1;
  flip: boolean;
  movable: number[];
  lastPit: number | null;
  captured: number[];
  flight: SeedFlight | null;
  busy: boolean;
  onPit: (pit: number) => void;
}

export function AwaleScene({ pits, store, names, turn, flip, movable, lastPit, captured, flight, busy, onPit }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onPitRef = useRef(onPit);
  onPitRef.current = onPit;
  const propsRef = useRef({ pits, store, names, turn, flip, movable, lastPit, captured, flight, busy });
  propsRef.current = { pits, store, names, turn, flip, movable, lastPit, captured, flight, busy };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true;
    host.appendChild(renderer.domElement);
    renderer.domElement.className = "h-full w-full touch-none";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 80);
    const target = new THREE.Vector3(0, 0.3, 0);
    let yaw = 0.15;
    let pitch = 0.34;
    let dist = 14;
    const aim = () => {
      camera.position.set(
        target.x + Math.sin(pitch) * Math.sin(yaw) * dist,
        target.y + Math.cos(pitch) * dist,
        target.z + Math.sin(pitch) * Math.cos(yaw) * dist,
      );
      camera.lookAt(target);
    };
    aim();

    scene.add(new THREE.HemisphereLight(0xfff6e8, 0x2a1a12, 0.95));
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.5);
    sun.position.set(-4, 12, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 2;
    sun.shadow.camera.far = 28;
    sun.shadow.camera.left = -8;
    sun.shadow.camera.right = 8;
    sun.shadow.camera.top = 5;
    sun.shadow.camera.bottom = -5;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xc5d4ff, 0.45);
    fill.position.set(6, 5, -4);
    scene.add(fill);

    const table = new THREE.Mesh(
      new THREE.CylinderGeometry(6.4, 6.7, 0.32, 64),
      new THREE.MeshStandardMaterial({ color: 0x1c120c, roughness: 0.8 }),
    );
    table.position.y = -0.42;
    table.receiveShadow = true;
    scene.add(table);

    const board = new THREE.Group();
    scene.add(board);

    const woodMat = new THREE.MeshStandardMaterial({ color: 0x9a5b2e, roughness: 0.48, metalness: 0.06 });
    const wood = new THREE.Mesh(new THREE.BoxGeometry(6.3, 0.46, 3.04), woodMat);
    wood.position.y = 0.08;
    wood.castShadow = true;
    wood.receiveShadow = true;
    board.add(wood);
    const capGeo = new THREE.CylinderGeometry(1.52, 1.52, 0.46, 40);
    for (const x of [-3.15, 3.15]) {
      const cap = new THREE.Mesh(capGeo, woodMat);
      cap.position.set(x, 0.08, 0);
      cap.castShadow = true;
      cap.receiveShadow = true;
      board.add(cap);
    }
    const surface = 0.32;

    const bowlGeo = new THREE.CircleGeometry(0.4, 28);
    const storeGeo = new THREE.CircleGeometry(0.58, 32);
    const rimGeo = new THREE.TorusGeometry(0.44, 0.045, 10, 28);
    const storeRimGeo = new THREE.TorusGeometry(0.62, 0.055, 10, 32);
    const hitGeo = new THREE.SphereGeometry(0.5, 12, 8);
    const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });

    const rims: THREE.Mesh[] = [];
    const hits: THREE.Mesh[] = [];
    const labels: THREE.Sprite[] = [];
    for (let i = 0; i < 12; i++) {
      const [x, z] = pitXZ(i);
      const bowl = new THREE.Mesh(
        bowlGeo,
        new THREE.MeshStandardMaterial({ color: 0x1a0d08, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      );
      bowl.rotation.x = -Math.PI / 2;
      bowl.position.set(x, surface, z);
      bowl.receiveShadow = true;
      board.add(bowl);

      const rim = new THREE.Mesh(
        rimGeo,
        new THREE.MeshStandardMaterial({ color: i < 6 ? 0xc4894a : 0x6f8f62, roughness: 0.4, metalness: 0.35 }),
      );
      rim.rotation.x = Math.PI / 2;
      rim.position.set(x, surface + 0.03, z);
      board.add(rim);
      rims.push(rim);

      const hit = new THREE.Mesh(hitGeo, hitMat);
      hit.position.set(x, surface + 0.08, z);
      hit.userData.pit = i;
      board.add(hit);
      hits.push(hit);

      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true }));
      sprite.position.set(x, surface + 0.42, z + (i < 6 ? 0.5 : -0.5));
      sprite.scale.set(0.52, 0.32, 1);
      board.add(sprite);
      labels.push(sprite);
    }

    const storeX = [3.95, -3.95];
    const storeRims: THREE.Mesh[] = [];
    const storeLabels: THREE.Sprite[] = [];
    for (const seat of [0, 1] as const) {
      const bowl = new THREE.Mesh(storeGeo, new THREE.MeshStandardMaterial({ color: 0x140c08, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      bowl.rotation.x = -Math.PI / 2;
      bowl.position.set(storeX[seat], surface, 0);
      bowl.receiveShadow = true;
      board.add(bowl);
      const rim = new THREE.Mesh(
        storeRimGeo,
        new THREE.MeshStandardMaterial({
          color: seat === 0 ? 0xe8b15a : 0x86b07a,
          roughness: 0.35,
          metalness: 0.45,
          emissive: 0x000000,
        }),
      );
      rim.rotation.x = Math.PI / 2;
      rim.position.set(storeX[seat], surface + 0.03, 0);
      board.add(rim);
      storeRims.push(rim);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true }));
      sprite.position.set(storeX[seat], surface + 0.55, 0);
      sprite.scale.set(0.85, 0.53, 1);
      board.add(sprite);
      storeLabels.push(sprite);
    }

    const seedGeo = new THREE.SphereGeometry(0.1, 16, 12);
    const seeds = new THREE.InstancedMesh(
      seedGeo,
      new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.38, metalness: 0.04, clearcoat: 0.35, clearcoatRoughness: 0.4 }),
      48,
    );
    const palette = [0xc9863a, 0xe2b15a, 0x8d4e22, 0xf0d09a, 0xa8642c, 0xd7a15a];
    for (let i = 0; i < 48; i++) seeds.setColorAt(i, new THREE.Color(palette[i % palette.length]));
    seeds.castShadow = true;
    seeds.instanceColor!.needsUpdate = true;
    board.add(seeds);
    const hand = new THREE.Mesh(
      seedGeo,
      new THREE.MeshPhysicalMaterial({ color: 0xf3d7a1, roughness: 0.32, metalness: 0.04, clearcoat: 0.45 }),
    );
    hand.castShadow = true;
    hand.visible = false;
    board.add(hand);
    const spot = (index: number): [number, number] => (index >= 12 ? [storeX[index - 12], 0] : pitXZ(index));

    const textures = new Map<string, THREE.CanvasTexture>();
    const labelOf = (text: string, color: string) => {
      const key = `${text}|${color}`;
      let tex = textures.get(key);
      if (!tex) {
        tex = plaque(text, color);
        textures.set(key, tex);
      }
      return tex;
    };

    const propsNow = () => propsRef.current;
    const dummy = new THREE.Object3D();
    let shown = "";
    const sync = () => {
      const p = propsNow();
      const key = [p.pits.join(","), p.store.join(","), p.names.join(","), p.turn, p.flip ? 1 : 0, p.movable.join(","), p.lastPit ?? "", p.captured.join(",")].join("|");
      board.rotation.y = p.flip ? Math.PI : 0;
      if (key === shown) return;
      shown = key;
      const play = new Set(p.movable);
      const caps = new Set(p.captured);
      let cursor = 0;
      const put = (x: number, z: number, n: number, radius: number) => {
        for (const [lx, ly, lz] of layoutSeeds(n, radius)) {
          if (cursor >= 48) return;
          dummy.position.set(x + lx, surface + ly, z + lz);
          dummy.rotation.set(0, cursor * 0.7, 0);
          dummy.scale.set(1, 0.78, 1);
          dummy.updateMatrix();
          seeds.setMatrixAt(cursor, dummy.matrix);
          cursor++;
        }
      };
      for (let i = 0; i < 12; i++) {
        const [x, z] = pitXZ(i);
        put(x, z, p.pits[i] ?? 0, 0.34);
        const mat = rims[i].material as THREE.MeshStandardMaterial;
        const mode = play.has(i) ? "play" : caps.has(i) ? "cap" : p.lastPit === i ? "last" : "idle";
        mat.color.setHex(mode === "play" ? 0xfbbf24 : mode === "cap" ? 0xfb7185 : mode === "last" ? 0x38bdf8 : i < 6 ? 0xc4894a : 0x6f8f62);
        mat.emissive.setHex(mode === "idle" ? 0x000000 : mat.color.getHex());
        mat.emissiveIntensity = mode === "idle" ? 0 : 0.7;
        const color = mode === "play" ? "#fde68a" : mode === "cap" ? "#fecdd3" : "#f8f1e4";
        const material = labels[i].material as THREE.SpriteMaterial;
        material.map = labelOf(String(p.pits[i] ?? 0), color);
        material.needsUpdate = true;
      }
      for (const seat of [0, 1] as const) {
        put(storeX[seat], 0, p.store[seat] ?? 0, 0.5);
        const mat = storeRims[seat].material as THREE.MeshStandardMaterial;
        const active = p.turn === seat;
        mat.emissive.setHex(active ? (seat === 0 ? 0xe8b15a : 0x86b07a) : 0x000000);
        mat.emissiveIntensity = active ? 0.45 : 0;
        const material = storeLabels[seat].material as THREE.SpriteMaterial;
        material.map = labelOf(String(p.store[seat] ?? 0), seat === 0 ? "#f6d48a" : "#d5efd4");
        material.needsUpdate = true;
      }
      for (; cursor < 48; cursor++) {
        dummy.position.set(0, -6, 0);
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        seeds.setMatrixAt(cursor, dummy.matrix);
      }
      seeds.instanceMatrix.needsUpdate = true;
    };

    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      sync();
      const hop = propsNow().flight;
      const now = performance.now();
      if (!hop || now >= hop.start + hop.ms) {
        hand.visible = false;
      } else {
        const p = (now - hop.start) / hop.ms;
        const eased = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
        const [x0, z0] = spot(hop.from);
        const [x1, z1] = spot(hop.to);
        const dx = x1 - x0;
        const dz = z1 - z0;
        const len = Math.hypot(dx, dz) || 1;
        const sway = Math.sin(eased * Math.PI) * 0.14;
        const settle = p > 0.84 ? ((p - 0.84) / 0.16) * 0.16 : 0;
        hand.visible = true;
        hand.position.set(x0 + dx * eased + (-dz / len) * sway, surface + 0.18 + Math.sin(eased * Math.PI) * 0.7 - settle, z0 + dz * eased + (dx / len) * sway);
        hand.scale.setScalar(1.2 - settle);
        hand.rotation.y = eased * 5;
      }
      renderer.render(scene, camera);
    };
    tick();

    const ndc = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    const drag = { on: false, x: 0, y: 0, moved: false, onPit: false };
    const pts = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    let pinched = false;

    const pick = (ev: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.intersectObjects(hits, false)[0];
      const pit = hit?.object.userData.pit;
      return typeof pit === "number" ? pit : null;
    };

    const onDown = (ev: PointerEvent) => {
      pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (pts.size >= 2) {
        const [a, b] = [...pts.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
        pinched = true;
        drag.on = false;
        return;
      }
      const pit = pick(ev);
      drag.on = true;
      drag.moved = false;
      drag.onPit = pit != null && propsNow().movable.includes(pit);
      drag.x = ev.clientX;
      drag.y = ev.clientY;
    };
    const onPointerMove = (ev: PointerEvent) => {
      if (!pts.has(ev.pointerId) && !drag.on) {
        if (ev.target !== renderer.domElement) return;
        const pit = pick(ev);
        renderer.domElement.style.cursor = pit != null && propsNow().movable.includes(pit) ? "pointer" : "grab";
        return;
      }
      if (pts.has(ev.pointerId)) pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (pts.size >= 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch > 0) dist = Math.min(22, Math.max(10, dist * (pinch / d)));
        pinch = d;
        aim();
        return;
      }
      if (!drag.on) return;
      const dx = ev.clientX - drag.x;
      const dy = ev.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 12) drag.moved = true;
      drag.x = ev.clientX;
      drag.y = ev.clientY;
      if (drag.onPit && !drag.moved) return;
      yaw -= dx * 0.007;
      pitch = Math.min(1.05, Math.max(0.28, pitch + dy * 0.005));
      aim();
    };
    const onUp = (ev: PointerEvent) => {
      pts.delete(ev.pointerId);
      if (pts.size < 2 && pinched) {
        pinched = false;
        drag.on = false;
        return;
      }
      if (!drag.on) return;
      drag.on = false;
      if (drag.moved || propsNow().busy) return;
      const pit = pick(ev);
      if (pit != null && propsNow().movable.includes(pit)) onPitRef.current(pit);
    };
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      dist = Math.min(22, Math.max(10, dist + ev.deltaY * 0.01));
      aim();
    };

    renderer.domElement.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    const fit = () => {
      board.updateMatrixWorld(true);
      const sphere = new THREE.Box3().setFromObject(board).getBoundingSphere(new THREE.Sphere());
      target.copy(sphere.center);
      const vFov = (camera.fov * Math.PI) / 180;
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * Math.max(camera.aspect, 0.4));
      const margin = 1.18;
      dist = Math.max(sphere.radius / Math.sin(vFov / 2), sphere.radius / Math.sin(hFov / 2)) * margin;
      aim();
    };
    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      fit();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      renderer.domElement.removeEventListener("wheel", onWheel);
      for (const tex of textures.values()) tex.dispose();
      renderer.dispose();
      seedGeo.dispose();
      wood.geometry.dispose();
      capGeo.dispose();
      bowlGeo.dispose();
      storeGeo.dispose();
      rimGeo.dispose();
      storeRimGeo.dispose();
      hitGeo.dispose();
      host.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={hostRef} className="h-full w-full" aria-label="Plateau d'awalé en trois dimensions, deux rangées de six trous." />;
}
