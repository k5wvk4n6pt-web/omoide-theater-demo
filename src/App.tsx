import {useEffect,useMemo,useRef,useState} from 'react';
import type {ChangeEvent,CSSProperties} from 'react';
import {clipGainValue,exportMovie} from './exportMovie';
import {listProjects,saveProject as persistProject,loadProject,deleteProject,duplicateProject} from './draftStore';
import type {ProjectSummary,StoredProject} from './draftStore';
import {loadSharedProject,newShareToken,saveSharedProject,shareTokenFromHash,SharedProjectConflict} from './sharedProject';
type CardSide='opening'|'ending';
type CardMedia={id:string;name:string;kind:'image'|'video';url:string;duration:number;effect:'none'};
const cardFileId=(side:CardSide)=>'title-card:'+side;

type SubtitleCue={id:string;text:string;start:number;end:number};
type MusicSwitch={id:string;name:string;url:string;seconds:number;start:number;anchor:'time'|'photo';photoId?:string;offset:number;volume:number;fade:number};
type Photo={subtitles?:SubtitleCue[];subtitleColor?:string;subtitleSize?:number;subtitleOutline?:string;trimStart?:number;sourceDuration?:number;keepAudio?:boolean;audioVolume?:number;kind?:'image'|'video';id:string;name:string;url:string;duration:number;effect:'fade'|'zoom'|'slide'|'page'|'heart'|'curtain'|'none'|'wipe'|'slideUp'|'circle'|'blinds'|'flash'|'blur'|'mosaic'|'random';sticker?:string;caption?:string;zoom?:number;offsetX?:number;offsetY?:number;captionX?:number;captionY?:number;captionFont?:string;captionColor?:string;captionSize?:number;captionWeight?:number;captionOutline?:boolean;captionOutlineColor?:string;captionBackground?:boolean;captionMotion?:'none'|'fade'|'rise'|'slide'};
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
const [importing,setImporting]=useState(false);
const [importNotice,setImportNotice]=useState('');
const [draftInfo,setDraftInfo]=useState('');
const [draftBusy,setDraftBusy]=useState(false);
const [projects,setProjects]=useState<ProjectSummary[]>([]);
const [projectId,setProjectId]=useState<string|null>(null);
const [shared,setShared]=useState<{token:string;etag:string}|null>(null);
const [shareNotice,setShareNotice]=useState('');
const [shareConflict,setShareConflict]=useState(false);
const pendingShareToken=useRef<string|null>(null);
const shareLinkField=useRef<HTMLInputElement>(null);
const [thumbUrls,setThumbUrls]=useState<Record<string,string>>({});
const thumbRef=useRef<Record<string,string>>({});
async function refreshProjects(){const list=await listProjects();setProjects(list);Object.values(thumbRef.current).forEach(url=>URL.revokeObjectURL(url));const urls:Record<string,string>={};list.forEach(p=>{if(p.thumbnail)urls[p.id]=URL.createObjectURL(p.thumbnail)});thumbRef.current=urls;setThumbUrls(urls)}

const [title,setTitle]=useState('');
const [endingStyle,setEndingStyle]=useState<'message'|'fuji_graduation'|'none'|'upload'>('message');
const [ending,setEnding]=useState('ありがとう、たくさんの思い出');
const [sticker,setSticker]=useState('none');
const [curtainColor,setCurtainColor]=useState<'red'|'pink'|'navy'|'gold'>('red');
const [opening,setOpening]=useState<'curtain'|'sparkle'|'sakura'|'album'|'countdown'|'rainbow'|'fade'|'gold_light'|'floral_wedding'|'sakura_tunnel'|'balloon_party'|'starry_story'|'retro_cinema'|'fuji_graduation'|'none'|'upload'>('fuji_graduation');
const [openingMedia,setOpeningMedia]=useState<CardMedia|null>(null);
const [endingMedia,setEndingMedia]=useState<CardMedia|null>(null);
const [cardError,setCardError]=useState('');
const openingRequest=useRef(0),endingRequest=useRef(0);
useEffect(()=>()=>{if(openingMedia)URL.revokeObjectURL(openingMedia.url)},[openingMedia]);
useEffect(()=>()=>{if(endingMedia)URL.revokeObjectURL(endingMedia.url)},[endingMedia]);

const [step,setStep]=useState<'home'|'edit'>('home');
const [selected,setSelected]=useState(0);
const [transitionScope,setTransitionScope]=useState<'one'|'all'|'chosen'>('one');
const [transitionTargets,setTransitionTargets]=useState<string[]>([]);
const [transitionChoice,setTransitionChoice]=useState<Photo['effect']>('fade');
const [editPage,setEditPage]=useState<'opening'|'main'|'ending'|'finish'>('opening');
const [editTool,setEditTool]=useState<'text'|'sticker'|'transition'|'duration'|'position'|'apply'|'subtitles'|null>(null);
const [undoStack,setUndoStack]=useState<Photo[][]>([]);
const [redoStack,setRedoStack]=useState<Photo[][]>([]);
const [mode,setMode]=useState<'photo'|'music'>('photo');
const [musicSeconds,setMusicSeconds]=useState(180);
const [duration,setDuration]=useState(5);
const [aspect,setAspect]=useState<'wide'|'vertical'|'square'>('wide');
const [playing,setPlaying]=useState(false);
const [previewPosition,setPreviewPosition]=useState(0);
const [scrubbing,setScrubbing]=useState(false);
const [sceneOffset,setSceneOffset]=useState(0);
const [playIndex,setPlayIndex]=useState(0);
const [phase,setPhase]=useState<'intro'|'photos'|'outro'>('intro');
const [sceneKey,setSceneKey]=useState(0);
const [subtitleTime,setSubtitleTime]=useState(0);
const previewVideo=useRef<HTMLVideoElement|null>(null);
const previewClipAudio=useRef<{context:AudioContext;gain:GainNode}|null>(null);
useEffect(()=>()=>{const graph=previewClipAudio.current;previewClipAudio.current=null;if(graph)void graph.context.close().catch(()=>{})},[step]);

