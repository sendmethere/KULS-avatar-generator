import * as T from 'three';
import { shirtGeometry, pantsGeometry, shirtFrontZ, vestGeometry } from './garment.js';
import { createHairShell } from './hair-shell.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { garmentSurface } from './garment-surface.js';
export const EXPRESSIONS = ['smile','serious','sad','angry','surprised','blink'];
const v = (x,y,z)=>new T.Vector3(x,y,z);
// 홍채 텍스처. 반지름 r 과 세로 위치로 색을 정한다. 위에서 들어온 빛이 홍채 아래쪽을
// 밝히므로 아래가 밝고 위가 어둡다. 가장자리에는 어두운 윤부륜을 두고, 왼쪽 위에 큰
// 하이라이트, 오른쪽 아래에 작은 반사를 넣는다.
const IRIS_N = 128;
const irisCache = new Map();
function irisTexture(hex, pupilSize) {
  const key = hex + '|' + pupilSize.toFixed(3);
  if (irisCache.has(key)) return irisCache.get(key);
  const n = IRIS_N, data = new Uint8Array(n * n * 4);
  const base = new T.Color(hex), col = new T.Color(), white = new T.Color(1, 1, 1);
  // eyeColor 는 기본값이 어두운 갈색이다. 곱하기만 하면 밝아지지 않고, 흰색을 섞으면
  // 채도가 빠져 회색이 된다. HSL 에서 명도만 올리고 채도는 오히려 더해야 색이 남는다.
  const dark = base.clone().offsetHSL(0, .05, -.08);
  const light = base.clone().offsetHSL(0, .13, .29);
  const limbal = base.clone().offsetHSL(0, .06, -.13);
  const pupilR = 0.30 * pupilSize;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const u = (i + .5) / n * 2 - 1, w = (j + .5) / n * 2 - 1;   // w: -1 아래, +1 위
    const r = Math.hypot(u, w), k = (j * n + i) * 4;
    // 위에서 들어온 빛이 홍채 아래쪽을 밝힌다. 가장자리로 갈수록 어두워진다.
    const down = 1 - (w + 1) / 2;
    const shade = Math.min(1, Math.max(0, (.18 + .92 * down) * (1 - .40 * r * r)));
    col.lerpColors(dark, light, shade);
    if (r > .90) col.copy(limbal);
    if (r < pupilR) col.setRGB(.072, .060, .054);
    const hi = Math.hypot(u + .34, w - .40), hi2 = Math.hypot(u - .30, w + .34);
    if (hi < .175) col.copy(white);
    else if (hi2 < .11) col.lerp(white, .55);
    data[k] = col.r * 255; data[k + 1] = col.g * 255; data[k + 2] = col.b * 255; data[k + 3] = 255;
  }
  const tex = new T.DataTexture(data, n, n, T.RGBAFormat);
  tex.colorSpace = T.SRGBColorSpace; tex.needsUpdate = true;
  tex.minFilter = T.LinearFilter; tex.magFilter = T.LinearFilter;
  irisCache.set(key, tex);
  return tex;
}

// Arch height by brow shape, as a function of outer-ness (-1 inner corner, +1 outer tail).
const BROW_ARCH = {
  soft: o => 1-o*o,
  straight: o => .12*(1-o*o),
  angled: o => 1-Math.abs(o-.35)/.85,
  rounded: o => 1.18*Math.pow(Math.max(0,1-o*o),.55),
};

