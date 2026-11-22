import {useEffect,useMemo,useRef,useState} from 'react';
import type {CSSProperties} from 'react';
import {exportMovie} from './exportMovie';
type Photo={id:string;name:string;url:string;duration:number;effect:'fade'|'zoom'|'slide'};
type Theme='theater'|'album'|'sakura'|'sparkle';
const themes:{id:Theme;name:string;emoji:string;description:string}[]=[{id:'theater',name:'シアター',emoji:'🎭',description:'赤いカーテン'},{id:'album',name:'アルバム',emoji:'📖',description:'懐かしい思い出'},{id:'sakura',name:'さくら',emoji:'🌸',description:'卒園・卒業'},{id:'sparkle',name:'キラキラ',emoji:'✨',description:'誕生日・お祝い'}];
const id=()=>Math.random().toString(36).slice(2);
export default function App(){
const [photos,setPhotos]=useState<Photo[]>([]);
const [theme,setTheme]=useState<Theme>('theater');
const [title,setTitle]=useState('大切な思い出');
const [ending,setEnding]=useState('ありがとう、たくさんの思い出');
const [frame,setFrame]=useState<'none'|'sakura'|'gold'|'soft'>('none');
const [step,setStep]=useState<'home'|'theme'|'photos'|'edit'>('home');
const [selected,setSelected]=useState(0);
const [mode,setMode]=useState<'photo'|'music'>('photo');
const [musicSeconds,setMusicSeconds]=useState(180);
const [duration,setDuration]=useState(5);
const [aspect,setAspect]=useState<'wide'|'vertical'>('wide');
const [playing,setPlaying]=useState(false);
const [playIndex,setPlayIndex]=useState(0);
const [phase,setPhase]=useState<'intro'|'photos'|'outro'>('intro');
const [sceneKey,setSceneKey]=useState(0);
const input=useRef<HTMLInputElement>(null);
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
function update(i:number,patch:Partial<Photo>){setPhotos(p=>p.map((v,j)=>j===i?{...v,...patch}:v))}
const current=photos[selected];
const activePhoto=photos[playing?playIndex:selected];
const activeDuration=computed[playing?playIndex:selected]||duration;
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
async function makeMovie(){
 if(!photos.length||exporting)return;
 setPlaying(false);stopMusic();setExportError('');setExportProgress(0);setExporting(true);
 try{
  const {blob,extension}=await exportMovie({photos,durations:computed,title,ending,frame,theme,aspect,bgm,audioUrl:audioFile?.url,volume,onProgress:setExportProgress});
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
{step==='home'?<section className="panel hero"><div className="stage">🎬<h1>思い出を映画に</h1><p>写真を選ぶだけで、自分だけのムービーを。</p></div><button className="primary" onClick={()=>setStep('theme')}>＋ 新しいムービーを作る</button><p className="note">試作版です。BGMの試聴に対応しました。動画の書き出しは試験機能として追加しました。</p></section>:null}
{step==='theme'?<section className="panel"><h2>① テーマを選ぶ</h2><div className="themeGrid">{themes.map(t=><button key={t.id} className={'theme '+(theme===t.id?'active':'')} onClick={()=>setTheme(t.id)}><span>{t.emoji}</span><strong>{t.name}</strong><small>{t.description}</small></button>)}</div><label>ムービーのタイトル<input value={title} onChange={e=>setTitle(e.target.value)} /></label><label>画面の向き<select value={aspect} onChange={e=>setAspect(e.target.value as typeof aspect)}><option value="wide">横型（16:9）</option><option value="vertical">縦型（9:16）</option></select></label><button className="primary" onClick={()=>setStep('photos')}>次へ：写真を選ぶ</button></section>:null}
{step==='photos'?<section className="panel"><h2>② 写真を選ぶ</h2><p>iPhoneの写真からまとめて選べます。</p><button className="primary" onClick={()=>input.current?.click()}>写真を追加する</button><button className="secondary" onClick={()=>setStep('theme')}>戻る</button></section>:null}
{step==='edit'?<section className="panel"><div className="sectionHeading"><h2>③ ムービー編集</h2><button className="small" onClick={()=>setStep('theme')}>テーマ変更</button></div><div className={'preview '+aspect}><div className={'previewFrame '+theme}>
{activePhoto?<div key={sceneKey+'-'+(activePhoto?.id||'')} className={'scenePhoto '+(playing&&phase==='photos'?'animate '+activePhoto.effect:'')} style={{'--scene-duration':activeDuration+'s'} as CSSProperties}><img src={activePhoto.url} alt="選択中の写真" /></div>:<span>写真を追加してください</span>}
{playing&&phase==='intro'&&theme==='theater'?<div key={'curtain-'+sceneKey} className="curtainOverlay"><div className="curtainPanel curtainLeft"/><div className="curtainPanel curtainRight"/><div className="curtainCaption">{title}</div></div>:null}
{playing&&phase==='outro'?<div className="endingScreen"><div>Fin.</div><small>{ending||title}</small></div>:null}
{frame!=='none'&&!(playing&&phase==='intro'&&theme==='theater')?<div className={'photoDecoration '+frame} aria-hidden="true">{frame==='sakura'?'🌸　🌸':frame==='gold'?'✦　✦':'♡　♡'}</div>:null}
{!playing||phase==='intro'?<div className="previewTitle">{title}</div>:null}
</div></div><div className="actions"><button onClick={startPreview}>{playing?'■ 停止':'▶ 演出付きプレビュー'}</button><button onClick={()=>input.current?.click()}>＋ 写真追加</button></div><p className="note">カーテン・写真のフェード／ズーム／スライドを画面で確認できます。BGMは試聴用です。動画の書き出しは下の試験機能で確認できます。</p><h3>写真の並び順</h3><div className="strip">{photos.map((p,i)=><button key={p.id} className={'thumb '+(selected===i?'selected':'')} onClick={()=>{setSelected(i);setPlaying(false);setPhase('intro');setSceneKey(k=>k+1)}}><img src={p.url} alt={p.name}/><span>{i+1}</span></button>)}</div>{current&&<div className="editor"><h3>選択中の写真：{selected+1}枚目</h3><div className="actions"><button disabled={selected===0} onClick={()=>move(selected,-1)}>← 前へ</button><button disabled={selected===photos.length-1} onClick={()=>move(selected,1)}>後ろへ →</button><button className="danger" onClick={()=>remove(selected)}>削除</button></div><label>演出<select value={current.effect} onChange={e=>update(selected,{effect:e.target.value as Photo['effect']})}><option value="zoom">ゆっくりズーム</option><option value="fade">フェード</option><option value="slide">スライド</option></select></label>{mode==='photo'&&<label>表示時間：{current.duration}秒<input type="range" min="2" max="15" value={current.duration} onChange={e=>update(selected,{duration:Number(e.target.value)})}/></label>}</div>}<section className="designBox"><h3>🌸 写真の飾り・エンディング</h3>
<label>写真フレーム<select value={frame} onChange={e=>setFrame(e.target.value as typeof frame)}>
<option value="none">フレームなし</option><option value="sakura">桜（卒園・卒業）</option><option value="gold">ゴールド（結婚式・お祝い）</option><option value="soft">やさしいハート（誕生日・家族）</option></select></label>
<label>最後に表示するメッセージ<textarea rows={2} maxLength={70} value={ending} onChange={e=>setEnding(e.target.value)} placeholder="ありがとう、たくさんの思い出"/></label>
<p className="note">フレームは全写真に適用され、メッセージは動画の最後に表示されます。</p>
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
<footer>おもいでシアター · 試作版 v0.5</footer></main>
}