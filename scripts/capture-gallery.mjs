import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const b=await chromium.launch({channel:'chrome',headless:true});
const page=await b.newPage({viewport:{width:1440,height:1000}});
await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>window.avatarStudio);
const data=await page.evaluate(async()=>{
 const T=await import('/node_modules/three/build/three.module.js');const {createAvatar}=await import('/src/avatar.js');
 const r=new T.WebGLRenderer({antialias:true,alpha:true});r.setSize(400,400);r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=1.12;
 const scene=new T.Scene();scene.add(new T.HemisphereLight('#fff7e8','#9aa28b',2.6));const light=new T.DirectionalLight('#fff5e7',3);light.position.set(-3,5,5);scene.add(light);
 const cam=new T.PerspectiveCamera(30,1,.01,20);
 const out=document.createElement('canvas');out.width=1200;out.height=880;const ctx=out.getContext('2d');ctx.fillStyle='#f4f3ed';ctx.fillRect(0,0,1200,880);
 const labels=['보통','웃음','정색','슬픔','화남','당황'],expressions=['neutral','smile','serious','sad','angry','surprised'];
 for(let i=0;i<6;i++){
  const config={...window.avatarStudio.presets[1],expression:expressions[i],intensity:1};const a=createAvatar(config);a.pose('relaxed');a.setExpression(expressions[i],1);scene.add(a.group);cam.position.set(.04,a.headY,1.85);cam.lookAt(0,a.headY-.025,0);r.render(scene,cam);
  const x=(i%3)*400,y=Math.floor(i/3)*440;ctx.drawImage(r.domElement,x,y);ctx.fillStyle='#53604d';ctx.font='500 20px "Noto Sans KR", sans-serif';ctx.textAlign='center';ctx.fillText(labels[i],x+200,y+422);scene.remove(a.group);a.dispose();
 }
 r.dispose();return out.toDataURL('image/png');
});
await writeFile('examples/cartoon-expressions.png',Buffer.from(data.split(',')[1],'base64'));
await page.waitForFunction(()=>document.querySelectorAll('.preset-img.loaded').length===12);
for(const [name,config,tab] of [
 ['hijab-detailed',{...await page.evaluate(()=>window.avatarStudio.presets[8]),hijabStyle:'draped',shirt:'jacket'},'hair'],
 ['cartoon-outfit',{...await page.evaluate(()=>window.avatarStudio.presets[1]),shirt:'cardigan',pants:'skirt'},'outfit'],
 ['child-refined',{...await page.evaluate(()=>window.avatarStudio.presets[4]),shirt:'overalls'},'body'],
]){await page.evaluate(c=>window.avatarStudio.setConfig(c),config);await page.locator('#pose').selectOption('relaxed');await page.locator('[data-tab='+tab+']').click();await page.screenshot({path:'examples/'+name+'.png'});}
await b.close();
