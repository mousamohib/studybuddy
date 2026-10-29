// Scrawlie mascot: a real 3D sticky note with a face, tape, a peeling corner, ink-line arms and legs.
// Everything is driven by setState() each frame, so rendering is deterministic (frame-by-frame video).
import * as THREE from './node_modules/three/build/three.module.js';

const YELLOW = '#FFD43B', DEEP = '#E0B100', INK = '#1B1E3F';

export function createMascotRenderer(canvas, W, H) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camZ = 12, fov = 30;
  const camera = new THREE.PerspectiveCamera(fov, W / H, 0.1, 100);
  camera.position.set(0, 0, camZ);
  const unitsPerPx = (2 * camZ * Math.tan((fov / 2) * Math.PI / 180)) / H;
  const toWorld = (x, y) => [(x - W / 2) * unitsPerPx, -(y - H / 2) * unitsPerPx];

  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a5a50, 1.35));
  const sun = new THREE.DirectionalLight(0xffffff, 2.1);
  sun.position.set(-4, 6, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -12; sc.right = 12; sc.top = 12; sc.bottom = -12; sc.near = 1; sc.far = 40;
  sun.shadow.radius = 6;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xfff2c0, 0.6); rim.position.set(5, -2, 4); scene.add(rim);

  // The wall/desk behind the note: only shows the shadow.
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.32 }));
  wall.position.z = -0.9; wall.receiveShadow = true; scene.add(wall);

  // ---------- face texture ----------
  const fc = document.createElement('canvas'); fc.width = fc.height = 512;
  const g = fc.getContext('2d');
  const tex = new THREE.CanvasTexture(fc); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  let lastFace = '';
  function drawFace(f) {
    const key = JSON.stringify(f);
    if (key === lastFace) return; lastFace = key;
    const s = 512 / 100;
    g.setTransform(1, 0, 0, 1, 0, 0);
    const grad = g.createLinearGradient(0, 0, 512, 512);
    grad.addColorStop(0, '#FFE066'); grad.addColorStop(1, '#FFCB2B');
    g.fillStyle = grad; g.fillRect(0, 0, 512, 512);
    // paper fibres
    g.globalAlpha = 0.05; g.fillStyle = '#7a5a00';
    for (let i = 0; i < 260; i++) { const x = (i * 97.13) % 512, y = (i * 53.71 * 1.7) % 512; g.fillRect(x, y, 2, 1); }
    g.globalAlpha = 1;
    g.scale(s, s);
    g.translate(f.lookX ?? 0, f.lookY ?? 0);
    g.fillStyle = INK; g.strokeStyle = INK; g.lineCap = 'round'; g.lineJoin = 'round';
    const eye = (x, open) => {
      if (open > 0.15) { g.beginPath(); g.ellipse(x, 42, 5.2, 6.2 * open, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(x + 1.6, 40 - 2 * open, 1.5, 0, Math.PI * 2); g.fill(); g.fillStyle = INK; }
      else { g.lineWidth = 3; g.beginPath(); g.moveTo(x - 5, 42); g.quadraticCurveTo(x, 45, x + 5, 42); g.stroke(); }
    };
    const happyEye = (x) => { g.lineWidth = 3.4; g.beginPath(); g.moveTo(x - 5, 44); g.quadraticCurveTo(x, 37, x + 5, 44); g.stroke(); };
    if (f.eyes === 'happy') { happyEye(36); happyEye(62); }
    else if (f.eyes === 'wink') { eye(36, 1); happyEye(62); }
    else { eye(36, f.blink ?? 1); eye(62, f.blink ?? 1); }
    if (f.worried) { g.lineWidth = 2.6; g.beginPath(); g.moveTo(28, 33); g.lineTo(39, 29); g.moveTo(70, 33); g.lineTo(59, 29); g.stroke(); }
    g.lineWidth = 4.6;
    g.beginPath();
    if (f.mouth === 'worried') { g.moveTo(39, 63); g.quadraticCurveTo(49, 56, 59, 63); g.stroke(); }
    else if (f.mouth === 'o') { g.ellipse(49, 60, 4.5, 5.5, 0, 0, Math.PI * 2); g.fill(); }
    else if (f.mouth === 'grin') { g.moveTo(35, 55); g.quadraticCurveTo(49, 72, 63, 55); g.closePath(); g.fill();
      g.fillStyle = '#E5385F'; g.beginPath(); g.ellipse(49, 63.5, 6, 3, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = INK; }
    else { g.moveTo(36, 56); g.quadraticCurveTo(49, 67, 62, 56); g.stroke(); }
    if (f.blush) { g.fillStyle = 'rgba(240,69,126,0.35)'; g.beginPath(); g.ellipse(26, 54, 6, 3.5, 0, 0, 7); g.ellipse(72, 54, 6, 3.5, 0, 0, 7); g.fill(); }
    if (f.sweat) {
      g.fillStyle = '#5BB8FF'; g.beginPath(); const sy = 18 + (f.sweatY ?? 0);
      g.moveTo(80, sy); g.quadraticCurveTo(86, sy + 9, 80, sy + 12); g.quadraticCurveTo(74, sy + 9, 80, sy); g.fill();
    }
    tex.needsUpdate = true;
  }

  // ---------- body ----------
  const SEG = 28;
  const geo = new THREE.PlaneGeometry(1, 1, SEG, SEG);
  const base = geo.attributes.position.array.slice();
  const front = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.78, metalness: 0, side: THREE.FrontSide });
  const back = new THREE.MeshStandardMaterial({ color: DEEP, roughness: 0.85, side: THREE.BackSide });
  const root = new THREE.Group(); scene.add(root);
  const body = new THREE.Group(); root.add(body);
  const mF = new THREE.Mesh(geo, front), mB = new THREE.Mesh(geo, back);
  mF.castShadow = mB.castShadow = true;
  body.add(mF, mB);
  // tape strip on top
  const tape = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.12), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.62, roughness: 0.4 }));
  tape.position.set(0.02, 0.5, 0.012); tape.rotation.z = -0.06; body.add(tape);

  // ink-line limbs: a pivot group per limb with a capsule hanging from it
  const inkMat = new THREE.MeshStandardMaterial({ color: INK, roughness: 0.5 });
  const limb = (len, r) => { const p = new THREE.Group(); const c = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), inkMat); c.position.y = -len / 2; c.castShadow = true; p.add(c); return p; };
  const armL = limb(0.3, 0.022), armR = limb(0.3, 0.022);
  armL.position.set(-0.5, -0.02, 0); armR.position.set(0.5, -0.02, 0);
  const legL = limb(0.2, 0.024), legR = limb(0.2, 0.024);
  legL.position.set(-0.17, -0.5, 0); legR.position.set(0.17, -0.5, 0);
  const foot = () => { const f = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), inkMat); f.scale.set(1.5, 0.7, 1); f.position.set(0.03, -0.26, 0.02); f.castShadow = true; return f; };
  legL.add(foot()); legR.add(foot());
  body.add(armL, armR, legL, legR);

  function deform(peel, bend) {
    const p = geo.attributes.position.array;
    const d0 = 1 - peel * 0.95;                       // fold line along the bottom-right diagonal
    const ax = Math.SQRT1_2, ay = -Math.SQRT1_2;       // direction from centre to bottom-right corner
    for (let i = 0; i < p.length; i += 3) {
      let x = base[i], y = base[i + 1], z = 0;
      const d = (x - y);                               // 0 at centre line, 1 at the corner
      if (peel > 0 && d > d0) {
        const s = (d - d0) * Math.SQRT1_2;             // distance past the fold
        const ang = Math.min(Math.PI * 0.92, (s / 0.12) * 1.25 * peel + peel * 0.9);
        const along = s * Math.cos(ang), up = s * Math.sin(ang);
        x -= ax * (s - along); y -= ay * (s - along); z += up;
      }
      z += bend * (x * x * 0.6 - 0.15);
      p[i] = x; p[i + 1] = y; p[i + 2] = z;
    }
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
  }

  /** s: {x,y,size (px), rotX, rotY, rotZ, squash, peel, bend, face, armL, armR, legL, legR, visible, z} */
  function render(s) {
    root.visible = s.visible !== false;
    if (root.visible) {
      const [wx, wy] = toWorld(s.x, s.y);
      const k = s.size * unitsPerPx;
      root.position.set(wx, wy, s.z ?? 0);
      root.scale.setScalar(k);
      root.rotation.set(s.rotX ?? 0, s.rotY ?? 0, s.rotZ ?? 0);
      const sq = s.squash ?? 0;
      body.scale.set(1 + sq * 0.45, 1 - sq, 1);
      body.position.y = -sq * 0.5 * 0.5;
      deform(s.peel ?? 0.18, s.bend ?? 0);
      drawFace(s.face ?? {});
      armL.rotation.z = -(s.armL ?? 0.4); armR.rotation.z = (s.armR ?? 0.4);
      legL.rotation.z = -(s.legL ?? 0.06); legR.rotation.z = (s.legR ?? 0.06);
    }
    renderer.render(scene, camera);
  }
  return { render };
}
