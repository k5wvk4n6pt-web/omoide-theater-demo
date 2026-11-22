export type ExportPhoto={url:string;duration:number;effect:'fade'|'zoom'|'slide'};
export type ExportOptions={photos:ExportPhoto[];durations:number[];title:string;ending:string;frame:'none'|'sakura'|'gold'|'soft';theme:string;aspect:'wide'|'vertical';bgm:'none'|'gentle'|'bright'|'file';audioUrl?:string;volume:number;onProgress:(p:number)=>void};
const sleep=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
function loadImage(url:string){return new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('写真を読み込めませんでした'));img.src=url})}
function drawImage(ctx:CanvasRenderingContext2D,img:HTMLImageElement,w:number,h:number,scale:number,shift:number){const ratio=Math.min(w/img.width,h/img.height);const dw=img.width*ratio*scale,dh=img.height*ratio*scale;ctx.drawImage(img,(w-dw)/2+shift,(h-dh)/2,dw,dh)}
function decorate(ctx:CanvasRenderingContext2D,w:number,h:number,frame:ExportOptions['frame']){
 if(frame==='none')return;
 ctx.save();ctx.lineWidth=Math.max(8,w*.018);ctx.strokeStyle=frame==='gold'?'#d5aa52':frame==='sakura'?'#f7cfdf':'#f4d1e5';
 ctx.strokeRect(10,10,w-20,h-20);
 ctx.font=Math.round(w*.065)+'px sans-serif';ctx.textBaseline='top';ctx.fillStyle='#fff';
 const symbol=frame==='sakura'?'🌸':frame==='gold'?'✦':'♡';
 ctx.fillText(symbol,24,22);ctx.textAlign='right';ctx.fillText(symbol,w-24,22);
 ctx.textBaseline='bottom';ctx.fillText(symbol,w-24,h-22);ctx.textAlign='left';ctx.fillText(symbol,24,h-22);
 ctx.restore();
}
function text(ctx:CanvasRenderingContext2D,label:string,w:number,h:number,size:number){ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold '+size+'px sans-serif';ctx.shadowColor='#000';ctx.shadowBlur=12;ctx.fillStyle='#fff6e8';ctx.fillText(label,w/2,h/2,w*.86);ctx.restore()}
export async function exportMovie(o:ExportOptions):Promise<{blob:Blob;extension:string}>{
 const canvas=document.createElement('canvas');const wide=o.aspect==='wide';canvas.width=wide?960:540;canvas.height=wide?540:960;
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('描画機能を利用できません');
 if(typeof canvas.captureStream!=='function'||typeof MediaRecorder==='undefined')throw Error('このiPhoneのブラウザは動画の書き出しに対応していません。iPhoneアプリ版での対応が必要です');
 const mime=['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4','video/webm;codecs=vp8,opus','video/webm'].find(x=>MediaRecorder.isTypeSupported(x));
 if(!mime)throw Error('このブラウザで利用できる動画形式がありません');
 const imgs=await Promise.all(o.photos.map(p=>loadImage(p.url)));
 const stream=canvas.captureStream(24);
 let ac:AudioContext|null=null,interval:number|undefined,audio:HTMLAudioElement|undefined;
 try{
  if(o.bgm!=='none'&&o.volume>0){
   ac=new AudioContext();const dest=ac.createMediaStreamDestination();const gain=ac.createGain();gain.gain.value=o.volume/100;gain.connect(dest);
   if(o.bgm==='file'&&o.audioUrl){audio=new Audio(o.audioUrl);audio.loop=true;const src=ac.createMediaElementSource(audio);src.connect(gain);await ac.resume();await audio.play()}
   else if(o.bgm!=='file'){await ac.resume();const notes=o.bgm==='gentle'?[261.63,329.63,392,523.25,392,329.63,293.66,349.23]:[392,493.88,587.33,783.99,659.25,587.33,493.88,523.25];let i=0;const play=()=>{if(!ac||ac.state==='closed')return;const oscillator=ac.createOscillator(),envelope=ac.createGain(),now=ac.currentTime;oscillator.type=o.bgm==='gentle'?'sine':'triangle';oscillator.frequency.value=notes[i++%notes.length];envelope.gain.setValueAtTime(.0001,now);envelope.gain.exponentialRampToValueAtTime(.10,now+.12);envelope.gain.exponentialRampToValueAtTime(.0001,now+1.1);oscillator.connect(envelope);envelope.connect(gain);oscillator.start(now);oscillator.stop(now+1.12)};play();interval=window.setInterval(play,o.bgm==='gentle'?1300:850)}
   dest.stream.getAudioTracks().forEach(track=>stream.addTrack(track));
  }
  const chunks:BlobPart[]=[];const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:2500000});
  const result=new Promise<Blob>((resolve,reject)=>{recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};recorder.onerror=()=>reject(Error('動画の記録中にエラーが発生しました'));recorder.onstop=()=>resolve(new Blob(chunks,{type:mime.split(';')[0]}))});
  const total=12+o.durations.reduce((a,b)=>a+b,0);const start=performance.now();recorder.start(1000);
  while(true){
   const elapsed=Math.min((performance.now()-start)/1000,total);const w=canvas.width,h=canvas.height;
   ctx.fillStyle=o.theme==='sakura'?'#e8b8cb':o.theme==='album'?'#75604d':'#1c1425';ctx.fillRect(0,0,w,h);
   if(elapsed<6){
    if(o.theme==='theater'){if(imgs[0])drawImage(ctx,imgs[0],w,h,1,0);const progress=Math.max(0,Math.min(1,(elapsed-1.4)/4.2));const panel=w*.51*(1-progress);for(let side=0;side<2;side++){const x=side===0?0:w-panel;const grad=ctx.createLinearGradient(x,0,x+panel,0);grad.addColorStop(0,'#510e27');grad.addColorStop(.5,'#a3294c');grad.addColorStop(1,'#570c28');ctx.fillStyle=grad;ctx.fillRect(x,0,panel,h)}}
    text(ctx,o.title,w,h,wide?44:40);
   }else if(elapsed>=total-6){text(ctx,'Fin.',w,h,wide?66:60);ctx.font='26px sans-serif';ctx.fillStyle='#f7e7d6';ctx.textAlign='center';ctx.fillText(o.ending||o.title,w/2,h*.64,w*.85)}
   else{let t=elapsed-6,index=0;while(index<o.durations.length-1&&t>=o.durations[index]){t-=o.durations[index];index++}const d=o.durations[index]||5;const fraction=Math.min(1,t/d);const photo=o.photos[index];const scale=photo.effect==='zoom'?1+.13*fraction:photo.effect==='slide'?1.06:1;const shift=photo.effect==='slide'?(0.05-0.1*fraction)*w:0;ctx.save();ctx.globalAlpha=photo.effect==='fade'?Math.min(1,t/.6,(d-t)/.6):1;drawImage(ctx,imgs[index],w,h,scale,shift);ctx.restore();decorate(ctx,w,h,o.frame)}
   o.onProgress(Math.min(100,Math.round(elapsed/total*100)));
   if(elapsed>=total)break;
   await sleep(1000/24);
  }
  await sleep(250);recorder.stop();const blob=await result;if(!blob.size)throw Error('動画ファイルが空でした');o.onProgress(100);return {blob,extension:mime.includes('mp4')?'mp4':'webm'};
 }finally{if(interval!==undefined)clearInterval(interval);if(audio)audio.pause();if(ac)void ac.close();stream.getTracks().forEach(track=>track.stop())}
}
