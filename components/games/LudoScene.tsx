"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { COLOR_START, LUDO_COLORS, movableTokens, type LudoState } from "@/lib/games/ludo";
import { BASE_ORIGIN, FINISH, HOME_COL, SAFE_KEYS, TRACK, YARD_HEX, cellXZ, posToRC } from "./ludoLayout";

type Move = { type: "roll" } | { type: "move"; token: number };

export interface LudoCampLabel {
  color: number;
  title: string;
  subtitle: string;
  playing: boolean;
}

interface Props {
  state: LudoState;
  mySeat: number | null;
  canPlay: boolean;
  busy: boolean;
  onMove: (move: Move) => void;
  camps: LudoCampLabel[];
}

function paintCamp(title: string, subtitle: string, color: number, playing: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 200;
  const g = canvas.getContext("2d");
  if (!g) return new THREE.CanvasTexture(canvas);
  g.clearRect(0, 0, 640, 200);
  g.fillStyle = playing ? "rgba(12,8,5,0.9)" : "rgba(12,8,5,0.66)";
  g.beginPath();
  g.roundRect(8, 18, 624, 164, 32);
  g.fill();
  if (playing) {
    g.strokeStyle = "#fde68a";
    g.lineWidth = 8;
    g.stroke();
  }
  g.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
  g.beginPath();
  g.arc(72, 100, 28, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#ffffff";
  g.font = "700 54px sans-serif";
  g.fillText(title.slice(0, 16), 118, 88);
  g.fillStyle = playing ? "#fde68a" : "#e7e5e4";
  g.font = "600 36px sans-serif";
  g.fillText(subtitle.slice(0, 32), 118, 140);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const TILE = 0.9;
const TILE_TOP = 0.2;

function pawnGeometry() {
  const pts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.2, 0),
    new THREE.Vector2(0.23, 0.05),
    new THREE.Vector2(0.14, 0.09),
    new THREE.Vector2(0.09, 0.26),
    new THREE.Vector2(0.15, 0.34),
    new THREE.Vector2(0.19, 0.46),
    new THREE.Vector2(0.11, 0.58),
    new THREE.Vector2(0, 0.62),
  ];
  return new THREE.LatheGeometry(pts, 24);
}

function starGeometry() {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? 0.2 : 0.08;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * radius;
    const y = Math.sin(a) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0.02, 0);
  return geo;
}

function triangle(ax: number, az: number, bx: number, bz: number, cx: number, cz: number, y: number) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute([ax, y, az, bx, y, bz, cx, y, cz], 3));
  geo.computeVertexNormals();
  return geo;
}

function faceUp(value: number) {
  // Faces du dé : +y=1, -y=6, +x=2, -x=5, +z=3, -z=4.
  const e = new THREE.Euler();
  if (value === 6) e.x = Math.PI;
  else if (value === 2) e.z = Math.PI / 2;
  else if (value === 5) e.z = -Math.PI / 2;
  else if (value === 3) e.x = -Math.PI / 2;
  else if (value === 4) e.x = Math.PI / 2;
  return e;
}

