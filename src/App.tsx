import {useEffect,useMemo,useRef,useState} from 'react';
import type {CSSProperties} from 'react';
import {exportMovie} from './exportMovie';
import {listProjects,saveProject as persistProject,loadProject,deleteProject,duplicateProject} from './draftStore';
import type {ProjectSummary} from './draftStore';
type Photo={id:string;name:string;url:string;duration:number;effect:'fade'|'zoom'|'slide'|'page'|'heart'|'curtain';frame?:string;decoration?:string;sticker?:string;caption?:string;zoom?:number;offsetX?:number;offsetY?:number;captionX?:number;captionY?:number;captionFont?:string;captionColor?:string;captionSize?:number;captionOutline?:boolean;captionOutlineColor?:string;captionBackground?:boolean;captionMotion?:'none'|'fade'|'rise'|'slide'};
type Theme='theater'|'album'|'sakura'|'sparkle';
const themes:{id:Theme;name:string;emoji:string;description:string}[]=[{id:'theater',name:'シアター',emoji:'🎭',description:'赤いカーテン'},{id:'album',name:'アルバム',emoji:'📖',description:'懐かしい思い出'},{id:'sakura',name:'さくら',emoji:'🌸',description:'卒園・卒業'},{id:'sparkle',name:'キラキラ',emoji:'✨',description:'誕生日・お祝い'}];
const id=()=>Math.random().toString(36).slice(2);
export default function App(){
const [photos,setPhotos]=useState<Photo[]>([]);
const [draftInfo,setDraftInfo]=useState('');
const [draftBusy,setDraftBusy]=useState(false);
const [projects,setProjects]=useState<ProjectSummary[]>([]);
const [projectId,setProjectId]=useState<string|null>(null);
const [thumbUrls,setThumbUrls]=useState<Record<string,string>>({});
const thumbRef=useRef<Record<string,string>>({});
async function refreshProjects(){const list=await listProjects();setProjects(list);Object.values(thumbRef.current).forEach(url=>URL.revokeObjectURL(url));const urls:Record<string,string>={};list.forEach(p=>{if(p.thumbnail)urls[p.id]=URL.createObjectURL(p.thumbnail)});thumbRef.current=urls;setThumbUrls(urls)}

const [theme,setTheme]=useState<Theme>('theater');
const [title,setTitle]=useState('大切な思い出');
const [ending,setEnding]=useState('ありがとう、たくさんの思い出');
const [frame,setFrame]=useState<'none'|'sakura'|'gold'|'soft'|'green'|'film'|'balloon'|'snow'|'sunflower'|'polaroid'|'album'>('none');
const [background,setBackground]=useState<'default'|'sky'|'sakura'|'stars'|'sunset'|'sparkle'|'rainbow'>('default');
const [decoration,setDecoration]=useState<'none'|'petals'|'glitter'|'bubbles'|'hearts'|'fireworks'|'snow'|'confetti'|'light'>('none');
const [sticker,setSticker]=useState('none');
const [curtainColor,setCurtainColor]=useState<'red'|'pink'|'navy'|'gold'>('red');
const [template,setTemplate]=useState('custom');
const [step,setStep]=useState<'home'|'theme'|'photos'|'edit'>('home');
const [selected,setSelected]=useState(0);
const [editTool,setEditTool]=useState<'frame'|'text'|'decor'|'sticker'|'transition'|'duration'|'position'|'apply'|null>(null);
const [undoStack,setUndoStack]=useState<Photo[][]>([]);
const [redoStack,setRedoStack]=useState<Photo[][]>([]);
const frameChoices=[['none','なし'],['sakura','🌸 さくら'],['green','🌿 グリーン'],['gold','✨ エレガント'],['polaroid','📷 ポラロイド'],['film','🎞️ フィルム'],['album','📒 アルバム'],['balloon','🎈 バルーン'],['soft','💗 ハート'],['snow','❄️ 雪'],['sunflower','🌻 ひまわり']];
const decorChoices=[['none','なし'],['petals','🌸 花びら'],['glitter','✨ キラキラ'],['bubbles','🫧 シャボン玉'],['hearts','💗 ハート'],['fireworks','🎆 花火'],['snow','❄️ 雪'],['confetti','🎉 紙吹雪'],['light','✦ 光の粒']];
const [mode,setMode]=useState<'photo'|'music'>('photo');
const [musicSeconds,setMusicSeconds]=useState(180);
const [duration,setDuration]=useState(5);
const [aspect,setAspect]=useState<'wide'|'vertical'>('wide');
const [playing,setPlaying]=useState(false);
const [playIndex,setPlayIndex]=useState(0);
const [phase,setPhase]=useState<'intro'|'photos'|'outro'>('intro');
const [sceneKey,setSceneKey]=useState(0);
const input=useRef<HTMLInputElement>(null);
const dragRef=useRef<{x:number;y:number;startX:number;startY:number;kind:'photo'|'caption';width:number;height:number}|null>(null);
function beginDrag(e:React.PointerEvent<HTMLElement>,kind:'photo'|'caption'){
 if(playing||!current)return;
 e.preventDefault();e.stopPropagation();
 const rect=e.currentTarget.closest('.previewFrame')?.getBoundingClientRect();
 if(!rect)return;
 dragRef.current={x:e.clientX,y:e.clientY,startX:kind==='photo'?(current.offsetX??0):(current.captionX??50),startY:kind==='photo'?(current.offsetY??0):(current.captionY??83),kind,width:rect.width,height:rect.height};
 e.currentTarget.setPointerCapture(e.pointerId);
}
function moveDrag(e:React.PointerEvent<HTMLElement>){
 const d=dragRef.current;if(!d||!current)return;
 const dx=(e.clientX-d.x)/d.width*100,dy=(e.clientY-d.y)/d.height*100;
 const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));
 if(d.kind==='photo')setPhotos(p=>p.map((x,i)=>i===selected?{...x,offsetX:clamp(d.startX+dx,-40,40),offsetY:clamp(d.startY+dy,-40,40)}:x));
 else setPhotos(p=>p.map((x,i)=>i===selected?{...x,captionX:clamp(d.startX+dx,5,95),captionY:clamp(d.startY+dy,8,92)}:x));
}
function endDrag(){const d=dragRef.current;if(!d)return;dragRef.current=null;setUndoStack(stack=>[...stack.slice(-19),photos.map((p,i)=>i===selected?{...p,...(d.kind==='photo'?{offsetX:d.startX,offsetY:d.startY}:{captionX:d.startX,captionY:d.startY})}:p)]);setRedoStack([])}