function setPreviewClipVolume(volume:unknown,activate=false){
 const video=previewVideo.current;
 if(!video)return;
 const level=clipGainValue(volume);
 let graph=previewClipAudio.current;
 if(!graph&&activate&&level!==1){
  try{
   const context=new AudioContext();
   const gain=context.createGain();
   context.createMediaElementSource(video).connect(gain);
   gain.connect(context.destination);
   video.volume=1;
   graph={context,gain};
   previewClipAudio.current=graph;
  }catch{
   video.volume=level;
   return;
  }
 }
 if(graph){
  graph.gain.gain.value=level;
  if(activate&&graph.context.state!=='running')void graph.context.resume().catch(()=>{});
 }else{
  video.volume=level;
 }
}
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
const bgmMaster=useRef<GainNode|null>(null);
const synthOutput=useRef<GainNode|null>(null);
const activeSwitchGain=useRef<{id:string;node:GainNode}|null>(null);
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
const previewBgmPaused=useRef(false);
const [previewVideoScene,setPreviewVideoScene]=useState<number|null>(null);
const [previewVideoBlocked,setPreviewVideoBlocked]=useState(false);
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
useEffect(()=>{if(bgmMaster.current)bgmMaster.current.gain.value=volume/100},[volume]);
useEffect(()=>{
 const active=activeSwitchGain.current;
 const track=active&&musicSwitches.find(m=>m.id===active.id);
 if(active&&track)active.node.gain.value=track.volume/100;
},[musicSwitches]);
const openingClip=opening==='upload'?openingMedia:null;
const endingClip=endingStyle==='upload'?endingMedia:null;
const intro=opening==='none'?0:opening==='upload'?openingClip?.duration??0:6;
const outro=endingStyle==='none'?0:endingStyle==='upload'?endingClip?.duration??0:6;
const playingCard=phase==='intro'?openingClip:phase==='outro'?endingClip:null;
const playingVideo=phase==='photos'?photos[playIndex]?.kind==='video':playingCard?.kind==='video';
const computed=useMemo(()=>mode==='photo'?photos.map(p=>p.duration):photos.map(p=>p.kind==='video'?p.duration:Math.max(1,(musicSeconds-intro-outro-photos.filter(x=>x.kind==='video').reduce((a,b)=>a+b.duration,0))/Math.max(1,photos.filter(x=>x.kind!=='video').length))),[photos,mode,musicSeconds,intro,outro]);
const sceneStarts=useMemo(()=>{
 const starts=[intro];
 for(const seconds of computed)starts.push(starts[starts.length-1]+seconds);
 return starts;
},[computed,intro]);
const outroStart=sceneStarts[sceneStarts.length-1];
const total=outroStart+outro;
function previewSceneAt(position:number){
 if(position<intro)return {phase:'intro',index:0,offset:position} as const;
 if(position>=outroStart&&outro>0)return {phase:'outro',index:0,offset:position-outroStart} as const;
 if(position>=outroStart){const index=computed.length-1;return {phase:'photos',index,offset:computed[index]??0} as const;}
 const index=sceneStarts.findIndex(start=>start>position)-1;
 return {phase:'photos',index,offset:position-sceneStarts[index]} as const;
}
const positionLabel=(seconds:number)=>{
 const whole=Math.floor(seconds);
 return Math.floor(whole/60)+':'+String(whole%60).padStart(2,'0');
};
const switchAt=(m:MusicSwitch)=>m.anchor==='photo'&&m.photoId?intro+computed.slice(0,Math.max(0,photos.findIndex(p=>p.id===m.photoId))).reduce((a,b)=>a+b,0):m.start;
const orderedSwitches=[...musicSwitches].sort((a,b)=>switchAt(a)-switchAt(b));
useEffect(()=>{
if(!playing||photos.length===0)return;
if(playingVideo&&previewVideoScene!==sceneKey)return;
const seconds=phase==='intro'?intro:phase==='outro'?outro:computed[playIndex];
const sceneStart=phase==='intro'?0:phase==='outro'?outroStart:sceneStarts[playIndex];
const startedAt=performance.now();
setPreviewPosition(sceneStart+sceneOffset);
const progress=window.setInterval(()=>setPreviewPosition(Math.min(sceneStart+seconds,sceneStart+sceneOffset+(performance.now()-startedAt)/1000)),100);
const timer=window.setTimeout(()=>{
 setSceneOffset(0);
 if(phase==='intro'){setPhase('photos');setPlayIndex(0)}
 else if(phase==='photos'&&playIndex<photos.length-1){setPlayIndex(i=>i+1)}
 else if(phase==='photos'&&outro>0){setPhase('outro')}
 else{setPlaying(false);setPhase('intro');setPlayIndex(0);setPreviewPosition(0)}
 setSceneKey(k=>k+1);
},Math.max(0,seconds-sceneOffset)*1000);
return()=>{window.clearTimeout(timer);window.clearInterval(progress)};
},[playing,phase,playIndex,photos,computed,previewVideoScene,sceneKey,sceneOffset,sceneStarts,outroStart,intro,outro,playingVideo]);
function readVideoDuration(url:string){
 return new Promise<number>(resolve=>{
  const video=document.createElement('video');
  video.preload='metadata';
  const timer=window.setTimeout(()=>finish(5),5000);
  function finish(seconds:number){
   window.clearTimeout(timer);
   video.onloadedmetadata=null;
   video.onerror=null;
   video.removeAttribute('src');
   video.load();
   resolve(seconds);
  }
  video.onloadedmetadata=()=>finish(Number.isFinite(video.duration)?Math.max(0.001,video.duration):5);
  video.onerror=()=>finish(5);
  video.src=url;
  video.load();
 });
}
function readCardMedia(url:string,kind:CardMedia['kind']):Promise<number>{
 return new Promise((resolve,reject)=>{
  const media=kind==='video'?document.createElement('video'):new Image();
  const timer=window.setTimeout(()=>finish(0),10000);
  function finish(seconds:number){
   clearTimeout(timer);
   media.removeAttribute('src');
   if(seconds>0)resolve(seconds);else reject(Error('画像または動画を読み込めませんでした。'));
  }
  media.onerror=()=>finish(0);
  if(media instanceof HTMLVideoElement){
   media.preload='metadata';
   media.onloadedmetadata=()=>finish(Number.isFinite(media.duration)?media.duration:0);
  }else media.onload=()=>finish(6);
  media.src=url;
 });
}
async function uploadCard(side:CardSide,file:File|undefined){
 if(!file)return;
 const request=side==='opening'?openingRequest:endingRequest;
 const sequence=++request.current;
 const kind=file.type.startsWith('video/')||/\.(mov|mp4|m4v|webm)$/i.test(file.name)?'video':'image';
 const url=URL.createObjectURL(file);
 setCardError('');
 try{
  const duration=await readCardMedia(url,kind);
  if(sequence!==request.current){URL.revokeObjectURL(url);return;}
  const media:CardMedia={id:cardFileId(side),name:file.name,kind,url,duration,effect:'none'};
  setPlaying(false);stopMusic();setScrubbing(false);setPreviewPosition(0);
  if(side==='opening')setOpeningMedia(media);else setEndingMedia(media);
 }catch(error){
  URL.revokeObjectURL(url);
  if(sequence===request.current)setCardError(error instanceof Error?error.message:'素材を読み込めませんでした。');
 }
}
function cardPicker(side:CardSide,media:CardMedia|null){
 return <><label>画像・動画を選ぶ
  <input type="file" accept="image/*,video/*,.mov,.mp4,.m4v,.webm" onChange={e=>{
   const file=e.currentTarget.files?.[0];e.currentTarget.value='';
   void uploadCard(side,file);
  }}/>
 </label>{media?<p className="note">{media.name}（{media.duration.toFixed(1)}秒）</p>:null}
 {cardError?<p className="musicError" role="alert">{cardError}</p>:null}</>;
}
async function addPhotos(files:FileList|null){
 if(!files?.length||importing)return;
 const chosenFiles=Array.from(files);
 const selectedFiles=chosenFiles.flatMap(file=>{
  const video=file.type.startsWith('video/')||/\.(mov|mp4|m4v|webm)$/i.test(file.name);
  const photo=file.type.startsWith('image/')||/\.(jpe?g|png|webp|gif|bmp|avif|heic|heif|tiff?)$/i.test(file.name);
  return video||photo?[{file,video}]:[];
 });
 if(!selectedFiles.length){
  setImportNotice('追加できる写真や動画を選んでください。');
  return;
 }
 setImporting(true);
 setImportNotice('写真・動画を読み込み中…');
 const urls:string[]=[];
 try {
  const items=await Promise.all(selectedFiles.map(async ({file,video}):Promise<Photo>=>{
   const url=URL.createObjectURL(file);
   urls.push(url);
   const seconds=video?await readVideoDuration(url):duration;
   return {id:id(),kind:video?'video':'image',name:file.name,url,duration:seconds,sourceDuration:video?seconds:undefined,trimStart:0,keepAudio:video,effect:video?'fade':'zoom'};
  }));
  stopMusic();
  setPlaying(false);
  setPhase('intro');
  setSelected(photosRef.current.length);
  setPhotos(previous=>[...previous,...items]);
  setEditPage('main');
  setStep('edit');
  setImportNotice(items.length+'件追加しました。'+(selectedFiles.length<chosenFiles.length?' 対応していないファイルは追加できませんでした。':''));
 } catch {
  urls.forEach(url=>URL.revokeObjectURL(url));
  setImportNotice('写真・動画を読み込めませんでした。ファイルを選び直してください。');
 } finally {
  setImporting(false);
 }
}
function importSelectedMedia(event:ChangeEvent<HTMLInputElement>){
 const input=event.currentTarget;
 void addPhotos(input.files);
 input.value='';
}
function remove(i:number){setPhotos(p=>p.filter((_,j)=>j!==i));setSelected(0)}
function move(i:number,offset:number){const to=i+offset;if(to<0||to>=photos.length)return;setPhotos(p=>{const next=[...p];[next[i],next[to]]=[next[to],next[i]];return next});setSelected(to)}
function update(i:number,patch:Partial<Photo>){setPhotos(p=>{setUndoStack(stack=>[...stack.slice(-19),p]);setRedoStack([]);return p.map((v,j)=>j===i?{...v,...patch}:v)})}
function undo(){if(!undoStack.length)return;setRedoStack(x=>[...x,photos]);setPhotos(undoStack[undoStack.length-1]);setUndoStack(x=>x.slice(0,-1))}
function redo(){if(!redoStack.length)return;setUndoStack(x=>[...x,photos]);setPhotos(redoStack[redoStack.length-1]);setRedoStack(x=>x.slice(0,-1))}
function applyAll(){if(!current)return;setUndoStack(x=>[...x.slice(-19),photos]);setRedoStack([]);setPhotos(p=>p.map(x=>({...x,sticker:current.sticker,caption:current.caption,zoom:current.zoom,offsetX:current.offsetX,offsetY:current.offsetY,captionX:current.captionX,captionY:current.captionY,captionFont:current.captionFont,captionColor:current.captionColor,captionSize:current.captionSize,captionWeight:current.captionWeight,captionOutline:current.captionOutline,captionOutlineColor:current.captionOutlineColor,captionBackground:current.captionBackground,captionMotion:current.captionMotion,effect:current.effect,duration:current.duration})))}

const current=photos[selected];
const [trimPreviewError,setTrimPreviewError]=useState('');
const trimming=editPage==='main'&&editTool==='duration'&&current?.kind==='video';
const trimStart=current?.trimStart??0;
const trimEnd=trimStart+(current?.duration??0);
const trimLimit=Math.max(trimEnd,current?.sourceDuration??0);
const minTrimLength=Math.min(0.1,trimLimit);
const trimTime=(seconds:number)=>seconds.toFixed(1)+'秒';
function adjustTrim(start:number,end:number,previewTime:number){
 if(playing)return;
 const video=previewVideo.current;
 if(video&&!scrubbing){
  video.pause();
  video.currentTime=previewTime;
 }
 setScrubbing(false);
 update(selected,{trimStart:start,duration:end-start});
}
function previewTrim(){
 const video=previewVideo.current;
 if(!video||playing||scrubbing)return;
 setTrimPreviewError('');
 setPreviewClipVolume(current?.audioVolume,true);
 video.currentTime=trimStart;
 void video.play().catch(()=>setTrimPreviewError('選んだ範囲を再生できませんでした。'));
}
const scrubScene=!playing&&scrubbing&&photos.length?previewSceneAt(Math.min(previewPosition,total)):null;
const openingStill=!playing&&(scrubScene?scrubScene.phase==='intro':editPage==='opening');
const endingStill=!playing&&(scrubScene?scrubScene.phase==='outro':editPage==='ending');
const titleCardStill=openingStill||endingStill;
const showOpening=openingStill||(playing&&phase==='intro');
const showEnding=endingStill||(playing&&phase==='outro');
const activePhoto=photos[playing?playIndex:scrubScene?.index??selected];
const visibleCard=showOpening?openingClip:showEnding?endingClip:null;
const previewMedia=visibleCard??(titleCardStill||playing&&phase!=='photos'?undefined:activePhoto);

