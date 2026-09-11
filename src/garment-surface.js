// Exact, spatially indexed sampling of the garment's triangles. Accessories use
// both its surface depth and its skin weights, including at the waist/chest blend.
export function garmentSurface(geometry, weights) {
  const p = geometry.attributes.position, indices = geometry.index;
  const cell = .025, buckets = new Map();
  const key = (x, y) => `${x},${y}`;
  for (let i = 0; i < (indices ? indices.count : p.count); i += 3) {
    const ids = [0, 1, 2].map(j => indices ? indices.getX(i + j) : i + j);
    const [a, b, c] = ids.map(j => [p.getX(j), p.getY(j), p.getZ(j)]);
    if (Math.max(a[2], b[2], c[2]) < 0) continue;
    const det = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
    if (Math.abs(det) < 1e-10) continue;
    const triangle = { ids, a, b, c, det };
    for (let y = Math.floor(Math.min(a[1], b[1], c[1]) / cell); y <= Math.floor(Math.max(a[1], b[1], c[1]) / cell); y++) {
      for (let x = Math.floor(Math.min(a[0], b[0], c[0]) / cell); x <= Math.floor(Math.max(a[0], b[0], c[0]) / cell); x++) {
        const k = key(x, y);
        if (!buckets.has(k)) buckets.set(k, []);
        buckets.get(k).push(triangle);
      }
    }
  }
  return (x, y) => {
    let result = null;
    for (const { ids, a, b, c, det } of buckets.get(key(Math.floor(x / cell), Math.floor(y / cell))) || []) {
      const u = ((b[0] - x) * (c[1] - y) - (c[0] - x) * (b[1] - y)) / det;
      const v = ((c[0] - x) * (a[1] - y) - (a[0] - x) * (c[1] - y)) / det;
      const w = 1 - u - v;
      if (Math.min(u, v, w) < -1e-6) continue;
      const depth = u * a[2] + v * b[2] + w * c[2];
      if (result && result.depth >= depth) continue;
      const influence = new Map();
      for (const [j, blend] of [u, v, w].entries()) {
        const skin = weights[ids[j]];
        skin.ids.forEach((bone, k) => influence.set(bone, (influence.get(bone) || 0) + Math.max(0, blend) * skin.weights[k]));
      }
      const sorted = [...influence].filter(([, value]) => value > 1e-8).sort((a, b) => b[1] - a[1]).slice(0, 4);
      const total = sorted.reduce((sum, [, value]) => sum + value, 0);
      while (sorted.length < 4) sorted.push([0, 0]);
      result = { depth, ids: sorted.map(([bone]) => bone), weights: sorted.map(([, value]) => value / total) };
    }
    return result;
  };
}
