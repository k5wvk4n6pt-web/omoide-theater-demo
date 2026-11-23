export type ExportPhoto={subtitles?:{id:string;text:string;start:number;end:number}[];subtitleColor?:string;subtitleSize?:number;subtitleOutline?:string;trimStart?:number;sourceDuration?:number;keepAudio?:boolean;kind?:'image'|'video';url:string;duration:number;effect:'fade'|'zoom'|'slide'|'page'|'heart'|'curtain';frame?:string;decoration?:string;sticker?:string;caption?:string;zoom?:number;offsetX?:number;offsetY?:number;captionX?:number;captionY?:number;captionFont?:string;captionColor?:string;captionSize?:number;captionWeight?:number;captionOutline?:boolean;captionOutlineColor?:string;captionBackground?:boolean;captionMotion?:'none'|'fade'|'rise'|'slide'};
export type ExportOptions={photos:ExportPhoto[];durations:number[];title:string;ending:string;frame:string;background:string;decoration:string;sticker:string;curtainColor:string;opening?:'curtain'|'sparkle'|'sakura'|'album'|'countdown'|'rainbow'|'fade';theme:string;aspect:'wide'|'vertical';bgm:'none'|'gentle'|'bright'|'file';audioUrl?:string;volume:number;bgmStart?:number;bgmOffset?:number;musicSwitches?:{id:string;url:string;start:number;offset:number;volume:number;fade:number}[];pauseBgmDuringVideo?:boolean;onProgress:(p:number)=>void};
const sleep=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
function loadImage(url:string){return new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('写真を読み込めませんでした'));img.src=url})}
function drawImage(ctx:CanvasRenderingContext2D,img:HTMLImageElement|HTMLVideoElement,w:number,h:number,scale:number,shift:number,offsetY=0){const iw=img instanceof HTMLVideoElement?img.videoWidth:img.naturalWidth,ih=img instanceof HTMLVideoElement?img.videoHeight:img.naturalHeight;if(!iw||!ih)return false;const ratio=Math.min(w/iw,h/ih);const dw=iw*ratio*scale,dh=ih*ratio*scale;ctx.drawImage(img,(w-dw)/2+shift,(h-dh)/2+offsetY,dw,dh);return true}
function decorate(ctx:CanvasRenderingContext2D,w:number,h:number,frame:ExportOptions['frame']){
 if(frame==='none')return;
 ctx.save();ctx.lineWidth=Math.max(8,w*.018);ctx.strokeStyle=frame==='gold'?'#d5aa52':frame==='green'?'#7abf81':frame==='film'?'#302a31':frame==='snow'?'#c8eafa':frame==='sunflower'?'#f5c844':frame==='sakura'?'#f7cfdf':'#f4d1e5';
 ctx.strokeRect(10,10,w-20,h-20);
 ctx.font=Math.round(w*.065)+'px sans-serif';ctx.textBaseline='top';ctx.fillStyle='#fff';
 const symbol=frame==='sakura'?'🌸':frame==='gold'?'✦':frame==='green'?'🌿':frame==='film'?'▣':frame==='snow'?'❄':frame==='sunflower'?'🌻':frame==='balloon'?'🎈':frame==='album'?'📒':frame==='polaroid'?'▧':'♡';
 ctx.fillText(symbol,24,22);ctx.textAlign='right';ctx.fillText(symbol,w-24,22);
 ctx.textBaseline='bottom';ctx.fillText(symbol,w-24,h-22);ctx.textAlign='left';ctx.fillText(symbol,24,h-22);
 ctx.restore();
}
function drawExtras(ctx:CanvasRenderingContext2D,w:number,h:number,o:ExportOptions,t:number){
 ctx.save();
 const stamps:Record<string,string>={bear:'🧸',rabbit:'🐰',camera:'📷',clapper:'🎬',bouquet:'💐',crown:'👑',graduation:'🎓',diploma:'📜',cake:'🎂',gift:'🎁',balloons:'🎈',rainbow:'🌈',star:'⭐',heart:'💗',music:'🎵',treble:'🎼',sparkles:'✨'};
 if(o.decoration!=='none'){const icons:Record<string,string>={petals:'🌸',glitter:'✦',bubbles:'◯',hearts:'♥',fireworks:'✺',snow:'❄',confetti:'◆',light:'✧'};
 const mark=icons[o.decoration]||'✦';ctx.font=Math.round(w*.038)+'px sans-serif';ctx.fillStyle=o.decoration==='snow'?'#e6f5ff':o.decoration==='hearts'?'#ff9bc1':'#ffe9a8';
 for(let i=0;i<15;i++){const x=((i*173+w*.13)%w),y=((i*127+t*(22+i%4*9))%(h+50))-25;ctx.globalAlpha=.45+.4*Math.sin(i+t)**2;ctx.fillText(mark,x,y)}}
 if(stamps[o.sticker]){ctx.globalAlpha=1;ctx.font=Math.round(w*.09)+'px sans-serif';ctx.fillText(stamps[o.sticker],w*.83,h*.85)}
 ctx.restore()
}
function text(ctx:CanvasRenderingContext2D,label:string,w:number,h:number,size:number){ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold '+size+'px sans-serif';ctx.shadowColor='#000';ctx.shadowBlur=12;ctx.fillStyle='#fff6e8';ctx.fillText(label,w/2,h/2,w*.86);ctx.restore()}
function drawOpening(ctx:CanvasRenderingContext2D,o:ExportOptions,w:number,h:number,t:number){
 const kind=o.opening??(o.theme==='theater'?'curtain':'fade');
 ctx.save();
 if(kind==='curtain'){
  const progress=Math.max(0,Math.min(1,(t-1.4)/4.2)),panel=w*.51*(1-progress);
  const shades:Record<string,[string,string,string]>={red:['#510e27','#a3294c','#570c28'],pink:['#a94e77','#f4a2c6','#a94e77'],navy:['#101b4e','#3559a1','#142050'],gold:['#8e5715','#e6b44e','#8e5715']};
  for(let side=0;side<2;side++){const x=side===0?0:w-panel,grad=ctx.createLinearGradient(x,0,x+Math.max(1,panel),0),colors=shades[o.curtainColor]||shades.red;grad.addColorStop(0,colors[0]);grad.addColorStop(.5,colors[1]);grad.addColorStop(1,colors[2]);ctx.fillStyle=grad;ctx.fillRect(x,0,panel,h)}
 }else if(kind==='sparkle'){
  for(let i=0;i<36;i++){const x=(i*173+29)%w,y=(i*127+53)%h,alpha=.2+.8*Math.abs(Math.sin(t*2+i));ctx.globalAlpha=alpha;ctx.fillStyle=i%3?'#ffe3a0':'#ffffff';ctx.font=Math.round(w*(.023+(i%4)*.009))+'px sans-serif';ctx.fillText(i%2?'✦':'✧',x,y)}
 }else if(kind==='sakura'){
  ctx.fillStyle='#fff1f5';ctx.globalAlpha=.9;ctx.fillRect(0,0,w,h);ctx.globalAlpha=1;
  for(let i=0;i<24;i++){ctx.font=Math.round(w*(.03+(i%3)*.014))+'px sans-serif';ctx.fillText('🌸',((i*137+t*25)% (w+80))-40,((i*89+t*(22+i%5*8))%(h+80))-40)}
 }else if(kind==='album'){
  const open=Math.max(.06,Math.min(1,t/2));ctx.fillStyle='#f7e9cf';ctx.fillRect(w*.08,h*.12,w*.84,h*.76);ctx.fillStyle='#b17b5e';ctx.fillRect(w*.08,h*.12,w*.84*(1-open),h*.76);ctx.strokeStyle='#a77c58';ctx.lineWidth=5;ctx.strokeRect(w*.08,h*.12,w*.84,h*.76);ctx.beginPath();ctx.moveTo(w*.5,h*.12);ctx.lineTo(w*.5,h*.88);ctx.stroke()
 }else if(kind==='countdown'){
  ctx.fillStyle='#27242c';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#e7d9c4';ctx.lineWidth=3;ctx.beginPath();ctx.arc(w/2,h/2,Math.min(w,h)*.29,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#f4e6d1';ctx.font='bold '+Math.round(h*.27)+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(Math.max(1,3-Math.floor(t/1.5))),w/2,h/2);ctx.textAlign='left';ctx.textBaseline='alphabetic'
 }else if(kind==='rainbow'){
  ctx.fillStyle='#c8edff';ctx.fillRect(0,0,w,h);const colors=['#ff819a','#ffbd7a','#ffe589','#91dba7','#8cc4f5','#c5a1ed'];ctx.lineWidth=Math.max(8,w*.026);colors.forEach((color,i)=>{ctx.strokeStyle=color;ctx.beginPath();ctx.arc(w/2,h*.88,w*(.36-i*.027),Math.PI,Math.PI*2);ctx.stroke()});ctx.font=Math.round(w*.13)+'px sans-serif';ctx.fillText('☁️',w*.05,h*.65);ctx.fillText('☁️',w*.79,h*.7)
 }else{ctx.fillStyle='#2a2435';ctx.globalAlpha=Math.max(0,1-t/5);ctx.fillRect(0,0,w,h)}
 ctx.restore();
 if(kind!=='countdown'||t>=4.5){ctx.save();ctx.globalAlpha=kind==='fade'?Math.min(1,t/2):kind==='album'?Math.min(1,t/2):kind==='countdown'?Math.min(1,(t-4.5)*2):1;text(ctx,o.title,w,h,w>h?44:40);ctx.restore()}
}
export async function exportMovie(o:ExportOptions):Promise<{blob:Blob;extension:string}>{
 const canvas=document.createElement('canvas');const wide=o.aspect==='wide';canvas.width=wide?960:540;canvas.height=wide?540:960;
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('描画機能を利用できません');
 if(typeof canvas.captureStream!=='function'||typeof MediaRecorder==='undefined')throw Error('このiPhoneのブラウザは動画の書き出しに対応していません。iPhoneアプリ版での対応が必要です');
 const mime=['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4','video/webm;codecs=vp8,opus','video/webm'].find(x=>MediaRecorder.isTypeSupported(x));
 if(!mime)throw Error('このブラウザで利用できる動画形式がありません');
 const imgs=await Promise.all(o.photos.map(p=>p.kind==='video'?Promise.resolve(null):loadImage(p.url)));
 const videos=await Promise.all(o.photos.map(async p=>{
  if(p.kind!=='video')return null;
  return await new Promise<HTMLVideoElement>((resolve,reject)=>{const v=document.createElement('video');v.muted=true;v.playsInline=true;v.preload='auto';v.onloadeddata=()=>resolve(v);v.onerror=()=>reject(new Error('動画を読み込めませんでした。対応形式の動画を選んでください'));v.src=p.url;v.load()});
 }));
 let lastVideoIndex=-1;
 const fontNames=[...new Set(o.photos.map(p=>p.captionFont==='cursive'?'Yomogi':p.captionFont?.split(',')[0]?.trim()).filter((name):name is string=>name==='Yomogi'||name==='Zen Kurenaido'))];
 if(fontNames.length&&document.fonts){await Promise.all(fontNames.map(async name=>{try{await document.fonts.load('24px "'+name+'"','あいうえお思い出');}catch{throw new Error('手書きフォントを読み込めませんでした。通信状態を確認してもう一度お試しください')}}))}

 const stream=canvas.captureStream(24);
 let ac:AudioContext|null=null,interval:number|undefined,audio:HTMLAudioElement|undefined,bgmGain:GainNode|null=null;
 const extraTracks:{audio:HTMLAudioElement;gain:GainNode;start:number;end:number;volume:number;fade:number;started:boolean}[]=[];
 try{
  const hasSourceAudio=o.photos.some(p=>p.kind==='video'&&p.keepAudio!==false);
  if((o.bgm!=='none'&&o.volume>0)||hasSourceAudio||(o.musicSwitches?.length??0)>0){
   ac=new AudioContext();const dest=ac.createMediaStreamDestination();
   if(hasSourceAudio){videos.forEach((v,i)=>{if(v&&o.photos[i].keepAudio!==false){v.muted=false;const source=ac!.createMediaElementSource(v);const clipGain=ac!.createGain();clipGain.gain.value=1;source.connect(clipGain);clipGain.connect(dest)}})}
   if(o.bgm!=='none'&&o.volume>0){const gain=ac.createGain();bgmGain=gain;gain.gain.value=0;gain.connect(dest);
   if(o.bgm==='file'&&o.audioUrl){audio=new Audio(o.audioUrl);audio.loop=true;const offset=Math.max(0,o.bgmOffset??0);const seek=()=>{try{audio!.currentTime=Math.min(offset,Math.max(0,(audio!.duration||0)-.1))}catch{}};audio.addEventListener('loadedmetadata',seek,{once:true});if(audio.readyState>=1)seek();const src=ac.createMediaElementSource(audio);src.connect(gain);await ac.resume();await audio.play()}
   else if(o.bgm!=='file'){await ac.resume();const notes=o.bgm==='gentle'?[261.63,329.63,392,523.25,392,329.63,293.66,349.23]:[392,493.88,587.33,783.99,659.25,587.33,493.88,523.25];let i=0;const play=()=>{if(!ac||ac.state==='closed')return;const oscillator=ac.createOscillator(),envelope=ac.createGain(),now=ac.currentTime;oscillator.type=o.bgm==='gentle'?'sine':'triangle';oscillator.frequency.value=notes[i++%notes.length];envelope.gain.setValueAtTime(.0001,now);envelope.gain.exponentialRampToValueAtTime(.10,now+.12);envelope.gain.exponentialRampToValueAtTime(.0001,now+1.1);oscillator.connect(envelope);envelope.connect(gain);oscillator.start(now);oscillator.stop(now+1.12)};play();interval=window.setInterval(play,o.bgm==='gentle'?1300:850)}
   }
   for(const [i,m] of (o.musicSwitches??[]).entries()){const next=o.musicSwitches?.[i+1];const a=new Audio(m.url);a.loop=true;const offset=Math.max(0,m.offset||0);const seek=()=>{try{a.currentTime=Math.min(offset,Math.max(0,(a.duration||0)-.1))}catch{}};a.addEventListener('loadedmetadata',seek,{once:true});if(a.readyState>=1)seek();const src=ac.createMediaElementSource(a);const gain=ac.createGain();gain.gain.value=0;src.connect(gain);gain.connect(dest);extraTracks.push({audio:a,gain,start:Math.max(0,m.start),end:next?Math.max(0,next.start):Infinity,volume:Math.max(0,Math.min(1,m.volume/100)),fade:Math.max(0,Math.min(5,m.fade)),started:false})}
   await ac.resume();
   dest.stream.getAudioTracks().forEach(track=>stream.addTrack(track));
  }
  const chunks:BlobPart[]=[];const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:2500000});
  const result=new Promise<Blob>((resolve,reject)=>{recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};recorder.onerror=()=>reject(Error('動画の記録中にエラーが発生しました'));recorder.onstop=()=>resolve(new Blob(chunks,{type:mime.split(';')[0]}))});
  let renderedVideoFrames=0;const total=12+o.durations.reduce((a,b)=>a+b,0);const start=performance.now();recorder.start(1000);
  while(true){
   const elapsed=Math.min((performance.now()-start)/1000,total);const w=canvas.width,h=canvas.height;
   if(extraTracks.length){for(const track of extraTracks){if(elapsed>=track.start&&!track.started){track.started=true;void track.audio.play().catch(()=>{})}if(elapsed>=track.end&&track.started){track.audio.pause()}const inRange=elapsed>=track.start&&elapsed<track.end;const fadeIn=track.fade>0?Math.min(1,Math.max(0,(elapsed-track.start)/track.fade)):1;const fadeOut=Number.isFinite(track.end)&&track.fade>0?Math.min(1,Math.max(0,(track.end-elapsed)/track.fade)):1;const target=inRange?track.volume*Math.min(fadeIn,fadeOut):0;track.gain.gain.setTargetAtTime(target,ac!.currentTime,.025)}}
   if(bgmGain){let pos=elapsed-6,clipIndex=0;while(clipIndex<o.durations.length-1&&pos>=o.durations[clipIndex]){pos-=o.durations[clipIndex];clipIndex++}const videoNow=elapsed>=6&&elapsed<total-6&&o.photos[clipIndex]?.kind==='video';const firstSwitch=o.musicSwitches?.[0]?.start??Infinity;const target=elapsed<(o.bgmStart??0)||elapsed>=firstSwitch||o.pauseBgmDuringVideo&&videoNow?0:o.volume/100;if(Math.abs(bgmGain.gain.value-target)>.001)bgmGain.gain.setTargetAtTime(target,ac!.currentTime,.035)}
   const colors:Record<string,[string,string]>={sky:['#6ab9f4','#eaf8ff'],sakura:['#f5b8d0','#fff2f6'],stars:['#0e1238','#50418b'],sunset:['#f68e8d','#f9c57a'],sparkle:['#b89250','#fff2c4'],rainbow:['#94d4f4','#ffdce9']};const palette=colors[o.background];if(palette){const gradient=ctx.createLinearGradient(0,0,0,h);gradient.addColorStop(0,palette[0]);gradient.addColorStop(1,palette[1]);ctx.fillStyle=gradient}else ctx.fillStyle=o.theme==='sakura'?'#e8b8cb':o.theme==='album'?'#75604d':'#1c1425';ctx.fillRect(0,0,w,h);
   if(elapsed<6){
    drawOpening(ctx,o,w,h,elapsed);
   }else if(elapsed>=total-6){text(ctx,'Fin.',w,h,wide?66:60);ctx.font='26px sans-serif';ctx.fillStyle='#f7e7d6';ctx.textAlign='center';ctx.fillText(o.ending||o.title,w/2,h*.64,w*.85)}
   else{let t=elapsed-6,index=0;while(index<o.durations.length-1&&t>=o.durations[index]){t-=o.durations[index];index++}const d=o.durations[index]||5;const fraction=Math.min(1,t/d);const photo=o.photos[index];const effect=o.opening==='album'?'page':photo.effect;const scale=effect==='zoom'?1+.13*fraction:effect==='slide'?1.06:1;const shift=effect==='slide'?(0.05-0.1*fraction)*w:0;ctx.save();ctx.globalAlpha=effect==='fade'?Math.max(0,Math.min(1,t/.6,(d-t)/.6)):1;
 if(effect==='page'&&o.opening!=='album'){ctx.translate(w,0);ctx.scale(Math.max(.01,Math.min(1,t/.65)),1);ctx.translate(-w,0)}
 if(effect==='heart'){const r=Math.max(.01,Math.min(1,t/.85));ctx.beginPath();const cx=w/2,cy=h/2;ctx.moveTo(cx,cy+h*.42*r);ctx.bezierCurveTo(cx-w*.9*r,cy-h*.12*r,cx-w*.45*r,cy-h*.62*r,cx,cy-h*.23*r);ctx.bezierCurveTo(cx+w*.45*r,cy-h*.62*r,cx+w*.9*r,cy-h*.12*r,cx,cy+h*.42*r);ctx.clip()}
 if(effect==='curtain'){const progress=Math.max(0,Math.min(1,t/.8));ctx.beginPath();ctx.rect(w/2-w/2*progress,0,w*progress,h);ctx.clip()}
 if(photo.kind==='video'){
  const v=videos[index];if(v){
   if(lastVideoIndex!==index){videos.forEach((item,j)=>{if(item&&j!==index)item.pause()});lastVideoIndex=index;v.currentTime=photo.trimStart??0;void v.play().catch(()=>{})}
   if(v.readyState>=2&&drawImage(ctx,v,w,h,photo.zoom??1,(photo.offsetX??0)/100*w,(photo.offsetY??0)/100*h))renderedVideoFrames++;
  }
 }else if(imgs[index])drawImage(ctx,imgs[index]!,w,h,scale*(photo.zoom??1),shift+(photo.offsetX??0)/100*w,(photo.offsetY??0)/100*h);ctx.restore();if(o.opening==='album'&&index>0&&t<1.05&&imgs[index-1]){const turn=Math.min(1,t/1.05);const widthFactor=Math.max(.01,Math.cos(turn*Math.PI*.53));ctx.save();ctx.translate(0,0);ctx.scale(widthFactor,1);ctx.globalAlpha=turn>.88?Math.max(0,(1-turn)/.12):1;const previous=o.photos[index-1];drawImage(ctx,imgs[index-1]!,w,h,previous.zoom??1,(previous.offsetX??0)/100*w,(previous.offsetY??0)/100*h);ctx.restore()}decorate(ctx,w,h,photo.frame??o.frame);drawExtras(ctx,w,h,{...o,decoration:photo.decoration??o.decoration,sticker:photo.sticker??o.sticker},t);if(photo.caption){ctx.save();const font=photo.captionFont==='cursive'?'Yomogi, cursive':photo.captionFont??'sans-serif';const px=(photo.captionSize??22)*(w/350);const x=w*(photo.captionX??50)/100,y=h*(photo.captionY??83)/100;const motion=photo.captionMotion??'none';const progress=Math.max(0,Math.min(1,t/.85));if(motion==='fade')ctx.globalAlpha=progress;if(motion==='rise')ctx.translate(0,(1-progress)*h*.10);if(motion==='slide')ctx.translate(-(1-progress)*w*.35,0);ctx.font=(photo.captionWeight??700)+' '+Math.round(px)+'px '+font;ctx.textAlign='center';ctx.textBaseline='middle';const maxWidth=w*.88;const measured=Math.min(ctx.measureText(photo.caption).width,maxWidth);if(photo.captionBackground){ctx.fillStyle='rgba(0,0,0,.58)';ctx.fillRect(x-measured/2-14,y-px*.75,measured+28,px*1.5)}ctx.fillStyle=photo.captionColor??'#ffffff';if(photo.captionOutline){ctx.lineWidth=Math.max(1.5,px*.045)+((photo.captionWeight??700)>=900?3.2:(photo.captionWeight??700)>=700?1.6:0)*w/350;ctx.lineJoin='round';ctx.strokeStyle=photo.captionOutlineColor??'#222222';ctx.strokeText(photo.caption,x,y,maxWidth)}ctx.shadowBlur=0;const extra=(photo.captionWeight??700)>=900?1.35:(photo.captionWeight??700)>=700?.65:0;if(extra){ctx.lineWidth=Math.max(.5,extra*w/350);ctx.strokeStyle=photo.captionColor??'#ffffff';ctx.lineJoin='round';ctx.strokeText(photo.caption,x,y,maxWidth)}ctx.fillText(photo.caption,x,y,maxWidth);ctx.restore()}
   const cue=photo.subtitles?.find(c=>t>=c.start&&t<c.end);
   if(cue?.text){ctx.save();const fontSize=(photo.subtitleSize??22)*w/350;ctx.font='bold '+Math.round(fontSize)+'px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';const maxWidth=w*.9;const lines=cue.text.split('\\n');const lineHeight=fontSize*1.35;const y=h*.88-(lines.length-1)*lineHeight/2;ctx.lineJoin='round';ctx.lineWidth=Math.max(2,fontSize*.22);ctx.strokeStyle=photo.subtitleOutline??'#202020';ctx.fillStyle=photo.subtitleColor??'#ffffff';lines.forEach((line,i)=>{ctx.strokeText(line,w/2,y+i*lineHeight,maxWidth);ctx.fillText(line,w/2,y+i*lineHeight,maxWidth)});ctx.restore()}
   }
   o.onProgress(Math.min(100,Math.round(elapsed/total*100)));
   if(elapsed>=total)break;
   await sleep(1000/24);
  }
  await sleep(250);recorder.stop();const blob=await result;if(o.photos.some(p=>p.kind==='video')&&renderedVideoFrames===0)throw Error('動画の映像を取得できませんでした。黒い画面の動画を保存しないため、書き出しを中止しました。');if(!blob.size)throw Error('動画ファイルが空でした');o.onProgress(100);return {blob,extension:mime.includes('mp4')?'mp4':'webm'};
 }finally{if(typeof videos!=='undefined')videos.forEach(v=>v?.pause());if(interval!==undefined)clearInterval(interval);if(audio)audio.pause();if(ac)void ac.close();stream.getTracks().forEach(track=>track.stop())}
}
