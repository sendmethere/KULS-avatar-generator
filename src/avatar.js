import * as T from 'three';
import { shirtGeometry, pantsGeometry, shirtFrontZ, vestGeometry } from './garment.js';
import { createHairShell } from './hair-shell.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
export const EXPRESSIONS = ['smile','serious','sad','angry','surprised','blink'];
const v = (x,y,z)=>new T.Vector3(x,y,z);
export function createAvatar(c, { animations = false } = {}) {
  const group = new T.Group(); group.name='Avatar';
  const mats = new Map(); const parts=[]; const facial=[];
  const mat=(color,roughness=.74)=>{ const k=color+roughness; if(!mats.has(k)) mats.set(k,new T.MeshStandardMaterial({color,roughness})); return mats.get(k); };
  const skin=c.skin, hair=c.hairColor;
  const darken=(hex,f)=>'#'+new T.Color(hex).multiplyScalar(f).getHexString();
  const age=c.age==='child'?.76:c.age==='elder'?.97:1;
  const h=c.height*age, bulk=c.build, fem=c.body==='feminine', masc=c.body==='masculine';
  const hip=0.84*h, shoulder=(c.age==='child'?1.23:1.39)*h, neck=shoulder+.08*h;
  const headScale=c.age==='child'?1.05:1;
  const rx=.305*c.headWidth*headScale, ry=.36*c.headLength*headScale, rz=.27*headScale;
  const headY=Math.max(1.76*h,shoulder+(c.age==='child'?.105:.012)+ry*c.chin);
  const eyeX=.115*c.eyeSpacing*c.headWidth, eyeY=headY+.035+c.eyeHeight;
  const bones=[], boneMap={};
  const bone=(name,parent,pos)=>{ const b=new T.Bone();b.name=name; const p=v(...pos); if(parent){ const pb=boneMap[parent]; b.position.copy(p.clone().sub(pb.userData.rest)); pb.add(b); }else{b.position.copy(p);group.add(b);} b.userData.rest=p; boneMap[name]=b;bones.push(b);return b; };
  bone('Hips',null,[0,hip,0]);bone('Spine','Hips',[0,hip+.16*h,0]);bone('Chest','Spine',[0,shoulder-.15*h,0]);bone('UpperChest','Chest',[0,shoulder-.06*h,0]);bone('Neck','UpperChest',[0,neck,0]);bone('Head','Neck',[0,headY-.22,0]);
  const shoulderX=(masc?.245:fem?.205:.225)*bulk;
  const armLen=.235*h, foreLen=.22*h;
  for(const [side,s] of [['Left',1],['Right',-1]]) {
    bone(side+'Shoulder','UpperChest',[s*.12,shoulder,0]);bone(side+'UpperArm',side+'Shoulder',[s*shoulderX,shoulder,0]);bone(side+'LowerArm',side+'UpperArm',[s*(shoulderX+armLen),shoulder,0]);bone(side+'Hand',side+'LowerArm',[s*(shoulderX+armLen+foreLen),shoulder,0]);
    bone(side+'UpperLeg','Hips',[s*.11*bulk,hip,0]);bone(side+'LowerLeg',side+'UpperLeg',[s*.11*bulk,.47*h,0]);bone(side+'Foot',side+'LowerLeg',[s*.11*bulk,.12*h,0]);bone(side+'Toes',side+'Foot',[s*.11*bulk,.075*h,.12]);
    bone(side+'Eye','Head',[s*eyeX,eyeY,.228]);
  }
  group.updateMatrixWorld(true); const skeleton=new T.Skeleton(bones);
  function skinGeo(name,g,color,bn='Head',morphs=null,weightFn=null) {
    g.deleteAttribute('uv');
    if(morphs) {g.morphAttributes.position=EXPRESSIONS.map(e=>morphs[e]||g.attributes.position.clone());g.morphTargetsRelative=false;}
    const ids=[], weights=[]; const index=bones.indexOf(boneMap[bn]); const p=g.attributes.position;
    for(let i=0;i<p.count;i++) { const w=weightFn?.(p.getX(i),p.getY(i),p.getZ(i),i); const ws=w?.weights||[1,0,0,0];ids.push(...(w?.ids||[index,0,0,0]).map((id,j)=>ws[j]>1e-8?id:0));weights.push(...ws.map(weight=>weight>1e-8?weight:0)); }
    g.setAttribute('skinIndex',new T.Uint16BufferAttribute(ids,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
    const m=new T.SkinnedMesh(g,mat(color));m.name=name;m.frustumCulled=false;m.castShadow=true;m.receiveShadow=true;
    group.add(m);m.bind(skeleton);if(morphs){m.morphTargetDictionary=Object.fromEntries(EXPRESSIONS.map((e,i)=>[e,i]));m.updateMorphTargets();m.morphTargetDictionary=Object.fromEntries(EXPRESSIONS.map((e,i)=>[e,i]));facial.push(m);}parts.push(m);return m;
  }
  const sphereGeo=(pos,scale,seg=24)=>new T.SphereGeometry(1,seg,16).scale(...scale).translate(...pos);
  const ell=(name,pos,scale,color,bn='Head',seg=24)=>skinGeo(name,sphereGeo(pos,scale,seg),color,bn);
  const curveGeo=(points,r=.012)=>new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>v(...p))),24,r,8,false);
  const tube=(name,pts,r,col,bn='Head')=>skinGeo(name,curveGeo(pts,r),col,bn);
  const segmentGeo=(a,b,r1,r2)=>{const av=v(...a),bv=v(...b),d=bv.clone().sub(av);return new T.CylinderGeometry(r2,r1,d.length(),20,5).applyQuaternion(new T.Quaternion().setFromUnitVectors(v(0,1,0),d.normalize())).translate(...av.add(bv).multiplyScalar(.5).toArray());};
  const seg=(name,a,b,r1,r2,col,bn)=>skinGeo(name,segmentGeo(a,b,r1,r2),col,bn);
  // The head is one deformable ellipsoid; independent jaw, cheek, forehead and chin controls.
  const headG=new T.SphereGeometry(1,48,36);const hp=headG.attributes.position;
  for(let i=0;i<hp.count;i++){const y=hp.getY(i);let width=y<0?T.MathUtils.lerp(c.jaw,c.cheek,Math.min(1,(y+1)*1.5)):T.MathUtils.lerp(c.cheek,c.forehead,y);hp.setXYZ(i,hp.getX(i)*rx*width,headY+y*ry*(y<-.5?c.chin:1),hp.getZ(i)*rz);}
  for(let i=0;i<hp.count;i++){if(hp.getZ(i)>0){const dx=(Math.abs(hp.getX(i))-eyeX)/(.105*c.eyeSize),dy=(hp.getY(i)-eyeY)/(.10*c.eyeSize*c.eyeRoundness);hp.setZ(i,hp.getZ(i)-.010*Math.exp(-1.8*(dx*dx+dy*dy)));}}
  headG.computeVertexNormals();skinGeo('Face',headG,skin);
  ell('Neck',[0,neck+.018,0],[.084,.145,.085],skin,'Neck');
  for(const [side,s] of [['Left',1],['Right',-1]]) {
    ell(side+'Ear',[s*rx*.98,headY-.018,-.012],[.068,.094,.047],skin);
    ell(side+'EarInner',[s*(rx+.027),headY-.018,.027],[.027,.049,.016],darken(skin,.77));
    // Cartoon eyes: rounded crown, flatter lower edge, thin iris and no painted catchlight.
    const ew=.083*c.eyeSize, eh=.088*.975*c.eyeSize*c.eyeRoundness;
    const angle=s*c.eyeTilt, ex=s*eyeX;
    const irx=ew*.60*c.irisSize, iry=Math.min(eh*.83,eh*.71*c.irisSize);
    function eyeMorphs(g) {
      const morphs={};
      for(const e of EXPRESSIONS){const a=g.attributes.position.clone();const f={blink:.035,smile:.94,serious:.82,sad:.94,angry:.79,surprised:1.08}[e]||1;for(let i=0;i<a.count;i++){const axis=eyeY+Math.sin(angle)*(a.getX(i)-ex);a.setY(i,axis+(a.getY(i)-axis)*f);}morphs[e]=a;}
      return morphs;
    }
    function eyeMesh(name,g,color,bn='Head') {return skinGeo(name,g,color,bn,eyeMorphs(g));}
    function eyePart(name,pos,scale,color,bn='Head') {
      const g=sphereGeo([0,0,0],scale,32);
      if(name.endsWith('EyeWhite')){
        const p=g.attributes.position;
        // Midpoint of the round and flat-bottom contours: preserve the dome, soften the base.
        for(let i=0;i<p.count;i++){const y=p.getY(i);if(y<0)p.setY(i,.5*(y-eh*.74*Math.pow(-y/eh,.60)));}
        g.computeVertexNormals();
      }
      g.rotateZ(angle).translate(...pos);return eyeMesh(name,g,color,bn);
    }
    eyePart(side+'EyeWhite',[ex,eyeY,.238],[ew,eh,.053],'#fffaf2','Head');
    eyePart(side+'Iris',[ex,eyeY,.291],[irx*.76*c.pupilSize*1.065,iry*.77*c.pupilSize*1.065,.009],c.eyeColor,side+'Eye');
    eyePart(side+'Pupil',[ex,eyeY,.298],[irx*.76*c.pupilSize,iry*.77*c.pupilSize,.007],'#151312',side+'Eye');
    const lidPoint=(t,upper,offset=0)=>{
      let x=ew*Math.cos(t),y=(upper?1:-1)*eh*Math.sin(t);
      if(!upper)y=.5*(y-eh*.74*Math.pow(Math.sin(t),.60));
      return[ex+x*Math.cos(angle)-y*Math.sin(angle),eyeY+x*Math.sin(angle)+y*Math.cos(angle)+offset,.244+Math.sin(t)*.003];
    };
    for(const upper of [true,false]){
      const pts=Array.from({length:21},(_,i)=>lidPoint(i/20*Math.PI,upper));
      if(upper && c.lashes!=='none'){
        const line=pts.map(p=>[p[0],p[1]-.002,p[2]+.010]);
        eyeMesh(side+'LashLine',curveGeo(line,.0013),darken(c.browColor,.52));
      }
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
    const brow=(e)=>{let tilt=0,lift=0; if(e==='smile')lift=.014;if(e==='sad'){tilt=-s*.047;lift=.023;}if(e==='angry'){tilt=s*.044;lift=-.024;}if(e==='serious')lift=-.018;if(e==='surprised')lift=.060;return [-1,0,1].map((t)=>[s*eyeX*c.browSpacing+t*.060*c.eyeSize*c.browWidth,eyeY+eh+.018+c.browHeight+lift+(1-t*t)*.017*c.browArch+t*(tilt+s*c.browTilt),.257]);};
    const browGeo=e=>{const path=new T.CatmullRomCurve3(brow(e).map(p=>v(...p)));const g=new T.TubeGeometry(path,24,.012*c.browThickness,8,false),p=g.attributes.position;for(let i=0;i<p.count;i++){const u=Math.floor(i/9)/24,center=path.getPointAt(u),outer=s===1?u:1-u,taper=.98-.83*Math.pow(outer,3);p.setXYZ(i,center.x+(p.getX(i)-center.x)*taper,center.y+(p.getY(i)-center.y)*taper,center.z+(p.getZ(i)-center.z)*taper);}g.computeVertexNormals();return g;};
    const bg=browGeo('neutral');const bm={};for(const e of EXPRESSIONS) bm[e]=browGeo(e).attributes.position;skinGeo(side+'Eyebrow',bg,c.browColor,'Head',bm);
    if(c.earrings){const g=new T.TorusGeometry(.033,.007,8,24).translate(s*(rx+.035),headY-.102,.006);skinGeo(side+'Earring',g,'#d9b263');}
  }
  ell('NoseBridge',[0,headY-.006,.246],[.037*c.noseWidth,.072*c.noseSize,.045*c.noseSize],skin);
  ell('NoseTip',[0,headY-.050,.280],[.055*c.noseWidth,.045*c.noseSize,.059*c.noseSize],skin);
  const mouthY=headY-.153+c.mouthHeight, mw=.078*c.mouthWidth;
  const faceSurfaceZ=(x,y)=>{
    let q=(y-headY)/ry;if(q<-.5)q/=c.chin;
    const width=q<0?T.MathUtils.lerp(c.jaw,c.cheek,Math.min(1,(q+1)*1.5)):T.MathUtils.lerp(c.cheek,c.forehead,q);
    return rz*Math.sqrt(Math.max(.025,1-q*q-(x/(rx*width))**2));
  };
  const mouthProfile=e=>e==='smile'?{curve:.043,open:.038}:e==='sad'?{curve:-.036,open:.004}:e==='angry'?{curve:-.021,open:.012}:e==='surprised'?{curve:0,open:.061}:e==='serious'?{curve:0,open:.001}:{curve:.003,open:.003};
  for(const upper of [true,false]) {
    const make=e=>{const {curve,open}=mouthProfile(e);return curveGeo(Array.from({length:9},(_,i)=>{const t=i/4-1,x=t*mw*(e==='surprised'?.65:e==='smile'?1.18:1),y=mouthY+curve*t*t+(upper?1:-1)*open*Math.sqrt(Math.max(0,1-t*t));return[x,y,faceSurfaceZ(x,y)+.012];}),.0045*c.lipSize);};
    const g=make('neutral'), morph={};for(const e of EXPRESSIONS)morph[e]=make(e).attributes.position;
    skinGeo(upper?'UpperLip':'LowerLip',g,'#68432e','Head',morph);
  }
  const mouthG=e=>{const pr=mouthProfile(e);const g=new T.SphereGeometry(1,32,16).scale(mw*(e==='surprised'?.65:e==='smile'?1.18:1),pr.open+.001,.008);const p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i);p.setY(i,p.getY(i)+mouthY+pr.curve*(x/(mw*(e==='surprised'?.65:e==='smile'?1.18:1)))**2);}for(let i=0;i<p.count;i++)p.setZ(i,p.getZ(i)+faceSurfaceZ(p.getX(i),p.getY(i))+.004);g.computeVertexNormals();return g;};
  const mm={};for(const e of EXPRESSIONS)mm[e]=mouthG(e).attributes.position;skinGeo('MouthInterior',mouthG('neutral'),'#482a25','Head',mm);
  const toothGeo=e=>{const smile=e==='smile',g=sphereGeo([0,mouthY+(smile?.020:0),0],[smile?mw*.91:.0001,smile?.008:.0001,.003],24),p=g.attributes.position;for(let i=0;i<p.count;i++)p.setZ(i,p.getZ(i)+faceSurfaceZ(p.getX(i),p.getY(i))+.018);g.computeVertexNormals();return g;};
  const toothMorph={};for(const e of EXPRESSIONS)toothMorph[e]=toothGeo(e).attributes.position;
  skinGeo('CartoonSmileTeeth',toothGeo('neutral'),'#fff8e8','Head',toothMorph);
  // Sculpted primitive locks + small raised strands. All hair remains editable mesh geometry.
  const hairGeos=[], strandGeos=[];
  const hs=(p,s)=>hairGeos.push(sphereGeo(p,s,20));
  const strand=(pts,r=.003)=>strandGeos.push(curveGeo(pts,r));
  const noise=n=>{const a=Math.sin(n*127.1+31.7)*43758.5453;return a-Math.floor(a);};
  const surface=(rows,cols,fn)=>{const positions=[],uvs=[],index=[];for(let y=0;y<=rows;y++)for(let x=0;x<=cols;x++){positions.push(...fn(x/cols,y/rows));uvs.push(x/cols,y/rows);}for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const a=y*(cols+1)+x,b=a+cols+1;index.push(a,b,a+1,b,b+1,a+1);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.setIndex(index);g.computeVertexNormals();return g;};
  const quiffPoint=(theta,phi,extra=0)=>{const f=(Math.cos(phi)+1)/2,limit=T.MathUtils.lerp(1.78,.97,f**3),t=T.MathUtils.clamp(theta/limit,0,1),flow=Math.sin(Math.PI*t),scale=1.025+.042*flow+extra,lift=.075*Math.pow(Math.max(0,flow),1.2)*f;return[Math.sin(theta)*Math.sin(phi)*rx*scale-.025*f*flow,headY+Math.cos(theta)*ry*scale+lift,Math.sin(theta)*Math.cos(phi)*rz*scale];};
  const cap=(front=1.0,back=1.8)=>{
    const g=new T.SphereGeometry(1,48,28,0,Math.PI*2,0,Math.PI-.01);const p=g.attributes.position;
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i),phi=Math.atan2(x,z),frontness=(Math.cos(phi)+1)/2;
      const maxTheta=T.MathUtils.lerp(back,front,frontness**3),theta=Math.acos(T.MathUtils.clamp(y,-1,1))/(Math.PI-.01)*maxTheta;
      if(c.hair==='quiff')p.setXYZ(i,...quiffPoint(theta,phi));else p.setXYZ(i,Math.sin(theta)*Math.sin(phi)*rx*1.07,headY+Math.cos(theta)*ry*1.07,Math.sin(theta)*Math.cos(phi)*rz*1.07);
    }g.computeVertexNormals();hairGeos.push(g);
  };
  if(c.hair==='curls') {
    cap(.88,1.7);
    const count=Math.round(128/(c.curlSize*c.curlSize));
    for(let i=0;i<count;i++){
      const theta=Math.acos(1-(i+.5)/count*1.08),phi=i*2.39996323,front=Math.cos(phi);
      if(front>.2&&theta>.91+.14*Math.abs(Math.sin(phi)))continue;
      const r=(.040+noise(i)*.010)*c.curlSize,rr=1+noise(i+20)*.025;
      const cx=Math.sin(theta)*Math.sin(phi)*rx*rr, cy=headY+Math.cos(theta)*ry*rr, cz=Math.sin(theta)*Math.cos(phi)*rz*rr;
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
    const shell=createHairShell(c,{rx,ry,rz,headY});
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
    if(c.beard==='full'||c.beard==='stubble'){
      for(let i=0;i<19;i++){const a=Math.PI*.12+i/18*Math.PI*.76;ell('Beard_'+i,[Math.cos(a)*rx*.83,headY-.13-Math.sin(a)*ry*.52,.12+Math.sin(a)*.06],[.047,c.beard==='full'?.060:.029,.034],hair);}
    }
    if(c.beard==='full'||c.beard==='mustache')for(const s of [-1,1])ell('Mustache'+s,[s*.037,headY-.113,.265],[.046,.016,.013],hair);
  }
  if(c.glasses!=='none')for(const [side,s] of [['Left',1],['Right',-1]]) {
    let g;if(c.glasses==='round')g=new T.TorusGeometry(.101*c.eyeSize,.010,8,36).scale(1,1.07,1).translate(s*eyeX,eyeY,.314);
    else g=curveGeo([[-.086,-.079],[-.099,0],[-.086,.079],[.086,.079],[.099,0],[.086,-.079],[-.086,-.079]].map(([x,y])=>[s*eyeX+x*c.eyeSize,eyeY+y*c.eyeSize,.315]),.009);
    skinGeo(side+'Glasses',g,'#35332e');tube(side+'GlassesArm',[[s*(eyeX+.10),eyeY,.31],[s*(rx+.03),eyeY,.10],[s*(rx+.02),eyeY-.015,-.035]],.009,'#35332e');
  }
  if(c.glasses!=='none')tube('GlassesBridge',[[-.035,eyeY+.015,.318],[0,eyeY+.026,.329],[.035,eyeY+.015,.318]],.009,'#35332e');
  if(c.age==='elder')for(const s of [-1,1])tube('SmileLine'+s,[[s*.16,headY-.08,.232],[s*.175,headY-.115,.215],[s*.172,headY-.143,.206]],.003,darken(skin,.83));
  // Body, clothing and limbs. Every part is weighted to the same humanoid skeleton.
  const torsoWidth=(masc?.248:fem?.211:.23)*bulk;
  const shortSleeve=['tee','polo','overalls'].includes(c.shirt);
  const torsoG=shirtGeometry({hip,shoulder,shoulderX,armLen,foreLen,width:torsoWidth,bulk,h,shortSleeve});
  const index=name=>bones.indexOf(boneMap[name]);
  // Invert the relaxed skin transform so the exported T-pose and live rig share
  // one mesh, while the resting shoulder is smooth instead of crushed by LBS.
  for(const [side,sign] of [['Left',1],['Right',-1]]){
    boneMap[side+'UpperArm'].rotation.z=-sign*1.25;
    boneMap[side+'LowerArm'].rotation.y=-sign*.1;
  }
  group.updateMatrixWorld(true);
  const relaxedMatrices=bones.map((b,i)=>new T.Matrix4().multiplyMatrices(b.matrixWorld,skeleton.boneInverses[i]));
  const garmentWeights=[],gp=torsoG.attributes.position,gn=torsoG.attributes.normal;
  const mixed=new T.Matrix4(),normalMatrix=new T.Matrix3();
  for(let i=0;i<gp.count;i++){
    const x=gp.getX(i),y=gp.getY(i),side=x>=0?'Left':'Right';
    const arm=T.MathUtils.smoothstep(Math.abs(x),torsoWidth*.975,torsoWidth*.975+.025*bulk);
    const along=(Math.abs(x)-shoulderX)*Math.cos(1.25)+(shoulder-y)*Math.sin(1.25);
    const fore=T.MathUtils.smoothstep(along,armLen-.045*h,armLen+.065*h);
    const chest=T.MathUtils.smoothstep(y,hip+.1*h,shoulder-.1*h);
    const w={ids:[index('Spine'),index('Chest'),index(side+'UpperArm'),index(side+'LowerArm')],weights:[(1-arm)*(1-chest),(1-arm)*chest,arm*(1-fore),arm*fore]};
    garmentWeights.push(w);mixed.elements.fill(0);
    for(let j=0;j<4;j++)for(let k=0;k<16;k++)mixed.elements[k]+=relaxedMatrices[w.ids[j]].elements[k]*w.weights[j];
    mixed.invert();const p=v(x,y,gp.getZ(i)).applyMatrix4(mixed);gp.setXYZ(i,p.x,p.y,p.z);
    normalMatrix.getNormalMatrix(mixed);const n=v(gn.getX(i),gn.getY(i),gn.getZ(i)).applyMatrix3(normalMatrix).normalize();gn.setXYZ(i,n.x,n.y,n.z);
  }
  for(const b of bones)b.quaternion.identity();group.updateMatrixWorld(true);skeleton.update();
  const torsoWeights=(x,y,z,i)=>garmentWeights[i];
  skinGeo(c.shirt==='vest'?'VestUndershirt':'Top_'+c.shirt,torsoG,c.shirt==='vest'?'#f4eddd':c.shirtColor,'Spine',null,torsoWeights);
  if(c.shirt==='vest'){
    const g=vestGeometry({hip,shoulder,width:torsoWidth,bulk,h});
    skinGeo('Top_vest',g,c.shirtColor,'Spine',null,(x,y)=>{const chest=T.MathUtils.smoothstep(y,hip+.1*h,shoulder-.1*h);return{ids:[index('Spine'),index('Chest'),0,0],weights:[1-chest,chest,0,0]};});
    for(let j=0;j<3;j++){const y=hip+.12*h+j*.073*h;ell('VestButton'+j,[0,y,.145*bulk],[.007,.007,.004],darken(c.shirtColor,.60),'Chest',12);}
  }
  if(!['skirt','pleated_skirt'].includes(c.pants)){
    const g=pantsGeometry({hip,width:torsoWidth,bulk,h,style:c.pants});
    skinGeo('Pants_'+c.pants,g,c.pantsColor,'Hips',null,(x,y)=>{
      const side=x>=0?'Left':'Right',leg=1-T.MathUtils.smoothstep(y,hip-.20*h,hip-.035*h),knee=1-T.MathUtils.smoothstep(y,.41*h,.53*h);
      return{ids:[index('Hips'),index(side+'UpperLeg'),index(side+'LowerLeg'),0],weights:[1-leg,leg*(1-knee),leg*knee,0]};
    });
  }
  if(c.shirt==='hoodie') {
    ell('Hood',[0,neck-.035,-.092],[.17,.115,.12],c.shirtColor,'UpperChest');
    for(const s of [-1,1])tube('HoodCord'+s,[[s*.043,shoulder+.015,.138],[s*.05,shoulder-.14,.145]],.007,'#e8e0cc','Chest');
    ell('KangarooPocket',[0,hip+.19*h,.13*bulk],[.12,.067,.019],darken(c.shirtColor,.87),'Spine');
  }
  if(c.shirt==='shirt') {tube('Placket',[[0,hip+.06,.141*bulk],[0,shoulder-.01,.139*bulk]],.012,darken(c.shirtColor,.86),'Chest');for(let i=0;i<4;i++)ell('Button'+i,[0,shoulder-.095-i*.085*h,.156*bulk],[.009,.009,.005],'#ede4d4','Chest',12);}
  if(c.shirt==='sweater'){const g=new T.TorusGeometry(.085,.017,10,32).rotateX(Math.PI/2).translate(0,neck-.035,0);skinGeo('Collar',g,darken(c.shirtColor,.84),'Neck');}
  const torsoCenter=(hip+shoulder)/2+.022, torsoHalf=(shoulder-hip)*.64;
  const frontZ=(x,y)=>shirtFrontZ(x,y,{hip,shoulder,width:torsoWidth,bulk,h})+.010;
  const patch=(name,x1,x2,y1,y2,color,bn='Chest')=>{
    const g=surface(12,8,(u,t)=>{const x=T.MathUtils.lerp(x1,x2,u),y=T.MathUtils.lerp(y1,y2,t);return[x,y,frontZ(x,y)];});
    const m=skinGeo(name,g,color,bn);m.material.side=T.DoubleSide;return m;
  };
  const lineOnTop=(name,xy,color,r=.008)=>tube(name,xy.map(([x,y])=>[x,y,frontZ(x,y)+.006]),r,color,'Chest');
  const lightTop='#f4eddd';
  if(['cardigan','jacket','uniform'].includes(c.shirt)){
    if(c.shirt!=='uniform')patch('InnerTee',-.069,.069,hip+.07*h,shoulder+.006,lightTop);
    for(const s of [-1,1]){
      if(c.shirt!=='uniform')lineOnTop('FrontBinding'+s,[[s*.06,hip+.07*h],[s*.07,torsoCenter],[s*.05,shoulder-.055*h],[s*.10,shoulder+.01]],darken(c.shirtColor,.82),c.shirt==='jacket'?.018:.011);
      if(c.shirt!=='uniform')ell('FrontPocket'+s,[s*torsoWidth*.51,hip+.16*h,frontZ(s*torsoWidth*.51,hip+.16*h)],[.054,.046,.012],darken(c.shirtColor,.92),'Spine');
      lineOnTop('PocketSeam'+s,[[s*torsoWidth*.51-.045,hip+.185*h],[s*torsoWidth*.51+.045,hip+.185*h]],darken(c.shirtColor,.74),.003);
    }
    if(c.shirt==='cardigan')for(let j=0;j<4;j++){const y=hip+.11*h+j*.065*h;ell('CardiganButton'+j,[.072,y,frontZ(.072,y)+.012],[.010,.010,.006],'#d9bd87','Chest',12);}
    if(c.shirt==='jacket'){
      for(const s of [-1,1])lineOnTop('JacketLapel'+s,[[s*.13,shoulder+.01],[s*.08,shoulder-.10*h],[s*.13,shoulder-.065*h]],darken(c.shirtColor,.84),.023);
      ell('JacketZip',[0,hip+.09*h,frontZ(0,hip+.09*h)+.01],[.008,.019,.005],'#bbb5a6','Spine');
    }
  }
  if(c.shirt==='uniform'){
    const applique=(name,points,color,offset=.019)=>{
      const outline=new T.Shape();outline.moveTo(...points[0]);for(const p of points.slice(1))outline.lineTo(...p);outline.closePath();
      const g=new T.ExtrudeGeometry(outline,{depth:.003,bevelEnabled:true,bevelThickness:.0015,bevelSize:.0015,bevelSegments:2,steps:1}),attr=g.attributes.position;
      for(let i=0;i<attr.count;i++)attr.setZ(i,attr.getZ(i)+frontZ(attr.getX(i),attr.getY(i))+offset);
      g.computeVertexNormals();const m=skinGeo(name,g,color,'Chest');m.material.side=T.DoubleSide;
    };
    applique('UniformShirtFront',[[-.071,shoulder+.006],[.071,shoulder+.006],[.044,shoulder-.19*h],[0,shoulder-.285*h],[-.044,shoulder-.19*h]],'#f7f5ee',.010);
    for(const s of [-1,1]){
      const py=hip+.16*h;lineOnTop('UniformPocketFlap'+s,[[s*.075,py],[s*.155,py]],darken(c.shirtColor,.83),.004);
      applique('UniformWhiteCollar'+s,[[s*.009,shoulder-.010*h],[s*.060,shoulder-.003*h],[s*.067,shoulder-.063*h],[s*.027,shoulder-.041*h]],'#f7f5ee',.027);
      applique('UniformLapel'+s,[[s*.092,shoulder+.015],[s*.147,shoulder-.068*h],[s*.119,shoulder-.092*h],[s*.137,shoulder-.111*h],[s*.041,shoulder-.260*h]],darken(c.shirtColor,.80),.024);
    }
    const tieY=shoulder-.042*h;
    if(c.uniformTie==='tie'){
      applique('UniformTie',[[-.009,tieY-.013],[.009,tieY-.013],[.017,tieY-.148*h],[0,tieY-.174*h],[-.017,tieY-.148*h]],c.tieColor,.035);
      applique('TieKnot',[[-.013,tieY+.010],[.013,tieY+.010],[.008,tieY-.015],[-.008,tieY-.015]],darken(c.tieColor,.88),.038);
    }else if(c.uniformTie==='ribbon'){
      for(const s of [-1,1]){
        const g=sphereGeo([0,0,0],[.037,.022,.010],20).rotateZ(s*.18).translate(s*.031,tieY,frontZ(0,tieY)+.038);skinGeo('RibbonBow'+s,g,c.tieColor,'Chest');
        applique('RibbonTail'+s,[[s*.004,tieY],[s*.024,tieY-.006],[s*.041,tieY-.067*h],[s*.020,tieY-.056*h],[s*.010,tieY-.070*h]],c.tieColor,.029);
      }
      ell('RibbonKnot',[0,tieY,frontZ(0,tieY)+.048],[.013,.015,.007],darken(c.tieColor,.86),'Chest');
    }
    const pocketY=shoulder-.195*h,pocketX=.123*bulk;
    lineOnTop('UniformBreastPocket',[[pocketX-.041,pocketY],[pocketX+.041,pocketY]],darken(c.shirtColor,.62),.005);
    applique('SchoolBadge',[[pocketX-.012,pocketY-.007],[pocketX+.012,pocketY-.007],[pocketX+.010,pocketY-.029],[pocketX,pocketY-.036],[pocketX-.010,pocketY-.029]],'#bda261',.024);
    for(let j=0;j<3;j++){const y=hip+.12*h+j*.065*h;ell('UniformButton'+j,[.038,y,frontZ(.038,y)+.022],[.009,.009,.005],'#bba16b','Spine',16);}
  }
  if(c.shirt==='polo'){
    for(const s of [-1,1])lineOnTop('PoloCollar'+s,[[s*.09,shoulder+.008],[s*.05,shoulder-.065*h],[s*.01,shoulder-.016*h]],darken(c.shirtColor,.78),.016);
    lineOnTop('PoloPlacket',[[0,shoulder-.02*h],[0,shoulder-.14*h]],darken(c.shirtColor,.84),.009);
    for(let j=0;j<2;j++){const y=shoulder-.060*h-j*.037*h;ell('PoloButton'+j,[0,y,frontZ(0,y)+.008],[.007,.007,.004],lightTop,'Chest',12);}
  }
  if(c.shirt==='overalls'){
    patch('OverallBib',-.105*bulk,.105*bulk,hip+.035*h,shoulder-.145*h,c.pantsColor,'Spine');
    for(const s of [-1,1]){
      lineOnTop('OverallStrap'+s,[[s*.086*bulk,hip+.14*h],[s*.083*bulk,shoulder-.1*h],[s*.115*bulk,shoulder+.018]],c.pantsColor,.020);
      ell('OverallBuckle'+s,[s*.084*bulk,shoulder-.15*h,frontZ(s*.084*bulk,shoulder-.15*h)+.02],[.015,.017,.007],'#c9a05a','Chest',16);
    }
    ell('BibPocket',[0,hip+.18*h,frontZ(0,hip+.18*h)+.009],[.065,.042,.009],darken(c.pantsColor,.86),'Spine');
    lineOnTop('BibSeam',[[-.06,hip+.19*h],[.06,hip+.19*h]],darken(c.pantsColor,.67),.0028);
  }
  if(['skirt','pleated_skirt'].includes(c.pants)){
    const school=c.pants==='pleated_skirt',bottom=(school?.43:.45)*h,top=hip+.035,flare=school?1.24:1.34;
    const pleat=a=>school?Math.asin(Math.sin(a*20))/(Math.PI/2)*.010:Math.sin(a*14)*.007;
    const skirtPoint=(u,t)=>{const a=u*Math.PI*2,r=T.MathUtils.lerp(torsoWidth*.92,torsoWidth*flare,t)+pleat(a)*t;
      const depth=T.MathUtils.lerp(.135*bulk,Math.max(torsoWidth*flare*.78,.16*h+.07*bulk),t);
      return[Math.sin(a)*r,T.MathUtils.lerp(top,bottom,t),Math.cos(a)*(depth+pleat(a)*t*.7)];};
    const skirtWeights=(x,y)=>{const follow=.70*T.MathUtils.smoothstep(top-y,.03*h,top-bottom),left=T.MathUtils.smoothstep(x,-.10*bulk,.10*bulk);
      return{ids:[index('Hips'),index('LeftUpperLeg'),index('RightUpperLeg'),0],weights:[1-follow,follow*left,follow*(1-left),0]};};
    const g=surface(20,80,skirtPoint);
    const skirt=skinGeo('PleatedSkirt',g,c.pantsColor,'Hips',null,skirtWeights);skirt.material.side=T.DoubleSide;
    const hem=Array.from({length:81},(_,j)=>skirtPoint(j/80,1));
    skinGeo('SkirtHem',curveGeo(hem,.004),darken(c.pantsColor,.83),'Hips',null,skirtWeights);
  }
  for(const [side,s] of [['Left',1],['Right',-1]]) {
    const sx=s*shoulderX, elbow=s*(shoulderX+armLen), wrist=s*(shoulderX+armLen+foreLen);
    const armRadius=.071*bulk;
    const upperSleeve=c.shirt==='vest'?lightTop:c.shirtColor,lowerSleeve=['tee','polo','overalls'].includes(c.shirt)?skin:c.shirt==='vest'?lightTop:c.shirtColor;
    if(shortSleeve){
      seg(side+'ExposedUpperArm',[s*(shoulderX+armLen-.065*h),shoulder,0],[elbow,shoulder,0],armRadius*.75,armRadius*.72,skin,side+'UpperArm');
      ell(side+'Elbow',[elbow,shoulder,0],[armRadius*.72,armRadius*.72,armRadius*.72],skin,side+'LowerArm');
      seg(side+'Forearm',[elbow,shoulder,0],[wrist,shoulder,0],armRadius*.73,armRadius*.60,skin,side+'LowerArm');
    }
    ell(side+'HandMesh',[wrist+s*.050*h,shoulder,0],[.072*h,.046,.039],skin,side+'Hand');
    ell(side+'Thumb',[wrist+s*.025,shoulder-.042,.014],[.023,.036,.023],skin,side+'Hand');
    if(['sweater','hoodie','jacket','cardigan'].includes(c.shirt)){seg(side+'SleeveCuff',[wrist-s*.034*h,shoulder,0],[wrist+s*.004,shoulder,0],armRadius*.72,armRadius*.70,darken(c.shirtColor,.82),side+'LowerArm');}
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
  const setExpression=(name,intensity=1,blink=0)=>{for(const m of facial)for(let i=0;i<EXPRESSIONS.length;i++)m.morphTargetInfluences[i]=EXPRESSIONS[i]==='blink'?blink:EXPRESSIONS[i]===name?intensity:0;};
  const setGaze=(x,y)=>{for(const side of ['Left','Right'])boneMap[side+'Eye'].rotation.set(-y,x,0);};
  const pose=(mode,time=0)=>{for(const b of bones)if(!b.name.endsWith('Eye'))b.quaternion.identity();if(mode!=='tpose'){boneMap.LeftUpperArm.rotation.z=-1.25;boneMap.RightUpperArm.rotation.z=1.25;boneMap.LeftLowerArm.rotation.y=-.1;boneMap.RightLowerArm.rotation.y=.1;}if(mode==='idle'){boneMap.Chest.rotation.z=Math.sin(time*1.2)*.022;boneMap.Head.rotation.y=Math.sin(time*1.2)*.08;}if(mode==='walk'){const a=Math.sin(time*4)*.48;boneMap.LeftUpperLeg.rotation.x=a;boneMap.RightUpperLeg.rotation.x=-a;boneMap.LeftLowerLeg.rotation.x=Math.max(0,-a)*1.1;boneMap.RightLowerLeg.rotation.x=Math.max(0,a)*1.1;boneMap.LeftUpperArm.rotation.x=-a*.7;boneMap.RightUpperArm.rotation.x=a*.7;}group.updateMatrixWorld(true);skeleton.update();};
  const clips=[];
  for(const mode of (animations ? ['idle','walk'] : [])){const tracks=[];const times=Array.from({length:49},(_,i)=>i/24);const names=['LeftUpperArm','RightUpperArm','LeftLowerArm','RightLowerArm','LeftUpperLeg','RightUpperLeg','LeftLowerLeg','RightLowerLeg','Chest','Head'];for(const name of names){const values=[];for(const t of times){pose(mode,mode==='walk'?t*Math.PI/4:t*Math.PI/1.2);values.push(...boneMap[name].quaternion.toArray());}tracks.push(new T.QuaternionKeyframeTrack(name+'.quaternion',times,values));}clips.push(new T.AnimationClip(mode==='idle'?'Idle':'Walk',2,tracks));}
  pose('relaxed');setExpression(c.expression,c.intensity);setGaze(c.gazeX,c.gazeY);
  const dispose=()=>{for(const p of parts)p.geometry.dispose();for(const m of mats.values())m.dispose();skeleton.dispose();};
  return {group,bones,boneMap,skeleton,parts,facial,setExpression,setGaze,pose,clips,dispose,height:headY+ry+.14,headY};
}
