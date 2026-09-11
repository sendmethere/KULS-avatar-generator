import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createIcons, Shapes, CircleHelp, FolderOpen, Download, Shuffle, ArrowUpRight, UserRound, Check, Layers3, Undo2, Redo2, Rotate3d, Bone, Box, Camera, Focus, Mouse, Activity, View, Component, Smile, Save, X, ScanFace, Scissors, PersonStanding, Shirt, Pipette, SlidersHorizontal, ScanEye, Sparkles } from 'lucide';
const icons={Shapes,CircleHelp,FolderOpen,Download,Shuffle,ArrowUpRight,UserRound,Check,Layers3,Undo2,Redo2,Rotate3d,Bone,Box,Camera,Focus,Mouse,Activity,View,Component,Smile,Save,X,ScanFace,Scissors,PersonStanding,Shirt,Pipette,SlidersHorizontal,ScanEye,Sparkles};
import { createAvatar } from './avatar.js';
import { DEFAULT, PRESETS, SKINS, HAIRS, COLORS, RANGE, validateConfig, randomConfig } from './config.js';
import { createClassroom, CLASSROOM_ACTIVITIES, BREAK_ACTIVITIES } from './classroom.js';
import { CLASSROOM_CONTEXTS } from './classroom-profiles.js';
import { localize } from './i18n.js';
import './style.css';
import './classroom.css';
const icon=(n)=>`<i data-lucide="${n}" aria-hidden="true"></i>`;
const $=s=>document.querySelector(s);
let config={...DEFAULT};try { const saved=localStorage.getItem('atelier-avatar');if(saved)config=validateConfig(JSON.parse(saved)); }catch{}
let locale='ko';try { locale=localStorage.getItem('atelier-locale')==='en'?'en':'ko'; }catch{}
let tab='face', avatar, skeletonHelper, mode='idle', spin=false, wire=false, rigVisible=false, view='full', history=[], future=[], exportBusy=false;
const labels={face:'얼굴',hair:'헤어',body:'체형',outfit:'의상',expression:'표정'};
const tabIcons={face:'scan-face',hair:'scissors',body:'person-standing',outfit:'shirt',expression:'smile'};
const html=`
<header class="topbar"><a class="brand" href="/" aria-label="Avatar Atelier 홈"><span class="brand-icon">${icon('shapes')}</span><span>avatar<span class="brand-light"> atelier</span><small>작은 조합, 무한한 캐릭터</small></span></a><div class="top-center"><span class="status-dot"></span> 로컬 스튜디오 <span class="divider">/</span> <span id="save-status">자동 저장됨</span></div><div class="header-actions"><button class="icon-btn" id="help" title="사용 안내" aria-label="사용 안내">${icon('circle-help')}</button><button class="quiet" id="load">${icon('folder-open')} 불러오기</button><button class="primary" id="export-open">${icon('download')} 내보내기</button></div><button class="language-toggle" id="language-toggle" type="button" aria-label="언어를 English로 변경" title="언어를 English로 변경">EN</button></header>
<main class="workspace"><aside class="library"><div class="library-title"><span class="eyebrow">YOUR CHARACTERS</span><h2>어떤 모습으로 시작할까요?</h2><p>마음에 드는 캐릭터를 골라 바꿔보세요.</p></div><button class="random-card" id="random">${icon('shuffle')}<span>새로운 조합 만들기<small>매번 다른, 나만의 캐릭터</small></span>${icon('arrow-up-right')}</button><div class="section-line"><h3>스타터 컬렉션</h3><span>12</span></div><div class="preset-grid">${PRESETS.map((p,i)=>`<button class="preset ${i===0?'selected':''}" data-preset="${i}" title="${p.tag}"><div class="preset-img" style="--swatch:${p.shirtColor}"><img alt="${p.name} 3D 아바타" id="thumb-${i}"/><span class="preset-placeholder">${icon('user-round')}</span></div><div class="preset-name">${p.name}<span class="preset-check">${icon('check')}</span></div><small>${p.tag}</small></button>`).join('')}</div><div class="library-note">${icon('layers-3')}<p>도형 하나부터 나답게.<br><span>모든 캐릭터는 직접 편집할 수 있어요.</span></p></div></aside>
<section class="stage-wrap"><div class="stage-heading"><div><div class="eyebrow">CHARACTER STUDIO</div><div class="name-row"><input id="avatar-name" aria-label="캐릭터 이름" maxlength="40"/><span class="pill">3D AVATAR</span></div></div><div class="undo-group"><button class="icon-btn" id="undo" title="되돌리기 (⌘Z)" aria-label="되돌리기">${icon('undo-2')}</button><button class="icon-btn" id="redo" title="다시 실행" aria-label="다시 실행">${icon('redo-2')}</button></div></div><div id="viewport"><div class="view-tabs"><button data-view="full" class="active">전신</button><button data-view="face">얼굴</button></div><div class="stage-tag"><span class="status-dot"></span> 실시간 미리보기</div><div class="stage-tools"><button class="icon-btn" id="rotate" title="자동 회전" aria-label="자동 회전">${icon('rotate-3d')}</button><button class="icon-btn" id="skeleton" title="뼈대 보기" aria-label="뼈대 보기">${icon('bone')}</button><button class="icon-btn" id="wire" title="와이어프레임" aria-label="와이어프레임">${icon('box')}</button><span></span><button class="icon-btn" id="capture" title="PNG 저장" aria-label="PNG 저장">${icon('camera')}</button><button class="icon-btn" id="reset-camera" title="시점 초기화" aria-label="시점 초기화">${icon('focus')}</button></div><div class="orbit-hint">${icon('mouse')} 드래그하여 회전 <b>·</b> 스크롤하여 확대</div><div class="stage-bottom"><div class="pose-select">${icon('activity')}<select id="pose" aria-label="포즈와 애니메이션"><option value="idle">편안하게 · Idle</option><option value="relaxed">기본 자세</option><option value="walk">걷기 · Walk</option><option value="sit">앉기</option><option value="shy">고개 숙이기</option><option value="look">두리번</option><option value="talk">이야기</option><option value="cross">팔짱</option><option value="tpose">T 포즈</option></select></div><button class="quiet" id="side-view">${icon('view')} 옆모습</button></div></div><footer class="stage-footer"><span>${icon('component')} <span id="mesh-count">—</span> 파츠</span><span>${icon('bone')} <span id="bone-count">—</span> 본</span><span>${icon('smile')} 6 Shape Keys</span><span class="ready-label"><span class="status-dot"></span> Blender · FBX</span></footer></section>
<aside class="editor"><div class="editor-heading"><span class="eyebrow">MAKE IT YOURS</span><h2>작은 차이가, 나다움</h2></div><nav class="editor-tabs">${Object.entries(labels).map(([k,l])=>`<button data-tab="${k}" class="${k===tab?'active':''}">${icon(tabIcons[k])}<span>${l}</span></button>`).join('')}</nav><div id="controls"></div><div class="editor-bottom">${icon('save')} 이 브라우저에 자동으로 저장됩니다</div></aside></main>
<div id="toast" role="status" aria-live="polite"></div><input id="file-input" type="file" accept=".json,application/json" hidden/>
<dialog id="export-dialog"><div class="dialog-header"><div><span class="eyebrow">TAKE YOUR CHARACTER</span><h2>다음 무대로 데려가세요</h2></div><button class="icon-btn dialog-close" aria-label="닫기">${icon('x')}</button></div><p>현재 얼굴과 의상, 뼈대, 표정을 함께 저장합니다.</p><div class="export-options"><button data-format="blend"><span class="format-icon orange">B</span><span><b>Blender 프로젝트</b><small>.blend · 메시, Armature, Shape Keys 편집</small></span>${icon('download')}</button><button data-format="fbx"><span class="format-icon violet">U</span><span><b>Unity용 FBX</b><small>.fbx · 휴머노이드 본과 Idle / Walk 포함</small></span>${icon('download')}</button><button data-format="glb"><span class="format-icon green">3D</span><span><b>범용 3D 모델</b><small>.glb · 재질, 스킨, 표정, 애니메이션</small></span>${icon('download')}</button><button data-format="json"><span class="format-icon beige">{ }</span><span><b>커스터마이징 설정</b><small>.json · 이 스튜디오에서 다시 편집</small></span>${icon('download')}</button></div><div id="export-status" role="status"></div><p class="dialog-note">GLB / FBX는 T 포즈를 기준으로 저장합니다. Blender / FBX 변환은 이 컴퓨터의 Blender를 사용합니다. Unity에서 Rig → Humanoid 설정이 필요합니다.</p></dialog>
<dialog id="help-dialog"><div class="dialog-header"><h2>나만의 아바타, 처음부터 끝까지</h2><button class="icon-btn dialog-close" aria-label="닫기">${icon('x')}</button></div><ol><li><b>조합하기</b><p>스타터를 고르거나 새로운 조합을 만드세요. 피부색과 얼굴형, 체형, 나이, 머리, 옷을 독립적으로 조절할 수 있습니다.</p></li><li><b>표정과 움직임</b><p>표정 탭에서 6가지 감정과 시선을 조절하세요. 아래의 포즈 메뉴에서 걷기와 T 포즈를 확인하고, 뼈대 버튼으로 리깅을 볼 수 있습니다.</p></li><li><b>Blender에서 편집</b><p>.blend 파일을 열어 파츠를 선택하고 Edit Mode에서 수정하세요. Armature의 Pose Mode로 포즈를 바꾸고, 눈·입·눈썹 메시의 Shape Keys로 표정을 조절합니다.</p></li><li><b>Unity에서 사용</b><p>FBX를 Assets로 가져온 후 Rig → Humanoid → Create From This Model → Apply를 선택하세요. Configure에서 매핑과 T 포즈를 확인합니다. 손은 단순화되어 손가락 본은 없습니다.</p></li></ol><p class="dialog-note">현재 생성은 기본 도형을 조합하는 로컬 절차적 생성 방식입니다. 외부 생성형 AI나 사진 분석은 연결하지 않았습니다. 얼굴의 6개 Shape Key는 웃음·정색·슬픔·화남·당황·눈 깜빡임이며 보통 표정은 기본 형태입니다.</p></dialog>`;
$('#app').innerHTML=html;
let pageMode='studio', classroom=null, classroomLoading=null, classroomOrbit=null, classroomScenario='lesson';
let classroomContext='korean';
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
$('.topbar').insertAdjacentHTML('afterend', `<nav class="workspace-tabs" role="tablist" aria-label="작업 공간"><button id="studio-tab" role="tab" aria-selected="true" aria-controls="studio-panel" data-workspace="studio">${icon('user-round')} 아바타 스튜디오</button><button id="classroom-tab" role="tab" aria-selected="false" aria-controls="classroom-panel" tabindex="-1" data-workspace="classroom">${icon('view')} 교실 시뮬레이션<span class="tab-new">NEW</span></button></nav>`);
$('.workspace').id='studio-panel';
$('.workspace').setAttribute('role','tabpanel');
$('.workspace').setAttribute('aria-labelledby','studio-tab');
$('#toast').insertAdjacentHTML('beforebegin', `<main id="classroom-panel" class="classroom-panel" role="tabpanel" aria-labelledby="classroom-tab" hidden>
  <div class="classroom-heading"><div><span class="eyebrow">CLASSROOM OBSERVATORY</span><h1>교실 속, 저마다의 순간</h1><p>다양한 아바타의 자세와 움직임을 한 공간에서 관찰하세요.</p></div><span class="observation-badge">${icon('scan-eye')} 관찰 전용</span></div>
  <div class="classroom-contexts" role="group" aria-label="교실 맥락">${Object.entries(CLASSROOM_CONTEXTS).map(([key,{label}])=>`<button data-classroom-context="${key}" aria-pressed="${key===classroomContext}">${label}</button>`).join('')}</div><p id="classroom-context-description">${CLASSROOM_CONTEXTS[classroomContext].description}</p>
  <div class="classroom-toolbar"><div class="classroom-scenarios" role="group" aria-label="교실 상황"><button data-scenario="lesson" aria-pressed="true">수업 시간</button><button data-scenario="break" aria-pressed="false">쉬는 시간</button></div><div class="classroom-camera-tools"><div class="classroom-zoom" role="group" aria-label="교실 확대와 축소"><button id="classroom-zoom-out" aria-label="교실 축소" title="축소">−</button><output id="classroom-zoom-level" aria-label="확대 배율">100%</output><button id="classroom-zoom-in" aria-label="교실 확대" title="확대">+</button></div><button id="classroom-reset" class="quiet" aria-label="교실 시점과 확대 배율 초기화" title="시점 초기화">${icon('focus')}<span>시점 초기화</span></button></div></div>
  <div class="classroom-layout"><section class="classroom-scene" aria-label="3D 교실 관찰 화면"><div class="classroom-scene-label"><span class="status-dot"></span> 01 교실 <span id="classroom-scenario-label">수업 시간</span></div><div id="classroom-viewport"><div id="classroom-loading" role="status" aria-live="polite">교실을 준비하고 있습니다…</div></div><div class="classroom-caption">${icon('mouse')} 드래그하여 회전 · 스크롤 / 두 손가락으로 확대</div></section>
  <aside class="classroom-info"><span class="eyebrow">IN THE CLASSROOM</span><h2>함께 있는 모습들</h2><p id="classroom-description">같은 수업, 서로 다른 자세.<br>작은 움직임을 천천히 살펴보세요.</p><div class="classroom-counts"><div><strong>09</strong><span>학생 아바타</span></div><div><strong>01</strong><span>교사 아바타</span></div></div><h3>지금 교실에서는</h3><ul class="classroom-activities">${CLASSROOM_ACTIVITIES.map(([label,count,color])=>`<li><span class="activity-dot" style="--activity-color:${color}"></span><span>${label}</span><small>${count}명</small></li>`).join('')}<li><span class="activity-dot" style="--activity-color:#b5a478"></span><span>수업 설명하기</span><small>교사</small></li></ul><div class="classroom-note">${icon('view')}<p>원하는 각도에서 관찰하세요.<br>아바타의 움직임은 자동으로 이어집니다.</p></div></aside></div>
</main>`);
const refreshIcons=()=>createIcons({icons,attrs:{'stroke-width':1.7}});
refreshIcons();
function applyLanguage(){
 document.documentElement.lang=locale;
 document.documentElement.querySelector('title').textContent=locale==='en'?'Avatar Atelier · Your 3D character':'Avatar Atelier · 나만의 3D 캐릭터';
 localize($('#app'),locale);localize($('.workspace-tabs'),locale);localize($('#classroom-panel'),locale);
 classroom?.setLanguage(locale);
 const button=$('#language-toggle');button.textContent=locale==='en'?'한국어':'EN';
 button.setAttribute('aria-label',locale==='en'?'Change language to Korean':'언어를 English로 변경');button.title=button.getAttribute('aria-label');
}
$('#language-toggle').onclick=()=>{locale=locale==='ko'?'en':'ko';try{localStorage.setItem('atelier-locale',locale);}catch{};renderControls();applyLanguage();};
const renderer=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
$('#viewport').prepend(renderer.domElement);renderer.domElement.setAttribute('aria-label','마우스로 회전할 수 있는 3D 아바타');
const scene=new T.Scene();
const camera=new T.PerspectiveCamera(32,1,.01,100);camera.position.set(2.5,1.7,5.5);
const orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;orbit.target.set(0,1.03,0);orbit.minDistance=.7;orbit.maxDistance=8;orbit.maxPolarAngle=Math.PI*.53;orbit.enablePan=true;
function lighting(s){s.add(new T.HemisphereLight('#fff5e4','#8b9b88',2.6));const key=new T.DirectionalLight('#fff5e5',3.5);key.position.set(-3,5,5);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-3;key.shadow.camera.right=3;key.shadow.camera.top=3;key.shadow.camera.bottom=-3;key.shadow.bias=-.0005;key.shadow.normalBias=.003;s.add(key);const fill=new T.DirectionalLight('#dce9ff',1.4);fill.position.set(3,2,-2);s.add(fill);}
lighting(scene);
const platform=new T.Mesh(new T.CylinderGeometry(.74,.76,.07,96),new T.MeshStandardMaterial({color:'#dddccf',roughness:1}));platform.position.y=-.042;platform.receiveShadow=true;scene.add(platform);
const floor=new T.Mesh(new T.PlaneGeometry(200,200),new T.ShadowMaterial({opacity:.12}));floor.rotation.x=-Math.PI/2;floor.position.y=-.08;floor.receiveShadow=true;scene.add(floor);
const grid=new T.GridHelper(16,64,'#c8c9bf','#d9dbd0');grid.position.y=-.081;grid.material.transparent=true;grid.material.opacity=.18;scene.add(grid);
const resize=()=>{const host=$(pageMode==='classroom'?'#classroom-viewport':'#viewport');const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h);if(pageMode==='classroom'){classroom?.resize(w,h);}else{camera.aspect=w/h;camera.updateProjectionMatrix();}};
const viewportObserver=new ResizeObserver(resize);viewportObserver.observe($('#viewport'));viewportObserver.observe($('#classroom-viewport'));
async function switchWorkspace(next){
 pageMode=next;const isClassroom=next==='classroom';
 $('#studio-panel').hidden=isClassroom;$('#classroom-panel').hidden=!isClassroom;
 $('.header-actions').hidden=isClassroom;$('.top-center').hidden=isClassroom;
 document.querySelectorAll('[data-workspace]').forEach(btn=>{const selected=btn.dataset.workspace===next;btn.setAttribute('aria-selected',String(selected));btn.tabIndex=selected?0:-1;});
 orbit.enabled=!isClassroom;
 if(classroomOrbit)classroomOrbit.enabled=isClassroom;
 $(isClassroom?'#classroom-viewport':'#viewport').prepend(renderer.domElement);
 renderer.domElement.setAttribute('aria-label',isClassroom?'교사 1명과 학생 9명이 다양한 자세를 취하는 관찰 전용 3D 교실':'마우스로 회전할 수 있는 3D 아바타');
 resize();
 if(isClassroom&&!classroom)await loadClassroom(classroomContext);
}
function loadClassroom(context){
 if(classroomLoading)return classroomLoading;
 $('#classroom-loading').hidden=false;
 document.querySelectorAll('[data-classroom-context]').forEach(btn=>btn.disabled=true);
 classroomLoading=createClassroom((count,total)=>{$('#classroom-loading').textContent=`${CLASSROOM_CONTEXTS[context].label} 준비 중… ${count} / ${total}`;},context)
    .then(result=>{
      const previous=classroom;
      const previousCamera=previous?.camera.position.clone(),previousZoom=previous?.camera.zoom;
      classroomOrbit?.dispose();
      classroom=result;
      classroomOrbit=new OrbitControls(classroom.camera,renderer.domElement);
      classroomOrbit.target.set(0,.6,0);classroomOrbit.enableDamping=!reducedMotion.matches;classroomOrbit.enablePan=false;
      classroomOrbit.minPolarAngle=.18;classroomOrbit.maxPolarAngle=Math.PI*.47;
      classroomOrbit.minZoom=.65;classroomOrbit.maxZoom=3;classroomOrbit.rotateSpeed=.65;
      classroomOrbit.enabled=pageMode==='classroom';classroomOrbit.update();classroomOrbit.saveState();
      if(previousCamera){classroom.camera.position.copy(previousCamera);classroom.camera.zoom=previousZoom;classroom.camera.updateProjectionMatrix();classroomOrbit.update();}
      classroomOrbit.addEventListener('change',()=>{$('#classroom-zoom-level').value=Math.round(classroom.camera.zoom*100)+'%';});
      previous?.dispose();
      classroomContext=context;
      document.querySelectorAll('[data-classroom-context]').forEach(btn=>btn.setAttribute('aria-pressed',String(btn.dataset.classroomContext===context)));
      $('#classroom-context-description').textContent=CLASSROOM_CONTEXTS[context].description;
      classroom.setScenario(classroomScenario);$('#classroom-loading').hidden=true;resize();applyLanguage();
    })
    .catch(error=>{console.error('Classroom generation',error);if(classroom){$('#classroom-loading').hidden=true;toast('교실을 불러오지 못했습니다. 다시 선택해 주세요.');}else{$('#classroom-loading').textContent='교실을 불러오지 못했습니다. 스튜디오로 돌아간 뒤 다시 열어 주세요.';}})
    .finally(()=>{classroomLoading=null;document.querySelectorAll('[data-classroom-context]').forEach(btn=>btn.disabled=false);});
 return classroomLoading;
}
document.querySelectorAll('[data-classroom-context]').forEach(btn=>btn.onclick=()=>{if(!classroom||btn.dataset.classroomContext!==classroomContext)loadClassroom(btn.dataset.classroomContext);});
document.querySelectorAll('[data-workspace]').forEach(btn=>{
 btn.onclick=()=>switchWorkspace(btn.dataset.workspace);
 btn.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?'studio':e.key==='End'?'classroom':pageMode==='studio'?'classroom':'studio';$(`[data-workspace="${next}"]`).focus();switchWorkspace(next);}};
});
document.querySelectorAll('[data-scenario]').forEach(btn=>btn.onclick=()=>{
 classroomScenario=btn.dataset.scenario;classroom?.setScenario(classroomScenario);
 const isBreak=classroomScenario==='break';
 document.querySelectorAll('[data-scenario]').forEach(el=>el.setAttribute('aria-pressed',String(el===btn)));
 $('#classroom-scenario-label').textContent=isBreak?'쉬는 시간':'수업 시간';
 $('#classroom-description').innerHTML=isBreak?'친구와 이야기하고, 통로를 걷고.<br>쉬는 시간의 일상을 살펴보세요.':'같은 수업, 서로 다른 자세.<br>작은 움직임을 천천히 살펴보세요.';
 $('.classroom-activities').innerHTML=(isBreak?BREAK_ACTIVITIES:CLASSROOM_ACTIVITIES).map(([label,count,color])=>`<li><span class="activity-dot" style="--activity-color:${color}"></span><span>${label}</span><small>${count}명</small></li>`).join('')+`<li><span class="activity-dot" style="--activity-color:#b5a478"></span><span>${isBreak?'교실 살펴보기':'수업 설명하기'}</span><small>교사</small></li>`;applyLanguage();
});
$('#classroom-reset').onclick=()=>{if(!classroomOrbit)return;const damping=classroomOrbit.enableDamping;classroomOrbit.enableDamping=false;classroomOrbit.update();classroomOrbit.reset();classroomOrbit.enableDamping=damping;};
reducedMotion.addEventListener('change',()=>{if(classroomOrbit){classroomOrbit.enableDamping=!reducedMotion.matches;classroomOrbit.update();}});
function zoomClassroom(factor){if(!classroom)return;classroom.camera.zoom=T.MathUtils.clamp(classroom.camera.zoom*factor,classroomOrbit.minZoom,classroomOrbit.maxZoom);classroom.camera.updateProjectionMatrix();$('#classroom-zoom-level').value=Math.round(classroom.camera.zoom*100)+'%';}
$('#classroom-zoom-in').onclick=()=>zoomClassroom(1.2);
$('#classroom-zoom-out').onclick=()=>zoomClassroom(1/1.2);
function save(){try{localStorage.setItem('atelier-avatar',JSON.stringify(config));$('#save-status').textContent='자동 저장됨';}catch{$('#save-status').textContent='저장 공간 부족';}}
const openArmBind=pose=>['tpose','cross'].includes(pose);
function rebuild(){if(avatar){scene.remove(avatar.group);avatar.dispose();}if(skeletonHelper){scene.remove(skeletonHelper);skeletonHelper.dispose();}avatar=createAvatar(config,{tpose:openArmBind(mode)});scene.add(avatar.group);skeletonHelper=new T.SkeletonHelper(avatar.group);skeletonHelper.material.depthTest=false;skeletonHelper.material.linewidth=2;skeletonHelper.renderOrder=10;skeletonHelper.visible=rigVisible;scene.add(skeletonHelper);for(const p of avatar.parts)p.material.wireframe=wire;$('#mesh-count').textContent=avatar.parts.length;$('#bone-count').textContent=avatar.bones.length;$('#avatar-name').value=config.name;save();}
function remember(){history.push({...config});if(history.length>60)history.shift();future=[];updateHistory();}
function updateHistory(){$('#undo').disabled=!history.length;$('#redo').disabled=!future.length;}
function apply(c,rememberFirst=true){if(rememberFirst)remember();config=validateConfig(c);rebuild();renderControls();$('.preset.selected')?.classList.remove('selected');}
function change(key,value,full=true){config[key]=value;if(key==='shirt'&&value==='uniform'){config.shirtColor='#29394f';config.pantsColor='#747981';config.shoeColor='#242a32';config.pants=['skirt','pleated_skirt'].includes(config.pants)?'pleated_skirt':'uniform_pants';}if(key==='pants'&&value==='pleated_skirt'&&config.shirt==='uniform'){config.legwear='tights';config.uniformTie='ribbon';}if(['expression','intensity','gazeX','gazeY'].includes(key)){avatar.setExpression(config.expression,config.intensity);avatar.setGaze(config.gazeX,config.gazeY);save();}else if(full)rebuild();}
function toast(s){$('#toast').textContent=s;$('#toast').classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('visible'),3300);}
function colorControl(key,title,colors){return `<section class="control-block"><div class="control-title"><h3>${title}</h3><label class="custom-color" title="직접 색상 선택"><input type="color" data-key="${key}" value="${config[key]}" aria-label="${title} 직접 선택"/>${icon('pipette')}</label></div><div class="swatches">${colors.map(col=>`<button class="swatch ${config[key]===col?'active':''}" data-color="${col}" data-key="${key}" style="--color:${col}" aria-label="${title} ${col}" aria-pressed="${config[key]===col}">${config[key]===col?icon('check'):''}</button>`).join('')}</div></section>`;}
function slider(key,title){const [min,max]=RANGE[key];const current=config[key];const display=['eyeHeight','mouthHeight','gazeX','gazeY','browHeight','browTilt','eyeTilt'].includes(key)?Math.round(current*100):Math.round(current*100)+'%';return `<label class="slider-control" for="${key}"><span>${title}<output for="${key}">${display}</output></span><input id="${key}" data-key="${key}" type="range" min="${min}" max="${max}" step="0.005" value="${current}" style="--percent:${(current-min)/(max-min)*100}%"/></label>`;}
function choices(key,title,items){return `<section class="control-block"><h3>${title}</h3><div class="choices ${items.length>4?'three':''}">${items.map(([value,label])=>`<button data-choice="${value}" data-key="${key}" class="${config[key]===value?'active':''}" aria-pressed="${config[key]===value}">${label}</button>`).join('')}</div></section>`;}
function block(title,content){return `<section class="control-block"><h3>${title}</h3>${content}</section>`;}
function renderControls(){
 let s='';
 if(tab==='face')s=colorControl('skin','피부색',SKINS)+block('눈',slider('eyeSize','눈 크기')+slider('eyeSpacing','눈 사이 간격')+slider('eyeHeight','눈 높이')+slider('eyeRoundness','눈 세로 비율')+slider('eyeTilt','눈꼬리 기울기')+slider('eyeLine','눈 외곽선')+slider('pupilSize','동공 크기'))+choices('lashes','속눈썹',[['none','없음'],['short','자연스럽게'],['long','길게']])+colorControl('eyeColor','홍채 색',['#1a1614','#3a2a22','#5c3a24','#8a5a2c','#a57c43','#4a6b52','#2f6b6b','#3f5f8a','#6b4a7a','#7a3a3a'])+block('눈썹',slider('browThickness','눈썹 두께')+slider('browWidth','눈썹 길이')+slider('browHeight','눈썹 높이')+slider('browSpacing','눈썹 간격')+slider('browTilt','눈썹 기울기')+slider('browArch','눈썹 아치'))+choices('browShape','눈썹 모양',[['soft','기본'],['straight','일자'],['angled','각진'],['rounded','둥근']])+colorControl('browColor','눈썹 색',HAIRS)+block('코와 입',slider('noseSize','코 크기')+slider('noseWidth','코 너비')+slider('mouthWidth','입 너비')+slider('mouthHeight','입 위치')+slider('lipSize','입술 두께'))+block('얼굴 윤곽',slider('headWidth','얼굴 너비')+slider('headLength','얼굴 길이')+slider('jaw','턱 너비')+slider('cheek','광대 너비')+slider('forehead','이마 너비')+slider('chin','턱 길이'));
 if(tab==='hair')s=choices('hair','헤어스타일',[['curls','컬 / 아프로'],['crop','짧은 머리'],['sport','스포츠 머리'],['dandy','댄디 머리'],['dandy_perm','댄디펌'],['quiff','퀴프'],['bob','보브'],['long','긴 머리'],['bun','번'],['ponytail','포니테일'],['braids','땋은 머리'],['waves','웨이브'],['bald','민머리'],['hijab','히잡']])+(config.hair==='hijab'?choices('hijabStyle','히잡 스타일',[['wrapped','랩 스타일'],['draped','드레이프'],['pleated','플리츠']]):'')+block('헤어 디테일',slider('hairVolume','전체 볼륨')+(config.hair==='curls'?slider('curlSize','컬 크기'):'')+slider('hairDetail','머릿결 선명도'))+colorControl('hairColor','머리 / 히잡 색',HAIRS)+choices('beard','수염',[['none','없음'],['stubble','짧은 수염'],['full','전체 수염'],['mustache','콧수염']])+choices('glasses','안경',[['none','없음'],['round','라운드'],['square','스퀘어']])+`<section class="control-block"><label class="toggle-row">이어링<input type="checkbox" data-key="earrings" ${config.earrings?'checked':''}/></label></section>`;
 if(tab==='body')s=choices('body','체형 스타일',[['neutral','중성적'],['masculine','남성적'],['feminine','여성적']])+choices('age','연령대',[['child','어린이'],['adult','성인'],['elder','노인']])+block('비율',slider('height','키')+slider('build','체격'))+`<div class="tip">${icon('sliders-horizontal')}<p>체형은 어깨와 몸통의 비율을 바꿉니다. 나이와 얼굴 특징, 의상은 자유롭게 조합할 수 있어요.</p></div>`;
 if(tab==='outfit')s=choices('shirt','상의',[['sweater','니트'],['tee','반소매'],['hoodie','후디'],['shirt','셔츠'],['polo','폴로'],['cardigan','카디건'],['jacket','재킷'],['vest','조끼'],['overalls','멜빵'],['uniform','교복 재킷']])+(config.shirt==='uniform'?choices('uniformTie','교복 타이',[['tie','넥타이'],['ribbon','리본'],['none','없음']])+colorControl('tieColor','타이 / 리본 색',['#823b4e','#243d60','#5c7049','#c4a454']):'')+colorControl('shirtColor','상의 색',COLORS)+choices('pants','하의',[['trousers','기본 바지'],['shorts','반바지'],['wide','와이드 팬츠'],['cargo','카고'],['joggers','조거'],['skirt','스커트'],['uniform_pants','교복 바지'],['pleated_skirt','교복 치마']])+colorControl('pantsColor','하의 색',['#e6d9bf','#454e61','#778570','#684d42','#e7dfd2','#3b444d'])+choices('legwear','양말 / 스타킹',[['none','없음'],['socks','긴 양말'],['tights','스타킹']])+colorControl('shoeColor','신발 색',['#f5efe3','#3b444d','#a94e50','#6686a2','#759785']);
 if(tab==='expression')s=choices('expression','지금의 기분',[['neutral','◡ 보통'],['smile','☺ 웃음'],['serious','— 정색'],['sad','◠ 슬픔'],['angry','⌁ 화남'],['surprised','○ 당황']])+block('표정 강도',slider('intensity','강도'))+block('시선',slider('gazeX','좌우')+slider('gazeY','상하'))+`<button class="wide-button" id="gaze-reset">${icon('scan-eye')} 정면 바라보기</button><div class="tip">${icon('sparkles')}<p>눈은 자동으로 깜빡여요. 표정은 Shape Key, 시선은 눈 본의 회전으로 저장됩니다.</p></div>`;
 $('#controls').innerHTML=s;refreshIcons();
 $('#controls').querySelectorAll('input[type=range]').forEach(el=>{el.addEventListener('pointerdown',()=>remember());el.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))remember();});el.addEventListener('input',()=>{const key=el.dataset.key,value=Number(el.value);el.style.setProperty('--percent',(value-Number(el.min))/(Number(el.max)-Number(el.min))*100+'%');el.previousElementSibling.querySelector('output').textContent=['eyeHeight','mouthHeight','gazeX','gazeY','browHeight','browTilt','eyeTilt'].includes(key)?Math.round(value*100):Math.round(value*100)+'%';change(key,value);});});
 $('#controls').querySelectorAll('[data-choice]').forEach(el=>el.onclick=()=>{remember();change(el.dataset.key,el.dataset.choice);renderControls();});
 $('#controls').querySelectorAll('[data-color]').forEach(el=>el.onclick=()=>{remember();change(el.dataset.key,el.dataset.color);renderControls();});
 $('#controls').querySelectorAll('input[type=color]').forEach(el=>el.onchange=()=>{remember();change(el.dataset.key,el.value);renderControls();});
 $('#controls').querySelectorAll('input[type=checkbox]').forEach(el=>el.onchange=()=>{remember();change(el.dataset.key,el.checked);});
 if($('#gaze-reset'))$('#gaze-reset').onclick=()=>{remember();change('gazeX',0);change('gazeY',0);renderControls();};
 if(locale==='en')localize($('#controls'),locale);
}
function frame(which=view){view=which;const targetY=view==='face'?avatar.headY:avatar.height*.46;orbit.target.set(0,targetY,0);if(view==='face')camera.position.set(.16,targetY+.06,1.6);else camera.position.set(.65,targetY+.24,Math.max(4.0,avatar.height*2.15,avatar.height/camera.aspect*1.5));orbit.update();document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view===view));}
rebuild();renderControls();updateHistory();frame();applyLanguage();
const clock=new T.Clock();
let lastClassroomFrame=-1;
renderer.setAnimationLoop(()=>{const t=clock.getElapsedTime();if(document.hidden)return;if(pageMode==='classroom'){if(classroom&&t-lastClassroomFrame>=1/30){classroomOrbit.update();classroom.update(reducedMotion.matches?0:t);renderer.render(classroom.scene,classroom.camera);lastClassroomFrame=t;}else if(!classroom){renderer.clear();}return;}if(avatar){avatar.pose(mode,t);const phase=t%4.8;const blink=mode==='tpose'?0:Math.max(0,1-Math.abs(phase-4.5)/.105);avatar.setExpression(config.expression,config.intensity,blink);avatar.setGaze(config.gazeX,config.gazeY);}orbit.autoRotate=spin;orbit.autoRotateSpeed=1.2;orbit.update();renderer.render(scene,camera);});
for(const btn of document.querySelectorAll('[data-tab]'))btn.onclick=()=>{tab=btn.dataset.tab;document.querySelectorAll('[data-tab]').forEach(el=>el.classList.toggle('active',el===btn));renderControls();$('#controls').scrollTop=0;};
for(const btn of document.querySelectorAll('[data-preset]'))btn.onclick=()=>{apply(PRESETS[Number(btn.dataset.preset)]);btn.classList.add('selected');frame();};
for(const btn of document.querySelectorAll('[data-view]'))btn.onclick=()=>frame(btn.dataset.view);
$('#random').onclick=()=>{apply(randomConfig());frame();toast('새로운 캐릭터가 태어났어요. 자유롭게 바꿔보세요.');};
$('#avatar-name').onchange=e=>{remember();config.name=e.target.value.trim()||'Avatar';save();};
$('#undo').onclick=()=>{if(!history.length)return;future.push({...config});config=history.pop();rebuild();renderControls();updateHistory();};
$('#redo').onclick=()=>{if(!future.length)return;history.push({...config});config=future.pop();rebuild();renderControls();updateHistory();};
window.addEventListener('keydown',e=>{if(pageMode==='studio'&&(e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'&&!['INPUT','TEXTAREA'].includes(e.target.tagName)){e.preventDefault();$(e.shiftKey?'#redo':'#undo').click();}});
// T-pose and crossed arms use the open-arm garment bind to avoid sleeve spikes.
$('#pose').onchange=e=>{const was=openArmBind(mode);mode=e.target.value;if(was!==openArmBind(mode))rebuild();};
$('#rotate').onclick=()=>{$('#rotate').classList.toggle('active',spin=!spin);};
$('#skeleton').onclick=()=>{$('#skeleton').classList.toggle('active',rigVisible=!rigVisible);skeletonHelper.visible=rigVisible;};
$('#wire').onclick=()=>{$('#wire').classList.toggle('active',wire=!wire);for(const p of avatar.parts)p.material.wireframe=wire;};
$('#reset-camera').onclick=()=>frame();
$('#side-view').onclick=()=>{orbit.target.set(0,view==='face'?avatar.headY:avatar.height*.46,0);camera.position.set(view==='face'?1.6:4.2,orbit.target.y+.12,.05);orbit.update();};
function download(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),20000);}
const filename=()=>config.name.replace(/[^\p{L}\p{N}_-]/gu,'_')||'Avatar';
$('#capture').onclick=()=>{renderer.render(scene,camera);renderer.domElement.toBlob(b=>{if(b)download(b,filename()+'.png');});};
$('#help').onclick=()=>$('#help-dialog').showModal();
for(const btn of document.querySelectorAll('.dialog-close'))btn.onclick=()=>{if(!exportBusy)btn.closest('dialog').close();};
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('click',e=>{if(e.target===dialog&&!exportBusy)dialog.close();});
$('#export-dialog').addEventListener('cancel',e=>{if(exportBusy)e.preventDefault();});
$('#export-open').onclick=async()=>{$('#export-dialog').showModal();$('#export-status').textContent='Blender 연결 확인 중…';try{const r=await fetch('/api/health');const h=await r.json();$('#export-status').textContent=h.blender?'● Blender 연결됨 · 로컬 변환 준비 완료':'Blender를 찾지 못했습니다. GLB를 저장하거나 BLENDER_PATH를 설정해 주세요.';for(const b of document.querySelectorAll('[data-format="blend"],[data-format="fbx"]'))b.disabled=!h.blender;}catch{$('#export-status').textContent='변환 서버 연결을 확인해 주세요. GLB / JSON은 바로 저장할 수 있습니다.';}};
async function exportGLB(){
 // Use an isolated T-pose instance so export never mutates the visible avatar or current pose.
 const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
 const a=createAvatar(config,{animations:true,tpose:true});a.pose('tpose');a.setExpression(config.expression,config.intensity,0);a.setGaze(config.gazeX,config.gazeY);a.group.userData={generator:'Avatar Atelier',config:{...config},license:'User-created procedural asset'};
 const assetScene=new T.Scene();assetScene.name='Avatar';assetScene.userData=a.group.userData;for(const child of [...a.group.children])assetScene.add(child);assetScene.updateMatrixWorld(true);
 try{return await new GLTFExporter().parseAsync(assetScene,{binary:true,animations:a.clips,onlyVisible:true});}finally{a.dispose();}
}
async function doExport(format){
 if(exportBusy)return;
 if(format==='json'){download(new Blob([JSON.stringify(config,null,2)],{type:'application/json'}),filename()+'.avatar.json');toast('설정을 저장했습니다.');return;}
 exportBusy=true;document.querySelectorAll('[data-format]').forEach(b=>b.disabled=true);$('#export-status').textContent=format==='glb'?'3D 모델 저장 중…':'Blender에서 변환 중… 잠시 기다려 주세요.';
 try{const buffer=await exportGLB();let blob=new Blob([buffer],{type:'model/gltf-binary'});if(format!=='glb'){const r=await fetch('/api/export?format='+format,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:blob});if(!r.ok){const e=await r.json();throw new Error(e.error);}blob=await r.blob();}download(blob,filename()+'.'+format);$('#export-status').textContent='저장 완료. 다운로드 폴더를 확인해 주세요.';toast(format.toUpperCase()+' 파일을 저장했습니다.');}catch(e){$('#export-status').textContent=e.message;toast('내보내기 실패: '+e.message);}finally{exportBusy=false;document.querySelectorAll('[data-format]').forEach(b=>b.disabled=false);}
}
for(const b of document.querySelectorAll('[data-format]'))b.onclick=()=>doExport(b.dataset.format);
$('#load').onclick=()=>$('#file-input').click();
$('#file-input').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>100000)throw new Error('100 KB 이하의 설정 JSON을 선택해 주세요.');apply(JSON.parse(await f.text()));frame();toast('캐릭터 설정을 불러왔습니다.');}catch(err){toast(err.message);}e.target.value='';};
async function thumbnails(){const r=new T.WebGLRenderer({antialias:true,alpha:true});r.setSize(180,164);r.setPixelRatio(1.5);r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=1.15;const s=new T.Scene();lighting(s);const cam=new T.PerspectiveCamera(31,180/164,.01,20);for(let i=0;i<PRESETS.length;i++){const a=createAvatar(PRESETS[i]);s.add(a.group);a.pose('relaxed');cam.position.set(.055,a.headY+.01,1.75);cam.lookAt(0,a.headY-.035,0);r.render(s,cam);const img=$('#thumb-'+i);img.src=r.domElement.toDataURL('image/png');img.onload=()=>img.parentElement.classList.add('loaded');s.remove(a.group);a.dispose();await new Promise(resolve=>setTimeout(resolve,20));}r.dispose();}
setTimeout(()=>thumbnails().catch(e=>console.error('Thumbnail generation',e)),200);
// Small automation surface used for round-trip validation and reproducible asset generation.
window.avatarStudio={getConfig:()=>({...config}),setConfig:c=>apply(c),exportGLB,getStats:()=>({meshes:avatar.parts.length,bones:avatar.bones.map(b=>b.name),shapeKeys:avatar.facial[0]?.morphTargetDictionary}),presets:PRESETS,getClassroomStats:()=>classroom?{...classroom.getStats(),active:pageMode==='classroom',drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles}:null};
