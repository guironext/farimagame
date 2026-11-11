"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RACE_FINISH, type Hazard } from "@/lib/games/race";

export interface RaceCarView {
  pos: number;
  lane: number;
  speed: number;
  shake: number;
  braking: boolean;
}

export interface RaceMotion {
  you: RaceCarView;
  rival: RaceCarView;
}

const IDLE_CAR: RaceCarView = { pos: 0, lane: 1, speed: 1, shake: 0, braking: false };

const LANE = 2.35;

export function RaceScene({ motion, hazards }: { motion: React.RefObject<RaceMotion>; hazards: { meter: number; hazard: Hazard }[] }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const motionRef = useRef(motion);
  const hazardsRef = useRef(hazards);
  motionRef.current = motion;
  hazardsRef.current = hazards;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.28;
    renderer.shadowMap.enabled = true;
    host.appendChild(renderer.domElement);
    renderer.domElement.className = "h-full w-full touch-none";

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070d18);
    scene.fog = new THREE.Fog(0x0c1428, 20, 72);

    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 140);
    camera.position.set(2.6, 2.2, 6.2);

    const disposed: { dispose: () => void }[] = [];
    const keep = <T extends { dispose: () => void }>(item: T) => {
      disposed.push(item);
      return item;
    };

    const sky = new THREE.Mesh(keep(new THREE.SphereGeometry(90, 28, 18)), keep(new THREE.MeshBasicMaterial({ map: keep(skyTexture()), side: THREE.BackSide, depthWrite: false })));
    scene.add(sky);

    scene.add(new THREE.HemisphereLight(0x9eb6e0, 0x1a2414, 0.55));
    const moon = new THREE.DirectionalLight(0xdbe7ff, 1.35);
    moon.position.set(-10, 18, 8);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    moon.shadow.camera.near = 2;
    moon.shadow.camera.far = 30;
    moon.shadow.camera.left = -12;
    moon.shadow.camera.right = 12;
    moon.shadow.camera.top = 10;
    moon.shadow.camera.bottom = -8;
    scene.add(moon);
    const warm = new THREE.DirectionalLight(0xffb36b, 0.45);
    warm.position.set(8, 6, -4);
    scene.add(warm);

    const asphalt = keep(roadTexture());
    const road = new THREE.Mesh(
      keep(new THREE.PlaneGeometry(7.2, 90)),
      keep(new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.62, metalness: 0.18 })),
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0, -32);
    road.receiveShadow = true;
    scene.add(road);

    const verge = new THREE.Mesh(
      keep(new THREE.PlaneGeometry(28, 90)),
      keep(new THREE.MeshStandardMaterial({ color: 0x142216, roughness: 1 })),
    );
    verge.rotation.x = -Math.PI / 2;
    verge.position.set(0, -0.04, -32);
    scene.add(verge);
    const gravelMat = keep(new THREE.MeshStandardMaterial({ color: 0x3a342c, roughness: 1 }));
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Mesh(keep(new THREE.PlaneGeometry(1.35, 90)), gravelMat);
      shoulder.rotation.x = -Math.PI / 2;
      shoulder.position.set(side * 4.25, -0.015, -32);
      scene.add(shoulder);
    }

    const youBuilt = buildCar(keep, 0xe11d48, 0xf5d78e, 0xfff1c2);
    const rivalBuilt = buildCar(keep, 0x2563eb, 0x7dd3fc, 0xdbeafe);
    youBuilt.car.position.z = -1.7;
    scene.add(youBuilt.car, rivalBuilt.car);

    const barrierMat = keep(new THREE.MeshStandardMaterial({ map: keep(barrierTexture()), roughness: 0.55 }));
    const steel = keep(new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.35, metalness: 0.7 }));
    const barriers: THREE.Group[] = [];
    const boardGeo = keep(new THREE.BoxGeometry(1.85, 0.62, 0.08));
    const footGeo = keep(new THREE.BoxGeometry(0.08, 0.55, 0.08));
    for (let i = 0; i < 14; i += 1) {
      const group = new THREE.Group();
      const board = new THREE.Mesh(boardGeo, barrierMat);
      board.position.y = 0.72;
      board.castShadow = true;
      const left = new THREE.Mesh(footGeo, steel);
      left.position.set(-0.7, 0.28, 0);
      const right = new THREE.Mesh(footGeo, steel);
      right.position.set(0.7, 0.28, 0);
      group.add(board, left, right);
      group.visible = false;
      scene.add(group);
      barriers.push(group);
    }

    const boostMat = keep(new THREE.MeshStandardMaterial({ color: 0x67e8f9, emissive: 0x06b6d4, emissiveIntensity: 0.9, roughness: 0.25 }));
    const arrowMat = keep(new THREE.MeshStandardMaterial({ color: 0xecfeff, emissive: 0xa5f3fc, emissiveIntensity: 1.4, roughness: 0.2 }));
    const arrowGeo = keep(arrowGeometry());
    const boosts: THREE.Group[] = [];
    for (let i = 0; i < 8; i += 1) {
      const group = new THREE.Group();
      const pad = new THREE.Mesh(keep(new THREE.BoxGeometry(1.45, 0.04, 2.4)), boostMat);
      pad.position.y = 0.03;
      group.add(pad);
      for (let n = 0; n < 3; n += 1) {
        const arrow = new THREE.Mesh(arrowGeo, arrowMat);
        arrow.position.set(0, 0.07, 0.55 - n * 0.55);
        arrow.rotation.x = -Math.PI / 2;
        group.add(arrow);
      }
      group.visible = false;
      scene.add(group);
      boosts.push(group);
    }

    const gantry = buildGantry(keep);
    scene.add(gantry);

    const facades = [facadeTexture(0xf6d48a), facadeTexture(0x7dd3fc), facadeTexture(0xf9a8d4)].map((tex) =>
      keep(new THREE.MeshStandardMaterial({ map: keep(tex), roughness: 0.72, metalness: 0.08 })),
    );
    const neonColors = [0xf43f5e, 0x22d3ee, 0xfbbf24];
    const lampMat = keep(new THREE.MeshStandardMaterial({ color: 0xfff1c2, emissive: 0xffc56b, emissiveIntensity: 2.4 }));
    const poleMat = keep(new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45, metalness: 0.55 }));
    const poolMat = keep(new THREE.MeshBasicMaterial({ color: 0xffc56b, transparent: true, opacity: 0.22, depthWrite: false }));
    const lamps: THREE.Group[] = [];
    const poleGeo = keep(new THREE.CylinderGeometry(0.05, 0.07, 4.4, 8));
    const headGeo = keep(new THREE.BoxGeometry(0.85, 0.1, 0.32));
    const poolGeo = keep(new THREE.CircleGeometry(1.6, 20));
    for (let i = 0; i < 12; i += 1) {
      const group = new THREE.Group();
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.y = 2.2;
      const head = new THREE.Mesh(headGeo, lampMat);
      head.position.y = 4.35;
      const pool = new THREE.Mesh(poolGeo, poolMat);
      pool.rotation.x = -Math.PI / 2;
      pool.position.y = 0.03;
      group.add(pole, head, pool);
      scene.add(group);
      lamps.push(group);
    }

    const blockGeo = keep(new THREE.BoxGeometry(2.4, 1, 3.2));
    const neonGeo = keep(new THREE.BoxGeometry(2.15, 0.08, 0.06));
    const blocks: THREE.Group[] = [];
    for (let i = 0; i < 12; i += 1) {
      const group = new THREE.Group();
      const height = 2.4 + (i % 5) * 1.15 + (i % 3) * 0.4;
      const mesh = new THREE.Mesh(blockGeo, facades[i % facades.length]);
      mesh.scale.y = height;
      mesh.position.y = height / 2;
      mesh.castShadow = true;
      const neon = new THREE.Mesh(
        neonGeo,
        keep(new THREE.MeshStandardMaterial({ color: neonColors[i % neonColors.length], emissive: neonColors[i % neonColors.length], emissiveIntensity: 1.8 })),
      );
      neon.position.y = height * 0.72;
      neon.position.z = 1.62;
      group.add(mesh, neon);
      scene.add(group);
      blocks.push(group);
    }

    const youSpin = { v: 0 };
    const rivalSpin = { v: 0 };
    let last = performance.now();
    let now = last;
    let dt = 0;
    let raf = 0;
    const pose = (group: THREE.Group, wheels: THREE.Group[], tail: THREE.MeshStandardMaterial, brake: THREE.MeshStandardMaterial, view: RaceCarView, spin: { v: number }, z: number, xBias: number) => {
      const targetX = (view.lane - 1) * LANE + xBias;
      const dx = targetX - group.position.x;
      group.position.x += dx * Math.min(1, dt * 7);
      group.position.y = Math.abs(Math.sin(now / 160)) * 0.012;
      group.position.z = z;
      group.rotation.z = THREE.MathUtils.lerp(group.rotation.z, dx * -0.28 + Math.sin(now / 38) * view.shake * 0.22, 0.18);
      group.rotation.y = THREE.MathUtils.lerp(group.rotation.y, dx * 0.16, 0.15);
      group.rotation.x = view.braking ? 0.045 : view.speed > 2 ? -0.03 : 0;
      tail.emissiveIntensity = view.braking ? 3.2 : 0.55 + view.speed * 0.25;
      brake.emissiveIntensity = view.braking ? 4 : 0.8;
      spin.v += dt * (7 + view.speed * 12);
      for (const wheel of wheels) wheel.rotation.x = spin.v;
      group.visible = z < 8 && z > -62;
    };
    const tick = () => {
      raf = requestAnimationFrame(tick);
      now = performance.now();
      dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const raw = motionRef.current.current;
      const you = raw?.you ?? IDLE_CAR;
      const rivalView = raw?.rival ?? IDLE_CAR;
      const pos = you.pos;
      asphalt.offset.y = pos / 10;

      const sideBySide = Math.abs(you.lane - rivalView.lane) < 0.2 && Math.abs(you.pos - rivalView.pos) < 2.8;
      const rivalBias = sideBySide ? (rivalView.lane >= 1 ? -1.95 : 1.95) : 0;
      pose(youBuilt.car, youBuilt.wheels, youBuilt.tailMat, youBuilt.brakeMat, you, youSpin, -1.7, 0);
      pose(rivalBuilt.car, rivalBuilt.wheels, rivalBuilt.tailMat, rivalBuilt.brakeMat, rivalView, rivalSpin, -1.7 - (rivalView.pos - you.pos), rivalBias);
      boostMat.emissiveIntensity = 0.7 + Math.sin(now / 140) * 0.45;
      arrowMat.emissiveIntensity = 1.1 + Math.sin(now / 110) * 0.6;

      const camX = youBuilt.car.position.x * 0.3 + 2.85 + Math.sin(now / 48) * you.shake * 0.06;
      camera.position.x += (camX - camera.position.x) * Math.min(1, dt * 4.5);
      camera.position.y = 2.35 + you.shake * 0.04;
      camera.position.z = youBuilt.car.position.z + 7.3;
      camera.lookAt(youBuilt.car.position.x - 0.2, 0.55, youBuilt.car.position.z - 1.6);
      const targetFov = 35 + you.speed * 1.2;
      camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 2.5);
      camera.updateProjectionMatrix();

      let wall = 0;
      let pad = 0;
      for (const item of hazardsRef.current) {
        const depth = item.meter - pos;
        if (depth < -6 || depth > 48) continue;
        const z = -depth;
        const x = (item.hazard.lane - 1) * LANE;
        if (item.hazard.kind === "wall" && wall < barriers.length) {
          const mesh = barriers[wall];
          wall += 1;
          mesh.visible = true;
          mesh.position.set(x, 0, z);
        } else if (item.hazard.kind === "boost" && pad < boosts.length) {
          const mesh = boosts[pad];
          pad += 1;
          mesh.visible = true;
          mesh.position.set(x, 0, z);
        }
      }
      for (let i = wall; i < barriers.length; i += 1) barriers[i].visible = false;
      for (let i = pad; i < boosts.length; i += 1) boosts[i].visible = false;

      const finishDepth = RACE_FINISH - pos;
      gantry.visible = finishDepth > 3 && finishDepth < 55;
      if (gantry.visible) gantry.position.set(0, 0, -finishDepth);

      const spacing = 18;
      const origin = Math.floor(pos / spacing) * spacing;
      for (let i = 0; i < blocks.length; i += 1) {
        const side = i % 2 === 0 ? -1 : 1;
        const meter = origin + Math.floor(i / 2) * spacing;
        blocks[i].position.x = side * 7.6;
        blocks[i].position.z = -(meter - pos);
        blocks[i].rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      }
      for (let i = 0; i < lamps.length; i += 1) {
        const side = i % 2 === 0 ? -1 : 1;
        const meter = origin + i * (spacing / 2);
        lamps[i].position.set(side * 5.15, 0, -(meter - pos));
        lamps[i].rotation.y = side > 0 ? Math.PI : 0;
      }

      renderer.render(scene, camera);
    };
    tick();

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
      renderer.dispose();
      for (const item of disposed) item.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={hostRef} className="h-full w-full" aria-label="Course de voiture en trois dimensions" />;
}

