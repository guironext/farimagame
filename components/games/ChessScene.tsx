"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const TILE = 1;
const FILES = "abcdefgh";

function xz(file: number, rank: number): [number, number] {
  return [(file - 3.5) * TILE, (3.5 - rank) * TILE];
}

function lathe(points: number[][]) {
  return new THREE.LatheGeometry(
    points.map(([x, y]) => new THREE.Vector2(x, y)),
    28,
  );
}

function paintLabel(text: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const g = canvas.getContext("2d");
  if (g) {
    g.clearRect(0, 0, 128, 128);
    g.fillStyle = "#f6ead7";
    g.font = "700 72px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, 64, 70);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface Props {
  pieces: { sq: string; kind: string }[];
  flip: boolean;
  selected: string | null;
  targets: string[];
  movable: string[];
  last: string[];
  check: string | null;
  busy: boolean;
  onSquare: (sq: string) => void;
}

export function ChessScene({ pieces, flip, selected, targets, movable, last, check, busy, onSquare }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onSquareRef = useRef(onSquare);
  onSquareRef.current = onSquare;
  const propsRef = useRef({ pieces, flip, selected, targets, movable, last, check, busy });
  propsRef.current = { pieces, flip, selected, targets, movable, last, check, busy };

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
    const target = new THREE.Vector3(0, 0.2, 0);
    let yaw = 0.28;
    let pitch = 0.62;
    let dist = 16;
    const aim = () => {
      camera.position.set(
        target.x + Math.sin(pitch) * Math.sin(yaw) * dist,
        target.y + Math.cos(pitch) * dist,
        target.z + Math.sin(pitch) * Math.cos(yaw) * dist,
      );
      camera.lookAt(target);
    };
    aim();

    scene.add(new THREE.HemisphereLight(0xfff6ea, 0x1a120c, 0.9));
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.35);
    sun.position.set(-5, 14, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 2;
    sun.shadow.camera.far = 32;
    sun.shadow.camera.left = -8;
    sun.shadow.camera.right = 8;
    sun.shadow.camera.top = 8;
    sun.shadow.camera.bottom = -8;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xc5d4ff, 0.4);
    fill.position.set(7, 6, -5);
    scene.add(fill);

    const table = new THREE.Mesh(
      new THREE.CylinderGeometry(7.6, 7.9, 0.36, 64),
      new THREE.MeshStandardMaterial({ color: 0x1a120c, roughness: 0.8 }),
    );
    table.position.y = -0.46;
    table.receiveShadow = true;
    scene.add(table);

    const board = new THREE.Group();
    scene.add(board);

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(9.15, 0.32, 9.15),
      new THREE.MeshStandardMaterial({ color: 0x4a2918, roughness: 0.58, metalness: 0.04 }),
    );
    frame.position.y = -0.06;
    frame.castShadow = true;
    frame.receiveShadow = true;
    board.add(frame);

    const lip = new THREE.Mesh(
      new THREE.BoxGeometry(8.28, 0.05, 8.28),
      new THREE.MeshStandardMaterial({ color: 0xc6a15b, roughness: 0.35, metalness: 0.65 }),
    );
    lip.position.y = 0.08;
    board.add(lip);

    const squareGeo = new THREE.BoxGeometry(0.96, 0.07, 0.96);
    const squares: THREE.Mesh[] = [];
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const dark = (file + rank) % 2 === 0;
        const mesh = new THREE.Mesh(
          squareGeo,
          new THREE.MeshStandardMaterial({ color: dark ? 0x6b3e24 : 0xf4e7d0, roughness: dark ? 0.74 : 0.52 }),
        );
        const [x, z] = xz(file, rank);
        mesh.position.set(x, 0.14, z);
        mesh.receiveShadow = true;
        mesh.userData.sq = `${FILES[file]}${rank + 1}`;
        board.add(mesh);
        squares.push(mesh);
      }
    }

    const labelTex = new Map<string, THREE.CanvasTexture>();
    const label = (text: string, x: number, z: number) => {
      let tex = labelTex.get(text);
      if (!tex) {
        tex = paintLabel(text);
        labelTex.set(text, tex);
      }
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
      sprite.position.set(x, 0.28, z);
      sprite.scale.set(0.34, 0.34, 1);
      board.add(sprite);
    };
    for (let i = 0; i < 8; i++) {
      label(FILES[i], xz(i, 0)[0], xz(i, 0)[1] + 0.78);
      label(String(i + 1), xz(0, i)[0] - 0.78, xz(0, i)[1]);
    }

    const whiteMat = new THREE.MeshPhysicalMaterial({ color: 0xf7f1e6, roughness: 0.28, metalness: 0.04, clearcoat: 0.45, clearcoatRoughness: 0.28 });
    const blackMat = new THREE.MeshPhysicalMaterial({ color: 0x1c140f, roughness: 0.34, metalness: 0.12, clearcoat: 0.35, clearcoatRoughness: 0.3 });
    const slitMat = new THREE.MeshStandardMaterial({ color: 0x0c0907, roughness: 0.6 });
    const geos = {
      pawn: lathe([[0, 0], [0.3, 0], [0.33, 0.05], [0.22, 0.1], [0.13, 0.18], [0.11, 0.4], [0.18, 0.5], [0.1, 0.56], [0.16, 0.68], [0.05, 0.76], [0, 0.78]]),
      rook: lathe([[0, 0], [0.32, 0], [0.34, 0.06], [0.24, 0.12], [0.2, 0.2], [0.2, 0.58], [0.3, 0.64], [0.3, 0.78], [0.18, 0.82], [0, 0.82]]),
      bishop: lathe([[0, 0], [0.3, 0], [0.32, 0.05], [0.2, 0.12], [0.12, 0.22], [0.1, 0.55], [0.18, 0.66], [0.08, 0.78], [0.05, 0.96], [0, 1.02]]),
      queen: lathe([[0, 0], [0.32, 0], [0.34, 0.05], [0.22, 0.12], [0.13, 0.22], [0.12, 0.62], [0.22, 0.74], [0.12, 0.84], [0.16, 0.98], [0, 1.02]]),
      king: lathe([[0, 0], [0.33, 0], [0.35, 0.06], [0.24, 0.12], [0.14, 0.22], [0.13, 0.66], [0.24, 0.78], [0.14, 0.88], [0.1, 1.02], [0, 1.05]]),
      merlon: new THREE.BoxGeometry(0.08, 0.12, 0.08),
      crown: new THREE.SphereGeometry(0.045, 12, 10),
      crossV: new THREE.BoxGeometry(0.045, 0.2, 0.045),
      crossH: new THREE.BoxGeometry(0.14, 0.045, 0.045),
      slit: new THREE.BoxGeometry(0.02, 0.16, 0.08),
      mitre: new THREE.SphereGeometry(0.055, 12, 10),
      head: new THREE.SphereGeometry(0.15, 18, 14),
      snout: new THREE.ConeGeometry(0.07, 0.2, 12),
      ear: new THREE.ConeGeometry(0.04, 0.11, 8),
      neck: new THREE.CylinderGeometry(0.07, 0.11, 0.22, 14),
    };

    const shade = (kind: string) => (kind.startsWith("w") ? whiteMat : blackMat);
    const build = (kind: string) => {
      const mat = shade(kind);
      const type = kind[1];
      const group = new THREE.Group();
      const add = (mesh: THREE.Mesh) => {
        mesh.castShadow = true;
        mesh.material = type === "B" && mesh.userData.slit ? slitMat : mat;
        group.add(mesh);
      };
      if (type === "P") add(new THREE.Mesh(geos.pawn, mat));
      if (type === "R") {
        add(new THREE.Mesh(geos.rook, mat));
        for (const [x, z] of [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]] as const) {
          const merlon = new THREE.Mesh(geos.merlon, mat);
          merlon.position.set(x, 0.86, z);
          add(merlon);
        }
      }
      if (type === "B") {
        add(new THREE.Mesh(geos.bishop, mat));
        const ball = new THREE.Mesh(geos.mitre, mat);
        ball.position.y = 1.05;
        add(ball);
        const slit = new THREE.Mesh(geos.slit, slitMat);
        slit.position.set(0, 0.78, 0.06);
        slit.userData.slit = true;
        add(slit);
      }
      if (type === "Q") {
        add(new THREE.Mesh(geos.queen, mat));
        for (let i = 0; i < 8; i++) {
          const pearl = new THREE.Mesh(geos.crown, mat);
          const a = (i / 8) * Math.PI * 2;
          pearl.position.set(Math.cos(a) * 0.12, 0.96, Math.sin(a) * 0.12);
          add(pearl);
        }
      }
      if (type === "K") {
        add(new THREE.Mesh(geos.king, mat));
        const upright = new THREE.Mesh(geos.crossV, mat);
        upright.position.y = 1.16;
        add(upright);
        const bar = new THREE.Mesh(geos.crossH, mat);
        bar.position.y = 1.2;
        add(bar);
      }
      if (type === "N") {
        const foot = new THREE.Mesh(geos.pawn, mat);
        foot.scale.set(1.05, 0.55, 1.05);
        add(foot);
        const neck = new THREE.Mesh(geos.neck, mat);
        neck.position.y = 0.48;
        add(neck);
        const head = new THREE.Mesh(geos.head, mat);
        head.scale.set(0.95, 0.72, 1.55);
        head.position.set(0, 0.74, -0.1);
        head.rotation.x = 0.45;
        add(head);
        const snout = new THREE.Mesh(geos.snout, mat);
        snout.rotation.x = Math.PI / 2;
        snout.scale.set(1.15, 1.35, 1.15);
        snout.position.set(0, 0.7, -0.3);
        add(snout);
        const ear = new THREE.Mesh(geos.ear, mat);
        ear.position.set(0.05, 0.86, 0.02);
        ear.rotation.z = -0.4;
        add(ear);
        group.rotation.y = kind.startsWith("w") ? 0 : Math.PI;
      }
      group.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) mesh.castShadow = true;
      });
      return group;
    };

    const slots: { group: THREE.Group; sq: string; kind: string }[] = [];
    for (let i = 0; i < 32; i++) {
      const group = new THREE.Group();
      group.visible = false;
      group.userData.sq = "";
      board.add(group);
      slots.push({ group, sq: "", kind: "" });
    }

    const markerGeo = new THREE.CircleGeometry(0.16, 20);
    const captureGeo = new THREE.RingGeometry(0.28, 0.36, 24);
    const markers: THREE.Mesh[] = [];
    for (let i = 0; i < 24; i++) {
      const mesh = new THREE.Mesh(
        markerGeo,
        new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.2;
      mesh.visible = false;
      board.add(mesh);
      markers.push(mesh);
    }
    const rings: THREE.Mesh[] = [];
    for (let i = 0; i < 16; i++) {
      const mesh = new THREE.Mesh(
        captureGeo,
        new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.95, side: THREE.DoubleSide }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.2;
      mesh.visible = false;
      board.add(mesh);
      rings.push(mesh);
    }

    const place = (slot: (typeof slots)[number], sq: string, kind: string) => {
      if (slot.kind !== kind) {
        for (const child of [...slot.group.children]) slot.group.remove(child);
        slot.group.add(build(kind));
        slot.kind = kind;
      }
      const file = sq.charCodeAt(0) - 97;
      const rank = Number(sq[1]) - 1;
      const [x, z] = xz(file, rank);
      slot.group.position.set(x, 0.18, z);
      slot.group.visible = true;
      slot.group.userData.sq = sq;
      slot.sq = sq;
    };

    const propsNow = () => propsRef.current;
    let shown = "";
    const sync = () => {
      const p = propsNow();
      const key = [
        p.pieces.map((item) => item.sq + item.kind).join(","),
        p.flip ? 1 : 0,
        p.selected ?? "",
        p.targets.join(","),
        p.movable.join(","),
        p.last.join(","),
        p.check ?? "",
      ].join("|");
      board.rotation.y = p.flip ? Math.PI : 0;
      if (key === shown) return;
      shown = key;
      const occupied = new Map(p.pieces.map((item) => [item.sq, item.kind]));
      const staying = new Set<(typeof slots)[number]>();
      for (const slot of slots) {
        const kind = occupied.get(slot.sq);
        if (!slot.group.visible || !kind || kind !== slot.kind) continue;
        place(slot, slot.sq, kind);
        staying.add(slot);
        occupied.delete(slot.sq);
      }
      const idle = slots.filter((slot) => !staying.has(slot));
      for (const [sq, kind] of occupied) {
        const slot = idle.find((item) => item.group.visible && item.kind === kind) ?? idle[0];
        if (!slot) break;
        idle.splice(idle.indexOf(slot), 1);
        place(slot, sq, kind);
      }
      for (const slot of idle) slot.group.visible = false;

      const lastSet = new Set(p.last);
      const movable = new Set(p.movable);
      for (const mesh of squares) {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        const sq = mesh.userData.sq as string;
        const file = sq.charCodeAt(0) - 97;
        const rank = Number(sq[1]) - 1;
        const dark = (file + rank) % 2 === 0;
        const mode = sq === p.check ? "check" : sq === p.selected ? "sel" : lastSet.has(sq) ? "last" : "idle";
        mat.color.setHex(mode === "check" ? 0xef4444 : mode === "sel" ? 0x38bdf8 : mode === "last" ? (dark ? 0xc6a15b : 0xf3d48a) : dark ? 0x6b3e24 : 0xf4e7d0);
        mat.emissive.setHex(mode === "idle" ? 0x000000 : mat.color.getHex());
        mat.emissiveIntensity = mode === "idle" ? 0 : 0.28;
        mesh.userData.play = !p.busy && (movable.has(sq) || p.targets.includes(sq) || sq === p.selected);
      }
      const occupiedNow = new Set(p.pieces.map((item) => item.sq));
      let dot = 0;
      let ring = 0;
      for (const mesh of markers) mesh.visible = false;
      for (const mesh of rings) mesh.visible = false;
      for (const sq of p.targets) {
        const file = sq.charCodeAt(0) - 97;
        const rank = Number(sq[1]) - 1;
        const [x, z] = xz(file, rank);
        const mesh = occupiedNow.has(sq) ? rings[ring++] : markers[dot++];
        if (!mesh) continue;
        mesh.visible = true;
        mesh.position.x = x;
        mesh.position.z = z;
      }
    };

    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      sync();
      renderer.render(scene, camera);
    };
    tick();

    const ndc = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    const drag = { on: false, x: 0, y: 0, moved: false, onSquare: false };
    const pts = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    let pinched = false;

    const squareOf = (obj: THREE.Object3D | null) => {
      let current = obj;
      while (current) {
        if (typeof current.userData.sq === "string" && current.userData.sq) return current.userData.sq as string;
        current = current.parent;
      }
      return null;
    };
    const pick = (ev: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects([...slots.map((slot) => slot.group), ...squares], true);
      for (const hit of hits) {
        const sq = squareOf(hit.object);
        if (sq) return sq;
      }
      return null;
    };
    const playable = (sq: string | null) => {
      if (!sq) return false;
      const p = propsNow();
      return p.movable.includes(sq) || p.targets.includes(sq) || sq === p.selected;
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
      drag.on = true;
      drag.moved = false;
      drag.onSquare = playable(pick(ev));
      drag.x = ev.clientX;
      drag.y = ev.clientY;
    };
    const onPointerMove = (ev: PointerEvent) => {
      if (!pts.has(ev.pointerId) && !drag.on) {
        if (ev.target !== renderer.domElement) return;
        renderer.domElement.style.cursor = playable(pick(ev)) ? "pointer" : "grab";
        return;
      }
      if (pts.has(ev.pointerId)) pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (pts.size >= 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch > 0) dist = Math.min(28, Math.max(10, dist * (pinch / d)));
        pinch = d;
        aim();
        return;
      }
      if (!drag.on) return;
      const dx = ev.clientX - drag.x;
      const dy = ev.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 10) drag.moved = true;
      drag.x = ev.clientX;
      drag.y = ev.clientY;
      if (drag.onSquare && !drag.moved) return;
      yaw -= dx * 0.007;
      pitch = Math.min(1.15, Math.max(0.35, pitch + dy * 0.005));
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
      const sq = pick(ev);
      if (sq) onSquareRef.current(sq);
    };
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      dist = Math.min(28, Math.max(10, dist + ev.deltaY * 0.012));
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
      dist = Math.max(sphere.radius / Math.sin(vFov / 2), sphere.radius / Math.sin(hFov / 2)) * 1.28;
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
      for (const tex of labelTex.values()) tex.dispose();
      for (const geo of Object.values(geos)) geo.dispose();
      squareGeo.dispose();
      markerGeo.dispose();
      captureGeo.dispose();
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={hostRef} className="h-full w-full" aria-label="Échiquier en trois dimensions." />;
}
