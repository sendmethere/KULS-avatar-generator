import { chromium } from '@playwright/test';
import { validateBytes } from 'gltf-validator';
import { writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.TEST_URL||'http://127.0.0.1:5173';
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto(base);await page.waitForFunction(()=>window.avatarStudio);await page.waitForFunction(()=>document.querySelectorAll('.preset-img.loaded').length===12);
 assert.equal(await page.locator('[data-key=eyeShape],[data-key=eyeStyle]').count(),0);
 const stats=await page.evaluate(()=>window.avatarStudio.getStats());assert.equal(stats.bones.length,24);assert.equal(Object.keys(stats.shapeKeys).length,6);
 await page.locator('[data-tab=face]').click();await page.locator('#browThickness').fill('1.6');assert.equal(await page.evaluate(()=>window.avatarStudio.getConfig().browThickness),1.6);
 await page.locator('#eyeRoundness').fill('0.85');assert.equal(await page.evaluate(()=>window.avatarStudio.getConfig().eyeRoundness),.85);await page.locator('#pupilSize').fill('1.1');assert.equal(await page.evaluate(()=>window.avatarStudio.getConfig().pupilSize),1.1);await page.locator('[data-choice=long]').click();assert.equal(await page.evaluate(()=>window.avatarStudio.getConfig().lashes),'long');
 await page.locator('#browHeight').fill('0.03');assert.equal(await page.evaluate(()=>window.avatarStudio.getConfig().browHeight),.03);
 await page.locator('[data-tab=expression]').click();await page.locator('[data-choice=angry]').click();assert.equal(await page.evaluate(()=>window.avatarStudio.getConfig().expression),'angry');
 await page.locator('#undo').click();assert.equal(await page.evaluate(()=>window.avatarStudio.getConfig().expression),'smile');await page.locator('#redo').click();assert.equal(await page.evaluate(()=>window.avatarStudio.getConfig().expression),'angry');
 await page.locator('#gazeX').fill('0.3');assert.equal(await page.evaluate(()=>window.avatarStudio.getConfig().gazeX),.3);await page.locator('#gaze-reset').click();assert.equal(await page.evaluate(()=>window.avatarStudio.getConfig().gazeX),0);
 for(const t of ['hair','body','outfit'])await page.locator('[data-tab='+t+']').click();
 await page.locator('[data-choice=shorts]').click();assert.equal(await page.evaluate(()=>window.avatarStudio.getConfig().pants),'shorts');
 await page.reload();await page.waitForFunction(()=>window.avatarStudio);assert.equal(await page.evaluate(()=>window.avatarStudio.getConfig().pants),'shorts');
 await page.locator('#file-input').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"version":22}')});await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('버전'));
 await page.evaluate(()=>window.avatarStudio.setConfig(window.avatarStudio.presets[0]));await page.locator('#pose').selectOption('relaxed');
 await page.waitForFunction(()=>document.querySelectorAll('.preset-img.loaded').length===12 && !document.querySelector('#toast').classList.contains('visible'));await page.screenshot({path:'examples/studio-desktop.png'});
 const variants=[['Milo',0],['Leo-child',4],['Oscar-elder',11],['Zara-hijab',8],['Hana-cartoon',1],['School-tie',0,{shirt:'uniform',pants:'uniform_pants',hair:'dandy_perm',shirtColor:'#29394f',pantsColor:'#747981',shoeColor:'#242a32'}],['School-ribbon',1,{shirt:'uniform',pants:'pleated_skirt',uniformTie:'ribbon',legwear:'tights',shirtColor:'#29394f',pantsColor:'#747981',shoeColor:'#242a32'}],['Sofia-long',5]];
 for(const [name,i,override={}] of variants){
  await page.evaluate(({i,override})=>window.avatarStudio.setConfig({...window.avatarStudio.presets[i],...(i===1?{shirt:'cardigan',pants:'skirt',hair:'braids'}:{}),...override}),{i,override});
  const encoded=await page.evaluate(async()=>{const data=new Uint8Array(await window.avatarStudio.exportGLB());let str='';for(let j=0;j<data.length;j+=32768)str+=String.fromCharCode(...data.subarray(j,j+32768));return btoa(str);});
  const bytes=new Uint8Array(Buffer.from(encoded,'base64'));
  const report=await validateBytes(bytes,{maxIssues:1000});
  await writeFile(`test-results/${name}-validation.json`,JSON.stringify(report,null,2));
  assert.equal(report.issues.numErrors,0,JSON.stringify(report.issues));assert.equal(report.issues.numWarnings,0,JSON.stringify(report.issues));
  const jsonLength=new DataView(bytes.buffer).getUint32(12,true);const gltf=JSON.parse(new TextDecoder().decode(bytes.slice(20,20+jsonLength)));
  assert.ok(gltf.skins.length>=1);assert.equal(gltf.animations.length,2);assert.ok(gltf.meshes.some(m=>m.extras?.targetNames?.includes('smile')));
  const allNames=gltf.nodes.map(n=>n.name);for(const b of stats.bones)assert.ok(allNames.includes(b));
  await writeFile(`examples/${name}.glb`,bytes);
  await writeFile(`examples/${name}.avatar.json`,JSON.stringify(await page.evaluate(()=>window.avatarStudio.getConfig()),null,2));
  console.log(`${name}: GLB ${Math.round(bytes.length/1024)} KB, ${report.issues.numErrors} errors, ${report.issues.numWarnings} warnings`);
  if(i===0 || i===4 || i===1){
   for(const format of ['blend','fbx']){
    const response=await fetch(`${base}/api/export?format=${format}`,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:bytes});
    if(response.status!==200)assert.fail((await response.text()).slice(0,300));
    const data=new Uint8Array(await response.arrayBuffer());assert.ok(data.length>10000);await writeFile(`examples/${name}.${format}`,data);console.log(`${format}: ${Math.round(data.length/1024)} KB`);
   }
  }
 }
 const bad=await fetch(base+'/api/export?format=fbx',{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:'invalid'});assert.equal(bad.status,400);
 await page.evaluate(()=>window.avatarStudio.setConfig(window.avatarStudio.presets[0]));await page.locator('[data-view=face]').click();await page.locator('[data-tab=face]').click();await page.locator('#browThickness').scrollIntoViewIfNeeded();await page.screenshot({path:'examples/studio-eyebrows.png'});
 await page.setViewportSize({width:390,height:844});await page.locator('[data-view=full]').click();await page.screenshot({path:'examples/studio-mobile.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(errors,[]);console.log('PASS: controls, eyebrows, history, persistence, invalid input, 8 GLBs, Blender/FBX conversion, responsive layout, no runtime errors.');
} finally {await browser.close();}
