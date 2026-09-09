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
 assert.ok(!a.parts.some(p=>p.name.includes('EyeShine')),'catchlight should be absent');
 a.dispose();
}
const a=createAvatar({...DEFAULT,eyeTilt:0});const white=a.parts.find(p=>p.name==='LeftEyeWhite');white.geometry.computeBoundingBox();const box=white.geometry.boundingBox;const center=a.headY+.035;assert.ok(Math.abs((center-box.min.y)/(box.max.y-center)-.87)<.001,'lower contour should be midway between round (1) and flat (.74)');a.dispose();
console.log('PASS: '+variants.length+' garment/hair/age/extreme combinations; finite geometry and morphs; normalized skin weights; flattened cartoon eyes without catchlights.');

const migrated=validateConfig({...DEFAULT,eyeShape:'almond',eyeStyle:'classic',name:'Saved avatar'});assert.equal(migrated.eyeShape,undefined);assert.equal(migrated.eyeStyle,undefined);assert.equal(migrated.name,'Saved avatar');

// The relaxed silhouette must survive the conversion to bind coordinates.
const {shirtGeometry}=await import('../src/garment.js');
const {Vector3}=await import('three');
for(const age of ['adult','child']){
 const c={...DEFAULT,age},h=age==='child'?.76:1,shoulder=(age==='child'?1.23:1.39)*h;
 const source=shirtGeometry({hip:.84*h,shoulder,shoulderX:.225,armLen:.235*h,foreLen:.22*h,width:.23,bulk:1,h});
 const avatar=createAvatar(c),top=avatar.parts.find(p=>p.name==='Top_sweater'),p=source.attributes.position;
 assert.equal(top.geometry.attributes.position.count,p.count);
 for(let i=0;i<p.count;i++){
  const actual=new Vector3();top.getVertexPosition(i,actual);
  assert.ok(actual.distanceTo(new Vector3().fromBufferAttribute(p,i))<2e-6,'relaxed garment silhouette changed by skinning');
  if(Math.abs(actual.x)>.245)assert.ok(actual.y<shoulder+.035*h,'sleeve shoulder rises above torso');
 }
 avatar.dispose();source.dispose();
}
const vest=createAvatar({...DEFAULT,shirt:'vest'});
assert.ok(vest.parts.some(p=>p.name==='VestUndershirt'));
assert.ok(vest.parts.some(p=>p.name==='Top_vest'));
assert.ok(!vest.parts.some(p=>p.name==='VestUndershirtSleeves'),'triangle-split vest edges must not return');vest.dispose();
console.log('PASS: adult/child relaxed garment shape, lowered sleeve shoulders, separate vest shell.');
