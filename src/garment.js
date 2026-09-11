import * as T from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
const cache = new Map();
const placeholder = new T.MeshBasicMaterial();
const clamp = T.MathUtils.clamp;
function smoothUnion(a,b,k) {const h=Math.max(k-Math.abs(a-b),0)/k;return Math.min(a,b)-h*h*k*.25;}
// 교집합을 Math.max 로 하면 경계에 날카로운 능선이 남고, 마칭큐브가 그 선을 들쭉날쭉하게
// 뽑아 어깨가 물결친다. 모서리를 둥글게 깎아 능선 자체를 없앤다.
function smoothIntersect(a,b,k) {const h=Math.max(k-Math.abs(a-b),0)/k;return Math.max(a,b)+h*h*k*.25;}
function roundBox(x,y,z,wx,hy,dz,r) {
  const qx=Math.abs(x)-(wx-r),qy=Math.abs(y)-(hy-r),qz=Math.abs(z)-(dz-r);
  return Math.hypot(Math.max(qx,0),Math.max(qy,0),Math.max(qz,0))+Math.min(Math.max(qx,qy,qz),0)-r;
}
export function shirtFrontZ(x,y,{hip,shoulder,width,bulk,h}) {
  const bottom=hip+.025*h,top=shoulder+.035*h,half=(top-bottom)/2,mid=(top+bottom)/2,r=.045*bulk;
  const w=width*(.84+.12*T.MathUtils.smoothstep(y,hip+.04*h,shoulder-.08*h));
  const qx=Math.max(0,Math.abs(x)-(w-r)),qy=Math.max(0,Math.abs(y-mid)-(half-r));
  return .126*bulk-r+Math.sqrt(Math.max(0,r*r-qx*qx-qy*qy));
}
function ellipsoid(x,y,z,rx,ry,rz) {return (Math.hypot(x/rx,y/ry,z/rz)-1)*Math.min(rx,ry,rz);}
function capsule(x,y,z,ax,ay,bx,by,r1,r2) {
  const dx=bx-ax,dy=by-ay,t=clamp(((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy),0,1);
  return Math.hypot(x-ax-dx*t,y-ay-dy*t,z)-T.MathUtils.lerp(r1,r2,t);
}

function fieldMesh(key,min,max,field,res=56) {
  if(cache.has(key)) return cache.get(key).clone();
  const n=res, mc=new MarchingCubes(n,placeholder,false,false,30000);
  mc.isolation=0;
  const half=max.map((v,i)=>(v-min[i])/2),center=max.map((v,i)=>(v+min[i])/2);
  for(let z=0;z<n;z++)for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    mc.field[x+n*(y+n*z)]=-field(min[0]+x/n*half[0]*2,min[1]+y/n*half[1]*2,min[2]+z/n*half[2]*2);
  }
  mc.update();
  if(mc.count>=30000*3)throw new Error('Garment mesh capacity exceeded');
  const source=new T.BufferGeometry();
  source.setAttribute('position',new T.Float32BufferAttribute(mc.positionArray.slice(0,mc.count*3),3));
  source.setAttribute('normal',new T.Float32BufferAttribute(mc.normalArray.slice(0,mc.count*3),3));
  source.scale(...half).translate(...center);
  const geometry=mergeVertices(source,1e-5);geometry.normalizeNormals();
  source.dispose();mc.geometry.dispose();
  if(cache.size>=12){const oldest=cache.keys().next().value;cache.get(oldest).dispose();cache.delete(oldest);}
  cache.set(key,geometry);return geometry.clone();
}
export function shirtGeometry({hip,shoulder,shoulderX,armLen,foreLen,width,bulk,h,collar,shortSleeve=false,armAngle=1.25,necklineScale=1}) {
  // Model the relaxed silhouette directly, then avatar.js solves its bind coordinates.
  const reach=armLen+(shortSleeve?-.06*h:foreLen-.006),angle=armAngle;
  const endX=shoulderX+reach*Math.cos(angle),endY=shoulder-reach*Math.sin(angle),r=.074*bulk;
  const args=[hip,shoulder,shoulderX,armLen,foreLen,width,bulk,h,collar,shortSleeve,armAngle,necklineScale];
  return fieldMesh('shirtA'+JSON.stringify(args),[-endX-.14,Math.min(hip,endY)-.11,-.23*bulk],[endX+.14,shoulder+.18,.23*bulk],(x,y,z)=>{
    const low=hip+.025*h;
    // 윗면이 높으면 목 구멍 테두리가 능선이 되어 어깨에 봉우리-골-봉우리가 생긴다.
    // 구멍 시작점(collar) 바로 위까지만 올린다.
    const high=shoulder+.018*h;
    // 허리. 엉덩이에서 어깨까지 단조 증가라 직선 원통이 된다. 중간을 살짝 조인다.
    const chest=T.MathUtils.smoothstep(y,hip+.04*h,shoulder-.08*h);
    const waist=Math.exp(-Math.pow((y-(hip+.21*h))/(.11*h),2));
    const w=width*(.86+.11*chest-.050*waist);
    // 모서리 반지름이 작으면 어깨가 상자 모서리로 선다. 옷은 사람 어깨에서 둥글게 돈다.
    let d=roundBox(x,y-(low+high)/2,z,w,(high-low)/2,.118*bulk,.074*bulk);
    // 어깨선. 윗면이 평평하면 어깨가 수평으로 뚝 떨어진다. 목 쪽은 높고 팔 쪽으로 내려가는
    // 면으로 잘라 쇄골에서 삼각근으로 이어지는 경사를 만든다. roundBox 의 high 를 x 의
    // 함수로 두면 거리장이 깨져 등가면이 위로 밀리므로 절단면으로 따로 준다.
    d=smoothIntersect(d,y-(high-.038*h*Math.pow(Math.min(1,Math.abs(x)/(width*.95)),1.5)),.055*bulk);
    // 캡슐 시작점이 어깨 관절보다 한참 아래면, 관절을 축으로 팔이 돌 때 그 오프셋이
    // 바깥으로 휘둘려 어깨 꼭대기에 단이 남는다. 관절 높이에 가깝게 올린다.
    const sleeve=capsule(Math.abs(x),y,z,shoulderX+.006*bulk,shoulder-.004*h-r*.62,endX,endY,r,r*.70);
    const endPlane=(Math.abs(x)-endX)*Math.cos(angle)-(y-endY)*Math.sin(angle);
    // 붙이는 폭이 좁으면 소매와 몸통 사이에 각이 남는다. 넓혀 겨드랑이를 둥글게 잇는다.
    d=smoothUnion(d,Math.max(sleeve,endPlane),.036*bulk);
    // 삼각근. 상자 모서리와 원통을 이어 붙이면 각이 진다. 실제 어깨는 몸통과 팔의 이음매
    // 위에 얹힌 둥근 덩어리다. 관절 위에 구를 두고 양쪽에 부드럽게 붙인다.
    const deltoid=Math.hypot((Math.abs(x)-shoulderX*.96)/1.00,(y-(shoulder-.072*h))/1.00,z/1.15)-.070*bulk;
    d=smoothUnion(d,deltoid,.042*bulk);
    // 어깨선을 옷깃에서 팔 쪽으로 완만히 내린다. 몸통·소매·삼각근을 합치면 어깨가
    // 목보다 높아져(1.385 → 1.401) 솟아 보인다. 합친 뒤에 곡면으로 깎아야 한다.
    // angle 은 빌드마다 상수다. T 포즈 빌드(angle≈0)에서는 이 면이 수평으로 뻗은 팔을
    // 잘라 버리므로 팔이 내려간 빌드에서만 적용한다.
    if(angle>.6){
      // 클램프를 두면 어깨 바깥에서 면이 평평해지고, 둥근 소매와 얕은 각으로 만나
      // 뾰족한 모서리가 남는다. 계속 내려가게 두면 소매에 접하며 사라진다.
      const capY=high-.050*h*Math.pow(Math.abs(x)/(shoulderX+.02),1.3);
      d=smoothIntersect(d,y-capY,.062*bulk);
    }
    // Scoop a neck hole out of the top so the neck reads as a neck instead of a flat collar line.
    const hole=(Math.hypot(x/(.120*bulk*necklineScale),(z-.008)/(.122*bulk*necklineScale))-1)*.120*bulk*necklineScale;
    // 뒷목선은 앞보다 높다. 앞뒤를 같은 높이로 자르면 뒤에서 칼라 아래로 목이 드러난다.
    const collarY=collar+.024*bulk*Math.min(1,Math.max(0,-(z-.008))/(.100*bulk));
    d=smoothIntersect(d,-Math.max(hole,collarY-y),.030*bulk);
    // Cut only the trunk hem, preserving sleeves below waist height.
    return Math.max(d,Math.abs(x)<width*.86?hip+.025*h-y:-100);
  });
}
export function pantsGeometry({hip,width,bulk,h,style}) {
  const short=style==='shorts',wide=style==='wide',bottom=short?.50*h:.12*h;
  const legX=.11*bulk, radius=(wide?.114:.095)*bulk;
  return fieldMesh('pants'+JSON.stringify([hip,width,bulk,h,style]),[-width-.11, bottom-.07,-.23*bulk],[width+.11,hip+.15,.23*bulk],(x,y,z)=>{
    // A short waist bridge preserves the toy-like proportions: no long pelvic bulb.
    let d=roundBox(x,y-(hip-.020*h),z,legX+radius*.94,.080*h,radius*1.04,Math.min(.064*bulk,.070*h));
    const thigh=capsule(Math.abs(x),y,z,legX,hip-.028*h,legX,bottom,radius*.94,radius*(wide?.90:style==='joggers'?.57:.80));
    d=smoothUnion(d,thigh,.044*bulk);
    // 무릎. 등속 테이퍼 캡슐 하나라 굽혀도 매끈한 관으로 보인다. 무릎 높이 앞쪽에 작은
    // 덩어리를 더하면 굽힘이 읽히고, 곧게 섰을 때도 다리에 마디가 생긴다.
    const kneeY=.47*h, kr=radius*.58;
    const kneeD=(Math.hypot((Math.abs(x)-legX)/1.05,(y-kneeY)/2.30,(z-radius*.26)/.95)-kr)*.95;
    d=smoothUnion(d,kneeD,.105*bulk);
    return Math.max(d,bottom-y,y-(hip+.06*h));
  });
}

export function vestGeometry({hip,shoulder,width,bulk,h}) {
  return fieldMesh('vest'+JSON.stringify([hip,shoulder,width,bulk,h]),[-width-.08,hip-.06,-.23*bulk],[width+.08,shoulder+.13,.23*bulk],(x,y,z)=>{
    const low=hip+.048*h,high=shoulder+.005*h;
    const w=width*T.MathUtils.lerp(.87,.78,T.MathUtils.smoothstep(y,hip+.18*h,shoulder-.05*h));
    let d=roundBox(x,y-(low+high)/2,z,w,(high-low)/2,.130*bulk,.042*bulk);
    const neckline=y-(shoulder-.145*h+Math.abs(x)*1.95);
    return Math.max(d,Math.min(neckline,z-.005));
  });
}
