import { DEFAULT, PRESETS, validateConfig } from './config.js';

export const CLASSROOM_CONTEXTS = {
  general: { label: '기본 교실', description: '다양한 헤어스타일과 일상복의 아바타가 함께하는 교실입니다.' },
  korean: { label: '한국 맥락의 교실', description: '' },
};

// Fictional character designs, explicitly authored rather than inferred from appearance.
// Background does not determine a student's seat activity or break-time behavior.
const koreanStudents = [
  { name: '서연', background: 'korean', skin: '#edc6a8', hair: 'bob', body: 'feminine', headWidth: .96, headLength: 1.02, jaw: .82, chin: .87, eyeSize: 1.03, eyeAlmond: .62, eyeTilt: .07, eyeSpacing: 1.05, noseSize: .82, noseWidth: .84, mouthWidth: .75, browShape: 'soft', browArch: .72, browThickness: .78 },
  { name: '민준', background: 'korean', skin: '#e3b794', hair: 'dandy', body: 'masculine', headWidth: 1.03, headLength: .94, jaw: 1.08, chin: .95, eyeSize: .91, eyeAlmond: .52, eyeTilt: .02, eyeSpacing: .95, noseSize: 1.08, noseWidth: .98, mouthWidth: .88, browShape: 'straight', browArch: .22, browThickness: 1.14 },
  { name: '지우', background: 'korean', skin: '#f0cdb2', hair: 'sport', headWidth: .90, headLength: 1.06, jaw: .84, chin: 1.04, eyeSize: .90, eyeRoundness: .76, eyeAlmond: .40, eyeTilt: -.05, eyeSpacing: 1.12, noseSize: .93, noseWidth: .86, mouthWidth: .79, browShape: 'angled', browArch: .52, shirt: 'cardigan', shirtColor: '#586779' },
  { name: '하윤', background: 'korean', skin: '#dbad88', hair: 'ponytail', body: 'feminine', headWidth: .98, headLength: .93, jaw: .90, cheek: 1.12, eyeSize: 1.08, eyeRoundness: .95, eyeAlmond: .31, eyeTilt: .11, eyeSpacing: 1.00, noseSize: .75, noseWidth: .80, mouthWidth: .86, lipSize: 1.16, browShape: 'rounded', browArch: 1.15, shirt: 'cardigan', shirtColor: '#686b62' },
  { name: '미겔', background: 'filipino', skin: '#ba855e', hair: 'crop', body: 'masculine', headWidth: 1.01, headLength: .98, jaw: .96, eyeSize: .98, eyeRoundness: .90, eyeAlmond: .50, eyeTilt: .04, eyeSpacing: 1.08, noseSize: 1.12, noseWidth: 1.08, mouthWidth: .94, browShape: 'soft', browThickness: 1.18 },
  { name: '엘리', background: 'white', skin: '#f6d6bc', hair: 'long', hairColor: '#b99a61', eyeColor: '#6b795d', body: 'feminine', headWidth: .88, headLength: 1.05, jaw: .74, chin: 1.02, eyeSize: 1.02, eyeRoundness: .88, eyeAlmond: .36, eyeTilt: -.10, eyeSpacing: 1.14, noseSize: .88, noseWidth: .76, mouthWidth: .73, browShape: 'rounded', browArch: .92 },
  { name: '도윤', background: 'korean', skin: '#e6bc98', hair: 'dandy_perm', body: 'masculine', glasses: 'round', headWidth: 1.02, headLength: .92, jaw: 1.00, cheek: 1.13, eyeSize: .88, eyeRoundness: .72, eyeAlmond: .64, eyeTilt: .06, eyeSpacing: .91, noseSize: 1.16, noseWidth: 1.02, mouthWidth: .91, browShape: 'straight', browArch: .12, browThickness: 1.27 },
  { name: '수빈', background: 'korean', skin: '#f1cdb0', hair: 'long', body: 'feminine', headWidth: .92, headLength: .99, jaw: .76, chin: .84, eyeSize: 1.12, eyeRoundness: 1.04, eyeAlmond: .20, eyeTilt: .01, eyeSpacing: 1.09, noseSize: .70, noseWidth: .79, mouthWidth: .82, lipSize: 1.20, browShape: 'soft', browArch: 1.02 },
  { name: '준서', background: 'korean', skin: '#d6a782', hair: 'crop', body: 'masculine', shirt: 'cardigan', shirtColor: '#414e60', headWidth: .98, headLength: 1.03, jaw: .92, chin: 1.08, eyeSize: .86, eyeRoundness: .69, eyeAlmond: .70, eyeTilt: -.03, eyeSpacing: 1.03, noseSize: 1.20, noseWidth: .91, mouthWidth: .84, browShape: 'angled', browArch: .88, browThickness: .98 },
];

export function classroomRoster(context) {
  if (!CLASSROOM_CONTEXTS[context]) throw new Error('지원하지 않는 교실입니다.');
  const common = { age: 'adult', height: .90, build: .94, hairDetail: .25, beard: 'none', expression: 'smile', intensity: .22 };
  const classroomConfig = config => validateConfig({ ...config, headWidth: config.headWidth * .9 });
  if (context === 'general') {
    return [1, 2, 0, 5, 9, 8, 3, 4, 10, 7].map((index, i) => ({
      background: null,
      config: classroomConfig({ ...PRESETS[index], ...common, height: i === 9 ? 1 : .90, pants: 'trousers' }),
    }));
  }
  const students = koreanStudents.map(({ background, ...design }) => ({
    background,
    config: classroomConfig({ ...DEFAULT, ...common,
      hairColor: '#211c1b', eyeColor: '#30251f', browColor: '#211c1b',
      shirt: 'uniform', shirtColor: '#29394f', pants: 'uniform_pants', pantsColor: '#747981',
      shoeColor: '#242a32', legwear: 'socks', uniformTie: 'tie', tieColor: '#5b3544',
      earrings: false, glasses: 'none', ...design, browColor: design.hairColor || '#211c1b',
    }),
  }));
  return [...students, { background: 'korean', config: classroomConfig({ ...DEFAULT, ...common,
    name: '김 선생님', height: 1, skin: '#e3b794', hair: 'dandy', hairColor: '#211c1b', browColor: '#211c1b',
    shirt: 'cardigan', shirtColor: '#787668', pants: 'trousers', pantsColor: '#454e61',
    shoeColor: '#242a32', glasses: 'round',
  }) }];
}
