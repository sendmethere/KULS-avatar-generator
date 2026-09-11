import assert from 'node:assert/strict';
import * as T from 'three';
import { createAvatar } from '../src/avatar.js';
import { DEFAULT } from '../src/config.js';
import { garmentSurface } from '../src/garment-surface.js';

let probes = 0;
for (const age of ['adult', 'child']) for (const shirt of ['overalls', 'jacket', 'cardigan', 'polo']) {
  const a = createAvatar({ ...DEFAULT, age, shirt });
  try {
    const top = a.parts.find(p => p.name === `Top_${shirt}`);
    const geometry = top.geometry;
    const weights = Array.from({ length: geometry.attributes.position.count }, (_, i) => ({
      ids: Array.from({ length: 4 }, (_, j) => geometry.attributes.skinIndex.array[i * 4 + j]),
      weights: Array.from({ length: 4 }, (_, j) => geometry.attributes.skinWeight.array[i * 4 + j]),
    }));
    const sample = garmentSurface(geometry, weights);
    const details = a.parts.filter(p => /^(InnerTee|FrontBinding|FrontPocket|JacketLapel|PoloCollar|PoloPlacket|OverallBib|OverallStrap|BibPocket)/.test(p.name));
    for (const mode of ['relaxed', 'sit', 'talk', 'walk']) {
      a.pose(mode, .8); a.group.updateMatrixWorld(true); a.skeleton.update();
      const matrices = a.bones.map((bone, i) => new T.Matrix4().multiplyMatrices(bone.matrixWorld, a.skeleton.boneInverses[i]));
        for (const part of details) {
          assert.ok(part.geometry.index.count > 0, `${age} ${shirt} ${part.name}: empty surface`);
          const vertices = [...new Set(part.geometry.index.array)], p = part.geometry.attributes.position;
          for (let j = 0; j < vertices.length; j += 19) {
            const i = vertices[j], x = p.getX(i), y = p.getY(i), hit = sample(x, y);
            assert.ok(hit, `${part.name}: no supporting garment surface`);
            // Compare the supporting torso point, not an occluding forearm sleeve.
            const base = new T.Vector3(), front = new T.Vector3();
            for (let k = 0; k < 4; k++) {
              base.addScaledVector(new T.Vector3(x, y, hit.depth).applyMatrix4(matrices[hit.ids[k]]), hit.weights[k]);
              front.addScaledVector(new T.Vector3(x, y, hit.depth + 1).applyMatrix4(matrices[hit.ids[k]]), hit.weights[k]);
            }
            front.sub(base).normalize();
            const point = new T.Vector3(); part.getVertexPosition(i, point);
            const delta = point.sub(base), clearance = delta.dot(front);
            assert.ok(clearance > .001, `${age} ${shirt} ${mode} ${part.name}: intersects ${clearance.toFixed(5)}`);
            assert.ok(delta.length() < .025, `${age} ${shirt} ${mode} ${part.name}: detached detail`);
            probes++;
          }
        }
    }
  } finally { a.dispose(); }
}
console.log(`PASS: ${probes} posed garment attachment probes across adult/child bodies.`);
