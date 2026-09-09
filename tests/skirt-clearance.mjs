import assert from 'node:assert/strict';
import * as T from 'three';
import {createAvatar} from '../src/avatar.js';
import {DEFAULT} from '../src/config.js';
let checked=0;
for(const age of ['adult','child'])for(const pants of ['skirt','pleated_skirt']){
 const a=createAvatar({...DEFAULT,age,pants});const skirt=a.parts.find(p=>p.name==='PleatedSkirt');
 for(let phase=0;phase<16;phase++){
  a.pose('walk',phase*Math.PI/32);
  const g=skirt.geometry.clone(),p=g.attributes.position;
  for(let i=0;i<p.count;i++){const v=new T.Vector3();skirt.getVertexPosition(i,v);p.setXYZ(i,v.x,v.y,v.z);}
  g.computeBoundingSphere();g.computeBoundingBox();const mesh=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));mesh.updateMatrixWorld();
  // Probe the visible knee region: a ray toward either side must meet fabric
  // when the knee point is above the highest moving hem.
  const hemY=Math.max(...Array.from({length:81},(_,i)=>p.getY(20*81+i)));
  for(const name of ['LeftKnee','RightKnee']){const knee=a.parts.find(p=>p.name===name);for(let i=0;i<knee.geometry.attributes.position.count;i+=3){
    const v=new T.Vector3();knee.getVertexPosition(i,v);if(v.y<=hemY+.008)continue;
    for(const sign of [-1,1]){const ray=new T.Raycaster(v,new T.Vector3(0,0,sign),0,1);assert.ok(ray.intersectObject(mesh).length,`${age} ${pants}: knee protrusion at phase ${phase}`);checked++;}
  }}
  g.dispose();mesh.material.dispose();
 }
 a.dispose();
}
console.log(`PASS: ${checked} knee clearance rays, 16 walk phases × adult/child × both skirts.`);
