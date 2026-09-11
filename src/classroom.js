import * as T from 'three';
import { createAvatar } from './avatar.js';
import { classroomRoster } from './classroom-profiles.js';
import { raiseClassroomHand } from './classroom-poses.js';

export const CLASSROOM_ACTIVITIES = [
  ['수업 듣기', 3, '#759785'], ['필기하기', 2, '#6686a2'],
  ['손들기', 2, '#d58b64'], ['고개 돌리기', 2, '#a67f9f'],
];
export const BREAK_ACTIVITIES = [
  ['이야기하기', 4, '#d58b64'], ['걸어 다니기', 2, '#6686a2'], ['자리에서 쉬기', 3, '#759785'],
];

// Camera controls live in the workspace; avatars only follow preset routines.
export async function createClassroom(onProgress = () => {}, context = 'general') {
  const roster = classroomRoster(context);
  const scene = new T.Scene();
  scene.background = new T.Color('#e9ede6');
  const camera = new T.OrthographicCamera(-7, 7, 6, -6, .1, 80);
  camera.position.set(10, 9, 12);
  camera.lookAt(0, .6, 0);
  const assets = new T.Group();
  scene.add(assets);
  const avatars = [];
  let scenario = 'lesson';
  let language = 'ko';
  const materials = new Map();
  const textures = [];
  const redrawSigns = [];
  const cube = new T.BoxGeometry(1, 1, 1);
  const material = color => {
    if (!materials.has(color)) materials.set(color, new T.MeshStandardMaterial({ color, roughness: .88 }));
    return materials.get(color);
  };
  function box(x, y, z, w, h, d, color, parent = assets) {
    const mesh = new T.Mesh(cube, material(color));
    mesh.position.set(x, y, z); mesh.scale.set(w, h, d);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function sign(texts, x, y, z, w, h, background, ink, fontSize = 40) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = Math.round(1024 * h / w);
    const ctx = canvas.getContext('2d');
    const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
    const redraw = () => {
      ctx.fillStyle = background; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `500 ${fontSize}px sans-serif`;
      const text = texts[language] || texts.ko;
      text.split('\n').forEach((line, i, lines) => ctx.fillText(line, 512, canvas.height / 2 + (i - (lines.length - 1) / 2) * fontSize * 1.7));
      texture.needsUpdate = true;
    };
    redraw(); redrawSigns.push(redraw);
    textures.push(texture);
    const mat = new T.MeshBasicMaterial({ map: texture });
    const plane = new T.Mesh(new T.PlaneGeometry(w, h), mat);
    plane.position.set(x, y, z); assets.add(plane);
    return plane;
  }
  function desk(x, z, tint) {
    box(x, .94, z, 1.12, .09, .64, '#d6b78b');
    box(x, .80, z, 1.0, .12, .48, '#bda381');
    for (const dx of [-.46, .46]) for (const dz of [-.23, .23]) box(x + dx, .44, z + dz, .045, .87, .045, '#87958d');
    // Open exercise book and a pencil, visible from the observation camera.
    box(x - .08, 1.001, z, .43, .018, .30, '#faf7ed');
    box(x - .08, 1.012, z, .008, .003, .29, '#d3c9b6');
    for (let i = 0; i < 4; i++) box(x + .02, 1.013, z - .09 + i * .05, .13, .002, .005, '#bec9c7');
    box(x + .31, 1.01, z + .05, .025, .025, .25, tint);
  }
  function chair(x, z, seatY, tint) {
    box(x, seatY - .035, z, .58, .07, .54, tint);
    box(x, seatY + .35, z + .26, .58, .39, .065, tint);
    for (const dx of [-.23, .23]) for (const dz of [-.20, .20]) box(x + dx, seatY / 2 - .04, z + dz, .035, seatY - .08, .035, '#87958d');
    for (const dx of [-.23, .23]) box(x + dx, seatY + .16, z + .25, .035, .4, .035, '#87958d');
  }
  function dispose() {
    for (const { avatar } of avatars) avatar.dispose();
    const geometries = new Set([cube]);
    const mats = new Set(materials.values());
    assets.traverse(obj => { if (obj.isMesh) { geometries.add(obj.geometry); mats.add(obj.material); } });
    geometries.forEach(g => g.dispose()); mats.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
    sun.shadow.dispose();
  }
  scene.add(new T.HemisphereLight('#fff7e7', '#9ba99d', 2.8));
  const sun = new T.DirectionalLight('#fff1d8', 3.2);
  sun.position.set(-3, 9, 4); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, far: 30 });
  sun.shadow.normalBias = .025; sun.shadow.bias = -.0002;
  scene.add(sun);
  const fill = new T.DirectionalLight('#dcecff', 1.2); fill.position.set(5, 5, -3); scene.add(fill);

  try {
    box(0, -.14, 0, 9.4, .28, 8.4, '#d2c6af');
    for (let i = 0; i < 17; i++) box(0, .006, -4 + i * .5, 9.3, .014, .012, '#bfb298');
    box(0, 1.75, -4.15, 9.4, 3.5, .15, '#f2eee2');
    box(-4.65, 1.75, 0, .15, 3.5, 8.4, '#e4e9dd');
    box(0, .32, -4.05, 9.25, .64, .035, '#bdcdbb');
    box(-4.55, .32, 0, .035, .64, 8.25, '#bdcdbb');
    // Windows are inset into the side wall; the other two walls are cut away.
    for (const z of [-2.2, .4, 3]) {
      box(-4.55, 2.15, z, .10, 1.8, 1.95, '#f8f6ed');
      box(-4.48, 2.15, z, .025, 1.61, 1.75, '#bad8de');
      box(-4.45, 2.15, z, .06, .065, 1.75, '#f8f6ed');
      box(-4.45, 2.15, z, .06, 1.65, .065, '#f8f6ed');
      box(-4.43, 1.22, z, .30, .08, 2.02, '#d6b78b');
    }
    box(-.9, 2.18, -4.00, 4.75, 1.78, .12, '#b99970');
    sign({ ko: context === 'korean' ? '오늘의 수업 · 국어\n서로의 생각을 존중하며 이야기해요' : '오늘의 교실\n서로의 생각을 들어보아요', en: context === 'korean' ? 'Today’s Lesson · Korean\nShare ideas with respect' : 'Today’s Classroom\nListen to each other' }, -.9, 2.18, -3.925, 4.56, 1.59, '#355d53', '#f4f3de', 49);
    box(-.9, 1.27, -3.87, 4.8, .075, .22, '#b99970');
    sign({ ko: context === 'korean' ? '2학년 1반' : 'CLASS 01', en: 'CLASS 2-1' }, -.9, 3.23, -4.055, 1.5, .25, '#f2eee2', '#657c6b', 90);
    box(3.3, 2.16, -4, 1.7, 1.5, .12, '#c4a886');
    sign({ ko: context === 'korean' ? '우리 반 알림\n국어 · 수학 · 영어\n서로 배려하는 교실' : '우리의 하루\n읽기 · 생각하기\n함께 배우기', en: context === 'korean' ? 'Class Notice\nKorean · Math · English\nA caring classroom' : 'Our day\nRead · Think\nLearn together' }, 3.3, 2.16, -3.925, 1.52, 1.32, '#eae1c8', '#66766a', 80);
    for (let i = 0; i < 4; i++) {
      box(2.1 + i * .6, .46, -3.75, .56, .92, .54, '#d2bc98');
      box(2.1 + i * .6, .50, -3.465, .43, .66, .015, ['#91aba3', '#d6bb7b', '#9eb2c1', '#bb9b9a'][i]);
    }
    desk(-2.4, -2.85, '#759785');
    const modes = ['listen', 'write', 'raise', 'look', 'listen', 'write', 'raise', 'look', 'listen'];
    for (let i = 0; i < 10; i++) {
      onProgress(i, 10);
      // Yield between models so the loading message paints and navigation stays usable.
      await new Promise(resolve => setTimeout(resolve, 0));
      const teacher = i === 9;
      const { config, background } = roster[i];
      const mode = teacher ? 'teach' : modes[i];
      // The lowered-sleeve bind stretches the armpit when raised. Use the existing
      // T-pose garment build for these students; the same rig still supports breaks.
      const avatar = createAvatar(config, { tpose: mode === 'raise' });
      avatars.push({ avatar, mode, phase: i * .79, config, background });
      avatar.group.name = `${teacher ? '교사' : '학생'} · ${config.name}`;
      if (teacher) {
        avatar.group.position.set(.1, 0, -2.65);
        avatar.group.rotation.y = .18;
      } else {
        const x = -2.45 + (i % 3) * 2.25;
        const z = -.80 + Math.floor(i / 3) * 1.72;
        avatar.pose('sit');
        // Align the seat to this avatar's lowered pelvis, including its height variation.
        const seatY = avatar.boneMap.Hips.position.y - .085;
        chair(x, z + .37, seatY, ['#91aaa0', '#8eacb7', '#bd9f87'][i % 3]);
        desk(x, z - .32, config.shirtColor);
        avatar.group.position.set(x, 0, z + .37);
        avatar.group.rotation.y = Math.PI;
      }
      // Several skinned parts share a skeleton. Frustum bounds from the rest pose can
      // otherwise incorrectly hide a raised arm or a seated leg.
      avatar.group.traverse(obj => { if (obj.isSkinnedMesh) obj.frustumCulled = false; });
      scene.add(avatar.group);
      avatars[i].seat = avatar.group.position.clone();
      avatars[i].lessonMode = mode;
      avatars[i].lessonRotation = avatar.group.rotation.y;
    }
  } catch (error) { dispose(); throw error; }

  // Remove near walls when orbiting around the cutaway so the room stays visible.
  const backWall = assets.children.filter(obj => obj.position.z < -3.8);
  const sideWall = assets.children.filter(obj => obj.position.x < -4.3);
  function setScenario(next) {
    if (!['lesson', 'break'].includes(next)) return;
    scenario = next;
    const breakModes = ['chat', 'chat', 'chat', 'chat', 'rest', 'rest', 'walk', 'walk', 'rest', 'supervise'];
    const chatSpots = [[-.95, -2.65, Math.PI / 2], [.65, -2.65, -Math.PI / 2], [3.55, -.45, 0], [3.55, 1.1, Math.PI]];
    avatars.forEach((entry, i) => {
      entry.mode = next === 'lesson' ? entry.lessonMode : breakModes[i];
      entry.avatar.group.position.copy(entry.seat);
      entry.avatar.group.rotation.y = entry.lessonRotation;
      if (next === 'break' && i < 4) {
        const [x, z, rotation] = chatSpots[i];
        entry.avatar.group.position.set(x, 0, z);
        entry.avatar.group.rotation.y = rotation;
      } else if (next === 'break' && i === 9) {
        entry.avatar.group.position.set(-3.65, 0, -2.7);
        entry.avatar.group.rotation.y = .5;
      }
    });
    update(0);
  }
  function update(time) {
    backWall.forEach(obj => { obj.visible = camera.position.z > -3.9; });
    sideWall.forEach(obj => { obj.visible = camera.position.x > -4.4; });
    for (const [i, { avatar: a, mode, phase }] of avatars.entries()) {
      const t = time + phase;
      let poseTime = t;
      let poseMode = ['teach', 'chat'].includes(mode) ? 'talk' : mode === 'supervise' ? 'idle' : 'sit';
      if (mode === 'walk') {
        // Two separate aisles, with a short, eased turn at each end. Walking never
        // crosses the desks, chairs, or the two stationary conversation groups.
        const cycle = (t * .8) % 20;
        const smooth = v => v * v * (3 - 2 * v);
        let z, heading;
        if (cycle < 8.8) { z = -1.65 + cycle / 8.8 * 5.1; heading = 0; }
        else if (cycle < 10) { z = 3.45; heading = Math.PI * smooth((cycle - 8.8) / 1.2); }
        else if (cycle < 18.8) { z = 3.45 - (cycle - 10) / 8.8 * 5.1; heading = Math.PI; }
        else { z = -1.65; heading = Math.PI + Math.PI * smooth((cycle - 18.8) / 1.2); }
        a.group.position.set(i === 6 ? -1.325 : .925, 0, z);
        a.group.rotation.y = heading;
        poseMode = cycle < 8.8 || (cycle >= 10 && cycle < 18.8) ? 'walk' : 'idle';
        poseTime = t * .8;
      }
      a.pose(poseMode, poseTime);
      const b = a.boneMap;
      if (poseMode === 'sit') {
        b.Chest.rotation.z = Math.sin(t * .9) * .012;
        if (mode === 'write') {
          b.Head.rotation.x = .30;
          b.RightUpperArm.rotation.x = -.75;
          b.RightLowerArm.rotation.y = .95 + Math.sin(t * 2.4) * .06;
        } else if (mode === 'raise') {
          raiseClassroomHand(a);
        } else if (mode === 'look') {
          b.Head.rotation.y = Math.sin(t * .65) * .55;
          b.Neck.rotation.y = Math.sin(t * .65) * .12;
        } else {
          b.Head.rotation.x = -.15 + Math.sin(t * .8) * .04;
        }
      }
      if (mode === 'chat') {
        // Partners alternate speaking and listening while keeping eye contact.
        const speaking = Math.sin(time * .8 + (i % 2) * Math.PI) > 0;
        if (!speaking) a.pose('idle', t);
        b.Head.rotation.y = Math.sin(t * .7) * .09;
        b.Head.rotation.x = Math.sin(t * (speaking ? 1.5 : 2.2)) * .06;
      }
      a.setExpression('smile', ['teach', 'chat'].includes(mode) ? .45 : .22, Math.max(0, 1 - Math.abs((t % 5.2) - 4.9) / .12));
    }
  }
  function resize(width, height) {
    const aspect = width / Math.max(1, height);
    const halfHeight = Math.max(5.75, 7.0 / aspect);
    camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect;
    camera.top = halfHeight; camera.bottom = -halfHeight; camera.updateProjectionMatrix();
  }
  update(0);
  function setLanguage(next) { language = next === 'en' ? 'en' : 'ko'; redrawSigns.forEach(redraw => redraw()); }
  return { scene, camera, update, resize, dispose, setScenario, setLanguage,
    getStats: () => ({ avatars: avatars.length, students: 9, teachers: 1, scenario, context,
      poses: [...new Set(avatars.map(a => a.mode))], camera: camera.position.toArray(), zoom: camera.zoom,
      occupants: avatars.map(({ avatar, mode, config, background }, i) => ({ mode, role: i === 9 ? 'teacher' : 'student',
        name: config.name, background, hair: config.hair, hairColor: config.hairColor, shirt: config.shirt,
        position: avatar.group.position.toArray() })) }) };
}