function pipTexture(n: number) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const g = canvas.getContext("2d");
  if (!g) return new THREE.CanvasTexture(canvas);
  g.fillStyle = "#fbf7ef";
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = "#e4dccb";
  g.lineWidth = 8;
  g.strokeRect(4, 4, 120, 120);
  const spots: Record<number, [number, number][]> = {
    1: [[64, 64]],
    2: [[40, 40], [88, 88]],
    3: [[40, 40], [64, 64], [88, 88]],
    4: [[40, 40], [88, 40], [40, 88], [88, 88]],
    5: [[40, 40], [88, 40], [64, 64], [40, 88], [88, 88]],
    6: [[40, 34], [88, 34], [40, 64], [88, 64], [40, 94], [88, 94]],
  };
  g.fillStyle = n === 1 ? "#be123c" : "#1c1917";
  for (const [x, y] of spots[n]) {
    g.beginPath();
    g.arc(x, y, 11, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function LudoScene({ state, mySeat, canPlay, busy, onMove, camps }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  const propsRef = useRef({ state, mySeat, canPlay, busy, camps });
  propsRef.current = { state, mySeat, canPlay, busy, camps };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    host.appendChild(renderer.domElement);
    renderer.domElement.className = "h-full w-full touch-none";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 80);
    let yaw = 0.55;
    let pitch = 0.62;
    let dist = 24;
    const aim = () => {
      camera.position.set(Math.sin(pitch) * Math.sin(yaw) * dist, Math.cos(pitch) * dist, Math.sin(pitch) * Math.cos(yaw) * dist);
      camera.lookAt(0, 0.2, 0);
    };
    aim();

    scene.add(new THREE.HemisphereLight(0xfff6e8, 0x2a211c, 0.85));
    const sun = new THREE.DirectionalLight(0xfff3dd, 2.6);
    sun.position.set(-7, 16, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 4;
    sun.shadow.camera.far = 36;
    sun.shadow.camera.left = -12;
    sun.shadow.camera.right = 12;
    sun.shadow.camera.top = 12;
    sun.shadow.camera.bottom = -12;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xc7d7ff, 0.45);
    fill.position.set(8, 6, -6);
    scene.add(fill);

    const wood = new THREE.MeshStandardMaterial({ color: 0x4a2e1c, roughness: 0.72, metalness: 0.04 });
    const felt = new THREE.MeshStandardMaterial({ color: 0x143028, roughness: 0.9 });
    const ivory = new THREE.MeshStandardMaterial({ color: 0xf6f1e6, roughness: 0.55 });
    const cream = new THREE.MeshStandardMaterial({ color: 0xfffaf2, roughness: 0.4 });
    const brass = new THREE.MeshStandardMaterial({ color: 0xd4b06a, roughness: 0.32, metalness: 0.72 });
    const yardMats = YARD_HEX.map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.08 }));
    const starMat = new THREE.MeshStandardMaterial({ color: 0xf6d778, roughness: 0.28, metalness: 0.55, emissive: 0x8a6a22, emissiveIntensity: 0.15 });

    const table = new THREE.Mesh(new THREE.CylinderGeometry(11.6, 12.1, 0.45, 72), new THREE.MeshStandardMaterial({ color: 0x24160f, roughness: 0.8 }));
    table.position.y = -0.42;
    table.receiveShadow = true;
    scene.add(table);

    const slab = new THREE.Mesh(new THREE.BoxGeometry(16.2, 0.28, 16.2), wood);
    slab.position.y = -0.02;
    slab.receiveShadow = true;
    slab.castShadow = true;
    scene.add(slab);

    const cloth = new THREE.Mesh(new THREE.BoxGeometry(15.05, 0.06, 15.05), felt);
    cloth.position.y = 0.12;
    cloth.receiveShadow = true;
    scene.add(cloth);

    const lip = new THREE.Mesh(new THREE.BoxGeometry(15.25, 0.05, 15.25), brass);
    lip.position.y = 0.08;
    scene.add(lip);

    const cellGeo = new THREE.BoxGeometry(TILE, 0.08, TILE);
    const placeTile = (r: number, c: number, mat: THREE.Material) => {
      const mesh = new THREE.Mesh(cellGeo, mat);
      const [x, z] = cellXZ(r, c);
      mesh.position.set(x, TILE_TOP, z);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      scene.add(mesh);
      return mesh;
    };

    const seen = new Set<string>();
    for (const [r, c] of TRACK) {
      const key = `${r},${c}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const start = COLOR_START.findIndex((g) => TRACK[g][0] === r && TRACK[g][1] === c);
      placeTile(r, c, start >= 0 ? yardMats[start] : ivory);
      if (SAFE_KEYS.has(key)) {
        const star = new THREE.Mesh(starGeometry(), starMat);
        const [x, z] = cellXZ(r, c);
        star.position.set(x, TILE_TOP + 0.05, z);
        scene.add(star);
      }
    }
    HOME_COL.forEach((cells, color) => cells.forEach(([r, c]) => placeTile(r, c, yardMats[color])));

    const yTri = TILE_TOP + 0.05;
    const tris: [number, number, number, number, number, number, number][] = [
      [-1.5, -1.5, -1.5, 1.5, 0, 0, 0],
      [-1.5, -1.5, 1.5, -1.5, 0, 0, 1],
      [1.5, -1.5, 1.5, 1.5, 0, 0, 2],
      [-1.5, 1.5, 1.5, 1.5, 0, 0, 3],
    ];
    for (const [ax, az, bx, bz, cx, cz, color] of tris) {
      const mat = yardMats[color].clone();
      mat.side = THREE.DoubleSide;
      const mesh = new THREE.Mesh(triangle(ax, az, bx, bz, cx, cz, yTri), mat);
      mesh.receiveShadow = true;
      scene.add(mesh);
    }

    for (const [r, c] of BASE_ORIGIN) {
      const color = BASE_ORIGIN.findIndex((o) => o[0] === r && o[1] === c);
      const group = new THREE.Group();
      const [x, z] = cellXZ(r + 2.5, c + 2.5);
      group.position.set(x, 0, z);
      const outer = new THREE.Mesh(new THREE.BoxGeometry(5.82, 0.14, 5.82), yardMats[color]);
      outer.position.y = 0.16;
      outer.castShadow = true;
      outer.receiveShadow = true;
      const inner = new THREE.Mesh(new THREE.BoxGeometry(4.15, 0.08, 4.15), cream);
      inner.position.y = 0.26;
      inner.receiveShadow = true;
      const disc = new THREE.Mesh(new THREE.CircleGeometry(1.72, 40), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 }));
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = 0.31;
      group.add(outer, inner, disc);
      scene.add(group);
    }

    const campLabels: THREE.Sprite[] = [];
    const campRings: THREE.Mesh[] = [];
    for (let color = 0; color < 4; color++) {
      const [r, c] = BASE_ORIGIN[color];
      const [x, z] = cellXZ(r + 2.5, c + 2.5);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(2.55, 2.82, 64),
        new THREE.MeshBasicMaterial({ color: 0xfde68a, transparent: true, opacity: 0, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 0.34, z);
      ring.visible = false;
      scene.add(ring);
      campRings.push(ring);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }));
      sprite.position.set(x * 0.82, 1.15, z * 0.82);
      sprite.scale.set(2.7, 0.84, 1);
      sprite.visible = false;
      sprite.renderOrder = 2;
      scene.add(sprite);
      campLabels.push(sprite);
    }
    let campSig = "";

    const pawnGeo = pawnGeometry();
    const tokens: THREE.Mesh[] = [];
    const tokenMat = (color: number) =>
      new THREE.MeshPhysicalMaterial({
        color: YARD_HEX[color],
        roughness: 0.22,
        metalness: 0.08,
        clearcoat: 0.7,
        clearcoatRoughness: 0.25,
        emissive: 0x000000,
      });

    const ensureTokens = (s: LudoState) => {
      const need = s.tokens.reduce((n, row) => n + row.length, 0);
      if (tokens.length === need) return;
      for (const mesh of tokens) scene.remove(mesh);
      tokens.length = 0;
      s.tokens.forEach((row, seat) => {
        row.forEach((_, token) => {
          const mesh = new THREE.Mesh(pawnGeo, tokenMat(s.colors[seat]));
          mesh.castShadow = true;
          mesh.userData = { seat, token, cell: "", hop: 0, tx: 0, tz: 0 };
          const hitbox = new THREE.Mesh(
            new THREE.SphereGeometry(0.46, 10, 8),
            new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
          );
          hitbox.position.y = 0.28;
          mesh.add(hitbox);
          scene.add(mesh);
          tokens.push(mesh);
        });
      });
    };

    const diePlate = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.7, 0.05, 28),
      new THREE.MeshStandardMaterial({ color: 0xd4b06a, roughness: 0.4, metalness: 0.35 }),
    );
    diePlate.position.set(0, 0.36, 0);
    scene.add(diePlate);

    const dieMats = [2, 5, 1, 6, 3, 4].map((n) => new THREE.MeshStandardMaterial({ map: pipTexture(n), roughness: 0.35, metalness: 0.05 }));
    const die = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.82, 0.82), dieMats);
    die.castShadow = true;
    die.position.set(0, 1.55, 0);
    die.userData = { rollId: "", spin: 0, value: 1 };
    scene.add(die);

    let lastTick = performance.now();
    let raf = 0;
    const drag = { on: false, x: 0, y: 0, moved: false, onPawn: false };

    const pawnOf = (obj: THREE.Object3D | null | undefined) => {
      let cur = obj;
      while (cur) {
        if (typeof cur.userData?.token === "number") return cur;
        cur = cur.parent;
      }
      return null;
    };

    const sync = () => {
      const { state: s, mySeat: seat, canPlay: play, busy: locked, camps: labels } = propsRef.current;
      ensureTokens(s);
      const movable = play && seat != null && s.phase === "move" && s.dice ? new Set(movableTokens(s, seat, s.dice)) : new Set<number>();
      const piles = new Map<string, THREE.Mesh[]>();
      let i = 0;
      s.tokens.forEach((row, st) => {
        row.forEach((pos, token) => {
          const mesh = tokens[i++];
          const hidden = !s.active[st] && !s.over;
          mesh.visible = !hidden;
          if (hidden) return;
          const color = s.colors[st];
          const [r, c] = posToRC(color, pos, token);
          const key = `${r},${c}`;
          const [x, z] = cellXZ(r, c);
          if (mesh.userData.cell !== key) {
            mesh.userData.cell = key;
            mesh.userData.hop = 1;
          }
          mesh.userData.tx = x;
          mesh.userData.tz = z;
          const clickable = st === seat && movable.has(token) && !locked;
          mesh.userData.clickable = clickable;
          const mat = mesh.material as THREE.MeshPhysicalMaterial;
          mat.emissive.setHex(clickable ? 0xfbbf24 : 0x000000);
          if (!piles.has(key)) piles.set(key, []);
          piles.get(key)!.push(mesh);
        });
      });
      for (const pile of piles.values()) {
        pile.forEach((mesh, index) => {
          const n = pile.length;
          const radius = n === 1 ? 0 : 0.2;
          const a = (index / n) * Math.PI * 2;
          mesh.userData.tx += Math.cos(a) * radius;
          mesh.userData.tz += Math.sin(a) * radius;
        });
      }

      const roll = s.lastRoll;
      const rollId = roll ? `${s.moves}:${roll.seat}:${roll.value}` : "";
      if (roll && rollId !== die.userData.rollId) {
        die.userData.rollId = rollId;
        die.userData.spin = 0.85;
        die.userData.value = roll.value;
      }
      die.userData.prompt = play && s.phase === "roll" && !locked;
      const turnColor = s.colors[s.turn] ?? 0;
      (diePlate.material as THREE.MeshStandardMaterial).color.setHex(s.over ? 0xd4b06a : YARD_HEX[turnColor]);
      const sig = labels.map((c) => `${c.color}:${c.title}:${c.subtitle}:${c.playing}`).join("|");
      if (sig !== campSig) {
        campSig = sig;
        campLabels.forEach((sprite) => {
          sprite.visible = false;
        });
        campRings.forEach((ring) => {
          ring.visible = false;
        });
        for (const camp of labels) {
          const sprite = campLabels[camp.color];
          const ring = campRings[camp.color];
          if (!sprite || !ring) continue;
          const previous = sprite.material.map;
          sprite.material.map = paintCamp(camp.title, camp.subtitle, YARD_HEX[camp.color], camp.playing);
          sprite.material.needsUpdate = true;
          previous?.dispose();
          sprite.visible = true;
          ring.visible = camp.playing;
        }
      }
    };

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      const dt = Math.min((now - lastTick) / 1000, 0.05);
      lastTick = now;
      const t = now / 1000;
      sync();
      for (const mesh of tokens) {
        if (!mesh.visible) continue;
        mesh.position.x += (mesh.userData.tx - mesh.position.x) * Math.min(1, dt * 8);
        mesh.position.z += (mesh.userData.tz - mesh.position.z) * Math.min(1, dt * 8);
        const hop = mesh.userData.hop as number;
        const lift = hop > 0 ? Math.sin(hop * Math.PI) * 0.55 : 0;
        mesh.userData.hop = Math.max(0, hop - dt * 1.6);
        mesh.position.y = TILE_TOP + 0.08 + lift;
        const mat = mesh.material as THREE.MeshPhysicalMaterial;
        if (mesh.userData.clickable) mat.emissiveIntensity = 0.25 + Math.sin(t * 7) * 0.2;
          mesh.scale.setScalar(mesh.userData.clickable ? 1.16 : 1);
      }
      for (const ring of campRings) {
        if (!ring.visible) continue;
        (ring.material as THREE.MeshBasicMaterial).opacity = 0.55 + Math.sin(t * 4) * 0.3;
      }
      if (die.userData.spin > 0) {
        die.userData.spin -= dt;
        die.rotation.x += dt * 18;
        die.rotation.z += dt * 14;
        die.position.y = 1.7 + Math.sin(t * 20) * 0.08;
        if (die.userData.spin <= 0) die.setRotationFromEuler(faceUp(die.userData.value));
      } else {
        const bob = die.userData.prompt ? Math.sin(t * 3) * 0.08 : 0;
        die.position.y = 1.45 + bob;
      }
      renderer.render(scene, camera);
    };
    tick();

    const ndc = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    const pick = (ev: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      return raycaster.intersectObjects([...tokens.filter((m) => m.visible), die], true);
    };

    const onDown = (ev: PointerEvent) => {
      const hit = pick(ev)[0];
      const pawn = pawnOf(hit?.object);
      drag.on = true;
      drag.moved = false;
      drag.onPawn = Boolean(pawn?.userData.clickable) || (hit?.object === die && Boolean(die.userData.prompt));
      drag.x = ev.clientX;
      drag.y = ev.clientY;
    };
    const onMovePtr = (ev: PointerEvent) => {
      if (!drag.on) {
        if (ev.target !== renderer.domElement) return;
        const hit = pick(ev)[0];
        const clickable = hit?.object === die ? die.userData.prompt : Boolean(pawnOf(hit?.object)?.userData.clickable);
        renderer.domElement.style.cursor = clickable ? "pointer" : "grab";
        return;
      }
      const dx = ev.clientX - drag.x;
      const dy = ev.clientY - drag.y;
      if (drag.onPawn && Math.abs(dx) + Math.abs(dy) < 12) return;
      drag.onPawn = false;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      drag.x = ev.clientX;
      drag.y = ev.clientY;
      yaw -= dx * 0.006;
      pitch = Math.min(1.05, Math.max(0.34, pitch + dy * 0.004));
      aim();
    };
    const onUp = (ev: PointerEvent) => {
      if (!drag.on) return;
      drag.on = false;
      if (drag.moved) return;
      const hit = pick(ev)[0];
      if (!hit) return;
      const pawn = pawnOf(hit.object);
      if (hit.object === die && die.userData.prompt) onMoveRef.current({ type: "roll" });
      else if (pawn?.userData.clickable) onMoveRef.current({ type: "move", token: pawn.userData.token });
    };
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      dist = Math.min(30, Math.max(12, dist + ev.deltaY * 0.012));
      aim();
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMovePtr);
    window.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMovePtr);
      window.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("wheel", onWheel);
      renderer.dispose();
      pawnGeo.dispose();
      cellGeo.dispose();
      for (const sprite of campLabels) {
        sprite.material.map?.dispose();
        sprite.material.dispose();
      }
      host.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={hostRef} className="h-full w-full" aria-hidden={false} aria-label={`Plateau de ludo en trois dimensions. Couleurs : ${LUDO_COLORS.join(", ")}. Cases d'arrivée : ${FINISH.map((c) => c.join("-")).join(" ")}.`} />;
}
