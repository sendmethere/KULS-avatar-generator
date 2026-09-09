import * as T from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
const cache = new Map();
const placeholder = new T.MeshBasicMaterial();
const clamp = T.MathUtils.clamp;
function smoothUnion(a,b,k) {const h=Math.max(k-Math.abs(a-b),0)/k;return Math.min(a,b)-h*h*k*.25;}
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
function fieldMesh(key,min,max,field) {
  if(cache.has(key)) return cache.get(key).clone();
  const n=56, mc=new MarchingCubes(n,placeholder,false,false,30000);
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
export function shirtGeometry({hip,shoulder,shoulderX,armLen,foreLen,width,bulk,h,shortSleeve=false}) {
  // Model the relaxed silhouette directly, then avatar.js solves its bind coordinates.
  const reach=armLen+(shortSleeve?-.06*h:foreLen-.006),angle=1.25;
  const endX=shoulderX+reach*Math.cos(angle),endY=shoulder-reach*Math.sin(angle),r=.074*bulk;
  const args=[hip,shoulder,shoulderX,armLen,foreLen,width,bulk,h,shortSleeve];
  return fieldMesh('shirtA'+JSON.stringify(args),[-endX-.14,Math.min(hip,endY)-.11,-.23*bulk],[endX+.14,shoulder+.18,.23*bulk],(x,y,z)=>{
    const low=hip+.025*h,high=shoulder+.035*h,w=width*(.84+.12*T.MathUtils.smoothstep(y,hip+.04*h,shoulder-.08*h));
    let d=roundBox(x,y-(low+high)/2,z,w,(high-low)/2,.126*bulk,.045*bulk);
    const sleeve=capsule(Math.abs(x),y,z,shoulderX+.006*bulk,shoulder+.010*h-r,endX,endY,r,r*.70);
    const endPlane=(Math.abs(x)-endX)*Math.cos(angle)-(y-endY)*Math.sin(angle);
    d=smoothUnion(d,Math.max(sleeve,endPlane),.025*bulk);
    // Cut only the trunk hem, preserving sleeves below waist height.
    return Math.max(d,Math.abs(x)<width*.86?hip+.025*h-y:-100);
  });
}
export function pantsGeometry({hip,width,bulk,h,style}) {
  const short=style==='shorts',wide=style==='wide',bottom=short?.50*h:.12*h;
  const legX=.11*bulk, radius=(wide?.109:.090)*bulk;
  return fieldMesh('pants'+JSON.stringify([hip,width,bulk,h,style]),[-width-.11, bottom-.07,-.23*bulk],[width+.11,hip+.15,.23*bulk],(x,y,z)=>{
    // A short waist bridge preserves the toy-like proportions: no long pelvic bulb.
    let d=roundBox(x,y-(hip-.020*h),z,legX+radius*.94,.080*h,radius*1.04,Math.min(.064*bulk,.070*h));
    const thigh=capsule(Math.abs(x),y,z,legX,hip-.028*h,legX,bottom,radius*.94,radius*(wide?.90:style==='joggers'?.57:.80));
    d=smoothUnion(d,thigh,.044*bulk);
    return Math.max(d,bottom-y,y-(hip+.06*h));
  });
}

export function vestGeometry({hip,shoulder,width,bulk,h}) {
  return fieldMesh('vest'+JSON.stringify([hip,shoulder,width,bulk,h]),[-width-.08,hip-.06,-.23*bulk],[width+.08,shoulder+.13,.23*bulk],(x,y,z)=>{
    const low=hip+.016*h,high=shoulder+.041*h;
    const w=width*T.MathUtils.lerp(.89,.79,T.MathUtils.smoothstep(y,hip+.18*h,shoulder-.05*h));
    let d=roundBox(x,y-(low+high)/2,z,w,(high-low)/2,.137*bulk,.038*bulk);
    const neckline=y-(shoulder-.145*h+Math.abs(x)*1.95);
    return Math.max(d,Math.min(neckline,z-.005));
  });
}