const musicInput=useRef<HTMLInputElement>(null);
const audioRef=useRef<HTMLAudioElement|null>(null);
const soundCtx=useRef<AudioContext|null>(null);
const synthTimer=useRef<number|null>(null);
const [bgm,setBgm]=useState<'none'|'gentle'|'bright'|'file'>('gentle');
const [audioFile,setAudioFile]=useState<{name:string;url:string;seconds:number}|null>(null);
const [volume,setVolume]=useState(65);
const [musicError,setMusicError]=useState('');
const [musicPlaying,setMusicPlaying]=useState(false);
const [exporting,setExporting]=useState(false);
const [exportProgress,setExportProgress]=useState(0);
const [exportError,setExportError]=useState('');
const [exportResult,setExportResult]=useState<{url:string;name:string;blob:Blob}|null>(null);
const exportUrl=useRef<string|null>(null);
useEffect(()=>()=>{if(exportUrl.current)URL.revokeObjectURL(exportUrl.current)},[]);
useEffect(()=>{void refreshProjects().catch(()=>setDraftInfo('保存作品を読み取れませんでした'))},[]);
useEffect(()=>()=>{Object.values(thumbRef.current).forEach(url=>URL.revokeObjectURL(url))},[]);
const photosRef=useRef<Photo[]>([]);
useEffect(()=>{photosRef.current=photos},[photos]);
useEffect(()=>()=>{photosRef.current.forEach(p=>URL.revokeObjectURL(p.url))},[]);
useEffect(()=>()=>{if(audioFile)URL.revokeObjectURL(audioFile.url)},[audioFile]);
useEffect(()=>{if(audioRef.current)audioRef.current.volume=volume/100},[volume]);
const intro=6,outro=6;
const computed=useMemo(()=>mode==='photo'?photos.map(p=>p.duration):photos.map(()=>Math.max(1,(musicSeconds-intro-outro)/Math.max(1,photos.length))),[photos,mode,musicSeconds]);
const total=intro+outro+computed.reduce((a,b)=>a+b,0);
useEffect(()=>{
if(!playing||photos.length===0)return;
const seconds=phase==='intro'?intro:phase==='outro'?outro:computed[playIndex];
const timer=window.setTimeout(()=>{
 if(phase==='intro'){setPhase('photos');setPlayIndex(0)}
 else if(phase==='photos'&&playIndex<photos.length-1){setPlayIndex(i=>i+1)}
 else if(phase==='photos'){setPhase('outro')}
 else{setPlaying(false);setPhase('intro');setPlayIndex(0)}
 setSceneKey(k=>k+1);
},seconds*1000);
return()=>window.clearTimeout(timer);
},[playing,phase,playIndex,photos.length,computed]);
function addPhotos(files:FileList|null){if(!files)return;const arr=[...files].filter(f=>f.type.startsWith('image/')).map(f=>({id:id(),name:f.name,url:URL.createObjectURL(f),duration,effect:'zoom' as const}));setPhotos(p=>[...p,...arr]);setStep('edit')}
function remove(i:number){setPhotos(p=>{const item=p[i];if(item)URL.revokeObjectURL(item.url);return p.filter((_,j)=>j!==i)});setSelected(0)}
function move(i:number,offset:number){const to=i+offset;if(to<0||to>=photos.length)return;setPhotos(p=>{const next=[...p];[next[i],next[to]]=[next[to],next[i]];return next});setSelected(to)}
function update(i:number,patch:Partial<Photo>){setPhotos(p=>{setUndoStack(stack=>[...stack.slice(-19),p]);setRedoStack([]);return p.map((v,j)=>j===i?{...v,...patch}:v)})}
function undo(){if(!undoStack.length)return;setRedoStack(x=>[...x,photos]);setPhotos(undoStack[undoStack.length-1]);setUndoStack(x=>x.slice(0,-1))}
function redo(){if(!redoStack.length)return;setUndoStack(x=>[...x,photos]);setPhotos(redoStack[redoStack.length-1]);setRedoStack(x=>x.slice(0,-1))}
function applyAll(){if(!current)return;setUndoStack(x=>[...x.slice(-19),photos]);setRedoStack([]);setPhotos(p=>p.map(x=>({...x,frame:current.frame,decoration:current.decoration,sticker:current.sticker,caption:current.caption,zoom:current.zoom,offsetX:current.offsetX,offsetY:current.offsetY,captionX:current.captionX,captionY:current.captionY,captionFont:current.captionFont,captionColor:current.captionColor,captionSize:current.captionSize,captionOutline:current.captionOutline,captionOutlineColor:current.captionOutlineColor,captionBackground:current.captionBackground,captionMotion:current.captionMotion,effect:current.effect,duration:current.duration})))}

