import {useEffect,useMemo,useRef,useState} from 'react';
import type {CSSProperties} from 'react';
import {exportMovie} from './exportMovie';
import {listProjects,saveProject as persistProject,loadProject,deleteProject,duplicateProject} from './draftStore';
import type {ProjectSummary} from './draftStore';
type SubtitleCue={id:string;text:string;start:number;end:number};
type MusicSwitch={id:string;name:string;url:string;seconds:number;start:number;anchor:'time'|'photo';photoId?:string;offset:number;volume:number;fade:number};
type Photo={subtitles?:SubtitleCue[];subtitleColor?:string;subtitleSize?:number;subtitleOutline?:string;trimStart?:number;sourceDuration?:number;keepAudio?:boolean;kind?:'image'|'video';id:string;name:string;url:string;duration:number;effect:'fade'|'zoom'|'slide'|'page'|'heart'|'curtain'|'none'|'wipe'|'slideUp'|'circle'|'blinds'|'flash'|'blur'|'mosaic'|'random';frame?:string;decoration?:string;sticker?:string;caption?:string;zoom?:number;offsetX?:number;offsetY?:number;captionX?:number;captionY?:number;captionFont?:string;captionColor?:string;captionSize?:number;captionWeight?:number;captionOutline?:boolean;captionOutlineColor?:string;captionBackground?:boolean;captionMotion?:'none'|'fade'|'rise'|'slide'};
type Theme='theater'|'album'|'sakura'|'sparkle';
const themes:{id:Theme;name:string;emoji:string;description:string}[]=[{id:'theater',name:'シアター',emoji:'🎭',description:'赤いカーテン'},{id:'album',name:'アルバム',emoji:'📖',description:'懐かしい思い出'},{id:'sakura',name:'さくら',emoji:'🌸',description:'卒園・卒業'},{id:'sparkle',name:'キラキラ',emoji:'✨',description:'誕生日・お祝い'}];
const id=()=>Math.random().toString(36).slice(2);
function VideoThumbnail({url,name}:{url:string;name:string}){
 const [poster,setPoster]=useState<string|null>(null);
 const videoRef=useRef<HTMLVideoElement>(null);
 useEffect(()=>{setPoster(null)},[url]);
 function capture(){
  const v=videoRef.current;if(!v||v.videoWidth===0||v.videoHeight===0)return;
  try{
   const canvas=document.createElement('canvas');
   const ratio=Math.min(1,320/Math.max(v.videoWidth,v.videoHeight));
   canvas.width=Math.max(1,Math.round(v.videoWidth*ratio));canvas.height=Math.max(1,Math.round(v.videoHeight*ratio));
   const ctx=canvas.getContext('2d');if(!ctx)return;
   ctx.drawImage(v,0,0,canvas.width,canvas.height);
   const image=ctx.getImageData(0,0,Math.min(8,canvas.width),Math.min(8,canvas.height)).data;
   if(!image.some((value,i)=>i%4!==3&&value>18))return;
   setPoster(canvas.toDataURL('image/jpeg',.8));
   v.pause();
  }catch{ /* The visible video remains the fallback on iOS. */ }
 }
 function beginPreview(v:HTMLVideoElement){
  if(poster)return;
  void v.play().catch(()=>{ /* iOS may require a tap; the loaded video frame remains visible. */ });
 }
 return <div className="videoThumb">
  {poster?<img src={poster} alt={name+'のサムネイル'}/>:<video ref={videoRef} src={url} muted playsInline autoPlay loop preload="auto" onLoadedData={e=>beginPreview(e.currentTarget)} onTimeUpdate={e=>{if(e.currentTarget.currentTime>.12)capture()}} onPlaying={e=>{if(e.currentTarget.currentTime>.12)capture()}} aria-label={name+'の動画プレビュー'}/>}
  <span className="videoThumbPlay" aria-hidden="true">▶</span>
 </div>
}
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
const [opening,setOpening]=useState<'curtain'|'sparkle'|'sakura'|'album'|'countdown'|'rainbow'|'fade'|'gold_light'|'floral_wedding'|'sakura_tunnel'|'balloon_party'|'starry_story'|'retro_cinema'>('curtain');
const [template,setTemplate]=useState('custom');
const [step,setStep]=useState<'home'|'edit'>('home');
const [selected,setSelected]=useState(0);
const [frameScope,setFrameScope]=useState<'one'|'all'|'chosen'>('one');
const [frameTargets,setFrameTargets]=useState<string[]>([]);
const [transitionScope,setTransitionScope]=useState<'one'|'all'|'chosen'>('one');
const [transitionTargets,setTransitionTargets]=useState<string[]>([]);
const [transitionChoice,setTransitionChoice]=useState<Photo['effect']>('fade');
const [editPage,setEditPage]=useState<'opening'|'main'|'ending'|'finish'>('opening');
const [editTool,setEditTool]=useState<'frame'|'text'|'decor'|'sticker'|'transition'|'duration'|'position'|'apply'|'subtitles'|null>(null);
const [undoStack,setUndoStack]=useState<Photo[][]>([]);
const [redoStack,setRedoStack]=useState<Photo[][]>([]);
const frameChoices=[['none','なし'],['album','アルバム風（桜）']];
const decorChoices=[['none','なし'],['petals','🌸 花びら'],['glitter','✨ キラキラ'],['bubbles','🫧 シャボン玉'],['hearts','💗 ハート'],['fireworks','🎆 花火'],['snow','❄️ 雪'],['confetti','🎉 紙吹雪'],['light','✦ 光の粒']];
const [mode,setMode]=useState<'photo'|'music'>('photo');
const [musicSeconds,setMusicSeconds]=useState(180);
const [duration,setDuration]=useState(5);
const [aspect,setAspect]=useState<'wide'|'vertical'|'square'>('wide');
const [playing,setPlaying]=useState(false);
const [playIndex,setPlayIndex]=useState(0);
const [phase,setPhase]=useState<'intro'|'photos'|'outro'>('intro');
const [sceneKey,setSceneKey]=useState(0);
const [subtitleTime,setSubtitleTime]=useState(0);
const input=useRef<HTMLInputElement>(null);
const videoInput=useRef<HTMLInputElement>(null);
const previewVideo=useRef<HTMLVideoElement|null>(null);
const dragRef=useRef<{x:number;y:number;startX:number;startY:number;kind:'photo'|'caption';width:number;height:number}|null>(null);
const touchesRef=useRef<Map<number,{x:number;y:number}>>(new Map());
const pinchRef=useRef<{distance:number;zoom:number}|null>(null);
const gestureStartRef=useRef<Photo[]|null>(null);
function beginDrag(e:React.PointerEvent<HTMLElement>,kind:'photo'|'caption'){
 if(playing||!current)return;
 e.preventDefault();e.stopPropagation();
 const rect=e.currentTarget.closest('.previewFrame')?.getBoundingClientRect();
 if(!rect)return;
 if(!gestureStartRef.current)gestureStartRef.current=photos;
 touchesRef.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(touchesRef.current.size===1){
  dragRef.current={x:e.clientX,y:e.clientY,startX:kind==='photo'?(current.offsetX??0):(current.captionX??50),startY:kind==='photo'?(current.offsetY??0):(current.captionY??83),kind,width:rect.width,height:rect.height};
 }else if(kind==='photo'&&touchesRef.current.size===2){
  const [a,b]=Array.from(touchesRef.current.values());
  pinchRef.current={distance:Math.hypot(a.x-b.x,a.y-b.y),zoom:current.zoom??1};
  dragRef.current=null;
 }
 e.currentTarget.setPointerCapture(e.pointerId);
}
function moveDrag(e:React.PointerEvent<HTMLElement>){
 if(!touchesRef.current.has(e.pointerId)||!current)return;
 touchesRef.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
 const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));
 if(touchesRef.current.size===2&&pinchRef.current){
  const [a,b]=Array.from(touchesRef.current.values());
  const distance=Math.hypot(a.x-b.x,a.y-b.y);
  const zoom=clamp(pinchRef.current.zoom*distance/Math.max(1,pinchRef.current.distance),1,3);
  setPhotos(p=>p.map((x,i)=>i===selected?{...x,zoom}:x));
  return;
 }
 const d=dragRef.current;if(!d)return;
 const dx=(e.clientX-d.x)/d.width*100,dy=(e.clientY-d.y)/d.height*100;
 if(d.kind==='photo')setPhotos(p=>p.map((x,i)=>i===selected?{...x,offsetX:clamp(d.startX+dx,-60,60),offsetY:clamp(d.startY+dy,-60,60)}:x));
 else setPhotos(p=>p.map((x,i)=>i===selected?{...x,captionX:clamp(d.startX+dx,5,95),captionY:clamp(d.startY+dy,8,92)}:x));
}
function endDrag(e?:React.PointerEvent<HTMLElement>){
 if(e)touchesRef.current.delete(e.pointerId);
 if(touchesRef.current.size===1){
  pinchRef.current=null;
  const remaining=Array.from(touchesRef.current.values())[0];
  const rect=e?.currentTarget.closest('.previewFrame')?.getBoundingClientRect();
  if(rect&&current)dragRef.current={x:remaining.x,y:remaining.y,startX:current.offsetX??0,startY:current.offsetY??0,kind:'photo',width:rect.width,height:rect.height};
  return;
 }
 if(touchesRef.current.size>0)return;
 dragRef.current=null;pinchRef.current=null;
 if(gestureStartRef.current){setUndoStack(stack=>[...stack.slice(-19),gestureStartRef.current!]);setRedoStack([]);gestureStartRef.current=null}
}