function carProfile() {
  const shape = new THREE.Shape();
  shape.moveTo(2.08, 0.3);
  shape.quadraticCurveTo(1.92, 0.5, 1.35, 0.5);
  shape.lineTo(0.62, 0.56);
  shape.quadraticCurveTo(0.28, 0.95, -0.18, 0.98);
  shape.quadraticCurveTo(-0.55, 0.86, -0.78, 0.62);
  shape.lineTo(-1.28, 0.56);
  shape.lineTo(-1.42, 0.9);
  shape.lineTo(-1.78, 0.9);
  shape.lineTo(-1.82, 0.58);
  shape.lineTo(-2.02, 0.4);
  shape.lineTo(-2.02, 0.18);
  shape.lineTo(-1.58, 0.18);
  shape.absarc(-1.16, 0.18, 0.38, Math.PI, 0, false);
  shape.lineTo(0.82, 0.18);
  shape.absarc(1.22, 0.18, 0.36, Math.PI, 0, false);
  shape.lineTo(2.08, 0.26);
  shape.closePath();
  const cabin = new THREE.Path();
  cabin.moveTo(0.48, 0.6);
  cabin.quadraticCurveTo(0.18, 0.9, -0.16, 0.9);
  cabin.lineTo(-0.48, 0.66);
  cabin.lineTo(-0.08, 0.58);
  cabin.closePath();
  shape.holes.push(cabin);
  return shape;
}