const current=photos[selected];
const activePhoto=photos[playing?playIndex:selected];
const activeDuration=computed[playing?playIndex:selected]||duration;
const shownFrame=activePhoto?.frame??frame;
const shownDecor=activePhoto?.decoration??decoration;
const shownSticker=activePhoto?.sticker??sticker;
function applyTemplate(t:string){setTemplate(t);const presets:Record<string,{theme:Theme;frame:typeof frame;background:typeof background;decoration:typeof decoration;title:string;ending:string}>={graduation:{theme:'sakura',frame:'sakura',background:'sakura',decoration:'petals',title:'卒園おめでとう',ending:'たくさんの思い出をありがとう'},wedding:{theme:'sparkle',frame:'gold',background:'sparkle',decoration:'glitter',title:'Wedding Story',ending:'いつまでもお幸せに'},birthday:{theme:'sparkle',frame:'balloon',background:'rainbow',decoration:'confetti',title:'Happy Birthday',ending:'笑顔あふれる一年に'},travel:{theme:'album',frame:'polaroid',background:'sky',decoration:'bubbles',title:'旅の思い出',ending:'また一緒に旅しよう'},growth:{theme:'album',frame:'soft',background:'rainbow',decoration:'hearts',title:'成長の記録',ending:'これからも元気に大きくなってね'},theater:{theme:'theater',frame:'film',background:'stars',decoration:'light',title:'大切な思い出',ending:'Fin.'}};const p=presets[t];if(p){setTheme(p.theme);setFrame(p.frame);setBackground(p.background);setDecoration(p.decoration);setTitle(p.title);setEnding(p.ending)}}
const symbols:Record<string,string>={bear:'🧸',rabbit:'🐰',camera:'📷',clapper:'🎬',bouquet:'💐',crown:'👑',graduation:'🎓',diploma:'📜',cake:'🎂',gift:'🎁',balloons:'🎈',rainbow:'🌈',star:'⭐',heart:'💗',music:'🎵',treble:'🎼',sparkles:'✨'};