const musicInput=useRef<HTMLInputElement>(null);
const audioRef=useRef<HTMLAudioElement|null>(null);
const soundCtx=useRef<AudioContext|null>(null);
const synthTimer=useRef<number|null>(null);
const [bgm,setBgm]=useState<'none'|'gentle'|'bright'|'file'>('gentle');
const [audioFile,setAudioFile]=useState<{name:string;url:string;seconds:number}|null>(null);
const [volume,setVolume]=useState(65);
const [bgmStart,setBgmStart]=useState(0);
const [bgmOffset,setBgmOffset]=useState(0);
const [musicSwitches,setMusicSwitches]=useState<MusicSwitch[]>([]);
const switchInput=useRef<HTMLInputElement>(null);
const switchTimers=useRef<number[]>([]);
const switchAudio=useRef<HTMLAudioElement|null>(null);
const bgmDelay=useRef<number|null>(null);
const [pauseBgmDuringVideo,setPauseBgmDuringVideo]=useState(true);
const [previewSound,setPreviewSound]=useState(false);
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
const computed=useMemo(()=>mode==='photo'?photos.map(p=>p.duration):photos.map(p=>p.kind==='video'?p.duration:Math.max(1,(musicSeconds-intro-outro-photos.filter(x=>x.kind==='video').reduce((a,b)=>a+b.duration,0))/Math.max(1,photos.filter(x=>x.kind!=='video').length))),[photos,mode,musicSeconds]);
const total=intro+outro+computed.reduce((a,b)=>a+b,0);
const switchAt=(m:MusicSwitch)=>m.anchor==='photo'&&m.photoId?intro+computed.slice(0,Math.max(0,photos.findIndex(p=>p.id===m.photoId))).reduce((a,b)=>a+b,0):m.start;
const orderedSwitches=[...musicSwitches].sort((a,b)=>switchAt(a)-switchAt(b));
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
async function addPhotos(files:FileList|null){
 if(!files)return;
 const items=await Promise.all([...files].filter(f=>f.type.startsWith('image/')||f.type.startsWith('video/')||/\.(mov|mp4|m4v)$/i.test(f.name)).map(async f=>{
  const url=URL.createObjectURL(f),video=f.type.startsWith('video/')||/\.(mov|mp4|m4v)$/i.test(f.name);
  let seconds=duration;
  if(video){seconds=await new Promise<number>(resolve=>{const el=document.createElement('video');el.preload='metadata';el.onloadedmetadata=()=>resolve(Number.isFinite(el.duration)?Math.max(1,Math.min(300,Math.round(el.duration))):5);el.onerror=()=>resolve(5);el.src=url;el.load()})}
  return {id:id(),kind:video?'video' as const:'image' as const,name:f.name,url,duration:seconds,sourceDuration:video?seconds:undefined,trimStart:0,keepAudio:video,effect:video?'fade' as const:'zoom' as const};
 }));
 if(items.length){setPhotos(p=>[...p,...items]);setStep('edit')}
}
function remove(i:number){setPhotos(p=>p.filter((_,j)=>j!==i));setSelected(0)}
function move(i:number,offset:number){const to=i+offset;if(to<0||to>=photos.length)return;setPhotos(p=>{const next=[...p];[next[i],next[to]]=[next[to],next[i]];return next});setSelected(to)}
function update(i:number,patch:Partial<Photo>){setPhotos(p=>{setUndoStack(stack=>[...stack.slice(-19),p]);setRedoStack([]);return p.map((v,j)=>j===i?{...v,...patch}:v)})}
function undo(){if(!undoStack.length)return;setRedoStack(x=>[...x,photos]);setPhotos(undoStack[undoStack.length-1]);setUndoStack(x=>x.slice(0,-1))}
function redo(){if(!redoStack.length)return;setUndoStack(x=>[...x,photos]);setPhotos(redoStack[redoStack.length-1]);setRedoStack(x=>x.slice(0,-1))}
function applyAll(){if(!current)return;setUndoStack(x=>[...x.slice(-19),photos]);setRedoStack([]);setPhotos(p=>p.map(x=>({...x,frame:current.frame,decoration:current.decoration,sticker:current.sticker,caption:current.caption,zoom:current.zoom,offsetX:current.offsetX,offsetY:current.offsetY,captionX:current.captionX,captionY:current.captionY,captionFont:current.captionFont,captionColor:current.captionColor,captionSize:current.captionSize,captionWeight:current.captionWeight,captionOutline:current.captionOutline,captionOutlineColor:current.captionOutlineColor,captionBackground:current.captionBackground,captionMotion:current.captionMotion,effect:current.effect,duration:current.duration})))}

const current=photos[selected];
const activePhoto=photos[playing?playIndex:selected];
const transitionEffect=activePhoto?.effect==='random'?['fade','wipe','circle','slideUp','blur','flash'][playIndex%6]:activePhoto?.effect;
const activeDuration=computed[playing?playIndex:selected]||duration;
const activeSubtitle=activePhoto?.subtitles?.find(c=>subtitleTime>=c.start&&subtitleTime<c.end);
const shownFrame=(activePhoto?.frame??frame)==='album'?'album':'none';
const [albumFrameReady,setAlbumFrameReady]=useState(false);
useEffect(()=>{const im=new Image();im.onload=()=>setAlbumFrameReady(true);im.src='/omoide-theater-demo/5D7629A6-7CD4-4630-9F0B-41ED75881354.png';if(im.complete&&im.naturalWidth)setAlbumFrameReady(true);return()=>{im.onload=null}},[]);
const shownDecor=activePhoto?.decoration??decoration;
const shownSticker=activePhoto?.sticker??sticker;
function applyTemplate(t:string){setTemplate(t);const presets:Record<string,{theme:Theme;frame:typeof frame;background:typeof background;decoration:typeof decoration;title:string;ending:string}>={graduation:{theme:'sakura',frame:'sakura',background:'sakura',decoration:'petals',title:'卒園おめでとう',ending:'たくさんの思い出をありがとう'},wedding:{theme:'sparkle',frame:'gold',background:'sparkle',decoration:'glitter',title:'Wedding Story',ending:'いつまでもお幸せに'},birthday:{theme:'sparkle',frame:'balloon',background:'rainbow',decoration:'confetti',title:'Happy Birthday',ending:'笑顔あふれる一年に'},travel:{theme:'album',frame:'polaroid',background:'sky',decoration:'bubbles',title:'旅の思い出',ending:'また一緒に旅しよう'},growth:{theme:'album',frame:'soft',background:'rainbow',decoration:'hearts',title:'成長の記録',ending:'これからも元気に大きくなってね'},theater:{theme:'theater',frame:'film',background:'stars',decoration:'light',title:'大切な思い出',ending:'Fin.'}};const p=presets[t];if(p){setTheme(p.theme);setFrame(p.frame);setBackground(p.background);setDecoration(p.decoration);setTitle(p.title);setEnding(p.ending)}}
const symbols:Record<string,string>={bear:'🧸',rabbit:'🐰',camera:'📷',clapper:'🎬',bouquet:'💐',crown:'👑',graduation:'🎓',diploma:'📜',cake:'🎂',gift:'🎁',balloons:'🎈',rainbow:'🌈',star:'⭐',heart:'💗',music:'🎵',treble:'🎼',sparkles:'✨'};