// tpose: 옷을 T 포즈 자세로 만든다. 옷은 팔을 내린 자세로 만들어지므로 T 포즈에서
// 팔이 71도 돌아가고, 소매 안쪽 절반이 몸통에 묶인 채 남아 겨드랑이에 물갈퀴가 생긴다.
// 가중치를 어떻게 나눠도 없앨 수 없다. 보여 줄 자세로 옷을 만들면 변형 자체가 없다.
export function createAvatar(c, { animations = false, tpose = false } = {}) {
  const armAngle = tpose ? 0 : 1.25;
  const group = new T.Group(); group.name='Avatar';
  const mats = new Map(); const parts=[]; const facial=[];
  const mat=(color,roughness=.74,map=null,vcol=false)=>{ const k=color+roughness+(map?.uuid??'')+vcol; if(!mats.has(k)) mats.set(k,new T.MeshStandardMaterial({color,roughness,map,vertexColors:vcol})); return mats.get(k); };
  const skin=c.skin, hair=c.hairColor;
  const darken=(hex,f)=>'#'+new T.Color(hex).multiplyScalar(f).getHexString();
  const age=c.age==='child'?.76:c.age==='elder'?.97:1;
  const h=c.height*age, bulk=c.build*(c.age==='child'?.94:1), fem=c.body==='feminine', masc=c.body==='masculine';
  // Torso runs 10% longer than the .84h waistline would give, taken out of the legs so the
  // overall height, head and neck stay where they are.
  const shoulder=(c.age==='child'?1.34:1.39)*h, hip=shoulder-1.10*(shoulder-0.84*h), neck=shoulder+(c.age==='child'?.045:.08)*h;
  const headScale=c.age==='child'?1.05:1;
  const headReduction=c.age==='child'?.78*Math.sqrt(c.height):1;
  const rx=.305*c.headWidth*headScale, ry=.36*c.headLength*headScale, rz=.284*headScale;
  // 두개골은 구가 아니다. 얼굴 앞면은 이마에서 턱까지 이어지는 판판한 면이고, 뒤통수가
  // 앞보다 훨씬 깊다. 앞쪽 반구의 z 를 눌러 면을 만들고 뒤는 그대로 두면 앞뒤로 길어진다.
  // 정수리와 뒤통수는 건드리지 않도록 세로로 띠를 씌운다.
  // 하안부 깊이를 줄인다. 앞뒤로 긴 덩어리로 보이던 원인이다. 광대 위는 건드리지 않는다.
  const lowerDepth=q=>1-.09*T.MathUtils.clamp(-(q+.18)/.62,0,1);
  const faceFlat=(z0,q)=>(1-.15*Math.pow(Math.max(0,z0),1.25)*Math.exp(-Math.pow((q-.02)/.72,2)))*lowerDepth(q);
  // 턱선은 옆모습의 z 윤곽이다. x 만 줄이면 정면만 바뀌고 옆에서는 여전히 매끈한 달걀이다.
  // 아래로 갈수록 앞쪽은 밀어내고 뒤쪽은 당겨, 귀 밑에서 각을 이루고 턱끝이 앞으로 나오게 한다.
  const jawZ=(z0,q)=>{
    const low=T.MathUtils.clamp(-(q+.20)/.80,0,1);
    return 1+.20*low*low*Math.max(0,z0)-.20*low*Math.max(0,-z0);
  };
  // 코·입·눈을 얼굴 표면에서 역산하므로 두개골을 바꿔도 파츠가 따라온다.
  const faceSurfaceZ=(x,y)=>{
    let q=(y-headY)/ry;
    // 메시는 구면 y 에 chinF 를 곱해 배치한다. 여기서는 그 역을 근사해 같은 구면 좌표로
    // 되돌린다. 옛 공식(q/=chin)을 쓰면 턱 아래에서 실제 메시보다 뒤를 가리켜, 그 깊이를
    // 기준으로 놓은 구강과 치아가 얼굴에 가려진다.
    if(q<-.5)q/=1+(c.chin-1)*T.MathUtils.clamp((-.5-q)/.5,0,1);
    const width=q<0?T.MathUtils.lerp(c.jaw,c.cheek,Math.min(1,(q+1)*1.5)):T.MathUtils.lerp(c.cheek,c.forehead,q);
    const z0=Math.sqrt(Math.max(.025,1-q*q-(x/(rx*width))**2));
    return rz*z0*faceFlat(z0,q)*jawZ(z0,q);
  };
  // Children get a longer torso and a head that scales as a complete assembly.
  // Fit the chin above the shoulders instead of forcing an adult-sized head high up.
  const headY=c.age==='child'?shoulder+.032*h+ry*c.chin*headReduction:Math.max(1.71*h,shoulder+.012+ry*c.chin);
  // 턱이 짧아지면 이 값이 셔츠 상단(shoulder+.035h)보다 위로 올라가 구멍은 안 파이고
  // 칼라 토러스만 목에 링으로 남는다. 셔츠 안쪽으로 묶어 둔다.
  const collar=Math.min(headY-ry*c.chin*headReduction-.030*h,shoulder+.008*h);
  const eyeX=.115*c.eyeSpacing*c.headWidth, eyeY=headY+.035+c.eyeHeight, earZ0=-.012;
  const bones=[], boneMap={};
  const bone=(name,parent,pos)=>{ const b=new T.Bone();b.name=name; const p=v(...pos); if(parent){ const pb=boneMap[parent]; b.position.copy(p.clone().sub(pb.userData.rest)); pb.add(b); }else{b.position.copy(p);group.add(b);} b.userData.rest=p; boneMap[name]=b;bones.push(b);return b; };
  bone('Hips',null,[0,hip,0]);bone('Spine','Hips',[0,hip+.16*h,0]);bone('Chest','Spine',[0,shoulder-.15*h,0]);bone('UpperChest','Chest',[0,shoulder-.06*h,0]);bone('Neck','UpperChest',[0,neck,0]);bone('Head','Neck',[0,headY-.22*headReduction,0]);
  const shoulderScale=c.age==='child'?.90:1;
  const shoulderX=(masc?.242:fem?.202:.222)*bulk*shoulderScale;
  const armLen=.272*h, foreLen=.258*h;
  for(const [side,s] of [['Left',1],['Right',-1]]) {
    bone(side+'Shoulder','UpperChest',[s*.12*shoulderScale,shoulder,0]);bone(side+'UpperArm',side+'Shoulder',[s*shoulderX,shoulder,0]);bone(side+'LowerArm',side+'UpperArm',[s*(shoulderX+armLen),shoulder,0]);bone(side+'Hand',side+'LowerArm',[s*(shoulderX+armLen+foreLen),shoulder,0]);
    bone(side+'UpperLeg','Hips',[s*.11*bulk,hip,0]);bone(side+'LowerLeg',side+'UpperLeg',[s*.11*bulk,.47*h,0]);bone(side+'Foot',side+'LowerLeg',[s*.11*bulk,.12*h,0]);bone(side+'Toes',side+'Foot',[s*.11*bulk,.075*h,.12]);
    bone(side+'Eye','Head',[s*eyeX*headReduction,headY+(eyeY-headY)*headReduction,(faceSurfaceZ(eyeX,eyeY)-.050)*headReduction]);
  }
  group.updateMatrixWorld(true); const skeleton=new T.Skeleton(bones);
  function skinGeo(name,g,color,bn='Head',morphs=null,weightFn=null,map=null,vcol=false) {
    if(!map)g.deleteAttribute('uv');
    // A morph identical to the base is dead weight in the GLB, and a no-op `blink` on the
    // brows or mouth makes the driver's blink attenuation flatten their expression. Keep only
    // the shape keys that actually move, so "has a blink key" means "this mesh really blinks".
    let keys=EXPRESSIONS;
    if(morphs) {
      const base=g.attributes.position.array;
      const moves=a=>{for(let i=0;i<base.length;i++)if(Math.abs(a.array[i]-base[i])>1e-6)return true;return false;};
      keys=EXPRESSIONS.filter(e=>morphs[e]&&moves(morphs[e]));
      g.morphAttributes.position=keys.map(e=>morphs[e]);g.morphTargetsRelative=false;
    }
    const ids=[], weights=[]; const index=bones.indexOf(boneMap[bn]); const p=g.attributes.position;
    for(let i=0;i<p.count;i++) { const w=weightFn?.(p.getX(i),p.getY(i),p.getZ(i),i); const ws=w?.weights||[1,0,0,0];ids.push(...(w?.ids||[index,0,0,0]).map((id,j)=>ws[j]>1e-8?id:0));weights.push(...ws.map(weight=>weight>1e-8?weight:0)); }
    g.setAttribute('skinIndex',new T.Uint16BufferAttribute(ids,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
    const m=new T.SkinnedMesh(g,mat(color,.74,map,vcol));m.name=name;m.frustumCulled=false;m.castShadow=true;m.receiveShadow=true;
    group.add(m);m.bind(skeleton);if(morphs){m.morphTargetDictionary=Object.fromEntries(keys.map((e,i)=>[e,i]));m.updateMorphTargets();m.morphTargetDictionary=Object.fromEntries(keys.map((e,i)=>[e,i]));facial.push(m);}parts.push(m);return m;
  }
  const sphereGeo=(pos,scale,seg=24)=>new T.SphereGeometry(1,seg,16).scale(...scale).translate(...pos);
  const ell=(name,pos,scale,color,bn='Head',seg=24)=>skinGeo(name,sphereGeo(pos,scale,seg),color,bn);
  // 격자 곡면. 눈꺼풀 띠와 코가 함께 쓰므로 얼굴보다 앞에 둔다.
  const surface=(rows,cols,fn)=>{const positions=[],uvs=[],index=[];for(let y=0;y<=rows;y++)for(let x=0;x<=cols;x++){positions.push(...fn(x/cols,y/rows));uvs.push(x/cols,y/rows);}for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const a=y*(cols+1)+x,b=a+cols+1;index.push(a,b,a+1,b,b+1,a+1);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.setIndex(index);g.computeVertexNormals();return g;};
  const curveGeo=(points,r=.012)=>new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>v(...p))),24,r,8,false);
  const tube=(name,pts,r,col,bn='Head')=>skinGeo(name,curveGeo(pts,r),col,bn);
  // 길이 방향으로 굵기가 변하는 튜브. TubeGeometry 는 반지름이 일정해서 입술처럼
  // 가운데가 두껍고 끝이 가늘어지는 것을 만들 수 없다. taper(u) 는 0~1 위치를 받아 배율을 준다.
  const taperTube=(points,r,taper)=>{
    const path=new T.CatmullRomCurve3(points.map(p=>v(...p)));
    const g=new T.TubeGeometry(path,32,r,10,false),a=g.attributes.position;
    for(let i=0;i<a.count;i++){
      const u=Math.floor(i/11)/32,mid=path.getPointAt(u),f=taper(u);
      a.setXYZ(i,mid.x+(a.getX(i)-mid.x)*f,mid.y+(a.getY(i)-mid.y)*f,mid.z+(a.getZ(i)-mid.z)*f);
    }
    g.computeVertexNormals();return g;
  };
  const segmentGeo=(a,b,r1,r2)=>{const av=v(...a),bv=v(...b),d=bv.clone().sub(av);return new T.CylinderGeometry(r2,r1,d.length(),20,5).applyQuaternion(new T.Quaternion().setFromUnitVectors(v(0,1,0),d.normalize())).translate(...av.add(bv).multiplyScalar(.5).toArray());};
  const seg=(name,a,b,r1,r2,col,bn)=>skinGeo(name,segmentGeo(a,b,r1,r2),col,bn);
  // The head is one deformable ellipsoid; independent jaw, cheek, forehead and chin controls.
  // 48×36 이면 정점 간격이 세로 .031 이라 코밑 그늘(반경 .022) 같은 작은 음영이
  // 정점 사이로 빠져 사라진다. 정점 색으로 얼굴을 칠하려면 이 정도 분할이 필요하다.
  const headG=new T.SphereGeometry(1,96,64);const hp=headG.attributes.position;
  // 턱 폭을 선형으로 보간하면 매끈한 달걀이 되고 턱선이 생기지 않는다. 지수를 태워
  // 좁은 폭이 아래쪽에 더 오래 머물게 하면 턱이 각진다.
  for(let i=0;i<hp.count;i++){
    const y=hp.getY(i);
    // 위로 갈수록 좁아지면 물방울 모양이 된다. 두개골은 정수리 아래(마루뼈)가 가장 넓다.
    // 광대에서 이마로 가는 선에 완만한 부풀림을 얹어 위가 뾰족해지지 않게 한다.
    const width=y<0?T.MathUtils.lerp(c.jaw,c.cheek,Math.pow(Math.min(1,(y+1)*1.5),1.15))
                   :T.MathUtils.lerp(c.cheek,c.forehead,y)*(1+.055*Math.sin(Math.PI*Math.min(1,y*1.15)));
    // chin 을 y<-.5 에서만 곱하면 그 경계에 불연속이 생겨 턱선에 단이 진다.
    // 배율을 -.5 에서 1, -1 에서 chin 이 되도록 이어 준다. 곱셈이므로 1보다 작으면
    // 하관이 짧아진다(오프셋으로 처리했더니 부호가 뒤집혀 오히려 길어졌다).
    const chinF=1+(c.chin-1)*T.MathUtils.clamp((-.5-y)/.5,0,1);
    const x0=hp.getX(i),z0=hp.getZ(i);
    // 관자놀이는 둥근 구가 아니라 평면에 가깝다. 눈높이 위 옆면을 눌러 각을 준다.
    const temple=1-.09*Math.max(0,y-.05)*Math.max(0,Math.abs(x0)-.42)/.58;
    // 턱선. width 는 높이만 보므로 옆에서 보면 매끈한 달걀이 된다. 아래쪽 앞면을 더 좁혀
    // 광대에서 턱으로 내려가는 면을 만들면 귀 밑에서 턱끝까지 능선이 생긴다.
    const jaw=1-.15*Math.max(0,-(y+.12))*Math.max(0,z0)*1.2;
    hp.setXYZ(i,x0*rx*width*temple*jaw,headY+y*ry*chinF,z0*rz*faceFlat(z0,y)*jawZ(z0,y));
  }
  // 두피 반지름 표. 머리 정점을 방향(θ,φ)별로 타원체 정규화 반지름의 최대값으로 기록한다.
  // 헤어 캡·셸·컬은 이 값 안으로 들어오지 않게 한다. 마루뼈 부풀림이나 이마 폭 같은
  // 두개골 조형을 헤어 공식마다 따로 베끼면 하나를 고칠 때마다 두피가 헤어를 뚫고 나온다.
  const skullR=(()=>{
    const NT=36,NP=72,g=new Float32Array(NT*NP).fill(0);
    for(let i=0;i<hp.count;i++){
      const dx=hp.getX(i)/rx,dy=(hp.getY(i)-headY)/ry,dz=hp.getZ(i)/rz,r=Math.hypot(dx,dy,dz);
      const ft=Math.acos(T.MathUtils.clamp(dy/r,-1,1))/Math.PI*(NT-1),fp=(Math.atan2(dx,dz)+Math.PI)/(2*Math.PI)*NP;
      for(const it of [Math.floor(ft),Math.ceil(ft)])for(const ip of [Math.floor(fp),Math.ceil(fp)]){
        const k=Math.min(NT-1,it)*NP+((ip%NP)+NP)%NP;
        if(r>g[k])g[k]=r;
      }
    }
    // 빈 칸은 같은 θ 행에서 가까운 값으로
    for(let it=0;it<NT;it++)for(let ip=0;ip<NP;ip++){const k=it*NP+ip;if(g[k]>0)continue;
      for(let d=1;d<NP;d++){const a=it*NP+((ip-d+NP)%NP),b=it*NP+((ip+d)%NP);if(g[a]>0){g[k]=g[a];break;}if(g[b]>0){g[k]=g[b];break;}}
      if(g[k]<=0)g[k]=1;}
    return (theta,phi)=>{
      const ft=T.MathUtils.clamp(theta/Math.PI*(NT-1),0,NT-1),fp=(phi+Math.PI)/(2*Math.PI)*NP;
      const it=Math.floor(ft),ip=Math.floor(fp),tt=ft-it,tp=fp-ip,jt=Math.min(it+1,NT-1);
      const c=(a,b)=>g[a*NP+((b%NP)+NP)%NP];
      return T.MathUtils.lerp(T.MathUtils.lerp(c(it,ip),c(it,ip+1),tp),T.MathUtils.lerp(c(jt,ip),c(jt,ip+1),tp),tt);
    };
  })();
  // Orbital socket: a deep dish for the eyeball plus a brow ridge just above it. Without the
  // recess the eye reads as a ball stuck on a smooth face and every lid line looks unattached.
  for(let i=0;i<hp.count;i++){if(hp.getZ(i)>0){
    const dx=(Math.abs(hp.getX(i))-eyeX)/(.112*c.eyeSize),dy=(hp.getY(i)-eyeY)/(.104*c.eyeSize*c.eyeRoundness);
    const ridge=(hp.getY(i)-eyeY-.088*c.eyeSize)/(.046*c.eyeSize);
    hp.setZ(i,hp.getZ(i)-.026*Math.exp(-1.6*(dx*dx+dy*dy))+.007*Math.exp(-(dx*dx+ridge*ridge)));
  }}
  headG.computeVertexNormals();
  // 얼굴 음영. 값이 커 보이지만 선형 공간에서 곱하므로 체감은 절반쯤으로 압축된다.
  // UV 를 새로 파는 대신 정점 색으로 넣는다. 머리 정점이 1800개라 볼 홍조나
  // 눈두덩 그늘 같은 부드러운 얼룩에는 충분하고, UV 규약과 뒤통수 이음매 문제를 피한다.
  // 단색 얼굴 위에 눈만 정교하면 눈만 도드라져 보인다. 얼굴에도 정보를 준다.
  {
    const skinC=new T.Color(skin), tint=new T.Color();
    const blush=new T.Color(skin).offsetHSL(-.015,.20,.02);
    const col=[];
    for(let i=0;i<hp.count;i++){
      const x=hp.getX(i),y=hp.getY(i),z=hp.getZ(i);
      const front=Math.max(0,z/rz);
      let shade=1;
      // 눈두덩. 눈 바로 위가 파여 있으니 그늘이 진다.
      const ex1=(Math.abs(x)-eyeX)/(.105*c.eyeSize), ey1=(y-eyeY-.050)/.048;
      shade-=.34*front*Math.exp(-(ex1*ex1+ey1*ey1));
      // 콧방울 옆. 콧등은 밝고 그 옆이 어둡다.
      const nx=(Math.abs(x)-.040)/.028, ny=(y-(headY-.045))/.055;
      shade-=.30*front*Math.exp(-(nx*nx+ny*ny));
      // 코 밑 그늘과 아랫입술 밑 그늘. 얼굴이 밋밋해 보이는 큰 이유다.
      const ux=x/.045, uy=(y-(headY-.105))/.022;
      shade-=.22*front*Math.exp(-(ux*ux+uy*uy));
      const lx=x/.055, ly=(y-(headY-.196))/.026;
      shade-=.18*front*Math.exp(-(lx*lx+ly*ly));
      // 턱 아래와 이마 위. 구형이라 저절로 생기는 음영보다 조금 더 준다.
      shade-=.20*Math.max(0,-(y-headY)/ry-.50)+.11*Math.max(0,(y-headY)/ry-.50);
      tint.copy(skinC).multiplyScalar(shade);
      // 볼 홍조.
      const bx=(Math.abs(x)-.118)/.062, by=(y-(headY-.052))/.044;
      tint.lerp(blush,.55*front*Math.exp(-(bx*bx+by*by)));
      col.push(tint.r,tint.g,tint.b);
    }
    headG.setAttribute('color',new T.Float32BufferAttribute(col,3));
  }
  skinGeo('Face',headG,'#ffffff','Head',null,null,null,true);
  // 목. 두개골 중심이 앞면 평탄화 때문에 z≈-.022 로 뒤에 있는데 목이 z=0 에 있으면
  // 뒤통수가 목 위로 튀어나와 보인다. 뒤로 옮기고, 위로 갈수록 벌려 턱 아래로 흘려 넣는다.
  {
    const g=sphereGeo([0,0,0],[.088,.150,.092],28),p=g.attributes.position;
    for(let i=0;i<p.count;i++){
      const t=p.getY(i)/.150;
      // 위로는 턱 아래로 흘려 넣고, 아래로는 어깨로 퍼뜨린다(승모근). 원통처럼 보이지 않게.
      const f=1+.38*Math.max(0,t)**2+.28*Math.max(0,-t)**2;
      p.setXYZ(i,p.getX(i)*f,p.getY(i),p.getZ(i)*f);
    }
    g.computeVertexNormals();if(c.age==='child')g.scale(.85,.70,.85);g.translate(0,neck+.018,-.025);
    skinGeo('Neck',g,skin,'Neck');
  }
  for(const [side,s] of [['Left',1],['Right',-1]]) {
    // 귀 크기가 고정이면 얼굴을 좁혔을 때 혼자 남아 밖으로 튄다. 얼굴 폭을 따라가게 한다.
    // 귀는 머리 표면에서 역산해 앉힌다. 고정 배율이면 z 를 옮길 때마다 파묻히거나 뜬다.
    // 위치는 턱 관절 바로 뒤, 눈썹과 코밑 사이 높이다.
    const earY=headY-.030, earZ=-.012;
    const earQ=(earY-headY)/ry;
    // 귀 최대 |x| 0.270 대 같은 높이 헤어 0.353 으로 귀는 셸을 뚫지 않는다(실측).
    // 예전에 귀를 안으로 넣는 보정을 넣었다가 근거가 없어 되돌렸다.
    const earX=rx*Math.sqrt(Math.max(.05,1-earQ*earQ-(earZ/rz)**2));
    ell(side+'Ear',[s*earX,earY,earZ],[.052*c.headWidth,.082,.038*c.headWidth],skin);
    ell(side+'EarInner',[s*(earX+.018*c.headWidth),earY,earZ+.006],[.022,.042,.014],darken(skin,.77));
    // Cartoon eyes: rounded crown, flatter lower edge, thin iris and no painted catchlight.
    // 안구 깊이는 얼굴 표면에서 역산한다. 상수로 두면 두개골 모양을 바꿀 때마다
    // 흰자가 얼굴 밖으로 튀거나 안으로 파묻힌다.
    const eyeZ=faceSurfaceZ(eyeX,eyeY)-.050;
    const ew=.083*c.eyeSize, eh=.088*.975*c.eyeSize*c.eyeRoundness;
    const angle=s*c.eyeTilt, ex=s*eyeX;
    // 아몬드 눈매. 안쪽 끝을 낮추고 바깥 끝을 올린 뒤 양 끝을 좁혀 뾰족하게 만든다.
    // 흰자와 눈꺼풀 곡선 양쪽에 같은 함수를 걸어야 외곽선이 흰자를 그대로 따라간다.
    const almond=(x,y)=>{
      const u=s*(x-ex)/ew, a=c.eyeAlmond;
      const lift=a*eh*(u>0?.46*u*u:-.20*u*u);
      // 끝으로 갈수록 세로로 눌러 뾰족하게 만든다.
      const pinch=1-a*.40*u*u*u*u;
      return eyeY+(y-eyeY)*pinch+lift;
    };
    const irx=ew*.60*c.irisSize, iry=Math.min(eh*.83,eh*.71*c.irisSize);
    function eyeMorphs(g) {
      const morphs={};
      for(const e of EXPRESSIONS){const a=g.attributes.position.clone();const f={blink:.035,smile:.94,serious:.82,sad:.94,angry:.79,surprised:1.08}[e]||1;for(let i=0;i<a.count;i++){const axis=eyeY+Math.sin(angle)*(a.getX(i)-ex);a.setY(i,axis+(a.getY(i)-axis)*f);}morphs[e]=a;}
      return morphs;
    }
    function eyeMesh(name,g,color,bn='Head',map=null,vcol=false) {return skinGeo(name,g,color,bn,eyeMorphs(g),null,map,vcol);}
    function eyePart(name,pos,scale,color,bn='Head') {
      const g=sphereGeo([0,0,0],scale,32);
      let vcol=false;
      if(name.endsWith('EyeWhite')){
        const p=g.attributes.position;
        // Midpoint of the round and flat-bottom contours: preserve the dome, soften the base.
        for(let i=0;i<p.count;i++){
          let y=p.getY(i);
          if(y<0)y=.5*(y-eh*.74*Math.pow(-y/eh,.60));
          p.setY(i,almond(p.getX(i)+pos[0],y+eyeY)-eyeY);
        }
        g.computeVertexNormals();
        // 윗눈꺼풀이 흰자에 드리우는 그늘. 이게 없으면 흰자가 종잇장처럼 평평해 보인다.
        // 텍스처를 새로 만들 필요 없이 얼굴에 쓴 정점 색을 그대로 쓴다.
        const base=new T.Color(color), tint=new T.Color(), col=[];
        for(let i=0;i<p.count;i++){
          const t=T.MathUtils.clamp(p.getY(i)/eh*.5+.58,0,1);
          tint.copy(base).multiplyScalar(1-.36*Math.pow(t,1.5));
          col.push(tint.r,tint.g,tint.b);
        }
        g.setAttribute('color',new T.Float32BufferAttribute(col,3));
        vcol=true;
      }
      g.rotateZ(angle).translate(...pos);
      return eyeMesh(name,g,vcol?'#ffffff':color,bn,null,vcol);
    }
    const white=eyePart(side+'EyeWhite',[ex,eyeY,eyeZ],[ew,eh,.053],'#fffaf2','Head');
    // 홍채는 텍스처 한 장으로 그린다. 단색 원판을 겹치면 동공이 홍채를 거의 다 덮어
    // 눈이 검은 점으로 읽혔다. 윤부륜, 위에서 들어온 빛에 밝아진 아래쪽, 동공, 하이라이트를
    // 한 장에 담으면 메시가 셋에서 하나로 줄고 색은 eyeColor 슬라이더가 계속 정한다.
    // 캔버스 대신 DataTexture 를 쓴다. Node 에서 도는 테스트에는 document 가 없다.
    const irisMap=irisTexture(c.eyeColor,c.pupilSize);
    const irisGeo=new T.CircleGeometry(1,56);
    {
      const ip=irisGeo.attributes.position;
      for(let i=0;i<ip.count;i++){
        const x=ip.getX(i),y=ip.getY(i);
        // 평면 원판은 안구 위에서 판때기로 보인다. 가운데를 앞으로 볼록하게 민다.
        ip.setXYZ(i,x*irx,y*iry,(1-(x*x+y*y))*.015);
      }
      irisGeo.computeVertexNormals();
      irisGeo.rotateZ(angle).translate(ex,eyeY,eyeZ+.045);
    }
    eyeMesh(side+'Iris',irisGeo,'#ffffff',side+'Eye',irisMap);
    const lidPoint=(t,upper,offset=0)=>{
      let x=ew*Math.cos(t),y=(upper?1:-1)*eh*Math.sin(t);
      if(!upper)y=.5*(y-eh*.74*Math.pow(Math.sin(t),.60));
      const wx=ex+x*Math.cos(angle)-y*Math.sin(angle);
      return[wx,almond(wx,eyeY+x*Math.sin(angle)+y*Math.cos(angle))+offset,eyeZ+.006+Math.sin(t)*.003];
    };
    if(c.eyeLine>0){
      // Comic outline: an inverted shell offset along the eye white's own normals, so every part
      // of it stays a fixed distance off the eyeball no matter which way the camera looks. The
      // Winding is reversed rather than using BackSide, which glTF has no way to express.
      const g=white.geometry.clone(),p=g.attributes.position,n=g.attributes.normal;
      for(let i=0;i<p.count;i++){
        // Barely graded: pushing the shell out near the brow only buries it deeper in the socket
        // skin and breaks through in speckles, so the stroke stays close to a constant offset.
        const up=T.MathUtils.clamp((p.getY(i)-eyeY)/eh,0,1);
        // 균일 오프셋은 아몬드형의 뾰족한 눈머리·눈꼬리에서 뭉쳐 검은 삼각형이 고인다.
        // 가로 끝으로 갈수록 얇게 한다.
        const side=Math.min(1,Math.abs(p.getX(i)-ex)/ew);
        const d=c.eyeLine*(.0046+.0012*up*up*(3-2*up))*(1-.55*Math.pow(side,4));
        p.setXYZ(i,p.getX(i)+n.getX(i)*d,p.getY(i)+n.getY(i)*d,p.getZ(i)+n.getZ(i)*d);
      }
      const idx=g.index.array;for(let i=0;i<idx.length;i+=3){const t=idx[i];idx[i]=idx[i+2];idx[i+2]=t;}
      g.computeVertexNormals();eyeMesh(side+'EyeLine',g,darken(c.browColor,.15));
    }
    if(c.eyeLine>0){
      // 윗눈꺼풀 먹선. 바깥 가장자리를 흰자 실루엣에 정확히 맞추고 안쪽으로만 내려오는 띠다.
      // 튜브로는 안 된다. 바깥 가장자리가 실루엣에서 조금이라도 떨어지면 그 위로 흰자가
      // 비쳐 선이 떠 보인다. 띠의 v=0 을 k=1(림)에 고정해 그 틈을 원천적으로 없앤다.
      // 두께는 눈꼬리 쪽이 두껍고 눈머리로 갈수록 0 이 된다.
      const lidGeo=surface(4,32,(u,vv)=>{
        const t=Math.PI*u;                       // 0: +x 끝, π: -x 끝
        const outer=(s*Math.cos(t)+1)/2;         // 0 눈머리, 1 눈꼬리
        // 눈꼬리 직전이 가장 두껍고 맨 끝에서 다시 얇아진다. 바깥으로 갈수록 단조롭게
        // 두꺼워지면 쐐기처럼 보인다.
        // 두께 변화가 크면 바깥이 눈의 4분의 1을 덮는 검은 쐐기가 되고 안쪽은 거의 없어져
        // 가로지르는 각진 경계가 생긴다. 눈꼬리 쪽을 조금 두껍게 하되 차이를 좁힌다.
        const bump=.72+.33*Math.exp(-(((outer-.62)/.46)**2));
        const dip=.15*c.eyeLine*Math.pow(Math.sin(t),.45)*bump;
        // 바깥 가장자리를 림보다 조금 밖으로 뺀다. 딱 맞추면 반올림 한 번에 흰자가 비친다.
        // 다만 눈머리·눈꼬리에서는 그 여유도 0 으로 거둔다. 끝까지 남겨 두면 피부 위에
        // 얇은 선이 남고, 두꺼운 부분으로 넘어가는 곳에서 단이 진다.
        const k=1+.030*Math.pow(1-vv,6)*Math.pow(Math.sin(t),.35)-dip*vv;
        const x=ew*k*Math.cos(t), y0=eh*k*Math.sin(t);
        // 아몬드 워프는 흰자와 같은 순서로 건다. 흰자는 회전 전 좌표에 걸므로 여기서도
        // 회전 전에 건다. 순서가 다르면 두 곡선이 어긋나 틈이 생긴다.
        const yA=almond(x+ex,eyeY+y0)-eyeY;
        // 림에서는 z=0(적도), 안으로 들어올수록 안구 앞면을 타고 올라온다.
        return[ex+x*Math.cos(angle)-yA*Math.sin(angle),
               eyeY+x*Math.sin(angle)+yA*Math.cos(angle),
               eyeZ+.053*Math.sqrt(Math.max(0,1-k*k))+.0008];
      });
      // 아랫눈꺼풀은 훨씬 얇고 눈꼬리 쪽에만 있다. 흰자 아래쪽은 눌려 있으므로(플랫)
      // 같은 식을 태워야 띠가 표면에서 뜨지 않는다.
      const lowGeo=surface(3,32,(u,vv)=>{
        const t=Math.PI*(1+u);                    // π~2π, 아래쪽 반
        const outer=(s*Math.cos(t)+1)/2;
        const dip=.060*c.eyeLine*Math.pow(Math.sin(t-Math.PI),.6)*(.22+.78*outer);
        const k=1+.026*Math.pow(1-vv,6)*Math.pow(Math.sin(t-Math.PI),.35)-dip*vv;
        const x=ew*k*Math.cos(t);
        let y0=eh*k*Math.sin(t);
        if(y0<0)y0=.5*(y0-eh*.74*Math.pow(-y0/eh,.60));
        const yA=almond(x+ex,eyeY+y0)-eyeY;
        return[ex+x*Math.cos(angle)-yA*Math.sin(angle),
               eyeY+x*Math.sin(angle)+yA*Math.cos(angle),
               eyeZ+.053*Math.sqrt(Math.max(0,1-k*k))+.0008];
      });
      const lids=mergeGeometries([lidGeo,lowGeo]);lidGeo.dispose();lowGeo.dispose();
      const lidMesh=eyeMesh(side+'EyeLids',lids,darken(c.browColor,.16));
      lidMesh.material.side=T.DoubleSide;
      // 먹선이 번들거리면 화장처럼 보인다. 이 색은 눈꺼풀만 쓰므로 여기서 거칠기를 올린다.
      lidMesh.material.roughness=.96;
    }
    if(c.lashes!=='none'){
      const pts=Array.from({length:21},(_,i)=>lidPoint(i/20*Math.PI,true));
      eyeMesh(side+'LashLine',curveGeo(pts.map(p=>[p[0],p[1]-.002,p[2]+.010]),.0013),darken(c.browColor,.52));
    }
    if(c.lashes!=='none'){
      const lashGeos=[];const length=c.lashes==='long'?.023:.012;
      for(let j=0;j<5;j++){
        const t=s===1?.12+j*.15:Math.PI-.12-j*.15, p=lidPoint(t,true);p[2]+=.012;
        const pts=[p,[p[0]+s*length*.45,p[1]+length*.24,p[2]+.005],[p[0]+s*length*(1-j*.09),p[1]+length*.7,p[2]+.012]];
        lashGeos.push(curveGeo(pts,.0016));
      }
      const g=mergeGeometries(lashGeos);lashGeos.forEach(g=>g.dispose());eyeMesh(side+'Eyelashes',g,darken(c.browColor,.45));
    }
    // 눈썹 z 를 상수로 두면 얼굴을 좁히거나 앞면을 평탄화할 때마다 바깥 끝이 공중에 뜬다.
    // 얼굴 표면에서 역산한다.
    const brow=(e)=>{let tilt=0,lift=0; if(e==='smile')lift=.014;if(e==='sad'){tilt=-s*.047;lift=.023;}if(e==='angry'){tilt=s*.044;lift=-.024;}if(e==='serious')lift=-.018;if(e==='surprised')lift=.060;return [-1,-.5,0,.5,1].map((t)=>[s*eyeX*c.browSpacing+t*.060*c.eyeSize*c.browWidth,eyeY+eh+.018+c.browHeight+lift+BROW_ARCH[c.browShape](s*t)*.017*c.browArch+t*(tilt+s*c.browTilt),faceSurfaceZ(s*eyeX*c.browSpacing+t*.060*c.eyeSize*c.browWidth,
      eyeY+eh+.018+c.browHeight+lift+BROW_ARCH[c.browShape](s*t)*.017*c.browArch+t*(tilt+s*c.browTilt))+.012]);};
    // 눈썹은 눈머리 쪽 3분의 1이 가장 두껍고 양 끝으로 갈수록 가늘어진다. 예전에는 바깥
    // 끝만 가늘어지고 안쪽 끝이 뭉툭하게 잘려 각져 보였다. 입술과 같은 taperTube 를 쓴다.
    const browGeo=e=>taperTube(brow(e),.0115*c.browThickness,u=>{
      const outer=s===1?u:1-u;
      return .07+.93*Math.pow(Math.sin(Math.PI*Math.pow(outer,.72)),.85);
    });
    const bg=browGeo('neutral');const bm={};for(const e of EXPRESSIONS) bm[e]=browGeo(e).attributes.position;skinGeo(side+'Eyebrow',bg,c.browColor,'Head',bm);
    if(c.earrings){const g=new T.TorusGeometry(.033,.007,8,24).translate(s*(rx+.035),headY-.102,.006);skinGeo(side+'Earring',g,'#d9b263');}
  }
  const mouthY=headY-.132+c.mouthHeight, mw=.078*c.mouthWidth;
  // 웃음은 입꼬리가 올라가는 것이지 입이 크게 벌어지는 것이 아니다. 예전 값(curve .043,
  // open .038, 가로 1.18배)은 아래 얼굴을 가로지르는 초승달이었다.
  const mouthProfile=e=>e==='smile'?{curve:.033,open:.024}:e==='sad'?{curve:-.036,open:.004}:e==='angry'?{curve:-.021,open:.012}:e==='surprised'?{curve:0,open:.061}:e==='serious'?{curve:0,open:.002}:{curve:.006,open:.007};
  // 얼굴 앞면은 입 아래에서 급히 후퇴한다(-.15 에서 .238, -.21 에서 .222).
  // 구강과 치아가 정점마다 그 값을 따라가면 크게 벌린 표정에서 아래쪽이 얼굴 뒤로 밀린다.
  // 입 중심에서 한 번만 재서 고정 깊이로 쓴다. 입술만 얼굴 윤곽을 따라간다.
  const mouthZ=faceSurfaceZ(0,mouthY);
  const mouthWide=e=>e==='surprised'?.65:e==='smile'?1.07:1;
  for(const upper of [true,false]) {
    const make=e=>{
      const {curve,open}=mouthProfile(e), wide=mouthWide(e);
      const pts=Array.from({length:13},(_,i)=>{
        const t=i/6-1,x=t*mw*wide;
        // 윗입술 한가운데는 살짝 내려앉는다(큐피드 활). 아랫입술은 매끈하게 둔다.
        const bow=upper?.0028*Math.exp(-((t/.24)**2)):0;
        const y=mouthY+curve*t*t+(upper?1:-1)*open*Math.sqrt(Math.max(0,1-t*t))-bow;
        return[x,y,faceSurfaceZ(x,y)+.006];
      });
      // 입꼬리로 갈수록 가늘어지고, 아랫입술이 윗입술보다 두껍다.
      return taperTube(pts,.0052*c.lipSize*(upper?1:1.24),u=>{const t=2*u-1;return .16+.84*Math.pow(Math.max(0,1-t*t),.55);});
    };
    const g=make('neutral'), morph={};for(const e of EXPRESSIONS)morph[e]=make(e).attributes.position;
    // 입술색을 고정 갈색으로 두면 어떤 피부색에서도 어두운 선 하나로 읽힌다.
    // 피부에서 파생시키되 채도가 아니라 색상을 붉은 쪽으로 옮긴다. 피부 색상이 이미
    // 주황 계열(h≈.06)이라 채도만 올리면 형광 주황이 된다. 윗입술이 조금 더 어둡다.
    const lip=new T.Color(skin).offsetHSL(upper?-.030:-.026,upper?.02:0,upper?-.15:-.095);
    skinGeo(upper?'UpperLip':'LowerLip',g,'#'+lip.getHexString(),'Head',morph);
  }
  // 구강. 예전에는 눌린 구체였고 치아·입술과 다른 깊이 기준을 써서 각도를 돌리면
  // 서로 따로 놀았다. 입술과 같은 얼굴 윤곽(faceSurfaceZ)에 평행한 면으로 만든다.
  // 층은 얼굴 +.003(구강) < +.006(입술 중심) < +.008(치아) 순이다.
  const mouthG=e=>{
    const {curve,open}=mouthProfile(e), wide=mouthWide(e);
    return surface(10,28,(u,vv)=>{
      const t=2*u-1, x=t*mw*wide;
      const fade=Math.sqrt(Math.max(0,1-t*t));
      const mid=mouthY+curve*t*t;
      const y=mid+open*fade*(1-2*vv);
      return[x,y,faceSurfaceZ(x,y)+.0025];
    });
  };
  const mm={};for(const e of EXPRESSIONS)mm[e]=mouthG(e).attributes.position;skinGeo('MouthInterior',mouthG('neutral'),'#482a25','Head',mm).material.side=T.DoubleSide;
  // 치아는 윗니와 아랫니 두 줄이고, 입 곡선을 따라 각 입술 안쪽에 매달린다. 렌즈 하나를
  // 입 안 가운데 띄우면 어디에도 붙어 있지 않은 판으로 보인다. 두 줄을 한 메시로 합쳐
  // 드로우콜은 그대로 두고, 벌어진 정도에 비례해 드러나게 한다.
  const toothRow=(e,up)=>{
    const {curve,open}=mouthProfile(e), wide=mouthWide(e);
    // 윗니는 조금만 벌려도 보이고 아랫니는 크게 벌려야 보인다. 웃을 때 아랫니가 윗니만큼
    // 보이면 두 줄이 입 안에 떠 있는 흰 테로 읽힌다.
    const show=up?T.MathUtils.clamp((open-.008)/.019,0,1):T.MathUtils.clamp((open-.016)/.030,0,1);
    // 입술 튜브의 중심선이 개구선이다. 치아를 거기에 붙이면 튜브 반지름만큼(아랫입술 .0076)
    // 잡아먹혀 조각만 남고 구멍처럼 보인다. 반지름만큼 안으로 물려서 시작한다.
    const lipR=.0052*c.lipSize*(up?1:1.24);
    // 치열은 입꼬리까지 가지 않는다. 입 너비의 84%(윗니), 67%(아랫니)에서 둥글게 끝난다.
    // .70/.78/.86/.94 를 나란히 렌더해 골랐다. .70 은 입꼬리 쪽이 비고 .94 는 입꼬리에 닿는다.
    const halfW=Math.max(mw*wide*.84*(up?1:.80)*show,1e-4), rowH=(up?.0125:.006)*show;
    return surface(3,26,(u,vv)=>{
      const t=2*u-1, x=t*halfW, tl=x/(mw*wide);
      // 바깥 변은 입술 안쪽(개구선)에 붙는다.
      const edge=mouthY+curve*tl*tl+(up?1:-1)*Math.max(0,open-lipR*.62)*Math.sqrt(Math.max(0,1-tl*tl));
      // 안쪽 변은 단단한 치열 아치다. 입술 곡률의 45%만 따라가고 높이는 일정하다.
      // 입술과 같은 곡률로 두면 치아가 아니라 입술 안쪽 테두리로 읽힌다.
      const bottom=mouthY+(up?1:-1)*Math.max(0,open-lipR*.62)+curve*tl*tl*.45-(up?1:-1)*rowH;
      // 끝 18% 구간에서만 높이를 줄여 둥근 끝을 만든다. 전체에 걸쳐 줄이면 초승달이 된다.
      const ef=Math.sqrt(Math.min(1,(1-Math.abs(t))/.18));
      const y=edge+(bottom-edge)*vv*ef;
      // 치아도 입술과 같은 얼굴 윤곽을 따라간다. 입술 쪽은 앞, 입 안쪽은 뒤로 물러나
      // 형태를 주되 구강 시트(+.0025)보다 앞에 머문다.
      return[x,y,faceSurfaceZ(x,y)+T.MathUtils.lerp(.010,.0045,vv)];
    });
  };
  const toothGeo=e=>{const g=mergeGeometries([toothRow(e,true),toothRow(e,false)]);g.computeVertexNormals();return g;};
  const toothMorph={};for(const e of EXPRESSIONS)toothMorph[e]=toothGeo(e).attributes.position;
  {
    const m=skinGeo('CartoonSmileTeeth',toothGeo('neutral'),'#fff8e8','Head',toothMorph);
    m.material.side=T.DoubleSide;
    // 양면 렌더는 뒷면 법선을 뒤집는데, 거의 옆에서 보이는 삼각형에서는 그 판정이 흔들려
    // 반구 조명의 지면색(#9aa28b)이 치아에 옅은 녹색 줄로 나타난다. 자체발광을 조금 주어
    // 조명 방향에 덜 좌우되게 한다.
    m.material.emissive=new T.Color('#fff8e8').multiplyScalar(.22);
    m.material.roughness=1;
  }
  // Sculpted primitive locks + small raised strands. All hair remains editable mesh geometry.
  const poseMorphs=[];
  const hairGeos=[], strandGeos=[];
  const hs=(p,s)=>hairGeos.push(sphereGeo(p,s,20));
  const strand=(pts,r=.003)=>strandGeos.push(curveGeo(pts,r));
  const noise=n=>{const a=Math.sin(n*127.1+31.7)*43758.5453;return a-Math.floor(a);};
  // 콧대는 눈썹 사이(headY+.026)에서 시작하되 아주 가늘게 둔다. 폭은 좁고 깊이만 주어
  // 능선으로 읽히게 하고, 코끝에서만 폭이 벌어진다. 예전에는 콧대가 아예 없어
  // 코가 얼굴에 붙은 작은 혹처럼 보였다.
  // Nose: one half-lathe. The profile is keyed at root/bridge/tip/base and smoothed with a
  // Catmull-Rom (x=height, y=half-width, z=depth), so the tip is a rounded bulb and the base
  // sweeps back under it instead of ending in a flat cut. The flanks wrap past the side of the
  // lathe and sink behind the face surface, which buries the open edge inside the head.
  const noseProfile=new T.CatmullRomCurve3([
    [-.001,.10,.36],[-.017,.12,.41],[-.034,.16,.48],[-.051,.30,.66],
    [-.062,.56,.90],[-.070,.76,1],[-.0765,.60,.72],[-.0822,.30,.26],[-.0765,.10,.02],
  ].map(k=>v(...k)));
  const noseSpan=Math.PI/2+.5;
  skinGeo('Nose',surface(26,24,(u,t)=>{
    const k=noseProfile.getPoint(t),a=noseSpan*(2*u-1),cos=Math.cos(a);
    const x=.042*c.noseWidth*k.y*Math.sin(a),y=headY+k.x;
    const round=1.4-.75*Math.min(1,t/.75);
    return[x,y,faceSurfaceZ(x,y)-.016+.0295*c.noseSize*k.z*Math.sign(cos)*Math.pow(Math.abs(cos),round)];
  }),skin);
  // 캡 테두리 각. 앞은 이마, 뒤는 목덜미까지 내려가되 옆(|sin φ|≈1)에서는 귀 위로 올린다.
  // 테두리가 귀 가운데를 지나면 귀가 캡을 뚫고 나와 경계가 톱니처럼 보인다.
  const capRim=(phi,front,back)=>{const f=(Math.cos(phi)+1)/2;return T.MathUtils.lerp(back,front,f**3)-.30*Math.pow(Math.abs(Math.sin(phi)),8);};
  // 기본 배율 1.025 는 두피와 거의 겹쳐 테두리가 두피를 들락거리며 계단이 생겼다. 1.06 으로.
  const quiffPoint=(theta,phi,extra=0)=>{const f=(Math.cos(phi)+1)/2,limit=capRim(phi,.97,1.78),t=T.MathUtils.clamp(theta/limit,0,1),flow=Math.sin(Math.PI*t),scale=Math.max(1.06,skullR(theta,phi)+.025)+.042*flow+extra,lift=.075*Math.pow(Math.max(0,flow),1.2)*f;return[Math.sin(theta)*Math.sin(phi)*rx*scale-.025*f*flow,headY+Math.cos(theta)*ry*scale+lift,Math.sin(theta)*Math.cos(phi)*rz*scale];};
  const cap=(front=1.0,back=1.8)=>{
    const g=new T.SphereGeometry(1,48,28,0,Math.PI*2,0,Math.PI-.01);const p=g.attributes.position;
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i),phi=Math.atan2(x,z),frontness=(Math.cos(phi)+1)/2;
      const maxTheta=capRim(phi,front,back),theta=Math.acos(T.MathUtils.clamp(y,-1,1))/(Math.PI-.01)*maxTheta;
      const sc=Math.max(1.07,skullR(theta,phi)+.025);
      if(c.hair==='quiff')p.setXYZ(i,...quiffPoint(theta,phi));else p.setXYZ(i,Math.sin(theta)*Math.sin(phi)*rx*sc,headY+Math.cos(theta)*ry*sc,Math.sin(theta)*Math.cos(phi)*rz*sc);
    }g.computeVertexNormals();hairGeos.push(g);
  };
  if(c.hair==='curls') {
    cap(.88,1.7);
    const count=Math.round(128/(c.curlSize*c.curlSize));
    for(let i=0;i<count;i++){
      const theta=Math.acos(1-(i+.5)/count*1.08),phi=i*2.39996323,front=Math.cos(phi);
      if(front>.2&&theta>.91+.14*Math.abs(Math.sin(phi)))continue;
      const r=(.040+noise(i)*.010)*c.curlSize,rr=Math.max(1+noise(i+20)*.025,skullR(theta,phi));
      const cx=Math.sin(theta)*Math.sin(phi)*rx*rr, cy=headY+Math.cos(theta)*ry*rr, cz=Math.sin(theta)*Math.cos(phi)*rz*rr;
      // 귀에 얹히는 구는 뺀다. 구가 귀를 반쯤 삼키면 경계가 딱딱하게 끊긴다.
      if(Math.hypot(Math.abs(cx)-rx*.98,(cy-(headY-.03))/1.3,cz+.012)<.085)continue;
      hs([cx,cy,cz],[r,r*(1.06+noise(i+2)*.15),r]);
      // Subtle coiled ridges break up the repeated sphere silhouette.
      if(c.hairDetail>.2){const pts=[];const normal=v(cx/rx,(cy-headY)/ry,cz/rz).normalize();const tangent=v(0,1,0).cross(normal).normalize();if(tangent.length()<.1)tangent.set(1,0,0);const bitangent=normal.clone().cross(tangent);for(let j=0;j<11;j++){const a=j/10*Math.PI*1.7,rr2=r*(.2+j/10*.4);pts.push(v(cx,cy,cz).addScaledVector(normal,r*.85).addScaledVector(tangent,Math.cos(a)*rr2).addScaledVector(bitangent,Math.sin(a)*rr2).toArray());}strand(pts,.0025*c.hairDetail);}
    }
  } else if(c.hair==='crop'||c.hair==='quiff') {
    cap(c.hair==='crop'?1.06:.97,1.78);
    for(let j=0;j<15;j++){
      const u=(j-7)/8,pts=[];
      for(let k=0;k<13;k++){
        const t=k/12,phi=u*1.2+.25*t,theta=(c.hair==='quiff'?1.00:1.07)-t*1.03;
        const frontness=(Math.cos(phi)+1)/2;const lift=c.hair==='quiff'?.09*Math.sin(theta/1.8*Math.PI)*frontness:0;
        pts.push(c.hair==='quiff'?quiffPoint(Math.max(.02,theta),phi,.002):[Math.sin(theta)*Math.sin(phi)*rx*1.076,headY+Math.cos(theta)*ry*1.076,Math.sin(theta)*Math.cos(phi)*rz*1.076]);
      }
      // A fine lock sits on the continuous volume instead of detached cylinders.
      hairGeos.push(curveGeo(pts,c.hair==='quiff'?.010:.011));
      if(c.hairDetail>.1)strand(pts.map(p=>[p[0],p[1]+.006,p[2]+.006]),.0024*c.hairDetail);
    }
  } else if(['bob','long','bun','ponytail','braids','waves','sport','dandy','dandy_perm'].includes(c.hair)) {
    const shell=createHairShell(c,{rx,ry,rz,headY,skull:skullR});
    hairGeos.push(shell.geometry);strandGeos.push(...shell.strands);
    if(c.hair==='ponytail'){
      hs([0,headY+ry*.66,-.22],[.11,.10,.10]);
      for(let j=0;j<8;j++){const a=j/8*Math.PI*2,pts=[];for(let k=0;k<15;k++){const t=k/14;pts.push([Math.cos(a)*.053*(1-t*.4)+Math.sin(t*3)*.045,headY+ry*.68-t*.55,-.23-Math.sin(t*Math.PI*.7)*.13+Math.sin(a)*.04]);}hairGeos.push(curveGeo(pts,.028));if(c.hairDetail>.1)strand(pts.map(p=>[p[0]+.018,p[1],p[2]-.01]),.002*c.hairDetail);}
      const tie=new T.TorusGeometry(.072,.010,8,28).rotateX(Math.PI/2).translate(0,headY+ry*.63,-.26);skinGeo('PonytailTie',tie,c.shirtColor);
    }
    if(c.hair==='braids')for(const s of [-1,1]){
      hs([s*rx*.86,headY+.02,-.065],[.068,.18,.11]);
      for(let j=0;j<9;j++){const taper=1-j*.048;for(const sign of [-1,1]){const g=sphereGeo([0,0,0],[.041*taper,.047,.04],16);g.rotateZ(sign*s*.55);g.translate(s*(rx*.91+sign*.018),headY-.08-j*.052,.005);hairGeos.push(g);}if(c.hairDetail>.1)strand([[s*(rx*.91-.025),headY-.09-j*.052,.04],[s*rx*.91,headY-.064-j*.052,.047],[s*(rx*.91+.026),headY-.09-j*.052,.04]],.002*c.hairDetail);}
      const tie=new T.TorusGeometry(.028,.008,8,20).rotateX(Math.PI/2).translate(s*rx*.91,headY-.51,.005);skinGeo('BraidTie'+s,tie,c.shirtColor);
    }
    if(c.hair==='bun'){
      hs([0,headY+ry+.045,-.075],[.145,.132,.128]);
      for(let j=0;j<12;j++){const a=j/12*Math.PI*2,pts=[];for(let k=0;k<13;k++){const t=k/12*Math.PI;pts.push([Math.sin(t)*Math.cos(a)*.147,headY+ry+.045+Math.cos(t)*.134,-.075+Math.sin(t)*Math.sin(a)*.130]);}if(c.hairDetail>.1)strand(pts,.003*c.hairDetail);}
    }
  } else if(c.hair==='hijab') {
    // A continuous cloth shell with a face opening; shaped in rows to retain a clean hem.
    const shell=surface(28,64,(u,t)=>{const a=u*Math.PI*2,theta=.01+t*(Math.PI*.5+.50-.01);const pleat=c.hijabStyle==='pleated'?.005*Math.sin(a*18)*Math.sin(theta):0;return[Math.sin(theta)*Math.cos(a)*(rx*1.14+pleat),headY+Math.sin(theta)*Math.sin(a)*ry*1.12,-Math.cos(theta)*(rz*1.12+pleat)];});
    hairGeos.push(shell);
    // Cloth edging follows forehead, temples and chin without covering the face.
    const border=[];for(let j=0;j<=48;j++){const a=-Math.PI/2+j/48*Math.PI*2;const xx=Math.cos(a)*rx*1.001, yy=headY+Math.sin(a)*ry*.984;const z=rz*1.12*Math.sin(.50);border.push([xx,yy,z]);}
    hairGeos.push(curveGeo(border,.028));
    const low=headY-ry*.90;
    // Overlapping diagonal bands make the wrapping readable at a distance.
    for(let layer=0;layer<3;layer++){
      const g=surface(8,40,(u,t)=>{const a=-Math.PI*.57+u*Math.PI*1.14;const radius=.16+layer*.018;return[Math.sin(a)*radius,low-.018-layer*.020-t*.034+.021*Math.sin(a),Math.cos(a)*(.13+layer*.018)-.012+t*.009];});hairGeos.push(g);
    }
    const long=c.hijabStyle==='draped',pleated=c.hijabStyle==='pleated';
    for(const s of [-1,1]){
      const drape=surface(24,14,(u,t)=>{const width=.105*(1-t*.25),fold=Math.sin(u*Math.PI*6+t*2)*.004*c.hairDetail;return[s*(rx*.64-t*.05)+(u-.5)*width,headY-ry*.60-t*(long?.43:.25),.045+Math.sin(t*Math.PI)*.09+fold+(s===1?.035:0)];});hairGeos.push(drape);
      if(c.hairDetail>.1)for(let j=1;j<5;j++){const pts=[];for(let k=0;k<14;k++){const t=k/13,u=j/5,fold=Math.sin(u*Math.PI*6+t*2)*.004*c.hairDetail;pts.push([s*(rx*.64-t*.05)+(u-.5)*.105*(1-t*.25),headY-ry*.60-t*(long?.43:.25),.048+Math.sin(t*Math.PI)*.09+fold+(s===1?.035:0)]);}strand(pts,.0016*c.hairDetail);}
    }
    if(c.hairDetail>.1)for(let j=0;j<(pleated?18:8);j++){const phi=.95+j/(pleated?17:7)*4.38,pts=[];for(let k=0;k<18;k++){const theta=.15+k/17*1.67;pts.push([Math.sin(theta)*Math.cos(phi)*rx*1.149,headY+Math.sin(theta)*Math.sin(phi)*ry*1.128,-Math.cos(theta)*rz*1.129]);}strand(pts,.0018*c.hairDetail);}
  }
  const finishHair=(geos,name,color)=>{if(!geos.length)return;const g=mergeGeometries(geos);const scale=['bob','long','waves','bun','ponytail','braids','sport','dandy','dandy_perm'].includes(c.hair)?1:c.hairVolume;g.translate(0,-headY,0).scale(scale,scale,scale).translate(0,headY,0);const mesh=skinGeo(name,g,color);if(c.hair==='hijab')mesh.material.side=T.DoubleSide;geos.forEach(g=>g.dispose());};
  finishHair(hairGeos,'Hair_'+c.hair,hair);
  finishHair(strandGeos,'HairStrands_'+c.hair,darken(hair,['bob','long','waves','bun','ponytail','braids','sport','dandy','dandy_perm'].includes(c.hair)?.94:.84));
  if(c.beard!=='none') {
    // 수염은 상수 z 에 두면 두개골을 고칠 때마다 얼굴 옆에 떠 있는 알갱이가 된다.
    // 방향(θ,φ)을 정하고 두피 반지름 표에서 실제 표면 위치를 받아 앉힌다.
    const onHead=(theta,phi,inset)=>{const r=skullR(theta,phi)-inset;return[Math.sin(theta)*Math.sin(phi)*rx*r,headY+Math.cos(theta)*ry*r,Math.sin(theta)*Math.cos(phi)*rz*r];};
    if(c.beard==='full'||c.beard==='stubble'){
      // 턱선을 따라 귀 밑(φ=±1.25, 높은 쪽)에서 턱끝(φ=0, 낮은 쪽)으로.
      for(let i=0;i<19;i++){const phi=T.MathUtils.lerp(-1.25,1.25,i/18),theta=2.58-.42*Math.pow(Math.abs(phi)/1.25,1.3);
        ell('Beard_'+i,onHead(theta,phi,.06),[.047,c.beard==='full'?.060:.029,.034],hair);}
    }
    if(c.beard==='full'||c.beard==='mustache')for(const s of [-1,1]){const my=headY-.113;ell('Mustache'+s,[s*.037,my,faceSurfaceZ(s*.037,my)+.004],[.046,.016,.013],hair);}
  }
  if(c.glasses!=='none')for(const [side,s] of [['Left',1],['Right',-1]]) {
    // 렌즈 깊이는 얼굴 표면에서 역산한다. 상수 .314 는 두개골을 줄인 뒤 얼굴에서 5cm 떠 있었다.
    // 렌즈 반지름은 눈 사이 거리보다 작아야 두 렌즈가 가운데서 겹치지 않는다.
    const lr=.072*c.eyeSize,lz=faceSurfaceZ(eyeX,eyeY)+.020;
    let g;if(c.glasses==='round')g=new T.TorusGeometry(lr,.008,8,36).scale(1,1.05,1).translate(s*eyeX,eyeY,lz);
    else g=curveGeo([[-.88,-.78],[-1,0],[-.88,.78],[.88,.78],[1,0],[.88,-.78],[-.88,-.78]].map(([x,y])=>[s*eyeX+x*lr,eyeY+y*lr,lz]),.008);
    skinGeo(side+'Glasses',g,'#35332e');
    // 다리는 렌즈 바깥에서 관자놀이를 지나 귀 위에 걸린다. 귀 위치는 귀 블록과 같은 식으로 잰다.
    const earX0=rx*Math.sqrt(Math.max(.05,1-(.030/ry)**2-(.012/rz)**2));
    tube(side+'GlassesArm',[[s*(eyeX+lr),eyeY,lz],[s*(rx*.99),eyeY+.006,faceSurfaceZ(rx*.99,eyeY)*.55],[s*(earX0+.006),headY+.032,earZ0-.012]],.007,'#35332e');
  }
  if(c.glasses!=='none'){
    const bz=faceSurfaceZ(0,eyeY+.012)+.014;
    tube('GlassesBridge',[[-.030,eyeY+.010,bz],[0,eyeY+.020,bz+.006],[.030,eyeY+.010,bz]],.008,'#35332e');
  }
  if(c.age==='elder')for(const s of [-1,1])tube('SmileLine'+s,[[s*.16,headY-.08,.232],[s*.175,headY-.115,.215],[s*.172,headY-.143,.206]],.003,darken(skin,.83));
  if(headReduction!==1){
    const transform=new T.Matrix4().makeTranslation(0,headY,0)
      .multiply(new T.Matrix4().makeScale(headReduction,headReduction,headReduction))
      .multiply(new T.Matrix4().makeTranslation(0,-headY,0));
    // Scale the face, hair, eyes, glasses, and absolute expression morphs together.
    // Changing only skull radii leaves adult-sized eyes and accessories protruding.
    for(const part of parts){
      if(part.name==='Neck')continue;
      part.geometry.applyMatrix4(transform);
      for(const morph of part.geometry.morphAttributes.position||[])morph.applyMatrix4(transform);
    }
  }
  // Body, clothing and limbs. Every part is weighted to the same humanoid skeleton.
  const torsoWidth=(masc?.248:fem?.211:.23)*bulk*shoulderScale;
  const shortSleeve=['tee','polo','overalls'].includes(c.shirt);
  // 몸통이 머리보다 앞에 있었다(머리 z 중심 -0.022, 상의 0.000). 옷을 뒤로 물린다.
  const bodyZ=-.018;
  const necklineScale=c.shirt==='sweater'?.92:1;
  const torsoG=shirtGeometry({hip,shoulder,shoulderX,armLen,foreLen,width:torsoWidth,bulk,h,collar,shortSleeve,armAngle,necklineScale}).translate(0,0,bodyZ);
  const index=name=>bones.indexOf(boneMap[name]);
  // Invert the relaxed skin transform so the exported T-pose and live rig share
  // one mesh, while the resting shoulder is smooth instead of crushed by LBS.
  // 전완을 따로 기울이지 않는다. 소매는 곧은 캡슐이라 전완만 기울이면 끝단 링과 손이
  // 소매 끝에서 앞으로 밀려 나온다.
  for(const [side,sign] of [['Left',1],['Right',-1]])boneMap[side+'UpperArm'].rotation.z=-sign*1.25;
  group.updateMatrixWorld(true);
  const relaxedMatrices=bones.map((b,i)=>new T.Matrix4().multiplyMatrices(b.matrixWorld,skeleton.boneInverses[i]));
  const garmentWeights=[],gp=torsoG.attributes.position,gn=torsoG.attributes.normal;
  const mixed=new T.Matrix4(),normalMatrix=new T.Matrix3();
  // 팔 가중치는 |x| 로 가른다. 소매 캡슐 축까지의 거리로 재 보았으나 쓸 수 없었다.
  // 편안한 자세에서 팔이 거의 수직으로 몸통 옆에 붙어 내려가므로, 몸통 옆면 전체가
  // 팔 축에서 가깝다. 그 척도로는 옆구리와 소매가 구분되지 않아 T 포즈에서 몸통 옆면이
  // 통째로 팔을 따라 올라간다. 가로 거리는 자세와 무관하게 둘을 가른다.
  for(let i=0;i<gp.count;i++){
    const x=gp.getX(i),y=gp.getY(i),side=x>=0?'Left':'Right';
    // 전이 구간이 좁으면 T 포즈에서 소매가 판자로 서고 이음매에 단이 진다.
    const arm=T.MathUtils.smoothstep(Math.abs(x),torsoWidth*.93,torsoWidth*.93+.028*bulk);
    const along=(Math.abs(x)-shoulderX)*Math.cos(armAngle)+(shoulder-y)*Math.sin(armAngle);
    // 전이 띠가 팔꿈치 아래로 6.5cm 내려가 있으면 팔꿈치를 100° 접을 때 그 구간이 상완을 따라
    // 곧게 매달려 소매 밑이 판처럼 남는다. 팔꿈치를 중심으로 좁게 둔다.
    const fore=T.MathUtils.smoothstep(along,armLen-.03*h,armLen+.03*h);
    const chest=T.MathUtils.smoothstep(y,hip+.1*h,shoulder-.1*h);
    const w={ids:[index('Spine'),index('Chest'),index(side+'UpperArm'),index(side+'LowerArm')],weights:[(1-arm)*(1-chest),(1-arm)*chest,arm*(1-fore),arm*fore]};
    garmentWeights.push(w);
    // T 포즈로 만들었으면 그 자세가 곧 바인드 자세다. 되돌릴 변형이 없다.
    if(tpose)continue;
    mixed.elements.fill(0);
    for(let j=0;j<4;j++)for(let k=0;k<16;k++)mixed.elements[k]+=relaxedMatrices[w.ids[j]].elements[k]*w.weights[j];
    mixed.invert();const p=v(x,y,gp.getZ(i)).applyMatrix4(mixed);gp.setXYZ(i,p.x,p.y,p.z);
    normalMatrix.getNormalMatrix(mixed);const n=v(gn.getX(i),gn.getY(i),gn.getZ(i)).applyMatrix3(normalMatrix).normalize();gn.setXYZ(i,n.x,n.y,n.z);
  }
  for(const b of bones)b.quaternion.identity();group.updateMatrixWorld(true);skeleton.update();
  const torsoWeights=(x,y,z,i)=>garmentWeights[i];
  // 부속(단추·넥타이·주머니)의 깊이는 공식이 아니라 실제로 만들어진 상의 메시에서 잰다.
  // garment.js 의 SDF 나 bodyZ 를 고칠 때마다 별도 공식이 어긋나 부속이 허공에 떴다.
  const frontZ=(()=>{
    const NX=33,NY=68,x0=-torsoWidth*.92,x1=torsoWidth*.92,y0=hip,y1=shoulder+.06*h;
    const grid=new Float32Array(NX*NY).fill(-9),p=torsoG.attributes.position,idx=torsoG.index;
    // 정점을 칸에 넣는 방식은 칸 안에서 가장 앞인 정점이 대표가 되어, 표면이 말려 들어가는
    // 목·어깨 부근에서 격자가 실제 표면보다 앞에 선다(부속이 선반처럼 뜬다). 삼각형을
    // 격자 노드에 래스터라이즈하면 노드마다 정확한 표면 z 를 얻는다.
    const nTri=(idx?idx.count:p.count)/3, gx=x=>(x-x0)/(x1-x0)*(NX-1), gy=y=>(y-y0)/(y1-y0)*(NY-1);
    for(let t=0;t<nTri;t++){
      const a=idx?idx.getX(3*t):3*t,b=idx?idx.getX(3*t+1):3*t+1,cc=idx?idx.getX(3*t+2):3*t+2;
      const za=p.getZ(a),zb=p.getZ(b),zc=p.getZ(cc);
      if(Math.max(za,zb,zc)<=0)continue;
      const xa=gx(p.getX(a)),ya=gy(p.getY(a)),xb=gx(p.getX(b)),yb=gy(p.getY(b)),xc=gx(p.getX(cc)),yc=gy(p.getY(cc));
      const det=(xb-xa)*(yc-ya)-(xc-xa)*(yb-ya);
      if(Math.abs(det)<1e-9)continue;
      const ix0=Math.max(0,Math.ceil(Math.min(xa,xb,xc))),ix1=Math.min(NX-1,Math.floor(Math.max(xa,xb,xc)));
      const iy0=Math.max(0,Math.ceil(Math.min(ya,yb,yc))),iy1=Math.min(NY-1,Math.floor(Math.max(ya,yb,yc)));
      for(let iy=iy0;iy<=iy1;iy++)for(let ix=ix0;ix<=ix1;ix++){
        const l1=((xb-ix)*(yc-iy)-(xc-ix)*(yb-iy))/det,l2=((xc-ix)*(ya-iy)-(xa-ix)*(yc-iy))/det,l3=1-l1-l2;
        if(l1<-1e-6||l2<-1e-6||l3<-1e-6)continue;
        const z=l1*za+l2*zb+l3*zc,k=iy*NX+ix;
        if(z>grid[k])grid[k]=z;
      }
    }
    // 빈 칸은 가까운 값으로 메운다. 먼저 같은 행에서, 그래도 비면 위아래 행에서 가져온다.
    // 한 칸이라도 -9 로 남으면 거기 걸린 부속이 z=-9 로 날아가 허공에 막대가 생긴다.
    const fill=(k,step,limit)=>{
      for(let d=1;d<limit;d++){
        const a=k-d*step,b=k+d*step;
        if(a>=0&&a<grid.length&&grid[a]>-9)return grid[a];
        if(b>=0&&b<grid.length&&grid[b]>-9)return grid[b];
      }
      return null;
    };
    for(let iy=0;iy<NY;iy++)for(let ix=0;ix<NX;ix++){
      const k=iy*NX+ix;
      if(grid[k]>-9)continue;
      const r=fill(k,1,NX-ix>ix?NX-ix:ix+1);
      if(r!=null)grid[k]=r;
    }
    for(let iy=0;iy<NY;iy++)for(let ix=0;ix<NX;ix++){
      const k=iy*NX+ix;
      if(grid[k]>-9)continue;
      const r=fill(k,NX,NY);
      grid[k]=r!=null?r:.10;
    }
    return (x,y)=>{
      const fx=T.MathUtils.clamp((x-x0)/(x1-x0)*(NX-1),0,NX-1),fy=T.MathUtils.clamp((y-y0)/(y1-y0)*(NY-1),0,NY-1);
      const ix=Math.floor(fx),iy=Math.floor(fy),tx=fx-ix,ty=fy-iy;
      const jx=Math.min(ix+1,NX-1),jy=Math.min(iy+1,NY-1);
      const a=T.MathUtils.lerp(grid[iy*NX+ix],grid[iy*NX+jx],tx),b=T.MathUtils.lerp(grid[jy*NX+ix],grid[jy*NX+jx],tx);
      return T.MathUtils.lerp(a,b,ty)+.002;
    };
  })();
  const sampleGarment=garmentSurface(torsoG,garmentWeights);
  const surfaceWeights=(x,y)=>sampleGarment(x,y)||{ids:[index('Spine'),index('Chest'),0,0],weights:[1-T.MathUtils.smoothstep(y,hip+.1*h,shoulder-.1*h),T.MathUtils.smoothstep(y,hip+.1*h,shoulder-.1*h),0,0]};
  const garmentZ=(x,y)=>sampleGarment(x,y)?.depth??frontZ(x,y)-.002;
  const detail=(name,g,color)=>skinGeo(name,g,color,'Chest',null,surfaceWeights);
  const lineOnTop=(name,xy,color,r=.008)=>{
    const path=new T.CatmullRomCurve3(xy.map(([x,y])=>v(x,y,0)));
    const g=curveGeo(Array.from({length:33},(_,i)=>{const p=path.getPoint(i/32);return[p.x,p.y,garmentZ(p.x,p.y)+.006];}),r);
    return detail(name,g,color);
  };
  // 표면을 따라가는 두께 0 시트. 판(Extrude)은 꼭짓점에서만 표면 깊이를 알아 그 사이에서
  // 옷을 뚫거나 뜨고, 목 쪽에서는 종이 날개처럼 섰다. 시트는 정점마다 표면을 따라간다.
  const sheet=(name,color,rows,cols,fn,lift,bn='Chest')=>{
    const valid=[];
    const g=surface(Math.max(rows,32),Math.max(cols,12),(u,t)=>{const [x,y]=fn(u,t),hit=sampleGarment(x,y);valid.push(Boolean(hit));return[x,y,(hit?.depth??0)+.005+lift];});
    const idx=g.index.array,kept=[];
    for(let i=0;i<idx.length;i+=3)if(valid[idx[i]]&&valid[idx[i+1]]&&valid[idx[i+2]])kept.push(idx[i],idx[i+2],idx[i+1]);
    // Remove clipped-out vertices too, so export never receives unused zero normals.
    const used=[...new Set(kept)],remap=new Map(used.map((old,i)=>[old,i])),p=g.attributes.position;
    const positions=used.flatMap(i=>[p.getX(i),p.getY(i),p.getZ(i)]);
    g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.deleteAttribute('normal');g.deleteAttribute('uv');
    g.setIndex(kept.map(i=>remap.get(i)));g.computeVertexNormals();
    const m=detail(name,g,color);m.material.side=T.DoubleSide;return m;
  };
  const patch=(name,x1,x2,y1,y2,color,bn='Chest')=>sheet(name,color,32,12,(u,t)=>[T.MathUtils.lerp(x1,x2,u),T.MathUtils.lerp(y1,y2,t)],0,bn);
  const buttonOnTop=(name,x,y,color,size=.008,lift=.010)=>detail(name,sphereGeo([x,y,garmentZ(x,y)+lift],[size,size,size*.48],16),color);
  // 네 꼭짓점 A(u0,t0) B(u1,t0) C(u1,t1) D(u0,t1) 의 쌍선형 사각형
  const quad=(A,B,C,D)=>(u,t)=>[T.MathUtils.lerp(T.MathUtils.lerp(A[0],B[0],u),T.MathUtils.lerp(D[0],C[0],u),t),T.MathUtils.lerp(T.MathUtils.lerp(A[1],B[1],u),T.MathUtils.lerp(D[1],C[1],u),t)];
  // (t,x) 꺾은선 보간
  const poly=pts=>t=>{for(let k=1;k<pts.length;k++)if(t<=pts[k][0])return T.MathUtils.lerp(pts[k-1][1],pts[k][1],(t-pts[k-1][0])/(pts[k][0]-pts[k-1][0]));return pts[pts.length-1][1];};
  skinGeo(c.shirt==='vest'?'VestUndershirt':'Top_'+c.shirt,torsoG,c.shirt==='vest'?'#f4eddd':c.shirtColor,'Spine',null,torsoWeights);
  if(c.shirt==='vest'){
    const g=vestGeometry({hip,shoulder,width:torsoWidth,bulk,h}).translate(0,0,bodyZ);
    skinGeo('Top_vest',g,c.shirtColor,'Spine',null,(x,y)=>{const chest=T.MathUtils.smoothstep(y,hip+.1*h,shoulder-.1*h);return{ids:[index('Spine'),index('Chest'),0,0],weights:[1-chest,chest,0,0]};});
    for(let j=0;j<3;j++){const y=hip+.12*h+j*.073*h;ell('VestButton'+j,[0,y,frontZ(0,y)+.008],[.007,.007,.004],darken(c.shirtColor,.60),'Chest',12);}
  }
  if(!['skirt','pleated_skirt'].includes(c.pants)){
    const g=pantsGeometry({hip,width:torsoWidth,bulk,h,style:c.pants}).translate(0,0,bodyZ);
    skinGeo('Pants_'+c.pants,g,c.pantsColor,'Hips',null,(x,y)=>{
      const side=x>=0?'Left':'Right',leg=1-T.MathUtils.smoothstep(y,hip-.11*h,hip-.01*h),knee=1-T.MathUtils.smoothstep(y,.41*h,.53*h);
      return{ids:[index('Hips'),index(side+'UpperLeg'),index(side+'LowerLeg'),0],weights:[1-leg,leg*(1-knee),leg*knee,0]};
    });
  }
  if(c.shirt==='hoodie') {
    ell('Hood',[0,neck-.035,-.092+bodyZ],[.17,.115,.12],c.shirtColor,'UpperChest');
    for(const s of [-1,1])lineOnTop('HoodCord'+s,[[s*.043,shoulder-.012],[s*.046,shoulder-.07],[s*.05,shoulder-.14]],'#e8e0cc',.006);
    ell('KangarooPocket',[0,hip+.19*h,frontZ(0,hip+.19*h)+.006],[.12,.067,.019],darken(c.shirtColor,.87),'Spine');
  }
  if(c.shirt==='shirt') {tube('Placket',[[0,hip+.06,frontZ(0,hip+.06)+.006],[0,shoulder-.01,frontZ(0,shoulder-.01)+.006]],.012,darken(c.shirtColor,.86),'Chest');for(let i=0;i<4;i++)ell('Button'+i,[0,shoulder-.095-i*.085*h,frontZ(0,shoulder-.095-i*.085*h)+.007],[.009,.009,.005],'#ede4d4','Chest',12);}
  if(c.shirt==='sweater'){
    // 칼라는 셔츠의 목 구멍에 얹혀야 한다. 목 반지름(.084)에 맞춰 목에 붙여 두면
    // 옷깃이 아니라 초커로 보이고, 위치도 구멍보다 8cm 위에 떠 있었다.
    // 목 구멍 뒤쪽은 앞보다 높고 윗면은 뒤로 갈수록 둥글게 내려간다. 평평한 토러스는
    // 앞에서는 파묻히고 뒤에서는 뜬다. 상의 정점에서 윗면 높이를 실측해 고리를 얹는다.
    const tp=torsoG.attributes.position,R=.122*bulk*necklineScale;
    const topY=(x,z)=>{let m=-9;for(let i=0;i<tp.count;i++){if(Math.abs(tp.getX(i)-x)<.016&&Math.abs(tp.getZ(i)-z)<.016)m=Math.max(m,tp.getY(i));}return m;};
    const ring=[];
    for(let k=0;k<=36;k++){const a=k/36*Math.PI*2,x=Math.sin(a)*R,z=Math.cos(a)*R+bodyZ;ring.push([x,topY(x,z)+.003,z]);}
    const g=new T.TubeGeometry(new T.CatmullRomCurve3(ring.map(q=>v(...q)),true),48,.008,8,true);
    // 칼라는 옷이므로 목이 아니라 가슴 본을 따른다. 목 본에 걸면 고개를 숙일 때 초커처럼 들린다.
    skinGeo('Collar',g,darken(c.shirtColor,.88),'Chest');
  }
  const torsoCenter=(hip+shoulder)/2+.022, torsoHalf=(shoulder-hip)*.64;
  const lightTop='#f4eddd';
  if(['cardigan','jacket'].includes(c.shirt)){
    // The inner shirt and bindings share one opening contour and the torso's
    // skin weights. Separate rigid Chest/Spine attachments split when bending.
    const edge=poly([[0,.058*bulk],[.65,.045*bulk],[1,.087*bulk]]),bandW=(c.shirt==='jacket'?.016:.012)*bulk;
    const yAt=t=>T.MathUtils.lerp(hip+.050*h,shoulder-.030*h,t);
    sheet('InnerTee',lightTop,40,16,(u,t)=>[(2*u-1)*edge(t),yAt(t)],0);
    for(const s of [-1,1]){
      sheet('FrontBinding'+s,darken(c.shirtColor,.86),40,4,(u,t)=>[s*(edge(t)-.003+u*bandW),yAt(t)],.003);
      const px=s*torsoWidth*.59,py=hip+.18*h,pw=.038*bulk,ph=.039*h;
      sheet('FrontPocket'+s,darken(c.shirtColor,.95),12,10,quad([px-pw,py-ph],[px+pw,py-ph],[px+pw,py+ph],[px-pw,py+ph]),.001);
      lineOnTop('PocketSeam'+s,[[px-pw*.9,py+ph*.85],[px+pw*.9,py+ph*.85]],darken(c.shirtColor,.79),.0017);
    }
    if(c.shirt==='cardigan')for(let j=0;j<4;j++){const t=.15+j*.15,y=yAt(t);buttonOnTop('CardiganButton'+j,edge(t)+bandW*.3,y,'#c6b598',.0065,.013);}
    if(c.shirt==='jacket'){
      for(const s of [-1,1])sheet('JacketLapel'+s,darken(c.shirtColor,.86),20,10,quad([s*.088*bulk,shoulder-.045*h],[s*.143*bulk,shoulder-.070*h],[s*.092*bulk,shoulder-.165*h],[s*.054*bulk,shoulder-.140*h]),.005);
      buttonOnTop('JacketZip',edge(.04)+bandW*.25,yAt(.04),'#aaa99f',.007,.012);
    }
  }
  if(c.shirt==='uniform'){
    const vTop=shoulder-.026,vBot=shoulder-.290*h;
    // 셔츠 V자 가장자리 반폭. 위(칼라)에서 아래(V 바닥)로. 옷깃 안쪽 변이 같은 선을 쓴다.
    const vEdge=poly([[0,.050],[.62,.042],[1,.004]]);
    sheet('UniformShirtFront','#f7f5ee',16,6,(u,t)=>[(2*u-1)*vEdge(t),T.MathUtils.lerp(vTop,vBot,t)],.004);
    const lapelOuter=poly([[0,.074],[.13,.126],[.24,.102],[.34,.120],[1,.040]]);
    for(const s of [-1,1]){
      const py=hip+.16*h;lineOnTop('UniformPocketFlap'+s,[[s*.075,py],[s*.155,py]],darken(c.shirtColor,.83),.004);
      // 옷깃: 안쪽 변은 셔츠 V자(살짝 겹치게), 바깥 변은 노치가 있는 라펠선
      sheet('UniformLapel'+s,darken(c.shirtColor,.80),18,4,(u,t)=>[s*T.MathUtils.lerp(vEdge(t)-.005,lapelOuter(t),u),T.MathUtils.lerp(vTop-.002,vBot-.008,t)],.006);
      // 흰 셔츠 칼라 날개
      sheet('UniformWhiteCollar'+s,'#f7f5ee',5,5,quad([s*.010,vTop+.004],[s*.048,vTop+.002],[s*.060,vTop-.050*h],[s*.024,vTop-.030*h]),.008);
    }
    const tieY=shoulder-.042*h;
    if(c.uniformTie==='tie'){
      const tieHalf=poly([[0,.009],[.78,.017],[1,.001]]);
      sheet('UniformTie',c.tieColor,16,4,(u,t)=>[(2*u-1)*tieHalf(t),T.MathUtils.lerp(tieY-.012,tieY-.176*h,t)],.008);
      ell('TieKnot',[0,tieY-.002,frontZ(0,tieY)+.012],[.014,.013,.006],darken(c.tieColor,.88),'Chest');
    }else if(c.uniformTie==='ribbon'){
      for(const s of [-1,1]){
        const g=sphereGeo([0,0,0],[.037,.022,.010],20).rotateZ(s*.18).translate(s*.031,tieY,frontZ(0,tieY)+.013);skinGeo('RibbonBow'+s,g,c.tieColor,'Chest');
        sheet('RibbonTail'+s,c.tieColor,8,3,quad([s*.004,tieY],[s*.024,tieY-.006],[s*.041,tieY-.067*h],[s*.012,tieY-.070*h]),.006);
      }
      ell('RibbonKnot',[0,tieY,frontZ(0,tieY)+.018],[.013,.015,.007],darken(c.tieColor,.86),'Chest');
    }
    const pocketY=shoulder-.195*h,pocketX=.123*bulk;
    lineOnTop('UniformBreastPocket',[[pocketX-.041,pocketY],[pocketX+.041,pocketY]],darken(c.shirtColor,.62),.005);
    sheet('SchoolBadge','#bda261',6,4,(u,t)=>[pocketX+(2*u-1)*.012*(1-.6*Math.pow(t,3)),pocketY-.007-.029*t],.006);
    for(let j=0;j<3;j++){const y=hip+.12*h+j*.065*h;ell('UniformButton'+j,[0,y,frontZ(0,y)+.007],[.009,.009,.005],'#bba16b','Spine',16);}
  }
  if(c.shirt==='polo'){
    const top=shoulder-.035*h;
    sheet('PoloPlacket',darken(c.shirtColor,.90),20,6,(u,t)=>[(2*u-1)*.012*bulk,T.MathUtils.lerp(top,top-.13*h,t)],.001);
    for(const s of [-1,1])sheet('PoloCollar'+s,darken(c.shirtColor,.88),18,12,quad([s*.013*bulk,top],[s*.105*bulk,top+.008*h],[s*.082*bulk,top-.085*h],[s*.032*bulk,top-.058*h]),.005);
    for(let j=0;j<2;j++)buttonOnTop('PoloButton'+j,0,top-.075*h-j*.032*h,lightTop,.0045,.011);
  }
  if(c.shirt==='overalls'){
    const bibTop=shoulder-.155*h,bibBottom=hip+.037*h;
    sheet('OverallBib',c.pantsColor,40,18,(u,t)=>[(2*u-1)*T.MathUtils.lerp(.158*bulk,.120*bulk,t),T.MathUtils.lerp(bibBottom,bibTop,t)],.001);
    for(const s of [-1,1]){
      const strapX=t=>T.MathUtils.lerp(.094*bulk,.145*bulk,t);
      sheet('OverallStrap'+s,c.pantsColor,28,6,(u,t)=>[s*(strapX(t)+(u-.5)*.030*bulk),T.MathUtils.lerp(bibTop-.023*h,shoulder-.030*h,t)],.003);
      const bx=s*.096*bulk,by=bibTop-.012*h,bw=.012*bulk,bh=.013*h;
      // Small rectangular buckle, with a fabric centre, instead of a spherical knob.
      sheet('OverallBuckle'+s,'#b79b61',8,8,quad([bx-bw,by-bh],[bx+bw,by-bh],[bx+bw,by+bh],[bx-bw,by+bh]),.007);
      sheet('OverallBuckleInset'+s,c.pantsColor,6,6,quad([bx-bw*.55,by-bh*.55],[bx+bw*.55,by-bh*.55],[bx+bw*.55,by+bh*.55],[bx-bw*.55,by+bh*.55]),.008);
    }
    const pocketY=bibTop-.10*h;
    sheet('BibPocket',darken(c.pantsColor,.93),16,12,(u,t)=>[(2*u-1)*.061*bulk*(1-.12*Math.pow(1-t,4)),pocketY+(t-.5)*.080*h],.004);
    lineOnTop('BibSeam',[[-.052*bulk,pocketY+.032*h],[.052*bulk,pocketY+.032*h]],darken(c.pantsColor,.75),.0018);
  }
  if(['skirt','pleated_skirt'].includes(c.pants)){
    // 허리는 상의 밑단(hip+.0275) 안쪽에서 시작하고 상의보다 좁다. 밑단 높이에서 시작해 상의보다
    // 넓게 두면 위에서 볼 때 둘 사이 고리 틈으로 다리가 보여 치마가 몸 둘레에 떠 있는 관처럼 읽힌다.
    const school=c.pants==='pleated_skirt',bottom=(school?.43:.45)*h,top=hip+.060,flare=school?1.24:1.34;
    const pleat=a=>school?Math.asin(Math.sin(a*20))/(Math.PI/2)*.010:Math.sin(a*14)*.007;
    const skirtPoint=(u,t)=>{const a=u*Math.PI*2,r=T.MathUtils.lerp(torsoWidth*.80,torsoWidth*flare,Math.pow(t,.8))+pleat(a)*t;
      const depth=T.MathUtils.lerp(.108*bulk,Math.max(torsoWidth*flare*.78,.16*h+.07*bulk),Math.pow(t,.8));
      return[Math.sin(a)*r,T.MathUtils.lerp(top,bottom,t),Math.cos(a)*(depth+pleat(a)*t*.7)];};
    // 허벅지 구간은 허벅지를 100% 따라가고 무릎 아래는 정강이를 따라간다. 앉으면 허벅지가
    // 수평이 되는데 치마가 70%만 따라가면 허벅지가 치마 윗면을 뚫고 나오고, 무릎 아래까지
    // 허벅지 본에 묶여 있으면 치맛단이 무릎 앞으로 판처럼 뻗는다. 정강이에 물리면 무릎에서
    // 아래로 늘어진다. 걷기 관통은 tests/skirt-clearance.mjs 가 본다.
    const skirtWeights=(x,y)=>{
      // 전이 띠가 길면(.03h~.22h) 그 구간에서 치마가 허벅지를 반만 따라가 앉을 때 허벅지가 뚫고 나온다.
      const follow=T.MathUtils.smoothstep(top-y,.015*h,.075*h),knee=1-T.MathUtils.smoothstep(y,.41*h,.53*h);
      const left=T.MathUtils.smoothstep(x,-.10*bulk,.10*bulk),side=x>=0?'Left':'Right',other=x>=0?'Right':'Left',mine=x>=0?left:1-left;
      return{ids:[index('Hips'),index(side+'UpperLeg'),index(side+'LowerLeg'),index(other+'UpperLeg')],weights:[1-follow,follow*mine*(1-knee),follow*mine*knee,follow*(1-mine)]};};
    const g=surface(20,80,skirtPoint);
    const skirt=skinGeo('PleatedSkirt',g,c.pantsColor,'Hips',null,skirtWeights);skirt.material.side=T.DoubleSide;
    const hem=Array.from({length:81},(_,j)=>skirtPoint(j/80,1));
    const hemMesh=skinGeo('SkirtHem',curveGeo(hem,.004),darken(c.pantsColor,.83),'Hips',null,skirtWeights);
    // 앉기 전용 셰이프키. 바인드 자세에서 치마 앞면은 다리 축보다 29cm 앞에 퍼져 있다.
    // 허벅지가 수평이 되면 그 앞 오프셋이 위로, 정강이를 따라가는 단은 무릎 앞으로 그대로
    // 남아 선반처럼 뻗는다. 가중치로는 못 푼다. 앉을 때만 앞 플레어를 다리 앞까지 접는다.
    const sitWarp=(x,y,z)=>{const t=T.MathUtils.clamp((top-y)/(top-bottom),0,1),f=T.MathUtils.smoothstep(t,.05,.55);
      return z>0?T.MathUtils.lerp(z,Math.min(z,.115*bulk),f):z;};
    for(const m of [skirt,hemMesh]){
      const p=m.geometry.attributes.position,arr=new Float32Array(p.array);
      for(let i=0;i<p.count;i++)arr[3*i+2]=sitWarp(p.getX(i),p.getY(i),p.getZ(i));
      m.geometry.morphAttributes.position=[new T.Float32BufferAttribute(arr,3)];m.geometry.morphTargetsRelative=false;
      m.updateMorphTargets();m.morphTargetDictionary={sit:0};poseMorphs.push(m);
    }
  }
  for(const [side,s] of [['Left',1],['Right',-1]]) {
    const sx=s*shoulderX, elbow=s*(shoulderX+armLen), wrist=s*(shoulderX+armLen+foreLen);
    const armRadius=.071*bulk;
    const upperSleeve=c.shirt==='vest'?lightTop:c.shirtColor,lowerSleeve=['tee','polo','overalls'].includes(c.shirt)?skin:c.shirt==='vest'?lightTop:c.shirtColor;
    if(shortSleeve){
      seg(side+'ExposedUpperArm',[s*(shoulderX+armLen-.065*h),shoulder,0],[elbow,shoulder,0],armRadius*.75,armRadius*.72,skin,side+'UpperArm');
      ell(side+'Elbow',[elbow,shoulder,0],[armRadius*.72,armRadius*.72,armRadius*.72],skin,side+'LowerArm');
      seg(side+'Forearm',[elbow,shoulder,0],[wrist,shoulder,0],armRadius*.73,armRadius*.50,skin,side+'LowerArm');
      ell(side+'Wrist',[wrist,shoulder,0],[armRadius*.50,armRadius*.50,armRadius*.46],skin,side+'Hand');
    }
    // 손. 눌린 타원체 하나면 굵기 변화가 없어 주걱처럼 보인다. 손목에서 좁고 손등에서
    // 넓어졌다가 손끝에서 둥글게 오므라드는 벙어리장갑 단면을 준다.
    {
      const hl=.076*h, g=sphereGeo([0,0,0],[hl,.038,.025],28), p=g.attributes.position;
      for(let i=0;i<p.count;i++){
        const x=p.getX(i), t=T.MathUtils.clamp(x*s/hl*.5+.5,0,1);
        // 손끝에서 배율까지 줄이면 구 자체도 0 으로 수렴해 송곳이 된다. 손목만 좁히고
        // 손끝은 구의 둥근 끝을 그대로 살린다. 손등(t≈.7)이 가장 넓다.
        const f=.78+.50*Math.pow(t,.55)-.28*Math.pow(t,4);
        p.setXYZ(i,x,p.getY(i)*f,p.getZ(i)*f*.90);
      }
      g.computeVertexNormals();
      g.translate(wrist+s*.052*h,shoulder,0);
      skinGeo(side+'HandMesh',g,skin,side+'Hand');
    }
    // 엄지는 손바닥 옆에서 앞아래로 뻗는 작은 타원체다. 구를 그냥 붙이면 사마귀로,
    // 원기둥을 쓰면 끝이 뚫린 관으로 보인다.
    {
      const g=sphereGeo([0,0,0],[.030*h,.016,.016],20);
      g.rotateZ(-s*.62).rotateY(s*.30);
      g.translate(wrist+s*.046*h,shoulder-.016,.017);
      skinGeo(side+'Thumb',g,skin,side+'Hand');
    }
    if(['sweater','hoodie','jacket','cardigan'].includes(c.shirt)){// 끝단은 소매 끝 반지름(armRadius*.73)으로 좁혀 들어간다. 소매보다 굵은 채 끝나면 그 단면
    // 고리가 위에서 볼 때 팔과 따로 노는 원반으로 읽힌다.
    seg(side+'SleeveCuff',[wrist-s*.036*h,shoulder,0],[wrist-s*.004,shoulder,0],armRadius*.79,armRadius*.72,darken(c.shirtColor,.82),side+'LowerArm');}
    const lx=s*.11*bulk, knee=.47*h, ankle=.12*h, legR=(c.pants==='wide'?.109:.090)*bulk;
    if(['skirt','pleated_skirt'].includes(c.pants))seg(side+'UpperLegMesh',[lx,hip,0],[lx,knee,0],legR*.78,legR*.67,c.legwear==='tights'?'#252630':skin,side+'UpperLeg');
    if(['shorts','skirt','pleated_skirt'].includes(c.pants)){
      ell(side+'Knee',[lx,knee,0],[legR*.67,legR*.67,legR*.67],c.legwear==='tights'?'#252630':skin,side+'LowerLeg');
      seg(side+'LowerLegMesh',[lx,knee,0],[lx,ankle,0],legR*.67,legR*.55,c.legwear==='none'?skin:'#252630',side+'LowerLeg');
    }
    if(c.pants==='cargo'){
      ell(side+'CargoPocket',[lx+s*legR*.79,hip-.17*h,.028],[.032,.072*h,.074],darken(c.pantsColor,.90),side+'UpperLeg');
      ell(side+'CargoFlap',[lx+s*legR*.83,hip-.115*h,.033],[.034,.021*h,.078],darken(c.pantsColor,.80),side+'UpperLeg');
    }
    if(c.pants==='joggers')seg(side+'AnkleCuff',[lx,ankle+.015,0],[lx,ankle+.07*h,0],legR*.58,legR*.64,darken(c.pantsColor,.78),side+'LowerLeg');
    ell(side+'Shoe',[lx,.081*h,.05],[.095*bulk,.072*h,.15],c.shoeColor,side+'Foot');
    ell(side+'Sole',[lx,.032*h,.05],[.098*bulk,.028*h,.152],'#f8f4ec',side+'Foot');
    for(let i=0;i<3;i++)tube(side+'Lace'+i,[[lx-.04,.132*h,.047+i*.025],[lx+.04,.132*h,.047+i*.025]],.0045,'#c3baab',side+'Foot');
  }
  group.updateMatrixWorld(true);
  // blink and the expressions scale the same eye axis, and three.js blends absolute morphs
  // linearly, so an expression left at full weight drags the closing lid past that axis
  // (serious -9.1%, angry -11.2%). Meshes carrying a real blink fade their expression out as
  // the lid closes; the brows and mouth have no blink key and keep theirs.
  const setExpression=(name,intensity=1,blink=0)=>{for(const m of facial){const d=m.morphTargetDictionary,w='blink' in d?intensity*(1-blink):intensity;for(const e in d)m.morphTargetInfluences[d[e]]=e==='blink'?blink:e===name?w:0;}};
  const setGaze=(x,y)=>{for(const side of ['Left','Right'])boneMap[side+'Eye'].rotation.set(-y,x,0);};
  // ── 걷기 ────────────────────────────────────────────────────────────────────
  // 순운동학만으로 다리를 흔들면 골반이 움직이는 동안 디딘 발이 같이 끌려가 빙판 위를
  // 걷는 것처럼 보인다. 발의 목표 위치를 먼저 정하고 무릎 각을 코사인 법칙으로 역산한다.
  // 2본이라 솔버가 필요 없다.
  const thighLen=hip-.47*h, shinLen=.47*h-.12*h, ankleRest=.12*h;
  const legIK=(side,ty,tz,hipY)=>{
    const u=hipY-ty, w=-tz;                       // 골반 기준. u 는 아래, w 는 뒤
    // 최대 신전에 닿으면 무릎이 탁 펴지고 그 근처에서 acos 이 급변해 딱딱해 보인다.
    // 사람 다리도 완전히 펴지지 않는다. 98.5% 로 제한해 항상 약간 굽은 상태를 유지한다.
    const dist=Math.min(Math.hypot(u,w),(thighLen+shinLen)*.985);
    const kneeCos=(thighLen*thighLen+shinLen*shinLen-dist*dist)/(2*thighLen*shinLen);
    const knee=Math.PI-Math.acos(T.MathUtils.clamp(kneeCos,-1,1));
    const hipCos=(thighLen*thighLen+dist*dist-shinLen*shinLen)/(2*thighLen*Math.max(dist,1e-6));
    const thighA=Math.atan2(w,u)-Math.acos(T.MathUtils.clamp(hipCos,-1,1));
    boneMap[side+'UpperLeg'].rotation.x=thighA;
    boneMap[side+'LowerLeg'].rotation.x=knee;
    return thighA+knee;                            // 정강이의 세계 각도. 발목에 쓴다
  };
  const walkPose=(time)=>{
    const p=(time*2/Math.PI)%1;                    // 0~1 한 걸음 주기
    const stride=.255*h, lift=.042*h;   // 보폭이 크면 디딤 다리가 최대 신전에 닿는다
    // 골반 상하 운동. 디딤 중간에 가장 높고 두 발이 바뀔 때 가장 낮다. 주기의 두 배다.
    const bob=.008*h*Math.cos(4*Math.PI*p);
    const hipY=hip+bob;
    boneMap.Hips.position.y=boneMap.Hips.userData.rest.y+bob;
    // 골반 기울기. 흔드는 다리 쪽이 내려간다. 어깨는 반대로 돈다.
    // 골반 흔들림은 아주 작아야 한다. 크게 주면 뒤뚱거린다.
    boneMap.Hips.rotation.z=.012*Math.sin(2*Math.PI*p);
    boneMap.Hips.rotation.y=.026*Math.sin(2*Math.PI*p);
    boneMap.Chest.rotation.y=-.042*Math.sin(2*Math.PI*p);
    boneMap.Chest.rotation.z=.008*Math.sin(2*Math.PI*p+Math.PI);
    boneMap.Head.rotation.y=.022*Math.sin(2*Math.PI*p);
    for(const [side,ph] of [['Left',0],['Right',.5]]){
      const sg=side==='Left'?1:-1;
      const q=(p+ph)%1;
      let ty,tz,ankle;
      if(q<.62){                                   // 디딤. 발이 바닥에 붙어 뒤로 흐른다
        const t=q/.62;
        ty=ankleRest; tz=T.MathUtils.lerp(stride*.5,-stride*.5,t);
        // 뒤꿈치 착지에서 발끝 밀기까지. 발목이 돌아야 발이 바닥을 긁지 않는다
        ankle=T.MathUtils.lerp(-.20,.42,Math.pow(t,1.6));
      }else{                                       // 흔듦
        const t=(q-.62)/.38;
        // 발끝을 뗀 직후에는 다리가 아직 뒤에 있고 무릎만 굽는다. 앞으로는 늦게 나간다.
        // 앞뒤 이동과 들어올림을 같은 속도로 주면 무릎을 높이 드는 행진이 된다.
        ty=ankleRest+lift*Math.sin(Math.PI*Math.pow(t,.85));
        tz=T.MathUtils.lerp(-stride*.5,stride*.5,Math.pow(t,1.55));
        ankle=T.MathUtils.lerp(.42,-.20,Math.min(1,t*1.4));
      }
      const shinWorld=legIK(side,ty,tz,hipY);
      boneMap[side+'Foot'].rotation.x=-shinWorld+ankle;
      // 팔은 반대쪽 다리와 짝을 이룬다. 왼팔이 나갈 때 오른발이 나간다.
      // 발이 가장 앞에 오는 시점이 q=0 이므로 sin 이 아니라 cos 을 써야 위상이 맞는다.
      // sin 을 쓰면 90도 어긋나 같은 쪽 팔다리가 함께 나간다.
      const c=Math.cos(2*Math.PI*q);
      boneMap[side+'UpperArm'].rotation.x=c*.40;
      // 팔을 내린 상태에서 전완 rotation.x 는 축 비틀림이다. 굽힘은 y (왼팔 음수가 앞).
      boneMap[side+'LowerArm'].rotation.y=-sg*(.16+Math.max(0,-c)*.50);
    }
  };
  const pose=(mode,time=0)=>{for(const m of poseMorphs)m.morphTargetInfluences[0]=mode==='sit'?1:0;for(const b of bones)if(!b.name.endsWith('Eye'))b.quaternion.identity();boneMap.Hips.position.y=boneMap.Hips.userData.rest.y;if(mode!=='tpose'){boneMap.LeftUpperArm.rotation.z=-1.25;boneMap.RightUpperArm.rotation.z=1.25;}if(mode==='idle'){boneMap.Chest.rotation.z=Math.sin(time*1.2)*.022;boneMap.Head.rotation.y=Math.sin(time*1.2)*.08;}if(mode==='walk')walkPose(time);
    if(mode==='sit'){
      // 골반을 의자 높이만큼 내리고 다리를 접는다. 굽힘 각도를 고관절 하나에 다 주면
      // 선형 블렌드 스키닝이 그 한 구간에서 비틀려 사탕 포장지처럼 잘록해진다.
      // 골반을 앞으로 기울여 굽힘을 나누고, 척추로 되돌리되 상체는 조금 앞으로 숙인다.
      // 팔이 몸통보다 짧아 똑바로 앉으면 손이 허벅지에 닿지 않는다.
      const tilt=.30;
      boneMap.Hips.position.y=boneMap.Hips.userData.rest.y-.155*h;
      boneMap.Hips.rotation.x=-tilt;
      boneMap.Spine.rotation.x=.42;boneMap.Chest.rotation.x=.22;
      boneMap.Neck.rotation.x=-.10;boneMap.Head.rotation.x=-.18;
      for(const [side,sg] of [['Left',1],['Right',-1]]){
        boneMap[side+'UpperLeg'].rotation.x=-1.44+tilt;
        // rotation.y 는 허벅지 축 비틀림이다(무릎 벌림이 아니다). 벌림은 z 로 준다.
        boneMap[side+'UpperLeg'].rotation.z=sg*.05;
        boneMap[side+'LowerLeg'].rotation.x=1.48;
        boneMap[side+'Foot'].rotation.x=-.04;
        // 손무릎. 각도는 scripts 의 탐색으로 손 본이 허벅지 위 무릎 근처에 오도록 잡은 값.
        // 팔을 내린 뒤에는 전완의 rotation.x 가 비틀림, rotation.y 가 팔꿈치 굽힘이다.
        // 상완은 17°만 앞으로, 팔꿈치 32°. 손은 허벅지 가운데에 놓인다(팔이 짧아 무릎까지는 안 간다).
        boneMap[side+'UpperArm'].rotation.z=-sg*1.60;
        boneMap[side+'UpperArm'].rotation.x=-.30;
        // 좌우 미러는 (x,-y,-z) 다. 비틀림 x 의 부호를 뒤집으면 두 손이 다른 곳을 본다.
        boneMap[side+'LowerArm'].rotation.x=.40;
        boneMap[side+'LowerArm'].rotation.y=-sg*.55;
        // 손목을 젖혀 손바닥이 허벅지 윗면에 눕게 한다. 전완 방향 그대로면 손끝이 허벅지를 뚫는다.
        // 손 메시는 x 팔 방향, y 너비, z 두께라 손바닥 법선은 로컬 z 다. 법선 아래(-Y), 손끝 앞(+Z). 탐색값.
        boneMap[side+'Hand'].rotation.set(0,-sg*1.0,sg*.4);
      }
    }
    if(mode==='look'){
      // 두리번. 고개를 좌우로 돌리되 목과 가슴이 조금씩 따라가고, 높이도 살짝 바뀐다.
      const a=Math.sin(time*1.1),b=Math.sin(time*.45+1.0);
      boneMap.Head.rotation.y=.50*a;boneMap.Neck.rotation.y=.18*a;boneMap.Chest.rotation.y=.10*a;
      boneMap.Head.rotation.x=.08*b;boneMap.Head.rotation.z=-.06*a;
      for(const [side,sg] of [['Left',1],['Right',-1]])boneMap[side+'LowerArm'].rotation.y=-sg*.15;
    }
    if(mode==='talk'){
      // 이야기. 끄덕임과 갸웃거림, 오른손은 손바닥을 위로 펴 앞에서 흔든다.
      const nod=Math.sin(time*3.1),tilt=Math.sin(time*1.7+.6),g=Math.sin(time*2.6);
      boneMap.Head.rotation.x=.04+.06*nod;boneMap.Head.rotation.z=.05*tilt;boneMap.Head.rotation.y=.08*Math.sin(time*.9);
      boneMap.Chest.rotation.z=.02*tilt;
      boneMap.RightUpperArm.rotation.x=-.35+.08*g;boneMap.RightLowerArm.rotation.y=1.35+.15*g;
      boneMap.RightHand.rotation.set(-.3+.2*g,-.2,0);
      boneMap.LeftLowerArm.rotation.y=-.25;
    }
    if(mode==='cross'){
      // 팔짱. 팔이 짧아 손이 반대쪽 팔꿈치까지는 못 가고 가슴 가운데서 만난다. 각도는 탐색값.
      // 오른팔은 왼팔 아래로 들어가도록 조금 덜 앞으로.
      // 상완을 수직보다 안으로(z −1.70) 눌러 넣으면 소매 바깥쪽이 어깨 위·뒤로 밀려 어깨가
      // 두꺼워진다. 상완은 z −1.1 로 두고 비틀림(y)과 팔꿈치 굽힘으로 가슴 앞을 가로지른다.
      // 어깨 띠 실루엣(뒤 z, 위 y, 바깥 x)이 쉬는 자세와 같은 후보 중에서 골랐다.
      // 두꺼워 보인 것은 상완 비틀림(y −1.6)이었다. 겨드랑이 이음 살이 팔에 물려 있어 비틀면
      // 팔 축에서 10cm 밖으로 휘둘려 소매 옆에 판이 선다(축 거리 최대 .102→.204).
      // 비틀림을 −.4 로 줄이고 전완 비틀림(x .8)으로 손 방향을 맞춘다(최대 .116).
      boneMap.LeftUpperArm.rotation.set(-.20,-.40,-1.50);boneMap.LeftLowerArm.rotation.set(.80,-1.90,0);boneMap.LeftHand.rotation.set(1.2,-.3,-.3);
      boneMap.RightUpperArm.rotation.set(-.12,.40,1.50);boneMap.RightLowerArm.rotation.set(.80,1.90,0);boneMap.RightHand.rotation.set(1.2,.3,.3);
      boneMap.Chest.rotation.x=.03;boneMap.Head.rotation.x=-.04;
    }
    if(mode==='shy'){
      // 주눅든 자세. 고개를 숙이고 등을 말고 어깨를 앞으로 모은다.
      boneMap.Head.rotation.x=.32;boneMap.Neck.rotation.x=.20;
      boneMap.Chest.rotation.x=.11;boneMap.Spine.rotation.x=.07;
      for(const [side,sg] of [['Left',1],['Right',-1]]){
        boneMap[side+'Shoulder'].rotation.y=-sg*.20;
        boneMap[side+'UpperArm'].rotation.z=-sg*1.33;
        boneMap[side+'UpperArm'].rotation.x=.12;
        boneMap[side+'LowerArm'].rotation.y=-sg*.48;
      }
    }group.updateMatrixWorld(true);skeleton.update();};
  const clips=[];
  for(const mode of (animations ? ['idle','walk'] : [])){const tracks=[];const times=Array.from({length:49},(_,i)=>i/24);const names=['Hips','LeftUpperArm','RightUpperArm','LeftLowerArm','RightLowerArm','LeftUpperLeg','RightUpperLeg','LeftLowerLeg','RightLowerLeg','LeftFoot','RightFoot','Chest','Head'];for(const name of names){const values=[];for(const t of times){pose(mode,mode==='walk'?t*Math.PI/4:t*Math.PI/1.2);values.push(...boneMap[name].quaternion.toArray());}tracks.push(new T.QuaternionKeyframeTrack(name+'.quaternion',times,values));}
    if(mode==='walk'){const ys=[];for(const t of times){pose(mode,t*Math.PI/4);ys.push(0,boneMap.Hips.position.y,0);}
      tracks.push(new T.VectorKeyframeTrack('Hips.position',times,ys));}clips.push(new T.AnimationClip(mode==='idle'?'Idle':'Walk',2,tracks));}
  pose('relaxed');setExpression(c.expression,c.intensity);setGaze(c.gazeX,c.gazeY);
  const dispose=()=>{for(const p of parts)p.geometry.dispose();for(const m of mats.values())m.dispose();skeleton.dispose();};
  return {group,bones,boneMap,skeleton,parts,facial,setExpression,setGaze,pose,clips,dispose,height:headY+(ry+.14)*headReduction,headY,collar,hip,armLen,foreLen,shoulderX,bodyZ};
}
