import {useEffect,useMemo,useRef,useState} from 'react';
import type {CSSProperties} from 'react';
type Photo={id:string;name:string;url:string;duration:number;effect:'fade'|'zoom'|'slide'};
type Theme='theater'|'album'|'sakura'|'sparkle';
const themes:{id:Theme;name:string;emoji:string;description:string}[]=[{id:'theater',name:'シアター',emoji:'🎭',description:'赤いカーテン'},{id:'album',name:'アルバム',emoji:'📖',description:'懐かしい思い出'},{id:'sakura',name:'さくら',emoji:'🌸',description:'卒園・卒業'},{id:'sparkle',name:'キラキラ',emoji:'✨',description:'誕生日・お祝い'}];
const id=()=>Math.random().toString(36).slice(2);
export default function App(){
const [photos,setPhotos]=useState<Photo[]>([]);
const [theme,setTheme]=useState<Theme>('theater');
const [title,setTitle]=useState('大切な思い出');
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
const photosRef=useRef<Photo[]>([]);
useEffect(()=>{photosRef.current=photos},[photos]);
useEffect(()=>()=>{photosRef.current.forEach(p=>URL.revokeObjectURL(p.url))},[]);
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
function startPreview(){if(!photos.length)return;if(playing){setPlaying(false);setPhase('intro')}else{setPlayIndex(0);setPhase(theme==='theater'?'intro':'photos');setPlaying(true)}setSceneKey(k=>k+1)}

return <main><header><div className="brand">✦ おもいでシアター</div><div className="subtitle">写真が、一本の映画になる。</div></header>
{step==='home'?<section className="panel hero"><div className="stage">🎬<h1>思い出を映画に</h1><p>写真を選ぶだけで、自分だけのムービーを。</p></div><button className="primary" onClick={()=>setStep('theme')}>＋ 新しいムービーを作る</button><p className="note">最初の試作版です。動画の書き出し・BGM再生は今後実装します。</p></section>:null}
{step==='theme'?<section className="panel"><h2>① テーマを選ぶ</h2><div className="themeGrid">{themes.map(t=><button key={t.id} className={'theme '+(theme===t.id?'active':'')} onClick={()=>setTheme(t.id)}><span>{t.emoji}</span><strong>{t.name}</strong><small>{t.description}</small></button>)}</div><label>ムービーのタイトル<input value={title} onChange={e=>setTitle(e.target.value)} /></label><label>画面の向き<select value={aspect} onChange={e=>setAspect(e.target.value as typeof aspect)}><option value="wide">横型（16:9）</option><option value="vertical">縦型（9:16）</option></select></label><button className="primary" onClick={()=>setStep('photos')}>次へ：写真を選ぶ</button></section>:null}
{step==='photos'?<section className="panel"><h2>② 写真を選ぶ</h2><p>iPhoneの写真からまとめて選べます。</p><button className="primary" onClick={()=>input.current?.click()}>写真を追加する</button><button className="secondary" onClick={()=>setStep('theme')}>戻る</button></section>:null}
{step==='edit'?<section className="panel"><div className="sectionHeading"><h2>③ ムービー編集</h2><button className="small" onClick={()=>setStep('theme')}>テーマ変更</button></div><div className={'preview '+aspect}><div className={'previewFrame '+theme}>
{activePhoto?<div key={sceneKey+'-'+(activePhoto?.id||'')} className={'scenePhoto '+(playing&&phase==='photos'?'animate '+activePhoto.effect:'')} style={{'--scene-duration':activeDuration+'s'} as CSSProperties}><img src={activePhoto.url} alt="選択中の写真" /></div>:<span>写真を追加してください</span>}
{playing&&phase==='intro'&&theme==='theater'?<div key={'curtain-'+sceneKey} className="curtainOverlay"><div className="curtainPanel curtainLeft"/><div className="curtainPanel curtainRight"/><div className="curtainCaption">{title}</div></div>:null}
{playing&&phase==='outro'?<div className="endingScreen"><div>Fin.</div><small>{title}</small></div>:null}
{!playing||phase==='intro'?<div className="previewTitle">{title}</div>:null}
</div></div><div className="actions"><button onClick={startPreview}>{playing?'■ 停止':'▶ 演出付きプレビュー'}</button><button onClick={()=>input.current?.click()}>＋ 写真追加</button></div><p className="note">カーテン・写真のフェード／ズーム／スライドを画面で確認できます。音声とMP4書き出しはまだ未実装です。</p><h3>写真の並び順</h3><div className="strip">{photos.map((p,i)=><button key={p.id} className={'thumb '+(selected===i?'selected':'')} onClick={()=>{setSelected(i);setPlaying(false);setPhase('intro');setSceneKey(k=>k+1)}}><img src={p.url} alt={p.name}/><span>{i+1}</span></button>)}</div>{current&&<div className="editor"><h3>選択中の写真：{selected+1}枚目</h3><div className="actions"><button disabled={selected===0} onClick={()=>move(selected,-1)}>← 前へ</button><button disabled={selected===photos.length-1} onClick={()=>move(selected,1)}>後ろへ →</button><button className="danger" onClick={()=>remove(selected)}>削除</button></div><label>演出<select value={current.effect} onChange={e=>update(selected,{effect:e.target.value as Photo['effect']})}><option value="zoom">ゆっくりズーム</option><option value="fade">フェード</option><option value="slide">スライド</option></select></label>{mode==='photo'&&<label>表示時間：{current.duration}秒<input type="range" min="2" max="15" value={current.duration} onChange={e=>update(selected,{duration:Number(e.target.value)})}/></label>}</div>}<h3>ムービーの長さ</h3><div className="mode"><label><input type="radio" checked={mode==='photo'} onChange={()=>setMode('photo')}/> 写真の表示時間を基準</label><label><input type="radio" checked={mode==='music'} onChange={()=>setMode('music')}/> 音楽の長さを基準</label></div>{mode==='photo'?<label>新しく追加する写真の初期表示時間：{duration}秒<input type="range" min="2" max="15" value={duration} onChange={e=>setDuration(Number(e.target.value))}/><button className="small" onClick={()=>setPhotos(p=>p.map(x=>({...x,duration})))}>全写真に適用</button></label>:<label>音楽の使用時間（秒）<input type="number" min="15" max="3600" value={musicSeconds} onChange={e=>setMusicSeconds(Math.max(15,Number(e.target.value)||15))}/></label>}<div className="summary">完成予定時間：約 {Math.floor(total/60)}分{Math.round(total%60)}秒（前後の演出各6秒を含む）</div><label>タイトル<input value={title} onChange={e=>setTitle(e.target.value)}/></label><button className="secondary" onClick={()=>setStep('home')}>ホームに戻る</button></section>:null}
<input ref={input} type="file" accept="image/*" multiple hidden onChange={e=>{addPhotos(e.target.files);e.target.value=''}}/>
<footer>おもいでシアター · 試作版 v0.2</footer></main>
}