useEffect(()=>{setPreviewClipVolume(visibleCard?undefined:activePhoto?.audioVolume)},[activePhoto?.id,activePhoto?.audioVolume,visibleCard]);
const displayedSubtitleTime=scrubScene?.phase==='photos'?scrubScene.offset:subtitleTime;
const scrubVideoTime=scrubScene&&previewMedia?.kind==='video'?(visibleCard?0:activePhoto?.trimStart??0)+scrubScene.offset:null;
const transitionEffect=activePhoto?.effect==='random'?['fade','wipe','circle','slideUp','blur','flash'][playIndex%6]:activePhoto?.effect;
const activeDuration=computed[playing?playIndex:selected]||duration;
const activeSubtitle=activePhoto?.subtitles?.find(c=>displayedSubtitleTime>=c.start&&displayedSubtitleTime<c.end);
const shownSticker=activePhoto?.sticker??sticker;
const symbols:Record<string,string>={bear:'🧸',rabbit:'🐰',camera:'📷',clapper:'🎬',bouquet:'💐',crown:'👑',graduation:'🎓',diploma:'📜',cake:'🎂',gift:'🎁',balloons:'🎈',rainbow:'🌈',star:'⭐',heart:'💗',music:'🎵',treble:'🎼',sparkles:'✨'};

