"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const TILE = 0.86;

function xz(sq: number): [number, number] {
  const r = Math.floor(sq / 10);
  const c = sq % 10;
  return [(c - 4.5) * TILE, (r - 4.5) * TILE];
}

function manGeometry() {
  const pts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.3, 0),
    new THREE.Vector2(0.34, 0.05),
    new THREE.Vector2(0.3, 0.1),
    new THREE.Vector2(0.2, 0.15),
    new THREE.Vector2(0.24, 0.22),
    new THREE.Vector2(0.1, 0.28),
    new THREE.Vector2(0, 0.3),
  ];
  return new THREE.LatheGeometry(pts, 28);
}

interface Props {
  display: number[];
  flip: boolean;
  movable: number[];
  nextSquares: number[];
  selected: number | null;
  pending: number[];
  last: number[];
  busy: boolean;
  onSquare: (sq: number) => void;
}

export function DamesScene({ display, flip, movable, nextSquares, selected, pending, last, busy, onSquare }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onSquareRef = useRef(onSquare);
  onSquareRef.current = onSquare;
  const propsRef = useRef({ display, flip, movable, nextSquares, selected, pending, last, busy });
  propsRef.current = { display, flip, movable, nextSquares, selected, pending, last, busy };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    host.appendChild(renderer.domElement);
    renderer.domElement.className = "h-full w-full touch-none";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);
    let yaw = 0.18;
    let pitch = 0.58;
    let dist = 18;
    const aim = () => {
      camera.position.set(Math.sin(pitch) * Math.sin(yaw) * dist, Math.cos(pitch) * dist, Math.sin(pitch) * Math.cos(yaw) * dist);
      camera.lookAt(0, 0, 0);
    };
    aim();

    scene.add(new THREE.HemisphereLight(0xfff4e4, 0x1c1410, 0.85));
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
    sun.position.set(-6, 14, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 2;
    sun.shadow.camera.far = 30;
    sun.shadow.camera.left = -8;
    sun.shadow.camera.right = 8;
    sun.shadow.camera.top = 8;
    sun.shadow.camera.bottom = -8;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xc5d4ff, 0.4);
    fill.position.set(6, 5, -4);
    scene.add(fill);

    const board = new THREE.Group();
    scene.add(board);

    const table = new THREE.Mesh(
      new THREE.CylinderGeometry(7.4, 7.7, 0.38, 64),
      new THREE.MeshStandardMaterial({ color: 0x24160f, roughness: 0.78 }),
    );
    table.position.y = -0.36;
    table.receiveShadow = true;
    scene.add(table);

    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(9.35, 0.22, 9.35),
      new THREE.MeshStandardMaterial({ color: 0x5a341c, roughness: 0.62, metalness: 0.05 }),
    );
    slab.position.y = -0.04;
    slab.receiveShadow = true;
    slab.castShadow = true;
    board.add(slab);

    const brass = new THREE.Mesh(
      new THREE.BoxGeometry(9.05, 0.04, 9.05),
      new THREE.MeshStandardMaterial({ color: 0xd4b06a, roughness: 0.35, metalness: 0.7 }),
    );
    brass.position.y = 0.07;
    board.add(brass);

    const lightMat = new THREE.MeshStandardMaterial({ color: 0xf3e6cf, roughness: 0.55 });
    const cell = new THREE.BoxGeometry(TILE * 0.96, 0.06, TILE * 0.96);
    const darkSquares: THREE.Mesh[] = [];
    for (let sq = 0; sq < 100; sq++) {
      const r = Math.floor(sq / 10);
      const c = sq % 10;
      const dark = (r + c) % 2 === 1;
      const mat = dark
        ? new THREE.MeshStandardMaterial({ color: 0x1f6b45, roughness: 0.72 })
        : lightMat;
      const mesh = new THREE.Mesh(cell, mat);
      const [x, z] = xz(sq);
      mesh.position.set(x, 0.12, z);
      mesh.receiveShadow = true;
      mesh.userData.sq = dark ? sq : -1;
      board.add(mesh);
      if (dark) darkSquares.push(mesh);
    }

    const man = manGeometry();
    const crownGeo = new THREE.TorusGeometry(0.16, 0.035, 8, 18);
    const pieces: THREE.Mesh[] = [];
    for (let i = 0; i < 40; i++) {
      const mat = new THREE.MeshPhysicalMaterial({
        color: 0xf6f1e7,
        roughness: 0.28,
        metalness: 0.08,
        clearcoat: 0.65,
        clearcoatRoughness: 0.25,
      });
      const mesh = new THREE.Mesh(man, mat);
      mesh.castShadow = true;
      const crown = new THREE.Mesh(
        crownGeo,
        new THREE.MeshStandardMaterial({ color: 0xe8c56b, roughness: 0.3, metalness: 0.75 }),
      );
      crown.rotation.x = Math.PI / 2;
      crown.position.y = 0.3;
      mesh.add(crown);
      mesh.userData = { sq: -1, piece: 0, crown };
      mesh.visible = false;
      board.add(mesh);
      pieces.push(mesh);
    }

    const markers: THREE.Mesh[] = [];
    const markerGeo = new THREE.CircleGeometry(0.16, 20);
    for (let i = 0; i < 50; i++) {
      const mesh = new THREE.Mesh(
        markerGeo,
        new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.17;
      mesh.visible = false;
      board.add(mesh);
      markers.push(mesh);
    }

    const propsNow = () => propsRef.current;
    const sync = () => {
      const p = propsNow();
      board.rotation.y = p.flip ? Math.PI : 0;
      const movable = new Set(p.movable);
      const pending = new Set(p.pending);
      const lastSet = new Set(p.last);
      for (const mesh of darkSquares) {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        const sq = mesh.userData.sq as number;
        mat.emissive.setHex(sq === p.selected ? 0x1d4ed8 : lastSet.has(sq) ? 0x14532d : 0x000000);
        mat.emissiveIntensity = sq === p.selected || lastSet.has(sq) ? 0.45 : 0;
      }
      const occupied = new Map<number, number>();
      p.display.forEach((piece, sq) => {
        if (piece !== 0) occupied.set(sq, piece);
      });
      const place = (mesh: THREE.Mesh, sq: number, piece: number) => {
        const [x, z] = xz(sq);
        mesh.visible = true;
        mesh.position.set(x, 0.16, z);
        mesh.userData.sq = sq;
        mesh.userData.piece = piece;
        const king = Math.abs(piece) === 2;
        const mat = mesh.material as THREE.MeshPhysicalMaterial;
        mat.color.setHex(piece > 0 ? 0xf7f3ea : 0x1a120e);
        mat.emissive.setHex(sq === p.selected ? 0x38bdf8 : movable.has(sq) ? 0xfbbf24 : 0x000000);
        const ghost = pending.has(sq);
        mat.transparent = ghost;
        mat.opacity = ghost ? 0.35 : 1;
        (mesh.userData.crown as THREE.Mesh).visible = king;
        mesh.scale.setScalar(king ? 1.08 : 1);
        mesh.userData.clickable = !p.busy && (movable.has(sq) || p.nextSquares.includes(sq));
      };
      const staying = new Set<THREE.Mesh>();
      for (const mesh of pieces) {
        const sq = mesh.userData.sq as number;
        const piece = occupied.get(sq);
        if (!mesh.visible || piece == null || Math.sign(piece) !== Math.sign(mesh.userData.piece as number)) continue;
        place(mesh, sq, piece);
        staying.add(mesh);
        occupied.delete(sq);
      }
      const idle = pieces.filter((mesh) => !staying.has(mesh));
      for (const [sq, piece] of occupied) {
        const mesh =
          idle.find((item) => item.visible && Math.sign(item.userData.piece as number) === Math.sign(piece)) ?? idle[0];
        if (!mesh) break;
        idle.splice(idle.indexOf(mesh), 1);
        place(mesh, sq, piece);
      }
      for (const mesh of idle) mesh.visible = false;
      markers.forEach((mesh, i) => {
        const sq = p.nextSquares[i];
        mesh.visible = sq !== undefined;
        if (sq === undefined) return;
        const [x, z] = xz(sq);
        mesh.position.x = x;
        mesh.position.z = z;
      });
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
    const drag = { on: false, x: 0, y: 0, moved: false };
    const pts = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    let pinched = false;

    const pick = (ev: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects([...pieces.filter((m) => m.visible), ...darkSquares], false);
      return hits.find((h) => typeof h.object.userData.sq === "number" && h.object.userData.sq >= 0);
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
      drag.x = ev.clientX;
      drag.y = ev.clientY;
    };
    const onMove = (ev: PointerEvent) => {
      if (!pts.has(ev.pointerId) && !drag.on) {
        if (ev.target !== renderer.domElement) return;
        const hit = pick(ev);
        const sq = hit?.object.userData.sq as number | undefined;
        const play = sq != null && (propsNow().movable.includes(sq) || propsNow().nextSquares.includes(sq));
        renderer.domElement.style.cursor = play ? "pointer" : "grab";
        return;
      }
      if (pts.has(ev.pointerId)) pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (pts.size >= 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch > 0) dist = Math.min(22, Math.max(8.5, dist * (pinch / d)));
        pinch = d;
        aim();
        return;
      }
      if (!drag.on) return;
      const dx = ev.clientX - drag.x;
      const dy = ev.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 8) drag.moved = true;
      drag.x = ev.clientX;
      drag.y = ev.clientY;
      yaw -= dx * 0.007;
      pitch = Math.min(1.15, Math.max(0.28, pitch + dy * 0.005));
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
      const hit = pick(ev);
      const sq = hit?.object.userData.sq as number | undefined;
      if (sq != null && sq >= 0) onSquareRef.current(sq);
    };

    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      dist = Math.min(22, Math.max(8.5, dist + ev.deltaY * 0.01));
      aim();
    };

    renderer.domElement.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
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
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      renderer.domElement.removeEventListener("wheel", onWheel);
      renderer.dispose();
      man.dispose();
      crownGeo.dispose();
      cell.dispose();
      host.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={hostRef} className="h-full w-full" aria-label="Plateau de dames en trois dimensions, dix cases sur dix." />;
}