function buildCar(keep: <T extends { dispose: () => void }>(item: T) => T, color: number, accent: number, lamp: number) {
  const paint = keep(new THREE.MeshPhysicalMaterial({ color, roughness: 0.18, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.12 }));
  const glass = keep(new THREE.MeshPhysicalMaterial({ color: 0x10243d, roughness: 0.05, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.05, emissive: 0x0c4a6e, emissiveIntensity: 0.35 }));
  const tailMat = keep(new THREE.MeshStandardMaterial({ color: 0xff3b3b, emissive: 0xff1d1d, emissiveIntensity: 0.9 }));
  const brakeMat = keep(new THREE.MeshStandardMaterial({ color: 0xfff1f2, emissive: 0xff2d2d, emissiveIntensity: 0.8 }));
  const lampMat = keep(new THREE.MeshStandardMaterial({ color: lamp, emissive: lamp, emissiveIntensity: 2.4 }));
  const dark = keep(new THREE.MeshStandardMaterial({ color: 0x0b0d12, roughness: 0.55, metalness: 0.4 }));
  const rubber = keep(new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.92 }));
  const hub = keep(new THREE.MeshStandardMaterial({ color: accent, roughness: 0.25, metalness: 0.85 }));
  const stripeMat = keep(new THREE.MeshStandardMaterial({ color: accent, roughness: 0.32, metalness: 0.65, emissive: accent, emissiveIntensity: 0.15 }));

  const car = new THREE.Group();
  const bodyGeo = keep(new THREE.ExtrudeGeometry(carProfile(), { depth: 1.78, bevelEnabled: true, bevelThickness: 0.045, bevelSize: 0.05, bevelSegments: 3, curveSegments: 10 }));
  bodyGeo.translate(0, 0, -0.89);
  const body = new THREE.Mesh(bodyGeo, paint);
  body.rotation.y = -Math.PI / 2;
  body.castShadow = true;
  car.add(body);

  const cabin = new THREE.Mesh(keep(new THREE.BoxGeometry(0.92, 0.16, 1.05)), glass);
  cabin.position.set(0, 0.74, 0.02);
  car.add(cabin);

  const skirt = new THREE.Mesh(keep(new THREE.BoxGeometry(1.42, 0.06, 1.7)), dark);
  skirt.position.set(0, 0.2, 0.05);
  car.add(skirt);
  const splitter = new THREE.Mesh(keep(new THREE.BoxGeometry(1.7, 0.05, 0.28)), dark);
  splitter.position.set(0, 0.16, -1.95);
  car.add(splitter);
  for (const x of [-0.72, 0.72]) {
    const mirror = new THREE.Mesh(keep(new THREE.BoxGeometry(0.16, 0.08, 0.22)), dark);
    mirror.position.set(x, 0.72, -0.35);
    car.add(mirror);
  }
  const lightGeo = keep(new THREE.BoxGeometry(0.46, 0.1, 0.06));
  for (const x of [-0.46, 0.46]) {
    const tail = new THREE.Mesh(lightGeo, tailMat);
    tail.position.set(x, 0.46, 1.96);
    car.add(tail);
    const head = new THREE.Mesh(keep(new THREE.BoxGeometry(0.4, 0.12, 0.08)), lampMat);
    head.position.set(x, 0.4, -2.02);
    car.add(head);
  }
  const brake = new THREE.Mesh(keep(new THREE.BoxGeometry(1.15, 0.045, 0.04)), brakeMat);
  brake.position.set(0, 0.86, 1.78);
  car.add(brake);
  const stripe = new THREE.Mesh(keep(new THREE.BoxGeometry(0.08, 0.025, 2.55)), stripeMat);
  stripe.position.set(0, 0.62, -0.2);
  car.add(stripe);
  const plate = new THREE.Mesh(
    keep(new THREE.PlaneGeometry(0.46, 0.16)),
    keep(new THREE.MeshStandardMaterial({ map: keep(plateTexture()), roughness: 0.4 })),
  );
  plate.position.set(0, 0.32, 2.02);
  car.add(plate);

  const exhaustGeo = keep(new THREE.CylinderGeometry(0.05, 0.055, 0.18, 12));
  for (const x of [-0.32, 0.32]) {
    const pipe = new THREE.Mesh(exhaustGeo, hub);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(x, 0.2, 1.98);
    car.add(pipe);
  }

  const shadow = new THREE.Mesh(
    keep(new THREE.CircleGeometry(1.25, 24)),
    keep(new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthWrite: false })),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  car.add(shadow);

  const beam = new THREE.Mesh(
    keep(new THREE.ConeGeometry(0.7, 3.4, 14, 1, true)),
    keep(new THREE.MeshBasicMaterial({ color: lamp, transparent: true, opacity: 0.09, depthWrite: false, side: THREE.DoubleSide })),
  );
  beam.rotation.x = -Math.PI / 2;
  beam.position.set(0, 0.38, -3.55);
  car.add(beam);

  const wheels: THREE.Group[] = [];
  const tireGeo = keep(new THREE.CylinderGeometry(0.36, 0.36, 0.28, 28));
  const lipGeo = keep(new THREE.TorusGeometry(0.28, 0.028, 8, 24));
  const rimGeo = keep(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 24));
  const spokeGeo = keep(new THREE.BoxGeometry(0.03, 0.18, 0.02));
  for (const [x, z] of [
    [-0.92, -1.22],
    [0.92, -1.22],
    [-0.94, 1.16],
    [0.94, 1.16],
  ] as const) {
    const wheel = new THREE.Group();
    wheel.position.set(x, 0.36, z);
    const tire = new THREE.Mesh(tireGeo, rubber);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    const lip = new THREE.Mesh(lipGeo, hub);
    lip.rotation.y = Math.PI / 2;
    const rim = new THREE.Mesh(rimGeo, hub);
    rim.rotation.z = Math.PI / 2;
    wheel.add(tire, lip, rim);
    for (let i = 0; i < 5; i += 1) {
      const spoke = new THREE.Mesh(spokeGeo, hub);
      const angle = (i / 5) * Math.PI * 2;
      spoke.position.set(0, Math.cos(angle) * 0.1, Math.sin(angle) * 0.1);
      spoke.rotation.x = angle;
      wheel.add(spoke);
    }
    car.add(wheel);
    wheels.push(wheel);
  }

  const spot = new THREE.SpotLight(lamp, 8, 30, 0.4, 0.45, 1);
  spot.position.set(0, 0.55, -1.85);
  spot.target.position.set(0, 0.1, -18);
  car.add(spot, spot.target);
  const bodyLight = new THREE.PointLight(color, 0.8, 5, 2);
  bodyLight.position.set(0, 0.45, 0);
  car.add(bodyLight);
  return { car, wheels, tailMat, brakeMat };
}