function stopMusic(clearSwitches=true){
 if(clearSwitches){switchTimers.current.forEach(window.clearTimeout);switchTimers.current=[];if(switchAudio.current){switchAudio.current.pause();switchAudio.current=null}}
 if(bgmDelay.current!==null){window.clearTimeout(bgmDelay.current);bgmDelay.current=null}
 if(audioRef.current){audioRef.current.pause();audioRef.current.currentTime=0;audioRef.current=null}
 if(synthTimer.current!==null){window.clearInterval(synthTimer.current);synthTimer.current=null}
 synthOutput.current?.disconnect();synthOutput.current=null;
 if(clearSwitches&&soundCtx.current){
  void soundCtx.current.close();soundCtx.current=null;bgmMaster.current=null;activeSwitchGain.current=null;
 }

 setMusicPlaying(false);
}
function previewAudioContext(){
 if(soundCtx.current&&bgmMaster.current)return {ctx:soundCtx.current,master:bgmMaster.current};
 const ctx=new AudioContext();
 const master=ctx.createGain();
 master.gain.value=volume/100;
 master.connect(ctx.destination);
 soundCtx.current=ctx;
 bgmMaster.current=master;
 return {ctx,master};
}
function musicPlaybackError(error:unknown){
 setMusicError(error instanceof DOMException&&error.name==='NotAllowedError'
  ?'ブラウザがBGMの再生を止めました。「BGMを試聴」をタップして確認してください。'
  :'この音声は再生できません。別のファイルをお試しください。');
}
function playMusic(elapsed=0){
 stopMusic(false);setMusicError('');
 if(bgm==='none')return;
 if(bgm==='file'&&!audioFile){setMusicError('先に音楽ファイルを選んでください');return}
 try{
  const {ctx,master}=previewAudioContext();
  void ctx.resume().catch(musicPlaybackError);
  if(bgm==='file'&&audioFile){
  const audio=new Audio(audioFile.url);audio.loop=true;ctx.createMediaElementSource(audio).connect(master);audioRef.current=audio;const seek=()=>{try{audio.currentTime=(bgmOffset+elapsed)%(audio.duration||audioFile.seconds||1)}catch{}};audio.addEventListener('loadedmetadata',seek,{once:true});seek();
  void audio.play().then(()=>{if(audioRef.current===audio)setMusicPlaying(true)}).catch(error=>{if(audioRef.current===audio){musicPlaybackError(error);setMusicPlaying(false)}});
  return;
  }
  const output=ctx.createGain();output.connect(master);synthOutput.current=output;
  const gentle=[261.63,329.63,392,523.25,392,329.63,293.66,349.23];
  const bright=[392,493.88,587.33,783.99,659.25,587.33,493.88,523.25];
  const notes=bgm==='gentle'?gentle:bright;
  let index=Math.floor(elapsed/(bgm==='gentle'?1.3:.85));
  const note=()=>{if(ctx.state==='closed')return;const osc=ctx.createOscillator(),gain=ctx.createGain();
   osc.type=bgm==='gentle'?'sine':'triangle';osc.frequency.value=notes[index++%notes.length];
   const t=ctx.currentTime;gain.gain.setValueAtTime(0.0001,t);gain.gain.exponentialRampToValueAtTime(.10,t+.12);gain.gain.exponentialRampToValueAtTime(.0001,t+1.1);
   osc.connect(gain);gain.connect(output);osc.start(t);osc.stop(t+1.12);
  };note();synthTimer.current=window.setInterval(note,bgm==='gentle'?1300:850);setMusicPlaying(true);
 }catch{setMusicError('この端末ではBGMを再生できません')}
}
function syncPreviewBgm(pause:boolean){
 previewBgmPaused.current=pause;
 const currentMusic=switchAudio.current??audioRef.current;
 if(audioRef.current&&switchAudio.current)audioRef.current.pause();
 if(currentMusic){
  if(pause)currentMusic.pause();
  else if(currentMusic.paused)void currentMusic.play().catch(()=>{});
 }
 if(soundCtx.current){
  if(pause)void soundCtx.current.suspend();
  else void soundCtx.current.resume();
 }
}
useEffect(()=>{
 const video=previewVideo.current;
 setPreviewVideoBlocked(false);
 if(!video)return;
 if(!playing||!playingVideo){
  if(!playing){
   if(previewMedia?.kind==='video'){
    if(video.src!==previewMedia.url)video.src=previewMedia.url;
    if(scrubVideoTime!==null){
     video.pause();
     const seek=()=>{try{video.currentTime=scrubVideoTime}catch{}};
     if(video.readyState>=1)seek();
     else video.addEventListener('loadedmetadata',seek,{once:true});
     return()=>video.removeEventListener('loadedmetadata',seek);
    }
   }else if(video.hasAttribute('src')){video.removeAttribute('src');video.load()}
  }
  return;
 }
 const clip=previewMedia;
 if(clip?.kind!=='video')return;
 if(video.src!==clip.url)video.src=clip.url;
 let active=true;
 const begin=()=>{
  video.defaultMuted=false;
  video.muted=false;
  const start=(visibleCard?0:activePhoto?.trimStart??0)+sceneOffset;
  try{if(Math.abs(video.currentTime-start)>.15)video.currentTime=start}catch{}
  void video.play().catch(()=>{if(active)setPreviewVideoBlocked(true)});
 };
 if(video.readyState>=1)begin();
 else video.addEventListener('loadedmetadata',begin,{once:true});
 return()=>{active=false;video.removeEventListener('loadedmetadata',begin);video.pause()};
},[playing,phase,playIndex,sceneKey,titleCardStill,previewMedia?.url,sceneOffset,scrubVideoTime,playingVideo]);
useEffect(()=>{setSubtitleTime(playing?sceneOffset:0)},[playIndex,selected,sceneKey]);
useEffect(()=>{if(!playing||phase!=='photos'||(photos[playIndex]?.kind==='video'&&previewVideoScene!==sceneKey))return;const start=performance.now();const timer=window.setInterval(()=>setSubtitleTime(Math.min(computed[playIndex]??5,sceneOffset+(performance.now()-start)/1000)),100);return()=>clearInterval(timer)},[playing,phase,playIndex,sceneKey,previewVideoScene,sceneOffset]);
async function addMusicSwitch(files:FileList|null){const file=files?.[0];if(!file)return;const url=URL.createObjectURL(file);const seconds=await new Promise<number>(resolve=>{const a=new Audio();a.preload='metadata';a.onloadedmetadata=()=>resolve(Number.isFinite(a.duration)?Math.round(a.duration):0);a.onerror=()=>resolve(0);a.src=url});setMusicSwitches(v=>[...v,{id:id(),name:file.name,url,seconds,start:Math.min(total,6),anchor:'time',offset:0,volume:100,fade:1}])}
function seekPreview(position:number){
 setScrubbing(true);
 setPlaying(false);
 stopMusic();
 setPreviewPosition(position);
}
function startPreview(){
 if(!photos.length)return;
 if(playing){seekPreview(previewPosition);return;}
 const position=previewPosition>=total?0:previewPosition;
 const {phase:nextPhase,index:nextIndex,offset}=previewSceneAt(position);
 const video=previewVideo.current;
 const card=nextPhase==='intro'?openingClip:nextPhase==='outro'?endingClip:null;
 const clip=nextPhase==='photos'?photos[nextIndex]:card;
 if(video&&(clip?.kind==='video'||openingClip?.kind==='video'||endingClip?.kind==='video'||photos.some(photo=>photo.kind==='video'))){
  const adjustedVideo=photos.find(photo=>photo.kind==='video'&&clipGainValue(photo.audioVolume)!==1);
  if(adjustedVideo)setPreviewClipVolume(adjustedVideo.audioVolume,true);
  setPreviewClipVolume(nextPhase==='photos'?photos[nextIndex]?.audioVolume:undefined,true);
  video.src=clip?.kind==='video'?clip.url:new URL('../preview-silence.mp4',import.meta.url).href;
  if(clip?.kind==='video'){try{video.currentTime=(nextPhase==='photos'?photos[nextIndex]?.trimStart??0:0)+offset}catch{}}
  void video.play().catch(()=>{});
 }
 setPreviewPosition(position);
 setScrubbing(false);setPlayIndex(nextIndex);setPhase(nextPhase);setSceneOffset(offset);setPlaying(true);
 setSceneKey(key=>key+1);
 stopMusic();
 const pause=pauseBgmDuringVideo&&clip?.kind==='video';
 previewBgmPaused.current=pause;
 if(bgm!=='none'||orderedSwitches.length){
  try{void previewAudioContext().ctx.resume().catch(musicPlaybackError)}catch(error){musicPlaybackError(error)}
 }
 const activeSwitch=[...orderedSwitches].reverse().find(m=>switchAt(m)<=position);
 function startSwitch(m:MusicSwitch,elapsed:number){
  try{
  switchAudio.current?.pause();
  audioRef.current?.pause();
  if(synthTimer.current!==null){window.clearInterval(synthTimer.current);synthTimer.current=null;}
  synthOutput.current?.disconnect();synthOutput.current=null;
  const {ctx,master}=previewAudioContext();
  activeSwitchGain.current?.node.disconnect();
  const audio=new Audio(m.url);
  const gain=ctx.createGain();
  gain.gain.value=m.volume/100;
  ctx.createMediaElementSource(audio).connect(gain);
  gain.connect(master);
  activeSwitchGain.current={id:m.id,node:gain};
  switchAudio.current=audio;
  audio.loop=true;
  const seek=()=>{if(Number.isFinite(audio.duration)&&audio.duration>0)audio.currentTime=(m.offset+elapsed)%audio.duration};
  audio.addEventListener('loadedmetadata',seek,{once:true});seek();
  if(!previewBgmPaused.current)void audio.play().catch(error=>{if(switchAudio.current===audio)musicPlaybackError(error)});
  }catch(error){musicPlaybackError(error)}
 }
 if(activeSwitch)startSwitch(activeSwitch,position-switchAt(activeSwitch));
 else if(position>=bgmStart){playMusic(position-bgmStart);syncPreviewBgm(pause)}
 else bgmDelay.current=window.setTimeout(()=>{bgmDelay.current=null;if(!switchAudio.current){playMusic();syncPreviewBgm(previewBgmPaused.current)}},(bgmStart-position)*1000);
 for(const m of orderedSwitches){
  const at=switchAt(m);
  if(at>position)switchTimers.current.push(window.setTimeout(()=>startSwitch(m,0),(at-position)*1000));
 }
}
async function snapshotProject():Promise<StoredProject>{
 const getBlob=async (url:string)=>{
  const response=await fetch(url);
  if(!response.ok)throw Error('素材を読み込めませんでした。');
  return response.blob();
 };
 // The archive already supports named extra files, including when submissions are appended.
 const cards=([openingMedia,endingMedia]).filter((media):media is CardMedia=>media!==null);
 const [items,audio,switchFiles]=await Promise.all([
  Promise.all(photos.map(async p=>({meta:{...p,url:undefined},blob:await getBlob(p.url)}))),
  audioFile?getBlob(audioFile.url).then(blob=>({name:audioFile.name,seconds:audioFile.seconds,blob})):undefined,
  Promise.all([...musicSwitches,...cards].map(async m=>({id:m.id,blob:await getBlob(m.url)}))),
 ]);
 return {version:1,savedAt:new Date().toISOString(),photos:items,audio,switchFiles,settings:{cardMedia:cards.map(({url,...media})=>media),title,ending,endingStyle,sticker,curtainColor,opening,mode,musicSeconds,duration,aspect,bgm,volume,bgmStart,bgmOffset,musicSwitches:musicSwitches.map(({url,...m})=>m),pauseBgmDuringVideo}};
}
async function saveProject(){
 if(!photos.length||draftBusy)return;setDraftBusy(true);setDraftInfo('保存中…');
 try{
  const draft=await snapshotProject();
  const targetId=projectId??id();
  await persistProject(targetId,draft);
  setProjectId(targetId);await refreshProjects();setDraftInfo('保存しました：'+new Date(draft.savedAt).toLocaleString('ja-JP'));
 }catch(e){setDraftInfo('保存できませんでした。端末の空き容量やプライベートブラウズ設定をご確認ください。'+(e instanceof Error?' '+e.message:''))}
 finally{setDraftBusy(false)}
}
function applyStoredProject(draft:StoredProject,targetId:string|null){
 stopMusic();
  const next=draft.photos.map(p=>{
   const {frame: _frame,decoration: _decoration,...meta}=p.meta as Partial<Photo>&{frame?:string;decoration?:string};
   const isVideo=p.blob.type.startsWith('video/') || /\.(mov|mp4|m4v|webm)$/i.test(meta.name ?? '');
   return {...meta, kind:isVideo?'video':(meta.kind ?? 'image'), url:URL.createObjectURL(p.blob)} as Photo;
  });
  photosRef.current.forEach(p=>URL.revokeObjectURL(p.url));setPhotos(next);setSelected(0);setUndoStack([]);setRedoStack([]);setPlaying(false);setPreviewPosition(0);setScrubbing(false);
  const v=draft.settings;
  setTitle(v.title as string);setEnding(v.ending as string);setEndingStyle(v.endingStyle==='fuji_graduation'||v.endingStyle==='none'||v.endingStyle==='upload'?v.endingStyle:'message');setSticker(v.sticker as string);setCurtainColor((v.curtainColor as typeof curtainColor)||'red');setOpening((v.opening as typeof opening)||(v.theme==='theater'?'curtain':'fade'));setMode(v.mode as typeof mode);setMusicSeconds(v.musicSeconds as number);setDuration(v.duration as number);setAspect(v.aspect as typeof aspect);setBgm(v.bgm as typeof bgm);setVolume(v.volume as number);setBgmStart(Math.max(0,Number(v.bgmStart)||0));setBgmOffset(Math.max(0,Number(v.bgmOffset)||0));setPauseBgmDuringVideo(v.pauseBgmDuringVideo!==false);
  function restoreCard(side:CardSide):CardMedia|null{
   const id=cardFileId(side);
   const meta=Array.isArray(v.cardMedia)?v.cardMedia.find(item=>item?.id===id):null;
   const file=draft.switchFiles?.find(item=>item.id===id);
   if(!file||!meta||typeof meta.name!=='string'||!Number.isFinite(meta.duration)||meta.duration<=0||
      (meta.kind!=='image'&&meta.kind!=='video'))return null;
   return {id,name:meta.name,kind:meta.kind,duration:meta.duration,url:URL.createObjectURL(file.blob),effect:'none'};
  }
  openingRequest.current++;endingRequest.current++;
  setOpeningMedia(restoreCard('opening'));setEndingMedia(restoreCard('ending'));setCardError('');
  setMusicSwitches((Array.isArray(v.musicSwitches)?v.musicSwitches:[]).map((m:MusicSwitch)=>{const item=draft.switchFiles?.find(x=>x.id===m.id);return {...m,url:item?URL.createObjectURL(item.blob):''}}).filter((m:MusicSwitch)=>m.url));
  if(draft.audio){setAudioFile({name:draft.audio.name,seconds:draft.audio.seconds,url:URL.createObjectURL(draft.audio.blob)})}else setAudioFile(null);
  setProjectId(targetId);setStep('edit');setImportNotice('');
}
async function restoreProject(targetId:string){
 if(draftBusy)return;setDraftBusy(true);setDraftInfo('読み込み中…');
 try{
  const draft=await loadProject(targetId);if(!draft){setDraftInfo('保存された作品がありません');return}
  applyStoredProject(draft,targetId);
  setDraftInfo('保存した作品を開きました');
 }catch(e){setDraftInfo('読み込めませんでした。'+(e instanceof Error?' '+e.message:''))}
 finally{setDraftBusy(false)}
}
function sharedLink(token:string){
 return window.location.origin+window.location.pathname+'#share='+token;
}
function leaveSharedProject(){
 if(window.location.hash.startsWith('#share='))window.history.replaceState(null,'',window.location.pathname+window.location.search);
 setShared(null);setShareNotice('');setShareConflict(false);pendingShareToken.current=null;
}
async function saveOnline(){
 if(draftBusy||shareConflict)return;
 if(!shared&&!pendingShareToken.current&&!window.confirm('作品の写真・動画・BGMをネットに保存します。共有リンクを知っている人は作品を開いて編集できます。保存しますか？'))return;
 setDraftBusy(true);setShareNotice('共有先に保存しています…');
 try{
  const draft=await snapshotProject();
  const token=shared?.token??pendingShareToken.current??newShareToken();
  pendingShareToken.current=token;
  let etag:string;
  try {
   etag=await saveSharedProject(token,shared?.etag??null,draft);
  } catch(error) {
   if(shared||!(error instanceof SharedProjectConflict))throw error;
   const current=await loadSharedProject(token);
   etag=await saveSharedProject(token,current.etag,draft);
  }
  setShared({token,etag});
  window.history.replaceState(null,'',sharedLink(token));
  setShareNotice('共有作品を保存しました。');
 }catch(error){
  setShareConflict(error instanceof SharedProjectConflict);
  setShareNotice(error instanceof Error?error.message:'共有作品を保存できませんでした。');
 }finally{setDraftBusy(false)}
}
async function reloadShared(){
 if(!shared||draftBusy||!window.confirm('この画面の編集内容を、共有先の最新版に置き換えますか？'))return;
 setDraftBusy(true);setShareNotice('共有作品を読み込み中…');
 try {
  const {project,etag}=await loadSharedProject(shared.token);
  applyStoredProject(project,projectId);
  setShared({...shared,etag});setShareConflict(false);
  setShareNotice('共有先の最新版を開きました。');
 }catch(error){setShareNotice(error instanceof Error?error.message:'共有作品を読み込めませんでした。')}
 finally{setDraftBusy(false)}
}
async function copyShareLink(){
 if(!shared)return;
 try {
  await navigator.clipboard.writeText(sharedLink(shared.token));
  setShareNotice('共有リンクをコピーしました。');
 }catch{
  shareLinkField.current?.focus();shareLinkField.current?.select();
  setShareNotice('選択した共有リンクをコピーしてください。');
 }
}
useEffect(()=>{
 let active=true;
 const token=shareTokenFromHash(window.location.hash);
 if(!token)return;
 setDraftBusy(true);setDraftInfo('共有作品を読み込み中…');
 void loadSharedProject(token).then(({project,etag})=>{
  if(!active)return;
  applyStoredProject(project,null);
  setShared({token,etag});setEditPage('main');
  setDraftInfo('');setShareNotice('共有作品を開きました。');
 }).catch(error=>{
  if(active)setDraftInfo(error instanceof Error?error.message:'共有作品を読み込めませんでした。');
 }).finally(()=>{if(active)setDraftBusy(false)});
 return()=>{active=false};
},[]);
async function eraseProject(targetId:string){
 if(!window.confirm('この作品の保存データを削除しますか？'))return;
 try{await deleteProject(targetId);if(projectId===targetId)setProjectId(null);await refreshProjects();setDraftInfo('作品を削除しました')}catch{setDraftInfo('削除できませんでした')}
}
async function copyProject(targetId:string){
 try{await duplicateProject(targetId,id());await refreshProjects();setDraftInfo('作品を複製しました')}catch{setDraftInfo('複製できませんでした')}
}
function newProject(){openingRequest.current++;endingRequest.current++;setOpeningMedia(null);setEndingMedia(null);setCardError('');leaveSharedProject();setPlaying(false);setPreviewPosition(0);setScrubbing(false);stopMusic();setPhotos([]);setProjectId(null);setSelected(0);setUndoStack([]);setRedoStack([]);setAudioFile(null);setMusicSwitches([]);setTitle('');setOpening('fuji_graduation');setEndingStyle('message');setEnding('ありがとう、たくさんの思い出');setEditPage('opening');setStep('edit');setDraftInfo('')}

