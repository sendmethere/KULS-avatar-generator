import { DEFAULT, PRESETS, validateConfig } from './config.js';

export const CLASSROOM_CONTEXTS = {
  general: { label: '기본 교실', description: '다양한 헤어스타일과 일상복의 아바타가 함께하는 교실입니다.' },
  korean: { label: '한국 맥락의 교실', description: '' },
};

// Fictional character designs, explicitly authored rather than inferred from appearance.
// Background does not determine a student's seat activity or break-time behavior.
const koreanStudents = [
  { name: '서연', background: 'korean', skin: '#edc6a8', hair: 'bob', body: 'feminine', headWidth: .96, jaw: .88 },
  { name: '민준', background: 'korean', skin: '#e3b794', hair: 'dandy', body: 'masculine', jaw: 1.02 },
  { name: '지우', background: 'korean', skin: '#f0cdb2', hair: 'sport', headLength: .96, shirt: 'cardigan', shirtColor: '#586779' },
  { name: '하윤', background: 'korean', skin: '#dbad88', hair: 'ponytail', body: 'feminine', headWidth: .98, shirt: 'cardigan', shirtColor: '#686b62' },
  { name: '미겔', background: 'filipino', skin: '#ba855e', hair: 'crop', body: 'masculine', headWidth: 1.01, jaw: .96 },
  { name: '엘리', background: 'white', skin: '#f6d6bc', hair: 'long', hairColor: '#b99a61', eyeColor: '#6b795d', body: 'feminine', headLength: .97 },
  { name: '도윤', background: 'korean', skin: '#e6bc98', hair: 'dandy_perm', body: 'masculine', glasses: 'round', headWidth: 1.02 },
  { name: '수빈', background: 'korean', skin: '#f1cdb0', hair: 'long', body: 'feminine', jaw: .82 },
  { name: '준서', background: 'korean', skin: '#d6a782', hair: 'crop', body: 'masculine', shirt: 'cardigan', shirtColor: '#414e60', headWidth: .98 },
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
