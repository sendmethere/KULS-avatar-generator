import assert from 'node:assert/strict';
import { createAvatar } from '../src/avatar.js';
import { DEFAULT, ENUMS, RANGE, validateConfig } from '../src/config.js';
const variants=[{...DEFAULT}];
for(const key of ['shirt','pants','hair','hijabStyle','age'])for(const value of ENUMS[key])variants.push({...DEFAULT,[key]:value,...(key==='hijabStyle'?{hair:'hijab'}:{})});
for(const edge of [0,1])variants.push({...DEFAULT,...Object.fromEntries(Object.entries(RANGE).map(([k,v])=>[k,v[edge]])),age:'child'});
for(const config of variants){
 const a=createAvatar(config);
 assert.equal(a.bones.length,24);
 for(const part of a.parts){
  const p=part.geometry.attributes.position.array;assert.ok(p.every(Number.isFinite),part.name+' non-finite geometry');
  const w=part.geometry.attributes.skinWeight.array;for(let i=0;i<w.length;i+=4)assert.ok(Math.abs(w[i]+w[i+1]+w[i+2]+w[i+3]-1)<1e-5,part.name+' weights');
  for(const m of part.geometry.morphAttributes.position||[])assert.ok(m.array.every(Number.isFinite),part.name+' non-finite morph');
 }
 // 하이라이트는 별도 메시가 아니라 홍채 텍스처 안에 그린다. 메시로 띄우면 시점을 돌릴 때
 // 안구에서 떨어져 보인다. 텍스처는 표면에 붙어 있으므로 그 문제가 없다.
 assert.ok(!a.parts.some(p=>p.name.includes('EyeShine')),'catchlight must live in the iris texture, not a floating mesh');
 const iris=a.parts.find(p=>p.name==='LeftIris');
 assert.ok(iris.material.map,'iris needs its texture');
 assert.ok(iris.geometry.attributes.uv,'iris keeps its uv');
 // 얼굴 음영은 정점 색이다. 속성이나 머티리얼 플래그가 빠지면 얼굴이 단색으로 돌아간다.
 const face=a.parts.find(p=>p.name==='Face');
 assert.ok(face.geometry.attributes.color,'face needs vertex colours');
 assert.ok(face.material.vertexColors,'face material must read them');
 a.dispose();
}
const a=createAvatar({...DEFAULT,eyeTilt:0});const white=a.parts.find(p=>p.name==='LeftEyeWhite');white.geometry.computeBoundingBox();const box=white.geometry.boundingBox;const center=a.headY+.035;assert.ok(Math.abs((center-box.min.y)/(box.max.y-center)-.87)<.001,'lower contour should be midway between round (1) and flat (.74)');a.dispose();
console.log('PASS: '+variants.length+' garment/hair/age/extreme combinations; finite geometry and morphs; normalized skin weights; flattened cartoon eyes without catchlights.');

const migrated=validateConfig({...DEFAULT,eyeShape:'almond',eyeStyle:'classic',name:'Saved avatar'});assert.equal(migrated.eyeShape,undefined);assert.equal(migrated.eyeStyle,undefined);assert.equal(migrated.name,'Saved avatar');

// The relaxed silhouette must survive the conversion to bind coordinates.
const {shirtGeometry}=await import('../src/garment.js');
const {Vector3}=await import('three');
for(const age of ['adult','child']){
 const c={...DEFAULT,age},h=age==='child'?.76:1,shoulder=(age==='child'?1.34:1.39)*h;
 const avatar=createAvatar(c);
 const bulk=age==='child'?.94:1;
 const source=shirtGeometry({hip:avatar.hip,shoulder,shoulderX:avatar.shoulderX,armLen:avatar.armLen,foreLen:avatar.foreLen,width:.23*bulk*(age==='child'?.90:1),bulk,h,collar:avatar.collar,necklineScale:.92}).translate(0,0,avatar.bodyZ);
 const top=avatar.parts.find(p=>p.name==='Top_sweater'),p=source.attributes.position;
 let armTop=-9,torsoTop=-9;
 assert.equal(top.geometry.attributes.position.count,p.count);
 for(let i=0;i<p.count;i++){
  const actual=new Vector3();top.getVertexPosition(i,actual);
  assert.ok(actual.distanceTo(new Vector3().fromBufferAttribute(p,i))<2e-6,'relaxed garment silhouette changed by skinning');
  // 소매가 어깨 덩어리보다 위로 솟으면 안 된다. 예전에는 shoulder+.035h 상수로 쟀는데
 // 삼각근을 넣으면서 어깨 자체가 그보다 높아졌다. 몸통 최고점과 비교하는 편이 뜻에 맞다.
 if(Math.abs(actual.x)>avatar.shoulderX+.02)armTop=Math.max(armTop,actual.y);
 torsoTop=Math.max(torsoTop,actual.y);
 }
 assert.ok(armTop<=torsoTop+1e-6,'sleeve rises above the shoulder mass');
 avatar.dispose();source.dispose();
}
const vest=createAvatar({...DEFAULT,shirt:'vest'});
assert.ok(vest.parts.some(p=>p.name==='VestUndershirt'));
assert.ok(vest.parts.some(p=>p.name==='Top_vest'));
assert.ok(!vest.parts.some(p=>p.name==='VestUndershirtSleeves'),'triangle-split vest edges must not return');vest.dispose();
console.log('PASS: adult/child relaxed garment shape, lowered sleeve shoulders, separate vest shell.');

// blink must close the eye the same amount under every expression. Absolute morphs blend
// linearly, so an unattenuated expression used to push the lid past the eye axis and invert it.
const b=createAvatar({...DEFAULT,eyeTilt:0});b.pose('tpose');
const eye=b.parts.find(p=>p.name==='LeftEyeWhite'),brow=b.parts.find(p=>p.name==='LeftEyebrow');
const spanY=m=>{const v=new Vector3();let lo=Infinity,hi=-Infinity;for(let i=0;i<m.geometry.attributes.position.count;i++){m.getVertexPosition(i,v);lo=Math.min(lo,v.y);hi=Math.max(hi,v.y);}return hi-lo;};
b.setExpression('neutral',1,0);const openSpan=spanY(eye);
for(const e of ['neutral','smile','serious','sad','angry','surprised']){
 b.setExpression(e,1,1);const shut=spanY(eye)/openSpan;
 assert.ok(Math.abs(shut-.035)<.002,`blink under ${e} closes to ${shut.toFixed(3)}, expected .035`);
 b.setExpression(e,1,0);const rest=new Vector3(),shutBrow=new Vector3();brow.getVertexPosition(0,rest);
 b.setExpression(e,1,1);brow.getVertexPosition(0,shutBrow);
 assert.ok(rest.distanceTo(shutBrow)<1e-9,`blink moved the ${e} eyebrow`);
}
assert.ok(!('blink' in brow.morphTargetDictionary),'a no-op blink key on the brow would clobber it');
b.dispose();
console.log('PASS: blink closes to 3.5% under every expression and leaves the brows alone.');