function stopMusic(){
 if(audioRef.current){audioRef.current.pause();audioRef.current.currentTime=0;audioRef.current=null}
 if(synthTimer.current!==null){window.clearInterval(synthTimer.current);synthTimer.current=null}
 if(soundCtx.current){void soundCtx.current.close();soundCtx.current=null}
 setMusicPlaying(false);
}
function playMusic(){
 stopMusic();setMusicError('');
 if(bgm==='none')return;
 if(bgm==='file'){
  if(!audioFile){setMusicError('先に音楽ファイルを選んでください');return}
  const audio=new Audio(audioFile.url);audio.loop=true;audio.volume=volume/100;audioRef.current=audio;
  void audio.play().then(()=>setMusicPlaying(true)).catch(()=>{setMusicError('この音声は再生できません。別のファイルをお試しください');setMusicPlaying(false)});
  return;
 }
 try{
  const ctx=new AudioContext();soundCtx.current=ctx;void ctx.resume();
  const gentle=[261.63,329.63,392,523.25,392,329.63,293.66,349.23];
  const bright=[392,493.88,587.33,783.99,659.25,587.33,493.88,523.25];
  const notes=bgm==='gentle'?gentle:bright;
  let index=0;
  const note=()=>{if(ctx.state==='closed')return;const osc=ctx.createOscillator(),gain=ctx.createGain();
   osc.type=bgm==='gentle'?'sine':'triangle';osc.frequency.value=notes[index++%notes.length];
   const t=ctx.currentTime;gain.gain.setValueAtTime(0.0001,t);gain.gain.exponentialRampToValueAtTime(Math.max(.0001,volume/100*.09),t+.12);gain.gain.exponentialRampToValueAtTime(.0001,t+1.1);
   osc.connect(gain);gain.connect(ctx.destination);osc.start(t);osc.stop(t+1.12);
  };note();synthTimer.current=window.setInterval(note,bgm==='gentle'?1300:850);setMusicPlaying(true);
 }catch{setMusicError('この端末ではBGMを再生できません')}
}
function startPreview(){
 if(!photos.length)return;
 if(playing){setPlaying(false);setPhase('intro');stopMusic()}
 else{setPlayIndex(0);setPhase(theme==='theater'?'intro':'photos');setPlaying(true);playMusic()}
 setSceneKey(k=>k+1)
}
async function saveProject(){
 if(!photos.length||draftBusy)return;setDraftBusy(true);setDraftInfo('保存中…');
 try{
  const items=await Promise.all(photos.map(async p=>({meta:{...p,url:undefined},blob:await fetch(p.url).then(r=>r.blob())})));
  const audio=audioFile?{name:audioFile.name,seconds:audioFile.seconds,blob:await fetch(audioFile.url).then(r=>r.blob())}:undefined;
  const savedAt=new Date().toISOString();
  const targetId=projectId??id();
  await persistProject(targetId,{version:1,savedAt,photos:items,audio,settings:{theme,title,ending,frame,background,decoration,sticker,curtainColor,template,mode,musicSeconds,duration,aspect,bgm,volume}});
  setProjectId(targetId);await refreshProjects();setDraftInfo('保存しました：'+new Date(savedAt).toLocaleString('ja-JP'));
 }catch(e){setDraftInfo('保存できませんでした。端末の空き容量やプライベートブラウズ設定をご確認ください。'+(e instanceof Error?' '+e.message:''))}
 finally{setDraftBusy(false)}
}
async function restoreProject(targetId:string){
 if(draftBusy)return;setDraftBusy(true);setDraftInfo('読み込み中…');
 try{
  const draft=await loadProject(targetId);if(!draft){setDraftInfo('保存された作品がありません');return}
  const next=draft.photos.map(p=>({...p.meta,url:URL.createObjectURL(p.blob)} as Photo));
  photosRef.current.forEach(p=>URL.revokeObjectURL(p.url));setPhotos(next);setSelected(0);setUndoStack([]);setRedoStack([]);setPlaying(false);
  const v=draft.settings;
  setTheme(v.theme as Theme);setTitle(v.title as string);setEnding(v.ending as string);setFrame(v.frame as typeof frame);setBackground(v.background as typeof background);setDecoration(v.decoration as typeof decoration);setSticker(v.sticker as string);setCurtainColor(v.curtainColor as typeof curtainColor);setTemplate(v.template as string);setMode(v.mode as typeof mode);setMusicSeconds(v.musicSeconds as number);setDuration(v.duration as number);setAspect(v.aspect as typeof aspect);setBgm(v.bgm as typeof bgm);setVolume(v.volume as number);
  if(draft.audio){setAudioFile({name:draft.audio.name,seconds:draft.audio.seconds,url:URL.createObjectURL(draft.audio.blob)})}else setAudioFile(null);
  setProjectId(targetId);setStep('edit');setDraftInfo('保存した作品を開きました');
 }catch(e){setDraftInfo('読み込めませんでした。'+(e instanceof Error?' '+e.message:''))}
 finally{setDraftBusy(false)}
}
async function eraseProject(targetId:string){
 if(!window.confirm('この作品の保存データを削除しますか？'))return;
 try{await deleteProject(targetId);if(projectId===targetId)setProjectId(null);await refreshProjects();setDraftInfo('作品を削除しました')}catch{setDraftInfo('削除できませんでした')}
}
async function copyProject(targetId:string){
 try{await duplicateProject(targetId,id());await refreshProjects();setDraftInfo('作品を複製しました')}catch{setDraftInfo('複製できませんでした')}
}
function newProject(){setPlaying(false);stopMusic();setPhotos([]);setProjectId(null);setSelected(0);setUndoStack([]);setRedoStack([]);setAudioFile(null);setTitle('大切な思い出');setEnding('ありがとう、たくさんの思い出');setStep('theme');setDraftInfo('')}

async function makeMovie(){
 if(!photos.length||exporting)return;
 setPlaying(false);stopMusic();setExportError('');setExportProgress(0);setExporting(true);
 try{
  const {blob,extension}=await exportMovie({photos:photos.map(p=>({...p,frame:p.frame??frame,decoration:p.decoration??decoration,sticker:p.sticker??sticker})),durations:computed,title,ending,frame,background,decoration,sticker,curtainColor,theme,aspect,bgm,audioUrl:audioFile?.url,volume,onProgress:setExportProgress});
  if(exportUrl.current)URL.revokeObjectURL(exportUrl.current);
  const url=URL.createObjectURL(blob);exportUrl.current=url;
  setExportResult({url,name:'omoide-theater.'+extension,blob});
 }catch(e){setExportError(e instanceof Error?e.message:'動画を書き出せませんでした')}
 finally{setExporting(false)}
}
async function shareMovie(){
 if(!exportResult)return;
 const file=new File([exportResult.blob],exportResult.name,{type:exportResult.blob.type});
 try{if(navigator.canShare?.({files:[file]})&&navigator.share){await navigator.share({files:[file],title:'おもいでシアター'});return}}catch(e){if(e instanceof Error&&e.name==='AbortError')return}
 const link=document.createElement('a');link.href=exportResult.url;link.download=exportResult.name;link.click();
}
function importMusic(files:FileList|null){
 const file=files?.[0];if(!file)return;
 if(!file.type.startsWith('audio/')&&!/\\.(mp3|m4a|wav|aac|ogg)$/i.test(file.name)){setMusicError('音声ファイルを選んでください');return}
 stopMusic();setMusicError('');
 const url=URL.createObjectURL(file);
 const probe=new Audio();probe.preload='metadata';probe.src=url;
 probe.onloadedmetadata=()=>{const seconds=Number.isFinite(probe.duration)?Math.round(probe.duration):0;setAudioFile({name:file.name,url,seconds});setBgm('file');if(seconds>12)setMusicSeconds(seconds)};
 probe.onerror=()=>{URL.revokeObjectURL(url);setMusicError('音楽ファイルを読み取れませんでした')};
}
useEffect(()=>{if(!playing)stopMusic()},[playing]);


