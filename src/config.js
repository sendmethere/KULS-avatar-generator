export const DEFAULT = { version: 1, name: 'Milo', skin: '#ba7953', hairColor: '#30251f', eyeColor: '#1a1614', browColor: '#30251f', browThickness: 0.93, browWidth: 1.14, browHeight: -0.03, browSpacing: 1.07, browTilt: 0, browArch: 1.09, browShape: 'soft', shirtColor: '#759785', pantsColor: '#e6d9bf', shoeColor: '#f5efe3', hair: 'curls', hairVolume: 1, curlSize: 1, hairDetail: 0.65, hijabStyle: 'wrapped', shirt: 'sweater', uniformTie: 'tie', tieColor: '#823b4e', legwear: 'none', pants: 'trousers', glasses: 'none', beard: 'none', earrings: false, body: 'neutral', age: 'adult', height: 1, build: 1, headWidth: 0.93, headLength: 0.92, jaw: 0.84, cheek: 1.05, forehead: 1.06, chin: 0.82, eyeSize: 1, eyeRoundness: 0.84, eyeTilt: 0.02, eyeLine: 1.2, eyeAlmond: 0.35, irisSize: 0.92, pupilSize: 1, eyelidSize: 0.7, lashes: 'none', eyeSpacing: 1, eyeHeight: 0, noseSize: 1, noseWidth: 1, mouthWidth: 0.70, mouthHeight: 0, lipSize: 1.02, expression: 'smile', intensity: 0.7, gazeX: 0, gazeY: 0 };
export const SKINS = ['#f6d6bc','#edbd91','#d79c6e','#ba7953','#98603f','#71462e','#4b3024'];
export const HAIRS = ['#211c1b','#493227','#754530','#b16b36','#e0b66d','#ddd9d0','#8a527b','#2b8185'];
export const COLORS = ['#759785','#6686a2','#d58b64','#e3bf65','#a67f9f','#e7dfd2','#3b444d','#a94e50'];
export const RANGE = { eyeRoundness:[0.65,1.3],eyeTilt:[-0.25,0.3],eyeLine:[0,1.8],eyeAlmond:[0,1],irisSize:[0.7,1.22],pupilSize:[0.65,1.3],eyelidSize:[0.5,1.6], hairVolume:[0.9,1.18],curlSize:[0.7,1.35],hairDetail:[0,1], browThickness:[0.4,2],browWidth:[0.6,1.5],browHeight:[-0.05,0.06],browSpacing:[0.75,1.3],browTilt:[-0.04,0.04],browArch:[0,2.5], height:[0.8,1.18],build:[0.72,1.4],headWidth:[0.8,1.2],headLength:[0.85,1.2],jaw:[0.65,1.3],cheek:[0.85,1.2],forehead:[0.85,1.15],chin:[0.78,1.2],eyeSize:[0.7,1.3],eyeSpacing:[0.8,1.2],eyeHeight:[-0.045,0.045],noseSize:[0.65,1.4],noseWidth:[0.7,1.4],mouthWidth:[0.65,1.3],mouthHeight:[-0.04,0.04],lipSize:[0.6,1.7],intensity:[0,1],gazeX:[-0.65,0.65],gazeY:[-0.45,0.45] };
export const ENUMS = {uniformTie:['tie','ribbon','none'],legwear:['none','socks','tights'],lashes:['none','short','long'],browShape:['soft','straight','angled','rounded'],hijabStyle:['wrapped','draped','pleated'],hair:['curls','crop','sport','dandy','dandy_perm','quiff','bob','long','bun','ponytail','braids','waves','bald','hijab'], shirt:['sweater','tee','hoodie','shirt','polo','cardigan','jacket','vest','overalls','uniform'],pants:['trousers','shorts','wide','cargo','joggers','skirt','uniform_pants','pleated_skirt'],glasses:['none','round','square'],beard:['none','stubble','full','mustache'],body:['neutral','masculine','feminine'],age:['adult','child','elder'],expression:['neutral','smile','serious','sad','angry','surprised']};
export const PRESETS = [
  {name:'Minjun',tag:'남학생 · 댄디 · 교복',skin:'#e6bc98',hair:'dandy',hairColor:'#211c1b',eyeColor:'#30251f',body:'masculine',height:.96,build:.94,
    eyeSize:.96,eyeRoundness:.78,eyeAlmond:.58,eyeTilt:.035,eyeSpacing:1.01,noseSize:.92,noseWidth:.93,
    browShape:'straight',browArch:.35,browThickness:1.02,headWidth:.94,headLength:.96,jaw:.96,chin:.92,mouthWidth:.82,
    shirt:'uniform',shirtColor:'#29394f',uniformTie:'tie',tieColor:'#823b4e',pants:'uniform_pants',pantsColor:'#747981',shoeColor:'#242a32',legwear:'socks'},
  {name:'Seoyeon',tag:'여학생 · 포니테일 · 교복',skin:'#edc6a8',hair:'ponytail',hairColor:'#211c1b',eyeColor:'#30251f',body:'feminine',height:.93,build:.90,
    eyeSize:1.01,eyeRoundness:.84,eyeAlmond:.68,eyeTilt:.07,eyeSpacing:1.04,noseSize:.79,noseWidth:.83,
    browShape:'soft',browArch:.65,browThickness:.77,headWidth:.92,headLength:.95,jaw:.80,chin:.87,mouthWidth:.76,
    shirt:'uniform',shirtColor:'#29394f',uniformTie:'ribbon',tieColor:'#823b4e',pants:'pleated_skirt',pantsColor:'#747981',shoeColor:'#242a32',legwear:'tights'},
  {name:'Noah',tag:'가느다란 눈 · 뚜렷한 코',skin:'#f6d6bc',hair:'quiff',hairColor:'#b16b36',body:'masculine',
    eyeSize:.84,eyeRoundness:.76,eyeAlmond:.45,eyeTilt:.03,eyeSpacing:.94,noseSize:1.24,noseWidth:.90,
    browShape:'angled',browThickness:1.30,browArch:.65,headWidth:.98,jaw:1.16,chin:1.04,mouthWidth:.91,shirt:'jacket',shirtColor:'#6686a2'},
  {name:'Amara',tag:'올라간 눈꼬리 · 넓은 코',skin:'#71462e',hair:'bun',body:'feminine',earrings:true,
    eyeSize:1.04,eyeRoundness:.88,eyeAlmond:.68,eyeTilt:.18,eyeSpacing:1.09,noseSize:1.04,noseWidth:1.27,
    browShape:'angled',browArch:1.70,browThickness:1.05,headLength:1.04,headWidth:.94,jaw:.84,mouthWidth:.98,lipSize:1.22,shirt:'polo',shirtColor:'#d58b64'},
  {name:'Leo',tag:'큰 동그란 눈 · 작은 코',skin:'#d79c6e',age:'child',hair:'crop',
    eyeSize:1.19,eyeRoundness:1.19,eyeAlmond:.08,eyeTilt:0,eyeSpacing:1.09,pupilSize:1.1,noseSize:.66,noseWidth:.81,
    browShape:'soft',browThickness:.70,browWidth:.87,headWidth:.96,jaw:.84,chin:.80,mouthWidth:.79,shirt:'hoodie',shirtColor:'#e3bf65',pants:'shorts'},
  {name:'Sofia',tag:'처진 눈매 · 갸름한 턱',skin:'#f6d6bc',hair:'long',hairColor:'#e0b66d',body:'feminine',
    eyeSize:.99,eyeRoundness:.93,eyeAlmond:.35,eyeTilt:-.14,eyeSpacing:1.11,noseSize:.82,noseWidth:.75,
    browShape:'rounded',browArch:.90,browThickness:.62,headWidth:.88,headLength:1.02,jaw:.69,chin:.94,mouthWidth:.76,shirt:'cardigan',shirtColor:'#759785'},
  {name:'Idris',tag:'깊은 눈매 · 굵은 눈썹',skin:'#4b3024',hair:'bald',beard:'full',body:'masculine',build:1.16,
    eyeSize:.85,eyeRoundness:.73,eyeAlmond:.58,eyeTilt:.06,eyeSpacing:.97,noseSize:1.23,noseWidth:1.29,
    browShape:'straight',browThickness:1.55,browHeight:-.04,browWidth:1.24,headWidth:1.01,jaw:1.19,mouthWidth:1.02,shirt:'vest',shirtColor:'#6e7b69'},
  {name:'June',tag:'작은 눈 · 둥근 코끝',skin:'#edbd91',age:'elder',hair:'quiff',hairColor:'#ddd9d0',glasses:'round',
    eyeSize:.81,eyeRoundness:.88,eyeAlmond:.22,eyeTilt:-.11,eyeSpacing:1.02,noseSize:1.17,noseWidth:1.13,
    browShape:'rounded',browArch:1.50,browThickness:.76,headWidth:.94,jaw:.93,cheek:1.08,mouthWidth:.80,shirt:'cardigan',shirtColor:'#a94e50'},
  {name:'Zara',tag:'넓은 눈 간격 · 긴 얼굴',skin:'#98603f',hair:'hijab',hairColor:'#6686a2',body:'feminine',
    eyeSize:1.07,eyeRoundness:.80,eyeAlmond:.76,eyeTilt:.08,eyeSpacing:1.17,noseSize:1.08,noseWidth:.87,
    browShape:'angled',browArch:1.20,browThickness:1.11,headWidth:.90,headLength:1.12,jaw:.77,chin:1.04,mouthWidth:.89,shirt:'sweater',pants:'wide'},
  {name:'Alex',tag:'일자 눈썹 · 각진 턱',skin:'#d79c6e',hair:'quiff',hairColor:'#2b8185',glasses:'round',
    eyeSize:.93,eyeRoundness:.84,eyeAlmond:.40,eyeTilt:.01,eyeSpacing:.89,noseSize:.91,noseWidth:.93,
    browShape:'straight',browArch:.12,browThickness:1.18,browWidth:1.22,headWidth:.94,jaw:1.12,chin:.92,mouthWidth:.96,shirt:'tee',shirtColor:'#e7dfd2'},
  {name:'Ruby',tag:'또렷한 눈 · 둥근 볼',skin:'#f6d6bc',age:'child',hair:'curls',hairColor:'#b16b36',
    eyeSize:1.11,eyeRoundness:1.02,eyeAlmond:.28,eyeTilt:.13,eyeSpacing:.95,irisSize:1.03,noseSize:.75,noseWidth:.96,
    browShape:'rounded',browArch:1.75,browThickness:.79,headWidth:1.01,cheek:1.17,jaw:.88,chin:.79,mouthWidth:.92,shirt:'overalls',shirtColor:'#d58b64',pants:'shorts'},
  {name:'Oscar',tag:'긴 코 · 낮은 눈썹',skin:'#ba7953',age:'elder',hair:'crop',hairColor:'#ddd9d0',beard:'full',glasses:'square',
    eyeSize:.83,eyeRoundness:.70,eyeAlmond:.48,eyeTilt:-.07,eyeSpacing:.92,noseSize:1.34,noseWidth:.94,
    browShape:'straight',browThickness:1.42,browHeight:-.043,browArch:.35,headWidth:.90,headLength:1.16,jaw:1.04,chin:1.12,mouthWidth:.88,shirt:'shirt',shirtColor:'#b7aa8e'}
].map(p=>({...DEFAULT,...p,browColor:p.browColor||(p.hair==='hijab'?DEFAULT.browColor:p.hairColor||DEFAULT.hairColor)}));
export function validateConfig(input) {
  if (!input || typeof input !== 'object' || input.version !== 1) throw new Error('버전 1의 아바타 JSON 파일을 선택해 주세요.');
  const c = {...DEFAULT};
  for (const key of Object.keys(c)) {
    if (!(key in input)) continue;
    const v = input[key];
    if (RANGE[key]) { if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`${key}: 숫자가 필요합니다.`); c[key] = Math.max(RANGE[key][0],Math.min(RANGE[key][1],v)); }
    else if (ENUMS[key]) { if (!ENUMS[key].includes(v)) throw new Error(`${key}: 지원하지 않는 값입니다.`); c[key]=v; }
    else if (key.endsWith('Color') || key==='skin') { if (typeof v !== 'string' || !/^#[0-9a-f]{6}$/i.test(v)) throw new Error('색상 형식이 올바르지 않습니다.'); c[key]=v; }
    else if(key==='name') c[key]=String(v).slice(0,40);
    else if(key==='earrings') c[key]=Boolean(v);
  }
  return c;
}
export function randomConfig() {
  const pick=a=>a[Math.floor(Math.random()*a.length)];
  return {...DEFAULT,name:pick(['Sol','Nori','Ari','Remy','Luca','Robin','Sage','Yuna']),skin:pick(SKINS),hair:pick(ENUMS.hair),hairColor:pick(HAIRS),shirtColor:pick(COLORS),pantsColor:pick(['#e6d9bf','#454e61','#778570','#684d42']),body:pick(ENUMS.body),age:pick(['adult','adult','adult','child','elder']),headWidth:0.9+Math.random()*.2,headLength:0.9+Math.random()*.2,jaw:0.7+Math.random()*.5,eyeSize:0.85+Math.random()*.3,noseSize:0.8+Math.random()*.4,glasses:pick(['none','none','round','square']),beard:pick(['none','none','none','mustache']),shirt:pick(ENUMS.shirt),pants:pick(ENUMS.pants),earrings:Math.random()>.65};
}
