import * as T from 'three';

// One closed, connected shell from crown to hem. The volume setting changes
// fullness along the lengths while keeping the forehead roots on the scalp.
export function createHairShell(c, { rx, ry, rz, headY }) {
  const perm = c.hair === 'dandy_perm';
  const loose = ['bob', 'long', 'waves'].includes(c.hair);
  const length = c.hair === 'bob' ? ry * .73 : loose ? ry + .18 : 0;
  const fullness = .033 + (c.hairVolume - .9) * .18;
  const smooth = T.MathUtils.smoothstep;
  function point(t, phi, inner = false) {
    const azimuth = Math.abs(Math.atan2(Math.sin(phi), Math.cos(phi)));
    const curtain = smooth(azimuth, .57, 1.28);
    const part = perm ? 1.28 - .32*Math.exp(-(((phi-.16)/.22)**2)) + .075*Math.sin(phi*7) : c.hair === 'sport' ? 1.10 : c.hair === 'dandy' ? 1.19 + .10 * Math.sin(phi - .4) - .14 * Math.exp(-(((phi - .50) / .18) ** 2)) : 1.07 - .22 * Math.exp(-(((phi - .14) / .30) ** 2));
    const short = ['sport','dandy','dandy_perm'].includes(c.hair);
    const backEnd = short ? T.MathUtils.lerp(c.hair==='sport'?1.42:1.59,1.86,smooth(azimuth,1.8,2.8)) : 1.91;
    const end = T.MathUtils.lerp(part, loose ? 1.64 : backEnd, curtain);
    const theta = t * end;
    const flowPhi = phi + (perm ? .32*Math.sin(phi-.16)*Math.sin(Math.PI*t) + .10*Math.sin(t*6)*Math.sin(phi*2) : .23*Math.sin(phi)*Math.sin(Math.PI*t));
    const ct = Math.cos(theta), st = Math.sin(theta);
    const width = ct < 0
      ? T.MathUtils.lerp(c.jaw, c.cheek, Math.min(1, (ct + 1) * 1.5))
      : T.MathUtils.lerp(c.cheek, c.forehead, ct);
    const rootTaper = 1 - (1 - curtain) * smooth(t, .70, 1);
    const permLift = perm ? (.022 + .012*Math.cos(phi*7+t*5))*Math.sin(Math.PI*t)**2 : 0;
    const pad = c.hair === 'sport' ? .009 + .016 * ct * ct : .009 + fullness * rootTaper + permLift;
    const grow = smooth(t, .40, 1);
    const tip = smooth(t, .84, 1);
    const bobTurn = c.hair === 'bob' ? .024 * tip * curtain : .010 * tip * curtain;
    const wave = c.hair === 'waves'
      ? .020 * Math.sin(t * 9 + Math.cos(phi * 3)) * grow * curtain : 0;
    const relief = .0019 * c.hairDetail * Math.sin(phi * 24 + t * 2)
      * Math.sin(Math.PI * t) ** 2;
    const radiusX = rx * width + pad + wave + relief - bobTurn + (loose ? .020 * Math.sin(Math.PI * grow) : 0);
    const radiusZ = rz + pad + wave * .8 + relief - bobTurn * .7;
    const thickness = inner ? .012 : 0;
    const result = new T.Vector3(
      st * Math.sin(flowPhi) * (radiusX - thickness),
      headY + ct * (ry + pad - thickness) - length * curtain * t ** 4,
      st * Math.cos(flowPhi) * (radiusZ - thickness)
    );
    // Check against the face at the final (draped) height, not the original scalp latitude.
    let q=(result.y-headY)/ry;if(q<-.5)q/=c.chin;
    if(Math.abs(q)<.998){
      const faceWidth=q<0?T.MathUtils.lerp(c.jaw,c.cheek,Math.min(1,(q+1)*1.5)):T.MathUtils.lerp(c.cheek,c.forehead,q);
      const cross=Math.sqrt(1-q*q),clearance=inner?.004:.016;
      const ax=rx*faceWidth*cross+clearance,az=rz*cross+clearance;
      const ratio=Math.hypot(result.x/ax,result.z/az);
      if(ratio>1e-6&&ratio<1){result.x/=ratio;result.z/=ratio;}
    }
    // Loose hair covers the ear region continuously instead of being pierced by it.
    const earY=(result.y-(headY-.025))/.145;
    if(loose&&Math.abs(earY)<1){
      const cover=Math.exp(-(((azimuth-Math.PI/2)/.27)**2));
      const target=rx*.98+.075*Math.sqrt(1-earY*earY)+(inner?.004:.016);
      if(Math.abs(result.x)<target)result.x=Math.sign(result.x)*T.MathUtils.lerp(Math.abs(result.x),target,cover);
    }
    return result;
  }
  const rows = 48, cols = 96, count = 1 + rows * cols;
  const positions = [], indices = [];
  for (let side = 0; side < 2; side++) {
    positions.push(...point(0, 0, side === 1).toArray());
    for (let row = 1; row <= rows; row++) {
      for (let col = 0; col < cols; col++) {
        const phi = -Math.PI + col / cols * Math.PI * 2;
        positions.push(...point(row / rows, phi, side === 1).toArray());
      }
    }
    const offset = side * count;
    const face = (a, b, d) => side === 0
      ? indices.push(offset + a, offset + b, offset + d)
      : indices.push(offset + a, offset + d, offset + b);
    for (let col = 0; col < cols; col++) face(0, 1 + col, 1 + (col + 1) % cols);
    for (let row = 0; row < rows - 1; row++) {
      for (let col = 0; col < cols; col++) {
        const next = (col + 1) % cols;
        const a = 1 + row * cols + col, b = a + cols;
        const d = 1 + row * cols + next, e = d + cols;
        face(a, b, d); face(b, e, d);
      }
    }
  }
  const hem = 1 + (rows - 1) * cols;
  for (let col = 0; col < cols; col++) {
    const a = hem + col, b = hem + (col + 1) % cols;
    indices.push(a, a + count, b, b, a + count, b + count);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(new Float32Array(positions.length / 3 * 2), 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  // Small tapered strokes use this exact surface, so they cannot peel away
  // from a separately scaled cap or side piece.
  const strands = [];
  if (c.hairDetail > .1 && c.hair !== 'sport') {
    for (let j = 0; j < 28; j++) {
      const phi = -Math.PI + (j + .5) / 28 * Math.PI * 2;
      const points = [];
      for (let k = 0; k <= 24; k++) {
        const t = .13 + k / 24 * .82;
        const p = point(t, phi);
        const radial = new T.Vector3(p.x / rx, (p.y - headY) / ry, p.z / rz).normalize();
        p.addScaledVector(radial, .0007);
        points.push(p);
      }
      const curve = new T.CatmullRomCurve3(points);
      const line = new T.TubeGeometry(curve, 40, .0010 * c.hairDetail, 5, false);
      const attr = line.attributes.position;
      for (let i = 0; i < attr.count; i++) {
        const t = Math.floor(i / 6) / 40;
        const center = curve.getPointAt(t);
        const taper = .15 + .85 * Math.sin(Math.PI * t);
        attr.setXYZ(i,
          center.x + (attr.getX(i) - center.x) * taper,
          center.y + (attr.getY(i) - center.y) * taper,
          center.z + (attr.getZ(i) - center.z) * taper);
      }
      line.computeVertexNormals();
      strands.push(line);
    }
  }
  return { geometry, strands };
}