async function makeMovie(){
 if(!photos.length||exporting)return;
 if(opening==='upload'&&!openingMedia||endingStyle==='upload'&&!endingMedia){
  setExportError('オープニングまたはエンディングの画像・動画を選ぶか、「なし」を選んでください。');
  return;
 }
 setPlaying(false);stopMusic();setExportError('');setExportProgress(0);setExporting(true);
 try{
  const {blob,extension}=await exportMovie({photos:photos.map(p=>({...p,sticker:p.sticker??sticker})),durations:computed,openingMedia:openingClip,endingMedia:endingClip,title,ending,endingStyle,sticker,curtainColor,opening,aspect,bgm,audioUrl:audioFile?.url,volume,bgmStart,bgmOffset,musicSwitches:orderedSwitches.map(m=>({...m,start:switchAt(m)})),pauseBgmDuringVideo,onProgress:setExportProgress});
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
useEffect(()=>{
 if(!playing){previewBgmPaused.current=false;return;}
 syncPreviewBgm(pauseBgmDuringVideo&&playingVideo);
},[playing,playingVideo,pauseBgmDuringVideo]);


const submissionSite='https://kiku-sotsuen-movie.th-1043.chatgpt.site/';
const graduationArtwork = new URL('../fuji-graduation-opening.webp', import.meta.url).href;
const graduationPosterCover = import.meta.env.BASE_URL + 'artwork/graduation-home-cover.webp';
return <main className={step==='home'?'theaterHome':'theaterEditor'}>
{step!=='home'?<header className="graduationEditorHeader">
  <img src={graduationPosterCover} width={1086} height={1448} alt="卒園ムービー。みんなの思い出を、ひとつに。"/>
</header>:null}
{step==='home'?<section className="graduationHome">
  <div className="graduationPoster">
    <img className="graduationPosterCover" src={graduationPosterCover} width={1086} height={1448} alt="卒園ムービー。みんなの思い出を、ひとつに。" fetchPriority="high"/>
    <img className="graduationPosterArtwork" src={graduationArtwork} width={1376} height={768} alt="令和9年 卒園式 思い出アルバム。桜と虹の下にふじほいくえんの園庭。"/>
    <button type="button" className="graduationPosterAction" aria-label="ムービーを作る" disabled={draftBusy} onClick={newProject}/>
  </div>
  <a className="graduationSubmitLink" href={submissionSite}><span className="graduationSubmitIcon" aria-hidden="true">📸</span>写真・動画の提出ページへ<span className="graduationSubmitArrow" aria-hidden="true">›</span></a>
  {projects.length>0?<div className="draftBox"><h3>📁 保存した作品（{projects.length}件）</h3><div className="projectList">{projects.map(p=><div className="projectCard" key={p.id}>{thumbUrls[p.id]?<img src={thumbUrls[p.id]} alt="作品の表紙"/>:<div className="projectFallback">🎬</div>}<div className="projectDetail"><strong>{p.title}</strong><small>{p.photoCount}枚 · {new Date(p.savedAt).toLocaleString('ja-JP')}</small><div className="projectButtons"><button onClick={()=>restoreProject(p.id)} disabled={draftBusy}>編集する</button><button onClick={()=>copyProject(p.id)} disabled={draftBusy}>複製</button><button onClick={()=>eraseProject(p.id)} disabled={draftBusy}>削除</button></div></div></div>)}</div></div>:null}{draftInfo?<p className="note" role="status">{draftInfo}</p>:null}</section>:null}
{step==='edit'?<section className="panel"><div className="sectionHeading"><h2>ムービーを作成</h2></div><nav className="editSteps" aria-label="編集の手順">{([['opening','① オープニング'],['main','② 本編'],['ending','③ エンディング'],['finish','④ 完成・保存']] as const).map(([key,label])=><button key={key} className={editPage===key?'active':''} aria-current={editPage===key?'step':undefined} onClick={()=>{setPlaying(false);setScrubbing(false);setEditPage(key)}}>{label}</button>)}</nav>{editPage!=='opening'?<div className="actions" role="group" aria-label="写真・動画の追加">
<label className={'mediaPicker'+(photos.length===0?' primary':'')}>
 ＋ 写真を追加する
 <input type="file" accept="image/*,.jpg,.jpeg,.png,.heic,.heif,.webp" multiple disabled={importing||draftBusy} onChange={importSelectedMedia}/>
</label>
<label className="mediaPicker">
 ＋ 動画を追加する
 <input type="file" accept="video/*,.mov,.mp4,.m4v,.webm" multiple disabled={importing||draftBusy} onChange={importSelectedMedia}/>
</label>
</div>:null}<p className="note" role="status" hidden={!importNotice}>{importNotice}</p>
<section className="sharedPreview"><div className="previewHeading"><h3>{scrubScene?'🎥 全体プレビュー':openingStill?'🎬 オープニングプレビュー':endingStill?'🌷 エンディングプレビュー':'🎥 全体プレビュー'}</h3>{photos.length>0?<button type="button" onClick={startPreview}>{playing?'■ 停止':previewPosition>0&&previewPosition<total?'▶ ここから再生':'▶ 最初から再生'}</button>:null}</div><div className={'preview '+aspect}><div className={'previewFrame'+(openingStill?' openingStill':'')}>
{playing&&phase==='photos'&&transitionEffect==='page'&&photos.length>0&&((playIndex===0&&opening==='album')||photos[playIndex-1])?<div key={'turn-'+sceneKey} className="albumFullPageTurn" aria-hidden="true">{playIndex===0?<div className="albumTurnTitlePage"><span>{title}</span></div>:<div className="albumTurnPreviousPage"><div className="albumTurnPhotoClip">{photos[playIndex-1].kind==='video'?<div className="albumTurnVideoPlaceholder">🎞️</div>:<img src={photos[playIndex-1].url} alt="" style={{transform:'scale('+(photos[playIndex-1].zoom??1)+') translate('+(photos[playIndex-1].offsetX??0)+'%,'+(photos[playIndex-1].offsetY??0)+'%)'}}/>}</div>{photos[playIndex-1].caption?<div className="albumTurnCaption" style={{left:(photos[playIndex-1].captionX??50)+'%',top:(photos[playIndex-1].captionY??83)+'%',fontFamily:photos[playIndex-1].captionFont==='cursive'?'Yomogi, cursive':photos[playIndex-1].captionFont??'sans-serif',fontSize:(photos[playIndex-1].captionSize??22)+'px',fontWeight:photos[playIndex-1].captionWeight??700,color:photos[playIndex-1].captionColor??'#fff',background:photos[playIndex-1].captionBackground?'rgba(0,0,0,.58)':'transparent'}}>{photos[playIndex-1].caption}</div>:null}</div>}</div>:null}
{showOpening&&opening==='album'?<div className="albumCustomTitle"><span>{title}</span></div>:null}
{playing&&phase==='photos'&&playIndex>0&&transitionEffect!=='none'&&transitionEffect!=='page'&&photos[playIndex-1].kind!=='video'?<div key={'under-'+sceneKey} className="transitionUnderlay"><div className="underlayClip"><img src={photos[playIndex-1].url} alt="" style={{transform:'scale('+(photos[playIndex-1].zoom??1)+') translate('+(photos[playIndex-1].offsetX??0)+'%,'+(photos[playIndex-1].offsetY??0)+'%)'}}/></div></div>:null}
<div onPointerDown={e=>{if(!scrubbing&&!visibleCard&&editTool==='position')beginDrag(e,'photo')}} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} className={'scenePhoto '+' '+(playing&&phase==='photos'?'animate '+(transitionEffect==='page'?'albumStill':transitionEffect):'')+(editTool==='position'?' draggablePhoto':'')} style={{'--scene-duration':activeDuration+'s'} as CSSProperties} data-video-hidden={previewMedia?.kind!=='video'} >
<video ref={previewVideo} playsInline onPointerDown={()=>setPreviewClipVolume(visibleCard?undefined:activePhoto?.audioVolume,true)} onPlay={()=>setPreviewClipVolume(visibleCard?undefined:activePhoto?.audioVolume,true)} controls={(!playing&&!scrubbing)||previewVideoBlocked} preload="auto" onTimeUpdate={e=>{
 if(!playing&&trimming&&!e.currentTarget.paused&&e.currentTarget.currentTime>=trimEnd)e.currentTarget.pause();
}} onPlaying={()=>{if(playing&&playingVideo){setPreviewVideoScene(sceneKey);setPreviewVideoBlocked(false)}}} onError={()=>{if(playing&&playingVideo)setPreviewVideoBlocked(true)}} style={{transform:'scale('+(visibleCard?1:activePhoto?.zoom??1)+') translate('+(visibleCard?0:activePhoto?.offsetX??0)+'%,'+(visibleCard?0:activePhoto?.offsetY??0)+'%)'}}/>
</div>
{titleCardStill||visibleCard?null:activePhoto?(activePhoto.kind==='video'?null:<div key={sceneKey+'-'+activePhoto.id} onPointerDown={e=>{if(!scrubbing&&editTool==='position')beginDrag(e,'photo')}} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} className={'scenePhoto '+' '+(playing&&phase==='photos'?'animate '+(transitionEffect==='page'?'albumStill':transitionEffect):'')+(editTool==='position'?' draggablePhoto':'')} style={{'--scene-duration':activeDuration+'s'} as CSSProperties}><img src={activePhoto.url} alt="選択中の写真" style={{transform:'scale('+(activePhoto.zoom??1)+') translate('+(activePhoto.offsetX??0)+'%,'+(activePhoto.offsetY??0)+'%)'}} /></div>):<span>上のボタンから写真や動画を追加できます</span>}
{visibleCard?.kind==='image'?<img className="openingTitleArtwork" src={visibleCard.url} alt={visibleCard.name}/>:null}
{(showOpening&&(opening==='none'||opening==='upload'&&!openingMedia)||showEnding&&(endingStyle==='none'||endingStyle==='upload'&&!endingMedia))?
 <span>{(showOpening?opening:endingStyle)==='none'?'なし':'画像または動画を選んでください'}</span>:null}
{showOpening&&opening==='curtain'?<div key={'curtain-'+sceneKey} className={'curtainOverlay curtain-'+curtainColor}><div className="curtainPanel curtainLeft"/><div className="curtainPanel curtainRight"/><div className="curtainCaption">{title}</div></div>:null}
{showEnding&&(endingStyle==='message'||endingStyle==='fuji_graduation') ? (
 endingStyle==='fuji_graduation'
  ? <img className="openingTitleArtwork" src={new URL('../fuji-graduation-ending.jpeg', import.meta.url).href} alt="たくさんの思い出をありがとう 令和9年 卒園式"/>
  : <div className={'endingScreen'+(endingStill?' endingStill':'')}><div>Fin.</div><small>{ending}</small></div>
):null}
{!titleCardStill&&(!playing||phase==='photos')&&shownSticker!=='none'?<div className="previewSticker" aria-hidden="true">{symbols[shownSticker]}</div>:null}
{!titleCardStill&&activeSubtitle&&(!playing||phase==='photos')?<div className="timedSubtitle" style={{color:activePhoto.subtitleColor??'#ffffff',fontSize:(activePhoto.subtitleSize??22)+'px',WebkitTextStroke:'0.5px '+(activePhoto.subtitleOutline??'#202020'),textShadow:'-1px -1px 0 '+(activePhoto.subtitleOutline??'#202020')+', 1px 1px 0 '+(activePhoto.subtitleOutline??'#202020')}}>{activeSubtitle.text}</div>:null}
{!titleCardStill&&activePhoto?.caption&&(!playing||phase==='photos')?<div key={activePhoto.id+'-'+sceneKey} className={'photoCaption '+(editTool==='text'?'draggableCaption':'')+(playing&&phase==='photos'?' captionMotion-'+(activePhoto.captionMotion??'none'):'')} style={{left:(activePhoto.captionX??50)+'%',top:(activePhoto.captionY??83)+'%',bottom:'auto',right:'auto',fontFamily:activePhoto.captionFont==='cursive'?'Yomogi, cursive':activePhoto.captionFont??'sans-serif',color:activePhoto.captionColor??'#ffffff',fontSize:(activePhoto.captionSize??22)+'px',fontWeight:activePhoto.captionWeight??700,textShadow:'none',background:activePhoto.captionBackground?'rgba(0,0,0,.58)':'transparent'}} onPointerDown={e=>{if(!scrubbing&&editTool==='text')beginDrag(e,'caption')}} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>{activePhoto.captionOutline?<span aria-hidden="true" className="captionOutlineLayer" style={{WebkitTextStroke:((activePhoto.captionWeight??700)>=900?'3.2px ':(activePhoto.captionWeight??700)>=700?'2.2px ':'1.2px ')+(activePhoto.captionOutlineColor??'#222222')}}>{activePhoto.caption}</span>:null}<span className="captionFillLayer" style={{WebkitTextStroke:(activePhoto.captionWeight??700)>=900?'1.35px '+(activePhoto.captionColor??'#ffffff'):(activePhoto.captionWeight??700)>=700?'.65px '+(activePhoto.captionColor??'#ffffff'):'0px transparent',paintOrder:'stroke fill'}}>{activePhoto.caption}</span></div>:null}
{showOpening && opening==='fuji_graduation' ? <img className="openingTitleArtwork" src={graduationArtwork} alt="令和9年 卒園式 思い出アルバム"/> : null}
{showOpening&&opening!=='curtain'&&opening!=='album'&&opening!=='fuji_graduation'&&opening!=='none'&&opening!=='upload'?<div key={'opening-'+sceneKey} className={'openingOverlay opening-'+opening}>{(['gold_light','floral_wedding','sakura_tunnel','balloon_party','starry_story','retro_cinema'].includes(opening))?<><div className="openingPhotoBackground" style={{backgroundImage:`url(${import.meta.env.BASE_URL}${opening}.png)`}}/><div className={"openingPhotoParticles"+(opening==='sakura_tunnel'?" sakuraPetalParticles":"")} aria-hidden="true">{Array.from({length:14},(_,i)=><span key={i} style={{left:(i*37%97)+'%',top:(i*23%91)+'%',animationDelay:-(i*.43)+'s'}}>{opening==='sakura_tunnel'?' ':opening==='balloon_party'?'🎈':opening==='floral_wedding'?'✿':opening==='retro_cinema'?'✦':opening==='starry_story'?'✧':'✦'}</span>)}</div></>:null}{opening==='countdown'?(!openingStill||!title.trim())&&<div className="countdownDial" aria-label="3、2、1とカウントダウン"><span className="countdownNumber countdownThree">3</span><span className="countdownNumber countdownTwo">2</span><span className="countdownNumber countdownOne">1</span><span className="countdownSweep"/></div>:<div className="openingOrnaments" aria-hidden="true">{opening==='sparkle'?'✦ ✧ ✨ ✦ ✧':opening==='sakura'?'🌸 🌸 🌸 🌸':opening==='rainbow'?'🌈 ☁️ ☁️':'✧'}</div>}<div className="openingHeading">{title}</div></div>:null}
</div></div>
{photos.length>0?<div className="previewTimeline">
 <label>再生位置 <span>{positionLabel(Math.min(previewPosition,total))} / {positionLabel(total)}</span>
  <input type="range" min={0} max={total} step="any" value={Math.min(previewPosition,total)} onChange={e=>seekPreview(Number(e.target.value))}/>
 </label>
</div>:null}
{playing&&previewVideoBlocked?<p className="note" role="status">動画の再生ボタンを押すと、音声付きでプレビューを続けられます。</p>:null}
{editPage==='main'?<><h3>写真の並び順</h3><div className="strip">{photos.map((p,i)=><button key={p.id} className={'thumb '+(selected===i?'selected':'')} onClick={()=>{setSelected(i);setScrubbing(false);setPlaying(false);setPhase('intro');setSceneKey(k=>k+1)}}>{p.kind==='video'?<VideoThumbnail url={p.url} name={p.name}/>:<img src={p.url} alt={p.name}/>}<span>{i+1}</span></button>)}</div>{current&&<div className="editor"><h3>選択中の{current.kind==='video'?'動画':'写真'}：{selected+1}番目</h3><div className="photoToolGrid">{([['text','T','文字'],['subtitles','▤','字幕'],['sticker','☺','スタンプ'],['transition','⇄','切り替え'],['duration','◷','表示時間'],['position','⛶','拡大・移動'],['apply','▢','一括適用']] as const).map(([key,icon,label])=><button key={key} className={editTool===key?'chosen':''} onClick={()=>{setScrubbing(false);if(key==='transition')setTransitionChoice(current.effect);setEditTool(editTool===key?null:key)}}><span>{icon}</span><small>{key==='duration'&&current.kind==='video'?'トリミング':label}</small></button>)}</div>
{current.kind==='video'?<label>この動画の音量：{Math.round(clipGainValue(current.audioVolume)*100)}%
 <input type="range" min="0" max="100" step="1" value={Math.round(clipGainValue(current.audioVolume)*100)} disabled={playing} onChange={e=>{
  const audioVolume=Number(e.currentTarget.value);
  if(activePhoto?.id===current.id)setPreviewClipVolume(audioVolume,true);
  update(selected,{audioVolume});
 }}/>
</label>:null}
{editTool?<div className="photoToolPanel">
{editTool==='subtitles'?<div className="subtitleEditor"><h4>字幕（この写真・動画）</h4><label>表示を確認する位置：{subtitleTime.toFixed(1)}秒<input type="range" min="0" max={Math.max(1,current.duration)} step="0.1" value={Math.min(subtitleTime,current.duration)} onChange={e=>setSubtitleTime(Number(e.target.value))}/></label>{(current.subtitles??[]).map(c=><div className="subtitleCue" key={c.id}><label>字幕<input value={c.text} placeholder="字幕を入力" onChange={e=>update(selected,{subtitles:(current.subtitles??[]).map(x=>x.id===c.id?{...x,text:e.target.value}:x)})}/></label><div className="subtitleTimes"><label>開始（秒）<input type="number" min="0" max={current.duration} step="0.1" value={c.start} onChange={e=>update(selected,{subtitles:(current.subtitles??[]).map(x=>x.id===c.id?{...x,start:Math.min(current.duration,Math.max(0,Number(e.target.value)))}:x)})}/></label><label>終了（秒）<input type="number" min="0" max={current.duration} step="0.1" value={c.end} onChange={e=>update(selected,{subtitles:(current.subtitles??[]).map(x=>x.id===c.id?{...x,end:Math.min(current.duration,Math.max(0,Number(e.target.value)))}:x)})}/></label></div><button className="small" onClick={()=>update(selected,{subtitles:(current.subtitles??[]).filter(x=>x.id!==c.id)})}>この字幕を削除</button></div>)}<button onClick={()=>{const start=Math.min(Math.max(0,subtitleTime),Math.max(0,current.duration-1));update(selected,{subtitles:[...(current.subtitles??[]),{id:id(),text:'',start:Math.round(start*10)/10,end:Math.min(current.duration,Math.round((start+3)*10)/10)}]})}}>＋ 字幕を追加</button><label>字幕の色<input type="color" value={current.subtitleColor??'#ffffff'} onChange={e=>update(selected,{subtitleColor:e.target.value})}/></label><label>字幕サイズ：{current.subtitleSize??22}px<input type="range" min="12" max="42" value={current.subtitleSize??22} onChange={e=>update(selected,{subtitleSize:Number(e.target.value)})}/></label><label>縁取り色<input type="color" value={current.subtitleOutline??'#202020'} onChange={e=>update(selected,{subtitleOutline:e.target.value})}/></label></div>:null}
{editTool==='text'?<div className="captionControls"><label>写真に表示する文字（プレビューで移動できます）<input value={current.caption??''} onChange={e=>update(selected,{caption:e.target.value})} placeholder="例：みんなと過ごした毎日"/></label><label>フォント<select value={current.captionFont??'sans-serif'} onChange={e=>update(selected,{captionFont:e.target.value})}><option value="sans-serif">ゴシック</option><option value="serif">明朝</option><option value="Yomogi, cursive">手書き風（やわらか）</option><option value="Zen Kurenaido, cursive">手書き風（すっきり）</option><option value="monospace">タイプライター</option></select></label><label>文字色<input type="color" value={current.captionColor??'#ffffff'} onChange={e=>update(selected,{captionColor:e.target.value})}/></label><label>文字の太さ<select value={current.captionWeight??700} onChange={e=>update(selected,{captionWeight:Number(e.target.value)})}><option value={400}>標準</option><option value={700}>太字</option><option value={900}>極太</option></select></label><label>文字サイズ：{current.captionSize??22}px<input type="range" min="12" max="52" value={current.captionSize??22} onChange={e=>update(selected,{captionSize:Number(e.target.value)})}/></label><label className="inlineOption"><input type="checkbox" checked={current.captionOutline??false} onChange={e=>update(selected,{captionOutline:e.target.checked})}/> 文字に縁取りを付ける</label>{current.captionOutline?<label>縁取りの色<input type="color" value={current.captionOutlineColor??'#222222'} onChange={e=>update(selected,{captionOutlineColor:e.target.value})}/></label>:null}<label className="inlineOption"><input type="checkbox" checked={current.captionBackground??false} onChange={e=>update(selected,{captionBackground:e.target.checked})}/> 文字の後ろに半透明の背景</label><label>文字の登場演出<select value={current.captionMotion??'none'} onChange={e=>update(selected,{captionMotion:e.target.value as Photo['captionMotion']})}><option value="none">なし</option><option value="fade">ふわっと現れる</option><option value="rise">下から現れる</option><option value="slide">横から流れる</option></select></label></div>:null}
{editTool==='sticker'?<label>この写真のスタンプ<select value={current.sticker??sticker} onChange={e=>update(selected,{sticker:e.target.value})}><option value="none">なし</option>{Object.entries(symbols).map(([key,value])=><option key={key} value={key}>{value} {key}</option>)}</select></label>:null}
{editTool==='transition'?<div className="transitionScopePanel"><strong>切り替えを設定する範囲</strong><div className="transitionScopeButtons"><button type="button" className={transitionScope==='one'?'chosen':''} onClick={()=>setTransitionScope('one')}>このページだけ</button><button type="button" className={transitionScope==='all'?'chosen':''} onClick={()=>setTransitionScope('all')}>すべてのページ</button><button type="button" className={transitionScope==='chosen'?'chosen':''} onClick={()=>{setTransitionScope('chosen');setTransitionTargets(t=>t.length?t:[current.id])}}>選んだページ</button></div>{transitionScope==='chosen'?<div className="frameTargetGrid">{photos.map((p,i)=><label key={p.id} className="frameTarget"><input type="checkbox" checked={transitionTargets.includes(p.id)} onChange={e=>setTransitionTargets(t=>e.target.checked?[...t,p.id]:t.filter(id=>id!==p.id))}/>{p.kind==='video'?<VideoThumbnail url={p.url} name={p.name}/>:<img src={p.url} alt={p.name}/>}<span>{i+1}番</span></label>)}</div>:null}<label>切り替えを選ぶ<select value={transitionChoice} onChange={e=>{const value=e.target.value as Photo['effect'];setTransitionChoice(value);setUndoStack(x=>[...x.slice(-19),photos]);setRedoStack([]);setPhotos(p=>p.map((photo,i)=>(transitionScope==='all'||transitionScope==='one'&&i===selected||transitionScope==='chosen'&&transitionTargets.includes(photo.id))?{...photo,effect:value}:photo))}}><option value="zoom">ゆっくりズーム</option><option value="fade">フェード</option><option value="slide">スライド</option><option value="page">ページめくり</option><option value="heart">ハート</option><option value="curtain">カーテン</option><option value="none">切り替えなし</option><option value="wipe">ワイプ</option><option value="slideUp">上へスライド</option><option value="circle">円形</option><option value="blinds">ブラインド</option><option value="flash">光</option><option value="blur">ぼかし</option><option value="mosaic">モザイク</option><option value="random">ランダム</option></select></label><button type="button" disabled={transitionScope==='chosen'&&!transitionTargets.length} onClick={()=>{setUndoStack(x=>[...x.slice(-19),photos]);setRedoStack([]);setPhotos(p=>p.map((photo,i)=>(transitionScope==='all'||transitionScope==='one'&&i===selected||transitionScope==='chosen'&&transitionTargets.includes(photo.id))?{...photo,effect:transitionChoice}:photo))}}>選択範囲に適用</button><p className="note">{transitionScope==='one'?'選択中の1枚に適用します。':transitionScope==='all'?'すべての写真・動画に同じ切り替えを設定します。':transitionTargets.length+'枚を選択中です。チェックを付けた素材だけに適用します。'}</p></div>:null}
{editTool==='duration'?(current.kind==='video'?<div className="videoTrim">
 <h4>動画のトリミング</h4>
 <label>開始位置：{trimTime(trimStart)}
  <input type="range" min={0} max={Math.max(0,trimEnd-minTrimLength)} step="any" value={trimStart} disabled={playing} onChange={e=>{const start=Number(e.target.value);adjustTrim(start,trimEnd,start)}}/>
 </label>
 <label>終了位置：{trimTime(trimEnd)}
  <input type="range" min={Math.min(trimLimit,trimStart+minTrimLength)} max={trimLimit} step="any" value={trimEnd} disabled={playing} onChange={e=>{const end=Number(e.target.value);adjustTrim(trimStart,end,end)}}/>
 </label>
 <p>使う長さ：{trimTime(current.duration)}</p>
 <div className="actions">
  <button type="button" disabled={playing||scrubbing} onClick={previewTrim}>▶ 選んだ範囲を再生</button>
  <button type="button" disabled={playing||(trimStart===0&&trimEnd===trimLimit)} onClick={()=>adjustTrim(0,trimLimit,0)}>全体に戻す</button>
 </div>
 <label><input type="checkbox" checked={current.keepAudio??true} onChange={e=>update(selected,{keepAudio:e.target.checked})}/> 動画の元音声を残す</label>
 {trimPreviewError?<p role="status">{trimPreviewError}</p>:null}
 <small>選んだ範囲がムービーに使われます。</small>
</div>:<label>表示時間：{current.duration}秒<input type="range" min="2" max="15" value={current.duration} onChange={e=>update(selected,{duration:Number(e.target.value)})}/>{mode==='music'?<small>音楽の長さ基準では個別の秒数は反映されません</small>:null}</label>):null}
{editTool==='position'?<><p className="note">プレビューを1本指で移動、2本指で拡大・縮小できます。</p><label>拡大：{Math.round((current.zoom??1)*100)}%<input type="range" min="1" max="3" step=".05" value={current.zoom??1} onChange={e=>update(selected,{zoom:Number(e.target.value)})}/></label><label>左右位置<input type="range" min="-60" max="60" value={current.offsetX??0} onChange={e=>update(selected,{offsetX:Number(e.target.value)})}/></label><label>上下位置<input type="range" min="-60" max="60" value={current.offsetY??0} onChange={e=>update(selected,{offsetY:Number(e.target.value)})}/></label><button type="button" onClick={()=>update(selected,{zoom:1,offsetX:0,offsetY:0})}>位置と拡大率をリセット</button></>:null}
{editTool==='apply'?<><p className="note">選択中の写真の設定を全写真にコピーします。</p><button onClick={applyAll}>全写真に適用する</button></>:null}
</div>:null}
<div className="actions"><button disabled={!undoStack.length} onClick={undo}>↶ 取り消し</button><button disabled={!redoStack.length} onClick={redo}>↷ やり直し</button></div>
<div className="actions"><button disabled={selected===0} onClick={()=>move(selected,-1)}>← 前へ</button><button disabled={selected===photos.length-1} onClick={()=>move(selected,1)}>後ろへ →</button><button className="danger" onClick={()=>remove(selected)}>削除</button></div><label>演出<select value={current.effect} onChange={e=>update(selected,{effect:e.target.value as Photo['effect']})}><option value="zoom">ゆっくりズーム</option><option value="fade">フェード</option><option value="slide">スライド</option><option value="page">ページめくり</option><option value="heart">ハート</option><option value="curtain">カーテン</option><option value="none">切り替えなし</option><option value="wipe">ワイプ</option><option value="slideUp">上へスライド</option><option value="circle">円形</option><option value="blinds">ブラインド</option><option value="flash">光</option><option value="blur">ぼかし</option><option value="mosaic">モザイク</option><option value="random">ランダム</option></select></label>{mode==='photo'&&current.kind!=='video'&&<label>表示時間：{current.duration}秒<input type="range" min="2" max="15" value={current.duration} onChange={e=>update(selected,{duration:Number(e.target.value)})}/></label>}</div>}</>:null}

<div className="actions" role="group" aria-label="途中保存"><button onClick={saveProject} disabled={draftBusy||importing}>{draftBusy?'処理中…':'途中保存'}</button>{projectId?<button onClick={()=>restoreProject(projectId)} disabled={draftBusy||importing}>保存した状態に戻す</button>:null}
<button disabled={importing||draftBusy||shareConflict} onClick={saveOnline}>{shared?'共有作品を保存':'ネットに保存して共有'}</button>
</div>
{shared?<div className="shareBox">
 <label>共有リンク<input ref={shareLinkField} type="text" value={sharedLink(shared.token)} readOnly onFocus={e=>e.currentTarget.select()}/></label>
 <div className="actions"><button onClick={copyShareLink}>共有リンクをコピー</button><button disabled={draftBusy||importing} onClick={reloadShared}>共有先の最新版を開く</button></div>
 <p className="note">リンクを知っている人は、写真や動画を見て作品を編集できます。</p>
 <div className="actions">
  <a className="downloadLink" target="_blank" rel="noreferrer" href={submissionSite+'manage#project='+shared.token}>きく組の提出データを追加</a>
 </div>
</div>:null}
{shareNotice?<p className="note" role="status">{shareNotice}</p>:null}
{shareConflict?<p className="note">手元の編集を残すには「途中保存」を押してから、共有先の最新版を開いてください。</p>:null}
{draftInfo?<p className="note" role="status">{draftInfo}</p>:null}
</section>{editPage==='main'?<><p className="note">カーテン・写真のフェード／ズーム／スライドを画面で確認できます。BGMは試聴用です。動画の書き出しは下の試験機能で確認できます。</p><div className="editPageActions"><button onClick={()=>setEditPage('opening')}>← オープニング</button><button className="primary" onClick={()=>setEditPage('ending')}>次へ：エンディング →</button></div></>:null}{editPage==='opening'?<><section className="designBox"><h3>🎬 オープニング作成</h3>
<label>オープニング演出<select value={opening} onChange={e=>{setPlaying(false);setScrubbing(false);setPreviewPosition(0);setCardError('');setOpening(e.target.value as typeof opening)}}>
  {opening!=='fuji_graduation'&&opening!=='curtain'&&opening!=='album'&&opening!=='none'&&opening!=='upload'?<option value={opening} disabled>保存済みの演出</option>:null}
  <option value="fuji_graduation">🌸 令和9年 卒園式（ふじほいくえん）</option>
  <option value="curtain">🎭 カーテン</option>
  <option value="album">📖 アルバムが開く</option>
  <option value="none">なし</option>
  <option value="upload">画像・動画をアップロード</option>
</select></label>
{opening==='curtain'?<label>カーテンの色<select value={curtainColor} onChange={e=>setCurtainColor(e.target.value as typeof curtainColor)}><option value="red">クラシック（赤）</option><option value="pink">パステル（ピンク）</option><option value="navy">ナイト（紺）</option><option value="gold">ゴールド</option></select></label>:null}
{opening==='album'?<p className="note">📖 本編の切り替えは素材ごとに選択できます。</p>:null}
{opening==='upload'?cardPicker('opening',openingMedia):opening==='none'?null:opening==='fuji_graduation'?<p className="note">画像に入っているタイトルを表示します。</p>:<label>オープニングタイトル<input value={title} onChange={e=>setTitle(e.target.value)}/></label>}<label>動画の向き<select value={aspect} onChange={e=>setAspect(e.target.value as typeof aspect)}><option value="wide">横型（16:9）</option><option value="vertical">縦型（9:16）</option><option value="square">正方形（1:1）</option></select></label><p className="note">オープニング演出とタイトルを選びます。タイトルは本編中には表示しません。</p></section>
<section className="musicBox"><h3>🎵 BGMを選ぶ</h3>
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
</section>
<div className="editPageActions"><button className="primary" onClick={()=>setEditPage('main')}>次へ：本編 →</button></div></>:null}{editPage==='ending'?<><section className="designBox"><h3>🌷 エンディング作成</h3>
<label>エンディングの種類
 <select value={endingStyle} onChange={e=>{setPlaying(false);setScrubbing(false);setPreviewPosition(0);setCardError('');setEndingStyle(e.target.value as typeof endingStyle)}}>
  <option value="none">なし</option>
  <option value="upload">画像・動画をアップロード</option>
  <option value="message">メッセージ</option>
  <option value="fuji_graduation">🌸 卒園式・たくさんの思い出をありがとう</option>
 </select>
</label>
{endingStyle==='upload'?cardPicker('ending',endingMedia):null}
{endingStyle==='message' ? <label>最後に表示するメッセージ<textarea rows={2} maxLength={70} value={ending} onChange={e=>setEnding(e.target.value)} placeholder="ありがとう、たくさんの思い出"/></label> : null}
</section><div className="editPageActions"><button onClick={()=>setEditPage('main')}>← 本編</button><button className="primary" onClick={()=>setEditPage('finish')}>次へ：完成・保存 →</button></div></>:null}{editPage==='finish'?<><h3>ムービーの長さ</h3><div className="mode"><label><input type="radio" checked={mode==='photo'} onChange={()=>setMode('photo')}/> 写真の表示時間を基準</label><label><input type="radio" checked={mode==='music'} onChange={()=>setMode('music')}/> 音楽の長さを基準</label></div>{mode==='photo'?<label>新しく追加する写真の初期表示時間：{duration}秒<input type="range" min="2" max="15" value={duration} onChange={e=>setDuration(Number(e.target.value))}/><button className="small" onClick={()=>setPhotos(p=>p.map(x=>({...x,duration})))}>全写真に適用</button></label>:<label>音楽の使用時間（秒）<input type="number" min="15" max="3600" value={musicSeconds} onChange={e=>setMusicSeconds(Math.max(15,Number(e.target.value)||15))}/></label>}<div className="summary">完成予定時間：約 {Math.floor(total/60)}分{Math.round(total%60)}秒（オープニング・エンディングを含む）</div><label>タイトル<input value={title} onChange={e=>setTitle(e.target.value)}/></label><section className="exportBox"><h3>🎬 動画を書き出す（試験機能）</h3>
<p className="note">動画の元音声を残すか選べます。BGMと同時に流れる場合は音量にご注意ください。作成には動画の長さと同じ程度の時間がかかります。</p>
<button className="primary" disabled={exporting||!photos.length} onClick={makeMovie}>{exporting?'動画を作成中… '+exportProgress+'%':'動画を作成する'}</button>
{exporting?<progress max="100" value={exportProgress} style={{width:'100%'}}/>:null}
{exportError?<p className="musicError" role="alert">{exportError}</p>:null}
{exportResult?<div><p>動画ができました（{exportResult.name}）</p><video src={exportResult.url} controls playsInline style={{width:'100%',maxHeight:320,background:'#211629'}}/><div className="actions">
<a className="downloadLink" href={exportResult.url} download={exportResult.name}>動画をダウンロード（{exportResult.name.split('.').pop()?.toUpperCase()}）</a>
<button onClick={shareMovie}>共有・保存する</button>
</div><p className="note">{/Android/i.test(navigator.userAgent)
 ? 'ダウンロードした動画は、ブラウザの「ダウンロード」から開けます。'
 : '共有メニューに「ビデオを保存」が表示される場合は、写真アプリにも保存できます。'}</p></div>:null}
</section><div className="editPageActions"><button onClick={()=>setEditPage('ending')}>← エンディング</button></div></>:null}<button className="secondary" disabled={importing||draftBusy} onClick={()=>{leaveSharedProject();setImportNotice('');setStep('home')}}>ホームに戻る</button></section>:null}
<input ref={switchInput} type="file" accept="audio/*,.mp3,.m4a,.wav,.aac" hidden onChange={e=>{void addMusicSwitch(e.target.files);e.target.value=''}}/><input ref={musicInput} type="file" accept="audio/*,.mp3,.m4a,.wav,.aac" hidden onChange={e=>{importMusic(e.target.files);e.target.value=''}}/>
{step!=='home'?<footer>おもいでシアター · 試作版 v8.20</footer>:null}</main>
}