function buildGantry(keep: <T extends { dispose: () => void }>(item: T) => T) {
  const gantry = new THREE.Group();
  const metal = keep(new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.35, metalness: 0.65 }));
  const towerGeo = keep(new THREE.BoxGeometry(0.22, 3.6, 0.22));
  const left = new THREE.Mesh(towerGeo, metal);
  const right = new THREE.Mesh(towerGeo, metal);
  left.position.set(-3.7, 1.8, 0);
  right.position.set(3.7, 1.8, 0);
  const beam = new THREE.Mesh(keep(new THREE.BoxGeometry(7.7, 0.22, 0.28)), metal);
  beam.position.y = 3.5;
  const banner = new THREE.Mesh(
    keep(new THREE.PlaneGeometry(6.4, 1.15)),
    keep(new THREE.MeshStandardMaterial({ map: keep(checkerTexture()), roughness: 0.55 })),
  );
  banner.position.y = 2.55;
  const title = new THREE.Mesh(
    keep(new THREE.PlaneGeometry(3.2, 0.48)),
    keep(new THREE.MeshBasicMaterial({ map: keep(finishTexture()), transparent: true })),
  );
  title.position.set(0, 2.55, 0.04);
  const bulbGeo = keep(new THREE.SphereGeometry(0.07, 10, 8));
  const bulbMat = keep(new THREE.MeshStandardMaterial({ color: 0xfef3c7, emissive: 0xfbbf24, emissiveIntensity: 1.6 }));
  gantry.add(left, right, beam, banner, title);
  for (let i = -3; i <= 3; i += 1) {
    const bulb = new THREE.Mesh(bulbGeo, bulbMat);
    bulb.position.set(i * 0.85, 3.35, 0.16);
    gantry.add(bulb);
  }
  return gantry;
}

function arrowGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.28);
  shape.lineTo(0.34, -0.08);
  shape.lineTo(0.12, -0.08);
  shape.lineTo(0.12, -0.28);
  shape.lineTo(-0.12, -0.28);
  shape.lineTo(-0.12, -0.08);
  shape.lineTo(-0.34, -0.08);
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false });
}

function roadTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 1024;
  const g = canvas.getContext("2d");
  const tex = new THREE.CanvasTexture(canvas);
  if (!g) return tex;
  const asphalt = g.createLinearGradient(0, 0, 512, 0);
  asphalt.addColorStop(0, "#12161e");
  asphalt.addColorStop(0.5, "#1c2433");
  asphalt.addColorStop(1, "#12161e");
  g.fillStyle = asphalt;
  g.fillRect(0, 0, 512, 1024);
  for (let i = 0; i < 1800; i += 1) {
    const shade = 22 + ((i * 37) % 28);
    g.fillStyle = `rgba(${shade},${shade + 4},${shade + 12},0.45)`;
    g.fillRect((i * 53) % 512, (i * 97) % 1024, 2, 2);
  }
  for (let y = 0; y < 1024; y += 28) {
    g.fillStyle = y % 56 === 0 ? "#f8fafc" : "#e11d48";
    g.fillRect(0, y, 22, 16);
    g.fillRect(490, y, 22, 16);
  }
  g.fillStyle = "#f6d36b";
  g.fillRect(28, 0, 8, 1024);
  g.fillRect(476, 0, 8, 1024);
  g.fillStyle = "rgba(248,250,252,0.92)";
  for (let y = 40; y < 1024; y += 120) {
    g.fillRect(166, y, 10, 52);
    g.fillRect(334, y, 10, 52);
  }
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 9);
  tex.anisotropy = 16;
  return tex;
}

function barrierTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 96;
  const g = canvas.getContext("2d");
  const tex = new THREE.CanvasTexture(canvas);
  if (!g) return tex;
  g.fillStyle = "#f97316";
  g.fillRect(0, 0, 256, 96);
  g.strokeStyle = "#fff7ed";
  g.lineWidth = 18;
  for (let x = -40; x < 300; x += 46) {
    g.beginPath();
    g.moveTo(x, 96);
    g.lineTo(x + 48, 0);
    g.stroke();
  }
  g.strokeStyle = "#9a3412";
  g.lineWidth = 6;
  g.strokeRect(3, 3, 250, 90);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function checkerTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 48;
  const g = canvas.getContext("2d");
  const tex = new THREE.CanvasTexture(canvas);
  if (!g) return tex;
  for (let x = 0; x < 32; x += 1) {
    for (let y = 0; y < 6; y += 1) {
      g.fillStyle = (x + y) % 2 === 0 ? "#f8fafc" : "#111827";
      g.fillRect(x * 8, y * 8, 8, 8);
    }
  }
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

function plateTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 96;
  const g = canvas.getContext("2d");
  const tex = new THREE.CanvasTexture(canvas);
  if (!g) return tex;
  g.fillStyle = "#f8fafc";
  g.fillRect(0, 0, 256, 96);
  g.fillStyle = "#111827";
  g.font = "700 54px sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("FARIMA", 128, 50);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function facadeTexture(litColor: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 256;
  const g = canvas.getContext("2d");
  const tex = new THREE.CanvasTexture(canvas);
  if (!g) return tex;
  const hex = `#${litColor.toString(16).padStart(6, "0")}`;
  g.fillStyle = "#121826";
  g.fillRect(0, 0, 128, 256);
  for (let y = 14; y < 246; y += 24) {
    for (let x = 10; x < 118; x += 20) {
      const lit = (x * 3 + y * 5) % 7 !== 0;
      g.fillStyle = lit ? hex : "#0b1020";
      g.fillRect(x, y, 11, 15);
    }
  }
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function finishTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const g = canvas.getContext("2d");
  const tex = new THREE.CanvasTexture(canvas);
  if (!g) return tex;
  g.clearRect(0, 0, 512, 96);
  g.fillStyle = "#fbbf24";
  g.font = "800 64px sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("ARRIVÉE", 256, 50);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function skyTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 256;
  const g = canvas.getContext("2d");
  const tex = new THREE.CanvasTexture(canvas);
  if (!g) return tex;
  const gradient = g.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, "#05070e");
  gradient.addColorStop(0.45, "#10192e");
  gradient.addColorStop(0.72, "#243656");
  gradient.addColorStop(1, "#c4b49a");
  g.fillStyle = gradient;
  g.fillRect(0, 0, 32, 256);
  g.fillStyle = "#f8f4e8";
  g.beginPath();
  g.arc(8, 70, 10, 0, Math.PI * 2);
  g.fill();
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
