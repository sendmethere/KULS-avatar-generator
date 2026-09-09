export const DEFAULT = { version: 1, name: 'Milo', skin: '#ba7953', hairColor: '#30251f', eyeColor: '#493128', browColor: '#30251f', browThickness: 1, browWidth: 1, browHeight: 0, browSpacing: 1, browTilt: 0, browArch: 1, shirtColor: '#759785', pantsColor: '#e6d9bf', shoeColor: '#f5efe3', hair: 'curls', hairVolume: 1, curlSize: 1, hairDetail: 0.65, hijabStyle: 'wrapped', shirt: 'sweater', uniformTie: 'tie', tieColor: '#823b4e', legwear: 'none', pants: 'trousers', glasses: 'none', beard: 'none', earrings: false, body: 'neutral', age: 'adult', height: 1, build: 1, headWidth: 1, headLength: 1, jaw: 0.85, cheek: 1.04, forehead: 1, chin: 1, eyeSize: 1, eyeRoundness: 1, eyeTilt: 0.02, irisSize: 0.92, pupilSize: 1, eyelidSize: 0.7, lashes: 'none', eyeSpacing: 1, eyeHeight: 0, noseSize: 1, noseWidth: 1, mouthWidth: 1, mouthHeight: 0, lipSize: 1, expression: 'smile', intensity: 0.7, gazeX: 0, gazeY: 0 };
export const SKINS = ['#f6d6bc','#edbd91','#d79c6e','#ba7953','#98603f','#71462e','#4b3024'];
export const HAIRS = ['#211c1b','#493227','#754530','#b16b36','#e0b66d','#ddd9d0','#8a527b','#2b8185'];
export const COLORS = ['#759785','#6686a2','#d58b64','#e3bf65','#a67f9f','#e7dfd2','#3b444d','#a94e50'];
export const RANGE = { eyeRoundness:[0.65,1.3],eyeTilt:[-0.25,0.3],irisSize:[0.7,1.22],pupilSize:[0.65,1.3],eyelidSize:[0.5,1.6], hairVolume:[0.9,1.18],curlSize:[0.7,1.35],hairDetail:[0,1], browThickness:[0.4,2],browWidth:[0.6,1.5],browHeight:[-0.05,0.06],browSpacing:[0.75,1.3],browTilt:[-0.04,0.04],browArch:[0,2.5], height:[0.8,1.18],build:[0.72,1.4],headWidth:[0.8,1.2],headLength:[0.85,1.2],jaw:[0.65,1.3],cheek:[0.85,1.2],forehead:[0.85,1.15],chin:[0.85,1.2],eyeSize:[0.7,1.3],eyeSpacing:[0.8,1.2],eyeHeight:[-0.045,0.045],noseSize:[0.65,1.4],noseWidth:[0.7,1.4],mouthWidth:[0.65,1.3],mouthHeight:[-0.04,0.04],lipSize:[0.6,1.7],intensity:[0,1],gazeX:[-0.65,0.65],gazeY:[-0.45,0.45] };
export const ENUMS = {uniformTie:['tie','ribbon','none'],legwear:['none','socks','tights'],lashes:['none','short','long'],hijabStyle:['wrapped','draped','pleated'],hair:['curls','crop','sport','dandy','dandy_perm','quiff','bob','long','bun','ponytail','braids','waves','bald','hijab'], shirt:['sweater','tee','hoodie','shirt','polo','cardigan','jacket','vest','overalls','uniform'],pants:['trousers','shorts','wide','cargo','joggers','skirt','uniform_pants','pleated_skirt'],glasses:['none','round','square'],beard:['none','stubble','full','mustache'],body:['neutral','masculine','feminine'],age:['adult','child','elder'],expression:['neutral','smile','serious','sad','angry','surprised']};
export const PRESETS = [
  {name:'Milo',tag:'포근한 컬 · 니트',skin:'#ba7953',hair:'curls'},
  {name:'Hana',tag:'짧은 보브 · 라운드',skin:'#edbd91',hair:'bob',hairColor:'#211c1b',body:'feminine',shirtColor:'#a67f9f',headWidth:1.08,jaw:1.05},
  {name:'Noah',tag:'퀴프 · 스퀘어',skin:'#f6d6bc',hair:'quiff',hairColor:'#b16b36',jaw:1.25,body:'masculine',shirt:'hoodie',shirtColor:'#6686a2'},
  {name:'Amara',tag:'번 헤어 · 이어링',skin:'#71462e',hair:'bun',body:'feminine',earrings:true,headLength:1.1,shirtColor:'#d58b64'},
  {name:'Leo',tag:'작은 키 · 큰 눈',skin:'#d79c6e',age:'child',hair:'crop',eyeSize:1.2,shirt:'hoodie',shirtColor:'#e3bf65',pants:'shorts'},
  {name:'Sofia',tag:'긴 머리 · 부드러운 턱',skin:'#f6d6bc',hair:'long',hairColor:'#e0b66d',body:'feminine',jaw:0.7,shirtColor:'#759785'},
  {name:'Idris',tag:'수염 · 넓은 얼굴',skin:'#4b3024',hair:'bald',beard:'full',jaw:1.22,body:'masculine',build:1.2,shirt:'shirt'},
  {name:'June',tag:'실버 헤어 · 안경',skin:'#edbd91',age:'elder',hair:'quiff',hairColor:'#ddd9d0',glasses:'round',shirtColor:'#a94e50'},
  {name:'Zara',tag:'히잡 · 오벌',skin:'#98603f',hair:'hijab',hairColor:'#6686a2',body:'feminine',headLength:1.1,shirt:'sweater',pants:'wide'},
  {name:'Alex',tag:'청록 머리 · 안경',skin:'#d79c6e',hair:'quiff',hairColor:'#2b8185',glasses:'round',shirt:'tee',shirtColor:'#e7dfd2'},
  {name:'Ruby',tag:'작은 컬 · 주황',skin:'#f6d6bc',age:'child',hair:'curls',hairColor:'#b16b36',shirtColor:'#d58b64',pants:'shorts'},
  {name:'Oscar',tag:'실버 수염 · 긴 얼굴',skin:'#ba7953',age:'elder',hair:'crop',hairColor:'#ddd9d0',beard:'full',headLength:1.16,glasses:'square',shirt:'shirt'}
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
