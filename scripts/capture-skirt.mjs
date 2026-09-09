import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();
await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>window.avatarStudio);
const data=await page.evaluate(async()=>{
 const T=await import('/node_modules/three/build/three.module.js');const {createAvatar}=await import('/src/avatar.js');
 const r=new T.WebGLRenderer({antialias:true,alpha:true});r.setSize(400,440);r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=1.12;
 const scene=new T.Scene();scene.add(new T.HemisphereLight('#fff7e8','#9aa28b',2.6));const light=new T.DirectionalLight('#fff5e7',3);light.position.set(-3,5,5);scene.add(light);
 const cam=new T.PerspectiveCamera(30,400/440,.01,20);const out=document.createElement('canvas');out.width=1600;out.height=960;const ctx=out.getContext('2d');ctx.fillStyle='#f4f3ed';ctx.fillRect(0,0,out.width,out.height);
 const presets=window.avatarStudio.presets;
 const variants=Array.from({length:8},(_,i)=>['Walk '+i,i>3?4:1,{pants:i%2?'pleated_skirt':'skirt',shirt:'tee'},'body']);
 for(let i=0;i<variants.length;i++){const [label,p,over,view]=variants[i];const a=createAvatar({...presets[p],...over});a.pose('walk',Math.PI/8+(i%4)*Math.PI/8);a.setExpression('smile',1);scene.add(a.group);const body=view==='body';cam.position.set(i%2?2.2:.05,body?1.18:a.headY,body?4.3:1.85);cam.lookAt(0,body?1.07:a.headY-.025,0);r.render(scene,cam);const x=i%4*400,y=Math.floor(i/4)*480;ctx.drawImage(r.domElement,x,y);ctx.fillStyle='#53604d';ctx.font='20px sans-serif';ctx.textAlign='center';ctx.fillText(label,x+200,y+465);scene.remove(a.group);a.dispose();}
 r.dispose();return out.toDataURL();});
await writeFile('examples/skirt-walk.png',Buffer.from(data.split(',')[1],'base64'));await browser.close();