return <main><header><div className="brand">✦ おもいでシアター</div><div className="subtitle">写真が、一本の映画になる。</div></header>
{step==='home'?<section className="panel hero"><div className="stage">🎬<h1>思い出を映画に</h1><p>写真を選ぶだけで、自分だけのムービーを。</p></div><button className="primary" onClick={newProject}>＋ 新しいムービーを作る</button>{projects.length>0?<div className="draftBox"><h3>📁 保存した作品（{projects.length}件）</h3><div className="projectList">{projects.map(p=><div className="projectCard" key={p.id}>{thumbUrls[p.id]?<img src={thumbUrls[p.id]} alt="作品の表紙"/>:<div className="projectFallback">🎬</div>}<div className="projectDetail"><strong>{p.title}</strong><small>{p.photoCount}枚 · {new Date(p.savedAt).toLocaleString('ja-JP')}</small><div className="projectButtons"><button onClick={()=>restoreProject(p.id)} disabled={draftBusy}>編集する</button><button onClick={()=>copyProject(p.id)} disabled={draftBusy}>複製</button><button onClick={()=>eraseProject(p.id)} disabled={draftBusy}>削除</button></div></div></div>)}</div></div>:null}{draftInfo?<p className="note" role="status">{draftInfo}</p>:null}<p className="note">試作版です。BGMの試聴に対応しました。動画の書き出しは試験機能として追加しました。</p></section>:null}
{step==='theme'?<section className="panel"><h2>① テーマを選ぶ</h2><div className="themeGrid">{themes.map(t=><button key={t.id} className={'theme '+(theme===t.id?'active':'')} onClick={()=>setTheme(t.id)}><span>{t.emoji}</span><strong>{t.name}</strong><small>{t.description}</small></button>)}</div><label>ムービーのタイトル<input value={title} onChange={e=>setTitle(e.target.value)} /></label><label>画面の向き<select value={aspect} onChange={e=>setAspect(e.target.value as typeof aspect)}><option value="wide">横型（16:9）</option><option value="vertical">縦型（9:16）</option></select></label><button className="primary" onClick={()=>setStep('photos')}>次へ：写真を選ぶ</button></section>:null}
{step==='photos'?<section className="panel"><h2>② 写真を選ぶ</h2><p>iPhoneの写真からまとめて選べます。</p><button className="primary" onClick={()=>input.current?.click()}>写真を追加する</button><button className="secondary" onClick={()=>setStep('theme')}>戻る</button></section>:null}
{step==='edit'?<section className="panel"><div className="draftBox"><h3>💾 途中保存</h3><p className="note">写真・編集設定・読み込んだ音楽をこのiPhoneのブラウザ内に作品ごとに保存します。</p><div className="actions"><button onClick={saveProject} disabled={draftBusy}>{draftBusy?'処理中…':'途中保存する'}</button>{projectId?<button onClick={()=>restoreProject(projectId)} disabled={draftBusy}>保存した状態に戻す</button>:null}</div>{draftInfo?<p className="note" role="status">{draftInfo}</p>:null}</div><div className="sectionHeading"><h2>③ ムービー編集</h2><button className="small" onClick={()=>setStep('theme')}>テーマ変更</button></div><div className={'preview '+aspect}><div className={'previewFrame '+theme+' backdrop-'+background}>
{activePhoto?<div key={sceneKey+'-'+(activePhoto?.id||'')} onPointerDown={e=>{if(editTool==='position')beginDrag(e,'photo')}} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} className={'scenePhoto '+(playing&&phase==='photos'?'animate '+activePhoto.effect:'')+(editTool==='position'?' draggablePhoto':'')} style={{'--scene-duration':activeDuration+'s'} as CSSProperties}><img src={activePhoto.url} alt="選択中の写真" style={{transform:'scale('+(activePhoto.zoom??1)+') translate('+(activePhoto.offsetX??0)+'%,'+(activePhoto.offsetY??0)+'%)'}} /></div>:<span>写真を追加してください</span>}
{playing&&phase==='intro'&&theme==='theater'?<div key={'curtain-'+sceneKey} className={'curtainOverlay curtain-'+curtainColor}><div className="curtainPanel curtainLeft"/><div className="curtainPanel curtainRight"/><div className="curtainCaption">{title}</div></div>:null}
{playing&&phase==='outro'?<div className="endingScreen"><div>Fin.</div><small>{ending||title}</small></div>:null}
{shownDecor!=='none'&&(!playing||phase==='photos')?<div className={'motionDecor decor-'+shownDecor} aria-hidden="true">{Array.from({length:12},(_,i)=><span key={i} style={{left:(i*37%95)+'%',animationDelay:-(i*.47)+'s'}}>{shownDecor==='petals'?'🌸':shownDecor==='glitter'||shownDecor==='light'?'✦':shownDecor==='bubbles'?'◯':shownDecor==='hearts'?'♥':shownDecor==='fireworks'?'✺':shownDecor==='snow'?'❄':'◆'}</span>)}</div>:null}
{shownSticker!=='none'?<div className="previewSticker" aria-hidden="true">{symbols[shownSticker]}</div>:null}
{shownFrame!=='none'&&!(playing&&phase==='intro'&&theme==='theater')?<div className={'photoDecoration '+shownFrame} aria-hidden="true">{shownFrame==='sakura'?'🌸　🌸':shownFrame==='gold'?'✦　✦':shownFrame==='green'?'🌿　🌿':shownFrame==='film'?'▣　▣':shownFrame==='balloon'?'🎈　🎈':shownFrame==='snow'?'❄　❄':shownFrame==='sunflower'?'🌻　🌻':shownFrame==='polaroid'?'▧　▧':shownFrame==='album'?'📒　📒':'♡　♡'}</div>:null}
{activePhoto?.caption&&(!playing||phase==='photos')?<div key={activePhoto.id+'-'+sceneKey} className={'photoCaption '+(editTool==='text'?'draggableCaption':'')+(playing&&phase==='photos'?' captionMotion-'+(activePhoto.captionMotion??'none'):'')} style={{left:(activePhoto.captionX??50)+'%',top:(activePhoto.captionY??83)+'%',bottom:'auto',right:'auto',fontFamily:activePhoto.captionFont==='cursive'?'Yomogi, cursive':activePhoto.captionFont??'sans-serif',color:activePhoto.captionColor??'#ffffff',fontSize:(activePhoto.captionSize??22)+'px',textShadow:'none',background:activePhoto.captionBackground?'rgba(0,0,0,.58)':'transparent'}} onPointerDown={e=>{if(editTool==='text')beginDrag(e,'caption')}} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>{activePhoto.captionOutline?<span aria-hidden="true" className="captionOutlineLayer" style={{WebkitTextStroke:'1px '+(activePhoto.captionOutlineColor??'#222222')}}>{activePhoto.caption}</span>:null}<span className="captionFillLayer">{activePhoto.caption}</span></div>:null}
{!playing||phase==='intro'?<div className="previewTitle">{title}</div>:null}
</div></div><div className="actions"><button onClick={startPreview}>{playing?'■ 停止':'▶ 演出付きプレビュー'}</button><button onClick={()=>input.current?.click()}>＋ 写真追加</button></div><p className="note">カーテン・写真のフェード／ズーム／スライドを画面で確認できます。BGMは試聴用です。動画の書き出しは下の試験機能で確認できます。</p><h3>写真の並び順</h3><div className="strip">{photos.map((p,i)=><button key={p.id} className={'thumb '+(selected===i?'selected':'')} onClick={()=>{setSelected(i);setPlaying(false);setPhase('intro');setSceneKey(k=>k+1)}}><img src={p.url} alt={p.name}/><span>{i+1}</span></button>)}</div>{current&&<div className="editor"><h3>選択中の写真：{selected+1}枚目</h3><div className="photoToolGrid">{([['frame','▣','フレーム'],['text','T','文字'],['decor','✧','装飾'],['sticker','☺','スタンプ'],['transition','⇄','切り替え'],['duration','◷','表示時間'],['position','⛶','拡大・移動'],['apply','▢','一括適用']] as const).map(([key,icon,label])=><button key={key} className={editTool===key?'chosen':''} onClick={()=>setEditTool(editTool===key?null:key)}><span>{icon}</span><small>{label}</small></button>)}</div>
{editTool?<div className="photoToolPanel">
{editTool==='frame'?<label>この写真のフレーム<select value={current.frame??frame} onChange={e=>update(selected,{frame:e.target.value})}>{frameChoices.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>:null}
{editTool==='text'?<div className="captionControls"><label>写真に表示する文字（プレビューで移動できます）<input value={current.caption??''} onChange={e=>update(selected,{caption:e.target.value})} placeholder="例：みんなと過ごした毎日"/></label><label>フォント<select value={current.captionFont??'sans-serif'} onChange={e=>update(selected,{captionFont:e.target.value})}><option value="sans-serif">ゴシック</option><option value="serif">明朝</option><option value="Yomogi, cursive">手書き風（やわらか）</option><option value="Zen Kurenaido, cursive">手書き風（すっきり）</option><option value="monospace">タイプライター</option></select></label><label>文字色<input type="color" value={current.captionColor??'#ffffff'} onChange={e=>update(selected,{captionColor:e.target.value})}/></label><label>文字サイズ：{current.captionSize??22}px<input type="range" min="12" max="52" value={current.captionSize??22} onChange={e=>update(selected,{captionSize:Number(e.target.value)})}/></label><label className="inlineOption"><input type="checkbox" checked={current.captionOutline??false} onChange={e=>update(selected,{captionOutline:e.target.checked})}/> 文字に縁取りを付ける</label>{current.captionOutline?<label>縁取りの色<input type="color" value={current.captionOutlineColor??'#222222'} onChange={e=>update(selected,{captionOutlineColor:e.target.value})}/></label>:null}<label className="inlineOption"><input type="checkbox" checked={current.captionBackground??false} onChange={e=>update(selected,{captionBackground:e.target.checked})}/> 文字の後ろに半透明の背景</label><label>文字の登場演出<select value={current.captionMotion??'none'} onChange={e=>update(selected,{captionMotion:e.target.value as Photo['captionMotion']})}><option value="none">なし</option><option value="fade">ふわっと現れる</option><option value="rise">下から現れる</option><option value="slide">横から流れる</option></select></label></div>:null}
{editTool==='decor'?<label>この写真の装飾<select value={current.decoration??decoration} onChange={e=>update(selected,{decoration:e.target.value})}>{decorChoices.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>:null}
{editTool==='sticker'?<label>この写真のスタンプ<select value={current.sticker??sticker} onChange={e=>update(selected,{sticker:e.target.value})}><option value="none">なし</option>{Object.entries(symbols).map(([key,value])=><option key={key} value={key}>{value} {key}</option>)}</select></label>:null}
{editTool==='transition'?<label>切り替え<select value={current.effect} onChange={e=>update(selected,{effect:e.target.value as Photo['effect']})}><option value="zoom">ゆっくりズーム</option><option value="fade">フェード</option><option value="slide">スライド</option><option value="page">ページめくり</option><option value="heart">ハート</option><option value="curtain">カーテン</option></select></label>:null}
{editTool==='duration'?<label>表示時間：{current.duration}秒<input type="range" min="2" max="15" value={current.duration} onChange={e=>update(selected,{duration:Number(e.target.value)})}/>{mode==='music'?<small>音楽の長さ基準では個別の秒数は反映されません</small>:null}</label>:null}
{editTool==='position'?<><p className="note">プレビューの写真を指で動かせます。下のスライダーでも調整できます。</p><label>拡大：{Math.round((current.zoom??1)*100)}%<input type="range" min="1" max="1.8" step=".05" value={current.zoom??1} onChange={e=>update(selected,{zoom:Number(e.target.value)})}/></label><label>左右位置<input type="range" min="-40" max="40" value={current.offsetX??0} onChange={e=>update(selected,{offsetX:Number(e.target.value)})}/></label><label>上下位置<input type="range" min="-40" max="40" value={current.offsetY??0} onChange={e=>update(selected,{offsetY:Number(e.target.value)})}/></label></>:null}
{editTool==='apply'?<><p className="note">選択中の写真の設定を全写真にコピーします。</p><button onClick={applyAll}>全写真に適用する</button></>:null}
</div>:null}
<div className="actions"><button disabled={!undoStack.length} onClick={undo}>↶ 取り消し</button><button disabled={!redoStack.length} onClick={redo}>↷ やり直し</button></div>
<div className="actions"><button disabled={selected===0} onClick={()=>move(selected,-1)}>← 前へ</button><button disabled={selected===photos.length-1} onClick={()=>move(selected,1)}>後ろへ →</button><button className="danger" onClick={()=>remove(selected)}>削除</button></div><label>演出<select value={current.effect} onChange={e=>update(selected,{effect:e.target.value as Photo['effect']})}><option value="zoom">ゆっくりズーム</option><option value="fade">フェード</option><option value="slide">スライド</option><option value="page">ページめくり</option><option value="heart">ハート</option><option value="curtain">カーテン</option></select></label>{mode==='photo'&&<label>表示時間：{current.duration}秒<input type="range" min="2" max="15" value={current.duration} onChange={e=>update(selected,{duration:Number(e.target.value)})}/></label>}</div>}<section className="designBox"><h3>🌸 写真の飾り・エンディング</h3>
<label>用途別テンプレート<select value={template} onChange={e=>applyTemplate(e.target.value)}>
<option value="custom">自分で組み合わせる</option><option value="graduation">🌸 卒園・入学</option><option value="wedding">💍 ウェディング</option><option value="birthday">🎂 誕生日</option><option value="travel">🏝️ 旅行</option><option value="growth">👣 成長記録</option><option value="theater">🎬 シアター</option></select></label>
<label>カーテンの色<select value={curtainColor} onChange={e=>setCurtainColor(e.target.value as typeof curtainColor)}><option value="red">クラシック（赤）</option><option value="pink">パステル（ピンク）</option><option value="navy">ナイト（紺）</option><option value="gold">ゴールド</option></select></label>
<label>背景<select value={background} onChange={e=>setBackground(e.target.value as typeof background)}><option value="default">テーマ標準</option><option value="sky">青空</option><option value="sakura">さくら</option><option value="stars">星空</option><option value="sunset">夕焼け</option><option value="sparkle">キラキラ</option><option value="rainbow">虹と雲</option></select></label>
<label>写真フレーム<select value={frame} onChange={e=>setFrame(e.target.value as typeof frame)}>
<option value="none">フレームなし</option><option value="sakura">さくら</option><option value="green">グリーン</option><option value="gold">エレガント</option><option value="polaroid">ポラロイド</option><option value="film">フィルム</option><option value="album">アルバム風</option><option value="balloon">バルーン</option><option value="soft">ハート</option><option value="snow">雪</option><option value="sunflower">ひまわり</option></select></label>
<label>動く装飾<select value={decoration} onChange={e=>setDecoration(e.target.value as typeof decoration)}><option value="none">なし</option><option value="petals">花びら</option><option value="glitter">キラキラ</option><option value="bubbles">シャボン玉</option><option value="hearts">ハート</option><option value="fireworks">花火</option><option value="snow">雪</option><option value="confetti">紙吹雪</option><option value="light">光の粒</option></select></label>
<label>スタンプ<select value={sticker} onChange={e=>setSticker(e.target.value)}><option value="none">なし</option>{Object.entries(symbols).map(([key,value])=><option key={key} value={key}>{value} {key}</option>)}</select></label>
<label>最後に表示するメッセージ<textarea rows={2} maxLength={70} value={ending} onChange={e=>setEnding(e.target.value)} placeholder="ありがとう、たくさんの思い出"/></label>
<p className="note">テンプレートは後から個別に変更できます。装飾・スタンプは全写真に適用されます。</p>
</section><section className="musicBox"><h3>🎵 BGMを選ぶ</h3>
<label>音楽の種類<select value={bgm} onChange={e=>{stopMusic();setBgm(e.target.value as typeof bgm)}}>
<option value="gentle">やさしい音色（試作用オリジナル音）</option>
<option value="bright">明るい音色（試作用オリジナル音）</option>
<option value="file">自分の音楽ファイル</option>
<option value="none">音楽なし</option></select></label>
<div className="actions"><button onClick={()=>musicInput.current?.click()}>＋ 音楽ファイルを選ぶ</button><button disabled={bgm==='none'||(bgm==='file'&&!audioFile)} onClick={()=>musicPlaying?stopMusic():playMusic()}>{musicPlaying?'■ BGM停止':'♪ BGMを試聴'}</button></div>
{audioFile?<p className="note">読み込み済み：{audioFile.name}（{audioFile.seconds||'不明'}秒）</p>:null}
<label>BGM音量：{volume}%<input type="range" min="0" max="100" step="5" value={volume} onChange={e=>setVolume(Number(e.target.value))}/></label>
{musicError?<p className="musicError" role="alert">{musicError}</p>:null}
<p className="note">アプリ内の音は動作確認用の簡易音源です。正式なBGM曲は後から追加します。Apple Musicなど保護された配信曲は取り込めません。</p>
</section><h3>ムービーの長さ</h3><div className="mode"><label><input type="radio" checked={mode==='photo'} onChange={()=>setMode('photo')}/> 写真の表示時間を基準</label><label><input type="radio" checked={mode==='music'} onChange={()=>setMode('music')}/> 音楽の長さを基準</label></div>{mode==='photo'?<label>新しく追加する写真の初期表示時間：{duration}秒<input type="range" min="2" max="15" value={duration} onChange={e=>setDuration(Number(e.target.value))}/><button className="small" onClick={()=>setPhotos(p=>p.map(x=>({...x,duration})))}>全写真に適用</button></label>:<label>音楽の使用時間（秒）<input type="number" min="15" max="3600" value={musicSeconds} onChange={e=>setMusicSeconds(Math.max(15,Number(e.target.value)||15))}/></label>}<div className="summary">完成予定時間：約 {Math.floor(total/60)}分{Math.round(total%60)}秒（前後の演出各6秒を含む）</div><label>タイトル<input value={title} onChange={e=>setTitle(e.target.value)}/></label><section className="exportBox"><h3>🎬 動画を書き出す（試験機能）</h3>
<p className="note">iPhoneのブラウザによっては動画の記録に対応していません。対応している場合はBGMと演出を含めた動画を作成します。作成には動画の長さと同じ程度の時間がかかります。</p>
<button className="primary" disabled={exporting||!photos.length} onClick={makeMovie}>{exporting?'動画を作成中… '+exportProgress+'%':'動画を作成する'}</button>
{exporting?<progress max="100" value={exportProgress} style={{width:'100%'}}/>:null}
{exportError?<p className="musicError" role="alert">{exportError}</p>:null}
{exportResult?<div><p>動画ができました（{exportResult.name}）</p><video src={exportResult.url} controls playsInline style={{width:'100%',maxHeight:320,background:'#211629'}}/><div className="actions"><button onClick={shareMovie}>共有・保存する</button><a className="downloadLink" href={exportResult.url} download={exportResult.name}>ファイルをダウンロード</a></div><p className="note">共有メニューから「ビデオを保存」が選べる場合は写真アプリに保存できます。対応形式は端末によって異なります。</p></div>:null}
</section><button className="secondary" onClick={()=>setStep('home')}>ホームに戻る</button></section>:null}
<input ref={musicInput} type="file" accept="audio/*,.mp3,.m4a,.wav,.aac" hidden onChange={e=>{importMusic(e.target.files);e.target.value=''}}/>
<input ref={input} type="file" accept="image/*" multiple hidden onChange={e=>{addPhotos(e.target.files);e.target.value=''}}/>
<footer>おもいでシアター · 試作版 v1.6</footer></main>
}