function stopMusic(clearSwitches=true){
 if(clearSwitches){switchTimers.current.forEach(window.clearTimeout);switchTimers.current=[];if(switchAudio.current){switchAudio.current.pause();switchAudio.current=null}}
 if(bgmDelay.current!==null){window.clearTimeout(bgmDelay.current);bgmDelay.current=null}
 if(audioRef.current){audioRef.current.pause();audioRef.current.currentTime=0;audioRef.current=null}
 if(synthTimer.current!==null){window.clearInterval(synthTimer.current);synthTimer.current=null}
 if(soundCtx.current){void soundCtx.current.close();soundCtx.current=null}
 setMusicPlaying(false);
}
function playMusic(){
 stopMusic(false);setMusicError('');
 if(bgm==='none')return;
 if(bgm==='file'){
  if(!audioFile){setMusicError('先に音楽ファイルを選んでください');return}
  const audio=new Audio(audioFile.url);audio.loop=true;audio.volume=volume/100;audioRef.current=audio;const seek=()=>{try{audio.currentTime=Math.min(bgmOffset,Math.max(0,(audio.duration||audioFile.seconds)-.1))}catch{}};audio.addEventListener('loadedmetadata',seek,{once:true});seek();
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
useEffect(()=>{const el=previewVideo.current;if(!el)return;if(playing&&phase==='photos'){const clip=photos[playIndex];if(clip?.kind!=='video')return;el.muted=!previewSound||clip.keepAudio===false;el.defaultMuted=!previewSound||clip.keepAudio===false;el.playsInline=true;const begin=()=>{const start=clip.trimStart??0;try{if(Math.abs(el.currentTime-start)>.15)el.currentTime=start}catch{}void el.play().catch(()=>{el.muted=true;el.defaultMuted=true;setPreviewSound(false);void el.play().catch(()=>setMusicError('動画を再生できません。動画をタップして再生をお試しください'))})};if(el.readyState>=1)begin();else{el.addEventListener('loadedmetadata',begin,{once:true});el.load()}return()=>{el.removeEventListener('loadedmetadata',begin);el.pause()}}else{el.pause()}},[playing,phase,playIndex,sceneKey,previewSound]);
useEffect(()=>{setSubtitleTime(0)},[playIndex,selected,sceneKey]);
useEffect(()=>{if(!playing||phase!=='photos')return;const start=performance.now();const timer=window.setInterval(()=>setSubtitleTime(Math.min(computed[playIndex]??5,(performance.now()-start)/1000)),100);return()=>clearInterval(timer)},[playing,phase,playIndex,sceneKey]);
async function addMusicSwitch(files:FileList|null){const file=files?.[0];if(!file)return;const url=URL.createObjectURL(file);const seconds=await new Promise<number>(resolve=>{const a=new Audio();a.preload='metadata';a.onloadedmetadata=()=>resolve(Number.isFinite(a.duration)?Math.round(a.duration):0);a.onerror=()=>resolve(0);a.src=url});setMusicSwitches(v=>[...v,{id:id(),name:file.name,url,seconds,start:Math.min(total,6),anchor:'time',offset:0,volume:volume,fade:1}])}
function startPreview(){
 if(!photos.length)return;
 if(playing){setPlaying(false);setPhase('intro');stopMusic()}
 else{setPlayIndex(0);setPhase('intro');setPlaying(true);stopMusic();if(bgmStart<=0)playMusic();else{bgmDelay.current=window.setTimeout(()=>{bgmDelay.current=null;playMusic()},bgmStart*1000)}
 for(const m of orderedSwitches){const at=Math.max(0,switchAt(m));const timer=window.setTimeout(()=>{if(switchAudio.current)switchAudio.current.pause();if(audioRef.current)audioRef.current.pause();if(soundCtx.current)void soundCtx.current.suspend();const a=new Audio(m.url);switchAudio.current=a;a.volume=Math.min(1,m.volume/100);a.loop=true;const seek=()=>{try{a.currentTime=Math.min(m.offset,Math.max(0,(a.duration||m.seconds)-.1))}catch{}};a.addEventListener('loadedmetadata',seek,{once:true});seek();void a.play().catch(()=>setMusicError('切り替えBGMを再生できませんでした'))},at*1000);switchTimers.current.push(timer)} }
 setSceneKey(k=>k+1)
}
async function saveProject(){
 if(!photos.length||draftBusy)return;setDraftBusy(true);setDraftInfo('保存中…');
 try{
  const items=await Promise.all(photos.map(async p=>({meta:{...p,url:undefined},blob:await fetch(p.url).then(r=>r.blob())})));
  const audio=audioFile?{name:audioFile.name,seconds:audioFile.seconds,blob:await fetch(audioFile.url).then(r=>r.blob())}:undefined;
  const switchFiles=await Promise.all(musicSwitches.map(async m=>({id:m.id,blob:await fetch(m.url).then(r=>r.blob())})));
  const savedAt=new Date().toISOString();
  const targetId=projectId??id();
  await persistProject(targetId,{version:1,savedAt,photos:items,audio,switchFiles,settings:{theme,title,ending,frame,background,decoration,sticker,curtainColor,opening,template,mode,musicSeconds,duration,aspect,bgm,volume,bgmStart,bgmOffset,musicSwitches:musicSwitches.map(({url,...m})=>m),pauseBgmDuringVideo}});
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
  setTheme(v.theme as Theme);setTitle(v.title as string);setEnding(v.ending as string);setFrame(v.frame as typeof frame);setBackground(v.background as typeof background);setDecoration(v.decoration as typeof decoration);setSticker(v.sticker as string);setCurtainColor((v.curtainColor as typeof curtainColor)||'red');setOpening((v.opening as typeof opening)||(v.theme==='theater'?'curtain':'fade'));setTemplate(v.template as string);setMode(v.mode as typeof mode);setMusicSeconds(v.musicSeconds as number);setDuration(v.duration as number);setAspect(v.aspect as typeof aspect);setBgm(v.bgm as typeof bgm);setVolume(v.volume as number);setBgmStart(Math.max(0,Number(v.bgmStart)||0));setBgmOffset(Math.max(0,Number(v.bgmOffset)||0));setPauseBgmDuringVideo(v.pauseBgmDuringVideo!==false);
  setMusicSwitches((Array.isArray(v.musicSwitches)?v.musicSwitches:[]).map((m:MusicSwitch)=>{const item=draft.switchFiles?.find(x=>x.id===m.id);return {...m,url:item?URL.createObjectURL(item.blob):''}}).filter((m:MusicSwitch)=>m.url));
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
function newProject(){setPlaying(false);stopMusic();setPhotos([]);setProjectId(null);setSelected(0);setUndoStack([]);setRedoStack([]);setAudioFile(null);setMusicSwitches([]);setTitle('大切な思い出');setEnding('ありがとう、たくさんの思い出');setEditPage('opening');setStep('edit');setDraftInfo('')}

async function makeMovie(){
 if(!photos.length||exporting)return;
 setPlaying(false);stopMusic();setExportError('');setExportProgress(0);setExporting(true);
 try{
  const {blob,extension}=await exportMovie({photos:photos.map(p=>({...p,frame:(p.frame??frame)==='album'?'album':'none',decoration:p.decoration??decoration,sticker:p.sticker??sticker})),durations:computed,title,ending,frame:'none',background,decoration,sticker,curtainColor,opening,theme,aspect,bgm,audioUrl:audioFile?.url,volume,bgmStart,bgmOffset,musicSwitches:orderedSwitches.map(m=>({...m,start:switchAt(m)})),pauseBgmDuringVideo,onProgress:setExportProgress});
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
useEffect(()=>{if(!playing)return;const isVideo=phase==='photos'&&photos[playIndex]?.kind==='video';const pause=pauseBgmDuringVideo&&isVideo;if(audioRef.current){if(pause)audioRef.current.pause();else void audioRef.current.play().catch(()=>{})}if(soundCtx.current){if(pause)void soundCtx.current.suspend();else void soundCtx.current.resume()}},[playing,phase,playIndex,pauseBgmDuringVideo,photos]);


return <main className={step==='home'?'theaterHome':'theaterEditor'}><header><img className="homeArtwork" src={import.meta.env.BASE_URL+'home_header.jpg'} alt="おもいでシアター" onLoad={e=>e.currentTarget.classList.add('loaded')}/><div className="homeCurtain left"/><div className="homeCurtain right"/><div className="brand"><span className="homeCamera">🎥</span>おもいでシアター</div><div className="subtitle">写真が、一本の映画になる。</div></header>
{step==='home'?<section className="panel hero"><div className="stage"><img className="homeArtwork" src={import.meta.env.BASE_URL+'home_hero.jpg'} alt="思い出を映画に" onLoad={e=>e.currentTarget.classList.add('loaded')}/><span className="heroFlower top">🌸</span><span className="heroFlower bottom">🌸</span><span className="heroReel">🎞</span><span className="heroClap">🎬</span><h1>思い出を映画に</h1><p>写真や動画を選んで、自分だけのムービーを。</p></div><button className="primary" onClick={newProject}><img className="homeArtwork" src={import.meta.env.BASE_URL+'home_create.jpg'} alt="新しいムービーを作る" onLoad={e=>e.currentTarget.classList.add('loaded')}/>＋ 新しいムービーを作る <span aria-hidden="true">›</span></button>{projects.length>0?<div className="draftBox"><h3>📁 保存した作品（{projects.length}件）</h3><div className="projectList">{projects.map(p=><div className="projectCard" key={p.id}>{thumbUrls[p.id]?<img src={thumbUrls[p.id]} alt="作品の表紙"/>:<div className="projectFallback">🎬</div>}<div className="projectDetail"><strong>{p.title}</strong><small>{p.photoCount}枚 · {new Date(p.savedAt).toLocaleString('ja-JP')}</small><div className="projectButtons"><button onClick={()=>restoreProject(p.id)} disabled={draftBusy}>編集する</button><button onClick={()=>copyProject(p.id)} disabled={draftBusy}>複製</button><button onClick={()=>eraseProject(p.id)} disabled={draftBusy}>削除</button></div></div></div>)}</div></div>:null}{draftInfo?<p className="note" role="status">{draftInfo}</p>:null}<p className="note">試作版です。BGMの試聴に対応しました。動画の書き出しは試験機能として追加しました。</p></section>:null}
{step==='edit'?<section className="panel"><div className="draftBox"><h3>💾 途中保存</h3><p className="note">写真・動画・編集設定・読み込んだ音楽をこのiPhoneのブラウザ内に作品ごとに保存します。</p><div className="actions"><button onClick={saveProject} disabled={draftBusy}>{draftBusy?'処理中…':'途中保存する'}</button>{projectId?<button onClick={()=>restoreProject(projectId)} disabled={draftBusy}>保存した状態に戻す</button>:null}</div>{draftInfo?<p className="note" role="status">{draftInfo}</p>:null}</div><div className="sectionHeading"><h2>ムービーを作成</h2></div><nav className="editSteps" aria-label="編集の手順">{([['opening','① オープニング'],['main','② 本編'],['ending','③ エンディング'],['finish','④ 完成・保存']] as const).map(([key,label])=><button key={key} className={editPage===key?'active':''} aria-current={editPage===key?'step':undefined} onClick={()=>{setPlaying(false);setEditPage(key)}}>{label}</button>)}</nav><section className="sharedPreview"><h3>🎥 全体プレビュー</h3><div className={'preview '+aspect}><div className={'previewFrame '+theme+' backdrop-'+background}>
{playing&&phase==='photos'&&transitionEffect==='page'&&photos.length>0&&((playIndex===0&&opening==='album')||photos[playIndex-1])?<div key={'turn-'+sceneKey} className="albumFullPageTurn" aria-hidden="true">{playIndex===0?<div className="albumTurnTitlePage"><span>{title}</span></div>:<div className={"albumTurnPreviousPage "+((photos[playIndex-1].frame??frame)==='album'?'withAlbumFrame':'withoutAlbumFrame')}><div className="albumTurnPhotoClip">{photos[playIndex-1].kind==='video'?<div className="albumTurnVideoPlaceholder">🎞️</div>:<img src={photos[playIndex-1].url} alt="" style={{transform:'scale('+(photos[playIndex-1].zoom??1)+') translate('+(photos[playIndex-1].offsetX??0)+'%,'+(photos[playIndex-1].offsetY??0)+'%)'}}/>}</div>{photos[playIndex-1].caption?<div className="albumTurnCaption" style={{left:(photos[playIndex-1].captionX??50)+'%',top:(photos[playIndex-1].captionY??83)+'%',fontFamily:photos[playIndex-1].captionFont==='cursive'?'Yomogi, cursive':photos[playIndex-1].captionFont??'sans-serif',fontSize:(photos[playIndex-1].captionSize??22)+'px',fontWeight:photos[playIndex-1].captionWeight??700,color:photos[playIndex-1].captionColor??'#fff',background:photos[playIndex-1].captionBackground?'rgba(0,0,0,.58)':'transparent'}}>{photos[playIndex-1].caption}</div>:null}</div>}</div>:null}
{opening==='album'&&playing&&phase==='intro'?<div className="albumCustomTitle"><span>{title}</span></div>:null}
{playing&&phase==='photos'&&playIndex>0&&transitionEffect!=='none'&&transitionEffect!=='page'&&photos[playIndex-1].kind!=='video'?<div key={'under-'+sceneKey} className="transitionUnderlay"><img src={photos[playIndex-1].url} alt="" style={{transform:'scale('+(photos[playIndex-1].zoom??1)+') translate('+(photos[playIndex-1].offsetX??0)+'%,'+(photos[playIndex-1].offsetY??0)+'%)'}}/>{(photos[playIndex-1].frame??frame)==='album'?<div className="albumCustomPage"/>:null}</div>:null}
{activePhoto?<div key={sceneKey+'-'+(activePhoto?.id||'')} onPointerDown={e=>{if(editTool==='position')beginDrag(e,'photo')}} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} className={'scenePhoto '+(shownFrame==='album'?' albumPhotoInset ':'')+(shownFrame==='album'&&!albumFrameReady?' albumFrameLoading ':'')+''+(playing&&phase==='photos'?'animate '+(transitionEffect==='page'?'albumStill':transitionEffect):'')+(editTool==='position'?' draggablePhoto':'')} style={{'--scene-duration':activeDuration+'s'} as CSSProperties}>{activePhoto.kind==='video'?<video ref={previewVideo} src={activePhoto.url} playsInline muted={!previewSound||!(activePhoto.keepAudio??true)} controls={!playing} preload="auto" onLoadedData={e=>{if(playing&&phase==='photos')void e.currentTarget.play().catch(()=>{})}} style={{transform:'scale('+(activePhoto.zoom??1)+') translate('+(activePhoto.offsetX??0)+'%,'+(activePhoto.offsetY??0)+'%)'}}/>:<img src={activePhoto.url} alt="選択中の写真" style={{transform:'scale('+(activePhoto.zoom??1)+') translate('+(activePhoto.offsetX??0)+'%,'+(activePhoto.offsetY??0)+'%)'}} />}</div>:<span>写真を追加してください</span>}
{playing&&phase==='intro'&&opening==='curtain'?<div key={'curtain-'+sceneKey} className={'curtainOverlay curtain-'+curtainColor}><div className="curtainPanel curtainLeft"/><div className="curtainPanel curtainRight"/><div className="curtainCaption">{title}</div></div>:null}
{playing&&phase==='outro'?<div className="endingScreen"><div>Fin.</div><small>{ending}</small></div>:null}
{shownDecor!=='none'&&(!playing||phase==='photos')?<div className={'motionDecor decor-'+shownDecor} aria-hidden="true">{Array.from({length:12},(_,i)=><span key={i} style={{left:(i*37%95)+'%',animationDelay:-(i*.47)+'s'}}>{shownDecor==='petals'?'🌸':shownDecor==='glitter'||shownDecor==='light'?'✦':shownDecor==='bubbles'?'◯':shownDecor==='hearts'?'♥':shownDecor==='fireworks'?'✺':shownDecor==='snow'?'❄':'◆'}</span>)}</div>:null}
{shownSticker!=='none'?<div className="previewSticker" aria-hidden="true">{symbols[shownSticker]}</div>:null}
{shownFrame==='album'&&activePhoto&&(!playing||phase==='photos')?<div className="albumCustomPage" aria-hidden="true"/>:null}
{shownFrame!=='none'&&shownFrame!=='album'&&!(playing&&phase==='intro'&&theme==='theater')?<div className={'photoDecoration '+shownFrame} aria-hidden="true"/>:null}
{activeSubtitle&&(!playing||phase==='photos')?<div className="timedSubtitle" style={{color:activePhoto.subtitleColor??'#ffffff',fontSize:(activePhoto.subtitleSize??22)+'px',WebkitTextStroke:'0.5px '+(activePhoto.subtitleOutline??'#202020'),textShadow:'-1px -1px 0 '+(activePhoto.subtitleOutline??'#202020')+', 1px 1px 0 '+(activePhoto.subtitleOutline??'#202020')}}>{activeSubtitle.text}</div>:null}
{activePhoto?.caption&&(!playing||phase==='photos')?<div key={activePhoto.id+'-'+sceneKey} className={'photoCaption '+(editTool==='text'?'draggableCaption':'')+(playing&&phase==='photos'?' captionMotion-'+(activePhoto.captionMotion??'none'):'')} style={{left:(activePhoto.captionX??50)+'%',top:(activePhoto.captionY??83)+'%',bottom:'auto',right:'auto',fontFamily:activePhoto.captionFont==='cursive'?'Yomogi, cursive':activePhoto.captionFont??'sans-serif',color:activePhoto.captionColor??'#ffffff',fontSize:(activePhoto.captionSize??22)+'px',fontWeight:activePhoto.captionWeight??700,textShadow:'none',background:activePhoto.captionBackground?'rgba(0,0,0,.58)':'transparent'}} onPointerDown={e=>{if(editTool==='text')beginDrag(e,'caption')}} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>{activePhoto.captionOutline?<span aria-hidden="true" className="captionOutlineLayer" style={{WebkitTextStroke:((activePhoto.captionWeight??700)>=900?'3.2px ':(activePhoto.captionWeight??700)>=700?'2.2px ':'1.2px ')+(activePhoto.captionOutlineColor??'#222222')}}>{activePhoto.caption}</span>:null}<span className="captionFillLayer" style={{WebkitTextStroke:(activePhoto.captionWeight??700)>=900?'1.35px '+(activePhoto.captionColor??'#ffffff'):(activePhoto.captionWeight??700)>=700?'.65px '+(activePhoto.captionColor??'#ffffff'):'0px transparent',paintOrder:'stroke fill'}}>{activePhoto.caption}</span></div>:null}
{playing&&phase==='intro'&&opening!=='curtain'&&opening!=='album'?<div key={'opening-'+sceneKey} className={'openingOverlay opening-'+opening}>{(['gold_light','floral_wedding','sakura_tunnel','balloon_party','starry_story','retro_cinema'].includes(opening))?<><div className="openingPhotoBackground" style={{backgroundImage:`url(${'/omoide-theater-demo/'}${opening}.png)`}}/><div className={"openingPhotoParticles"+(opening==='sakura_tunnel'?" sakuraPetalParticles":"")} aria-hidden="true">{Array.from({length:14},(_,i)=><span key={i} style={{left:(i*37%97)+'%',top:(i*23%91)+'%',animationDelay:-(i*.43)+'s'}}>{opening==='sakura_tunnel'?' ':opening==='balloon_party'?'🎈':opening==='floral_wedding'?'✿':opening==='retro_cinema'?'✦':opening==='starry_story'?'✧':'✦'}</span>)}</div></>:null}{opening==='countdown'?<div className="countdownDial" aria-label="3、2、1とカウントダウン"><span className="countdownNumber countdownThree">3</span><span className="countdownNumber countdownTwo">2</span><span className="countdownNumber countdownOne">1</span><span className="countdownSweep"/></div>:<div className="openingOrnaments" aria-hidden="true">{opening==='sparkle'?'✦ ✧ ✨ ✦ ✧':opening==='sakura'?'🌸 🌸 🌸 🌸':opening==='rainbow'?'🌈 ☁️ ☁️':'✧'}</div>}<div className="openingHeading">{title}</div></div>:null}
</div></div><div className="actions"><button onClick={startPreview}>{playing?'■ 停止':'▶ 最初から再生'}</button>{playing&&phase==='photos'&&activePhoto?.kind==='video'&&activePhoto.keepAudio!==false?<button onClick={()=>{setPreviewSound(v=>!v);const el=previewVideo.current;if(el){el.muted=previewSound;void el.play().catch(()=>{})}}}>{previewSound?'🔊 動画音声ON':'🔇 動画音声をON'}</button>:null}</div></section>{editPage==='main'?<><div className="actions"><button onClick={()=>input.current?.click()}>＋ 写真追加</button><button onClick={()=>videoInput.current?.click()}>＋ 動画追加</button></div><p className="note">カーテン・写真のフェード／ズーム／スライドを画面で確認できます。BGMは試聴用です。動画の書き出しは下の試験機能で確認できます。</p><h3>写真の並び順</h3><div className="strip">{photos.map((p,i)=><button key={p.id} className={'thumb '+(selected===i?'selected':'')} onClick={()=>{setSelected(i);setPlaying(false);setPhase('intro');setSceneKey(k=>k+1)}}>{p.kind==='video'?<VideoThumbnail url={p.url} name={p.name}/>:<img src={p.url} alt={p.name}/>}<span>{i+1}</span></button>)}</div>{current&&<div className="editor"><h3>選択中の{current.kind==='video'?'動画':'写真'}：{selected+1}番目</h3><div className="photoToolGrid">{([['frame','▣','フレーム'],['text','T','文字'],['subtitles','▤','字幕'],['decor','✧','装飾'],['sticker','☺','スタンプ'],['transition','⇄','切り替え'],['duration','◷','表示時間'],['position','⛶','拡大・移動'],['apply','▢','一括適用']] as const).map(([key,icon,label])=><button key={key} className={editTool===key?'chosen':''} onClick={()=>{if(key==='transition')setTransitionChoice(current.effect);setEditTool(editTool===key?null:key)}}><span>{icon}</span><small>{label}</small></button>)}</div>
{editTool?<div className="photoToolPanel">
{editTool==='subtitles'?<div className="subtitleEditor"><h4>字幕（この写真・動画）</h4><label>表示を確認する位置：{subtitleTime.toFixed(1)}秒<input type="range" min="0" max={Math.max(1,current.duration)} step="0.1" value={Math.min(subtitleTime,current.duration)} onChange={e=>setSubtitleTime(Number(e.target.value))}/></label>{(current.subtitles??[]).map(c=><div className="subtitleCue" key={c.id}><label>字幕<input value={c.text} placeholder="字幕を入力" onChange={e=>update(selected,{subtitles:(current.subtitles??[]).map(x=>x.id===c.id?{...x,text:e.target.value}:x)})}/></label><div className="subtitleTimes"><label>開始（秒）<input type="number" min="0" max={current.duration} step="0.1" value={c.start} onChange={e=>update(selected,{subtitles:(current.subtitles??[]).map(x=>x.id===c.id?{...x,start:Math.min(current.duration,Math.max(0,Number(e.target.value)))}:x)})}/></label><label>終了（秒）<input type="number" min="0" max={current.duration} step="0.1" value={c.end} onChange={e=>update(selected,{subtitles:(current.subtitles??[]).map(x=>x.id===c.id?{...x,end:Math.min(current.duration,Math.max(0,Number(e.target.value)))}:x)})}/></label></div><button className="small" onClick={()=>update(selected,{subtitles:(current.subtitles??[]).filter(x=>x.id!==c.id)})}>この字幕を削除</button></div>)}<button onClick={()=>{const start=Math.min(Math.max(0,subtitleTime),Math.max(0,current.duration-1));update(selected,{subtitles:[...(current.subtitles??[]),{id:id(),text:'',start:Math.round(start*10)/10,end:Math.min(current.duration,Math.round((start+3)*10)/10)}]})}}>＋ 字幕を追加</button><label>字幕の色<input type="color" value={current.subtitleColor??'#ffffff'} onChange={e=>update(selected,{subtitleColor:e.target.value})}/></label><label>字幕サイズ：{current.subtitleSize??22}px<input type="range" min="12" max="42" value={current.subtitleSize??22} onChange={e=>update(selected,{subtitleSize:Number(e.target.value)})}/></label><label>縁取り色<input type="color" value={current.subtitleOutline??'#202020'} onChange={e=>update(selected,{subtitleOutline:e.target.value})}/></label></div>:null}
{editTool==='frame'?<div className="frameScopePanel"><strong>フレームを設定する範囲</strong><div className="frameScopeButtons"><button type="button" className={frameScope==='one'?'chosen':''} onClick={()=>setFrameScope('one')}>この写真だけ</button><button type="button" className={frameScope==='all'?'chosen':''} onClick={()=>setFrameScope('all')}>すべての写真</button><button type="button" className={frameScope==='chosen'?'chosen':''} onClick={()=>{setFrameScope('chosen');setFrameTargets(t=>t.length?t:[current.id])}}>選んだ写真</button></div>{frameScope==='chosen'?<div className="frameTargetGrid">{photos.map((p,i)=><label key={p.id} className="frameTarget"><input type="checkbox" checked={frameTargets.includes(p.id)} onChange={e=>setFrameTargets(t=>e.target.checked?[...t,p.id]:t.filter(id=>id!==p.id))}/>{p.kind==='video'?<VideoThumbnail url={p.url} name={p.name}/>:<img src={p.url} alt={p.name}/>}<span>{i+1}番</span></label>)}</div>:null}<label>フレームを選ぶ<select value={(current.frame??frame)==='album'?'album':'none'} onChange={e=>{const value=e.target.value;setUndoStack(x=>[...x.slice(-19),photos]);setRedoStack([]);setPhotos(p=>p.map((photo,i)=>(frameScope==='all'||frameScope==='one'&&i===selected||frameScope==='chosen'&&frameTargets.includes(photo.id))?{...photo,frame:value}:photo))}}>{frameChoices.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><p className="note">{frameScope==='one'?'選択中の1枚に適用します。':frameScope==='all'?'すべての写真・動画に同じフレームを設定します。':frameTargets.length+'枚を選択中です。チェックを付けた素材だけに適用します。'}</p></div>:null}
{editTool==='text'?<div className="captionControls"><label>写真に表示する文字（プレビューで移動できます）<input value={current.caption??''} onChange={e=>update(selected,{caption:e.target.value})} placeholder="例：みんなと過ごした毎日"/></label><label>フォント<select value={current.captionFont??'sans-serif'} onChange={e=>update(selected,{captionFont:e.target.value})}><option value="sans-serif">ゴシック</option><option value="serif">明朝</option><option value="Yomogi, cursive">手書き風（やわらか）</option><option value="Zen Kurenaido, cursive">手書き風（すっきり）</option><option value="monospace">タイプライター</option></select></label><label>文字色<input type="color" value={current.captionColor??'#ffffff'} onChange={e=>update(selected,{captionColor:e.target.value})}/></label><label>文字の太さ<select value={current.captionWeight??700} onChange={e=>update(selected,{captionWeight:Number(e.target.value)})}><option value={400}>標準</option><option value={700}>太字</option><option value={900}>極太</option></select></label><label>文字サイズ：{current.captionSize??22}px<input type="range" min="12" max="52" value={current.captionSize??22} onChange={e=>update(selected,{captionSize:Number(e.target.value)})}/></label><label className="inlineOption"><input type="checkbox" checked={current.captionOutline??false} onChange={e=>update(selected,{captionOutline:e.target.checked})}/> 文字に縁取りを付ける</label>{current.captionOutline?<label>縁取りの色<input type="color" value={current.captionOutlineColor??'#222222'} onChange={e=>update(selected,{captionOutlineColor:e.target.value})}/></label>:null}<label className="inlineOption"><input type="checkbox" checked={current.captionBackground??false} onChange={e=>update(selected,{captionBackground:e.target.checked})}/> 文字の後ろに半透明の背景</label><label>文字の登場演出<select value={current.captionMotion??'none'} onChange={e=>update(selected,{captionMotion:e.target.value as Photo['captionMotion']})}><option value="none">なし</option><option value="fade">ふわっと現れる</option><option value="rise">下から現れる</option><option value="slide">横から流れる</option></select></label></div>:null}
{editTool==='decor'?<label>この写真の装飾<select value={current.decoration??decoration} onChange={e=>update(selected,{decoration:e.target.value})}>{decorChoices.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>:null}
{editTool==='sticker'?<label>この写真のスタンプ<select value={current.sticker??sticker} onChange={e=>update(selected,{sticker:e.target.value})}><option value="none">なし</option>{Object.entries(symbols).map(([key,value])=><option key={key} value={key}>{value} {key}</option>)}</select></label>:null}
{editTool==='transition'?<div className="transitionScopePanel"><strong>切り替えを設定する範囲</strong><div className="transitionScopeButtons"><button type="button" className={transitionScope==='one'?'chosen':''} onClick={()=>setTransitionScope('one')}>このページだけ</button><button type="button" className={transitionScope==='all'?'chosen':''} onClick={()=>setTransitionScope('all')}>すべてのページ</button><button type="button" className={transitionScope==='chosen'?'chosen':''} onClick={()=>{setTransitionScope('chosen');setTransitionTargets(t=>t.length?t:[current.id])}}>選んだページ</button></div>{transitionScope==='chosen'?<div className="frameTargetGrid">{photos.map((p,i)=><label key={p.id} className="frameTarget"><input type="checkbox" checked={transitionTargets.includes(p.id)} onChange={e=>setTransitionTargets(t=>e.target.checked?[...t,p.id]:t.filter(id=>id!==p.id))}/>{p.kind==='video'?<VideoThumbnail url={p.url} name={p.name}/>:<img src={p.url} alt={p.name}/>}<span>{i+1}番</span></label>)}</div>:null}<label>切り替えを選ぶ<select value={transitionChoice} onChange={e=>{const value=e.target.value as Photo['effect'];setTransitionChoice(value);setUndoStack(x=>[...x.slice(-19),photos]);setRedoStack([]);setPhotos(p=>p.map((photo,i)=>(transitionScope==='all'||transitionScope==='one'&&i===selected||transitionScope==='chosen'&&transitionTargets.includes(photo.id))?{...photo,effect:value}:photo))}}><option value="zoom">ゆっくりズーム</option><option value="fade">フェード</option><option value="slide">スライド</option><option value="page">ページめくり</option><option value="heart">ハート</option><option value="curtain">カーテン</option><option value="none">切り替えなし</option><option value="wipe">ワイプ</option><option value="slideUp">上へスライド</option><option value="circle">円形</option><option value="blinds">ブラインド</option><option value="flash">光</option><option value="blur">ぼかし</option><option value="mosaic">モザイク</option><option value="random">ランダム</option></select></label><button type="button" disabled={transitionScope==='chosen'&&!transitionTargets.length} onClick={()=>{setUndoStack(x=>[...x.slice(-19),photos]);setRedoStack([]);setPhotos(p=>p.map((photo,i)=>(transitionScope==='all'||transitionScope==='one'&&i===selected||transitionScope==='chosen'&&transitionTargets.includes(photo.id))?{...photo,effect:transitionChoice}:photo))}}>選択範囲に適用</button><p className="note">{transitionScope==='one'?'選択中の1枚に適用します。':transitionScope==='all'?'すべての写真・動画に同じ切り替えを設定します。':transitionTargets.length+'枚を選択中です。チェックを付けた素材だけに適用します。'}</p></div>:null}
{editTool==='duration'?(current.kind==='video'?<div className="videoTrim"><p>動画のカット編集</p><label>開始位置：{current.trimStart??0}秒<input type="range" min="0" max={Math.max(0,(current.sourceDuration??current.duration)-1)} step="1" value={current.trimStart??0} onChange={e=>{const start=Number(e.target.value);update(selected,{trimStart:start,duration:Math.min(current.duration,Math.max(1,(current.sourceDuration??current.duration)-start))})}}/></label><label>使用する長さ：{current.duration}秒<input type="range" min="1" max={Math.max(1,(current.sourceDuration??current.duration)-(current.trimStart??0))} value={current.duration} onChange={e=>update(selected,{duration:Number(e.target.value)})}/></label><label><input type="checkbox" checked={current.keepAudio??true} onChange={e=>update(selected,{keepAudio:e.target.checked})}/> 動画の元音声を残す</label><small>カット編集は元動画を変更せず、書き出し時に指定範囲だけ使用します。</small></div>:<label>表示時間：{current.duration}秒<input type="range" min="2" max="15" value={current.duration} onChange={e=>update(selected,{duration:Number(e.target.value)})}/>{mode==='music'?<small>音楽の長さ基準では個別の秒数は反映されません</small>:null}</label>):null}
{editTool==='position'?<><p className="note">プレビューを1本指で移動、2本指で拡大・縮小できます。フレームは動きません。</p><label>拡大：{Math.round((current.zoom??1)*100)}%<input type="range" min="1" max="3" step=".05" value={current.zoom??1} onChange={e=>update(selected,{zoom:Number(e.target.value)})}/></label><label>左右位置<input type="range" min="-60" max="60" value={current.offsetX??0} onChange={e=>update(selected,{offsetX:Number(e.target.value)})}/></label><label>上下位置<input type="range" min="-60" max="60" value={current.offsetY??0} onChange={e=>update(selected,{offsetY:Number(e.target.value)})}/></label><button type="button" onClick={()=>update(selected,{zoom:1,offsetX:0,offsetY:0})}>位置と拡大率をリセット</button></>:null}
{editTool==='apply'?<><p className="note">選択中の写真の設定を全写真にコピーします。</p><button onClick={applyAll}>全写真に適用する</button></>:null}
</div>:null}
<div className="actions"><button disabled={!undoStack.length} onClick={undo}>↶ 取り消し</button><button disabled={!redoStack.length} onClick={redo}>↷ やり直し</button></div>
<div className="actions"><button disabled={selected===0} onClick={()=>move(selected,-1)}>← 前へ</button><button disabled={selected===photos.length-1} onClick={()=>move(selected,1)}>後ろへ →</button><button className="danger" onClick={()=>remove(selected)}>削除</button></div><label>演出<select value={current.effect} onChange={e=>update(selected,{effect:e.target.value as Photo['effect']})}><option value="zoom">ゆっくりズーム</option><option value="fade">フェード</option><option value="slide">スライド</option><option value="page">ページめくり</option><option value="heart">ハート</option><option value="curtain">カーテン</option><option value="none">切り替えなし</option><option value="wipe">ワイプ</option><option value="slideUp">上へスライド</option><option value="circle">円形</option><option value="blinds">ブラインド</option><option value="flash">光</option><option value="blur">ぼかし</option><option value="mosaic">モザイク</option><option value="random">ランダム</option></select></label>{mode==='photo'&&current.kind!=='video'&&<label>表示時間：{current.duration}秒<input type="range" min="2" max="15" value={current.duration} onChange={e=>update(selected,{duration:Number(e.target.value)})}/></label>}</div>}<div className="editPageActions"><button onClick={()=>setEditPage('opening')}>← オープニング</button><button className="primary" onClick={()=>setEditPage('ending')}>次へ：エンディング →</button></div></>:null}{editPage==='opening'?<><section className="designBox"><h3>🎬 オープニング作成</h3>
<label>用途別テンプレート<select value={template} onChange={e=>applyTemplate(e.target.value)}>
<option value="custom">自分で組み合わせる</option><option value="graduation">🌸 卒園・入学</option><option value="wedding">💍 ウェディング</option><option value="birthday">🎂 誕生日</option><option value="travel">🏝️ 旅行</option><option value="growth">👣 成長記録</option><option value="theater">🎬 シアター</option></select></label>
<label>オープニング演出<select value={opening} onChange={e=>setOpening(e.target.value as typeof opening)}><option value="curtain">🎭 カーテン</option><option value="sparkle">✨ キラキラ登場</option><option value="sakura">🌸 桜の舞</option><option value="album">📖 アルバムが開く</option><option value="countdown">🎞️ 映画カウントダウン</option><option value="rainbow">🌈 虹と雲</option><option value="fade">✧ シンプルフェード</option><optgroup label="✨ 写真背景のオープニング"><option value="gold_light">✨ ゴールドの光</option><option value="floral_wedding">💐 フラワーウェディング</option><option value="sakura_tunnel">🌸 桜のトンネル</option><option value="balloon_party">🎈 バルーンパーティー</option><option value="starry_story">🌙 星空の物語</option><option value="retro_cinema">🎞️ レトロ映画</option></optgroup></select></label>
{opening==='curtain'?<label>カーテンの色<select value={curtainColor} onChange={e=>setCurtainColor(e.target.value as typeof curtainColor)}><option value="red">クラシック（赤）</option><option value="pink">パステル（ピンク）</option><option value="navy">ナイト（紺）</option><option value="gold">ゴールド</option></select></label>:null}
{opening==='album'?<p className="note">📖 本編の切り替えは素材ごとに選択できます。</p>:null}
<label>オープニングタイトル<input value={title} onChange={e=>setTitle(e.target.value)}/></label><label>動画の向き<select value={aspect} onChange={e=>setAspect(e.target.value as typeof aspect)}><option value="wide">横型（16:9）</option><option value="vertical">縦型（9:16）</option><option value="square">正方形（1:1）</option></select></label><p className="note">オープニング演出とタイトルを選びます。タイトルは本編中には表示しません。</p></section><div className="editPageActions"><button className="primary" onClick={()=>setEditPage('main')}>次へ：本編 →</button></div></>:null}{editPage==='ending'?<><section className="designBox"><h3>🌷 エンディング作成</h3>
<label>背景<select value={background} onChange={e=>setBackground(e.target.value as typeof background)}><option value="default">テーマ標準</option><option value="sky">青空</option><option value="sakura">さくら</option><option value="stars">星空</option><option value="sunset">夕焼け</option><option value="sparkle">キラキラ</option><option value="rainbow">虹と雲</option></select></label>
<label>写真フレーム<select value={frame} onChange={e=>setFrame(e.target.value as typeof frame)}>
<option value="none">フレームなし</option><option value="sakura">さくら</option><option value="green">グリーン</option><option value="gold">エレガント</option><option value="polaroid">ポラロイド</option><option value="film">フィルム</option><option value="album">アルバム風</option><option value="balloon">バルーン</option><option value="soft">ハート</option><option value="snow">雪</option><option value="sunflower">ひまわり</option></select></label>
<label>動く装飾<select value={decoration} onChange={e=>setDecoration(e.target.value as typeof decoration)}><option value="none">なし</option><option value="petals">花びら</option><option value="glitter">キラキラ</option><option value="bubbles">シャボン玉</option><option value="hearts">ハート</option><option value="fireworks">花火</option><option value="snow">雪</option><option value="confetti">紙吹雪</option><option value="light">光の粒</option></select></label>
<label>スタンプ<select value={sticker} onChange={e=>setSticker(e.target.value)}><option value="none">なし</option>{Object.entries(symbols).map(([key,value])=><option key={key} value={key}>{value} {key}</option>)}</select></label>
<label>最後に表示するメッセージ<textarea rows={2} maxLength={70} value={ending} onChange={e=>setEnding(e.target.value)} placeholder="ありがとう、たくさんの思い出"/></label>
<p className="note">背景やフレーム・装飾は本編にも反映されます。</p>
</section><div className="editPageActions"><button onClick={()=>setEditPage('main')}>← 本編</button><button className="primary" onClick={()=>setEditPage('finish')}>次へ：完成・保存 →</button></div></>:null}{editPage==='main'?<><section className="musicBox"><h3>🎵 BGMを選ぶ</h3>
<label>音楽の種類<select value={bgm} onChange={e=>{stopMusic();setBgm(e.target.value as typeof bgm)}}>
<option value="gentle">やさしい音色（試作用オリジナル音）</option>
<option value="bright">明るい音色（試作用オリジナル音）</option>
<option value="file">自分の音楽ファイル</option>
<option value="none">音楽なし</option></select></label>
<div className="actions"><button onClick={()=>musicInput.current?.click()}>＋ 音楽ファイルを選ぶ</button><button disabled={bgm==='none'||(bgm==='file'&&!audioFile)} onClick={()=>musicPlaying?stopMusic():playMusic()}>{musicPlaying?'■ BGM停止':'♪ BGMを試聴'}</button></div>
{audioFile?<p className="note">読み込み済み：{audioFile.name}（{audioFile.seconds||'不明'}秒）</p>:null}
<label>BGMを動画の何秒目から流す？：{bgmStart}秒<input type="range" min="0" max={Math.max(0,Math.ceil(total))} step="1" value={Math.min(bgmStart,Math.ceil(total))} onChange={e=>setBgmStart(Number(e.target.value))}/><input type="number" min="0" max={Math.ceil(total)} value={bgmStart} onChange={e=>setBgmStart(Math.max(0,Math.min(Math.ceil(total),Number(e.target.value)||0)))}/></label>
{bgm==='file'&&audioFile?<label>曲のどの位置から使う？：{bgmOffset}秒<input type="range" min="0" max={Math.max(0,Math.floor(audioFile.seconds)-1)} step="1" value={Math.min(bgmOffset,Math.max(0,Math.floor(audioFile.seconds)-1))} onChange={e=>setBgmOffset(Number(e.target.value))}/><input type="number" min="0" max={Math.max(0,Math.floor(audioFile.seconds)-1)} value={bgmOffset} onChange={e=>setBgmOffset(Math.max(0,Math.min(Math.max(0,Math.floor(audioFile.seconds)-1),Number(e.target.value)||0)))}/></label>:null}
<div className="musicSwitchEditor"><h3>🎶 曲を途中で切り替える</h3><p className="note">追加した曲は指定位置から次の曲まで流れます。写真・動画の開始位置、または秒数で指定できます。</p><button onClick={()=>switchInput.current?.click()}>＋ 切り替えるBGMを追加</button>{orderedSwitches.map((m,i)=><div className="musicSwitchCard" key={m.id}><strong>曲{i+2}：{m.name}</strong><label>切り替え位置<select value={m.anchor} onChange={e=>setMusicSwitches(v=>v.map(x=>x.id===m.id?{...x,anchor:e.target.value as 'time'|'photo'}:x))}><option value="time">秒数で指定</option><option value="photo">写真・動画から指定</option></select></label>{m.anchor==='time'?<label>動画の何秒目？<input type="number" min="0" max={Math.ceil(total)} value={m.start} onChange={e=>setMusicSwitches(v=>v.map(x=>x.id===m.id?{...x,start:Math.max(0,Number(e.target.value)||0)}:x))}/></label>:<label>切り替える写真・動画<select value={m.photoId||photos[0]?.id||''} onChange={e=>setMusicSwitches(v=>v.map(x=>x.id===m.id?{...x,photoId:e.target.value}:x))}>{photos.map((p,j)=><option key={p.id} value={p.id}>{j+1}. {p.name}</option>)}</select></label>}<label>曲の再生開始（秒）<input type="number" min="0" max={m.seconds||3600} value={m.offset} onChange={e=>setMusicSwitches(v=>v.map(x=>x.id===m.id?{...x,offset:Math.max(0,Number(e.target.value)||0)}:x))}/></label><label>音量 {m.volume}%<input type="range" min="0" max="100" value={m.volume} onChange={e=>setMusicSwitches(v=>v.map(x=>x.id===m.id?{...x,volume:Number(e.target.value)}:x))}/></label><label>切り替えのフェード（秒）<input type="number" min="0" max="5" step=".5" value={m.fade} onChange={e=>setMusicSwitches(v=>v.map(x=>x.id===m.id?{...x,fade:Math.max(0,Math.min(5,Number(e.target.value)||0))}:x))}/></label><button onClick={()=>setMusicSwitches(v=>v.filter(x=>x.id!==m.id))}>この曲を削除</button></div>)}</div>
<label className="inlineOption"><input type="checkbox" checked={pauseBgmDuringVideo} onChange={e=>setPauseBgmDuringVideo(e.target.checked)}/> 動画の再生中はBGMを止める（写真に戻ると再開）</label>
<label>BGM音量：{volume}%<input type="range" min="0" max="100" step="5" value={volume} onChange={e=>setVolume(Number(e.target.value))}/></label>
{musicError?<p className="musicError" role="alert">{musicError}</p>:null}
<p className="note">アプリ内の音は動作確認用の簡易音源です。正式なBGM曲は後から追加します。Apple Musicなど保護された配信曲は取り込めません。</p>
</section><div className="editPageActions"><button onClick={()=>setEditPage('opening')}>← オープニング</button><button className="primary" onClick={()=>setEditPage('ending')}>次へ：エンディング →</button></div></>:null}{editPage==='finish'?<><h3>ムービーの長さ</h3><div className="mode"><label><input type="radio" checked={mode==='photo'} onChange={()=>setMode('photo')}/> 写真の表示時間を基準</label><label><input type="radio" checked={mode==='music'} onChange={()=>setMode('music')}/> 音楽の長さを基準</label></div>{mode==='photo'?<label>新しく追加する写真の初期表示時間：{duration}秒<input type="range" min="2" max="15" value={duration} onChange={e=>setDuration(Number(e.target.value))}/><button className="small" onClick={()=>setPhotos(p=>p.map(x=>({...x,duration})))}>全写真に適用</button></label>:<label>音楽の使用時間（秒）<input type="number" min="15" max="3600" value={musicSeconds} onChange={e=>setMusicSeconds(Math.max(15,Number(e.target.value)||15))}/></label>}<div className="summary">完成予定時間：約 {Math.floor(total/60)}分{Math.round(total%60)}秒（前後の演出各6秒を含む）</div><label>タイトル<input value={title} onChange={e=>setTitle(e.target.value)}/></label><section className="exportBox"><h3>🎬 動画を書き出す（試験機能）</h3>
<p className="note">iPhoneのブラウザによっては動画の記録に対応していません。動画の元音声を残すか選べます。BGMと同時に流れる場合は音量にご注意ください。作成には動画の長さと同じ程度の時間がかかります。</p>
<button className="primary" disabled={exporting||!photos.length} onClick={makeMovie}>{exporting?'動画を作成中… '+exportProgress+'%':'動画を作成する'}</button>
{exporting?<progress max="100" value={exportProgress} style={{width:'100%'}}/>:null}
{exportError?<p className="musicError" role="alert">{exportError}</p>:null}
{exportResult?<div><p>動画ができました（{exportResult.name}）</p><video src={exportResult.url} controls playsInline style={{width:'100%',maxHeight:320,background:'#211629'}}/><div className="actions"><button onClick={shareMovie}>共有・保存する</button><a className="downloadLink" href={exportResult.url} download={exportResult.name}>ファイルをダウンロード</a></div><p className="note">共有メニューから「ビデオを保存」が選べる場合は写真アプリに保存できます。対応形式は端末によって異なります。</p></div>:null}
</section><div className="editPageActions"><button onClick={()=>setEditPage('ending')}>← エンディング</button></div></>:null}<button className="secondary" onClick={()=>setStep('home')}>ホームに戻る</button></section>:null}
<input ref={switchInput} type="file" accept="audio/*,.mp3,.m4a,.wav,.aac" hidden onChange={e=>{void addMusicSwitch(e.target.files);e.target.value=''}}/><input ref={musicInput} type="file" accept="audio/*,.mp3,.m4a,.wav,.aac" hidden onChange={e=>{importMusic(e.target.files);e.target.value=''}}/>
<input ref={input} type="file" accept="image/*" multiple hidden onChange={e=>{void addPhotos(e.target.files);e.target.value=''}}/><input ref={videoInput} type="file" accept="video/*,.mov,.mp4,.m4v" multiple hidden onChange={e=>{void addPhotos(e.target.files);e.target.value=''}}/>
<footer>おもいでシアター · 試作版 v7.6</footer></main>
}