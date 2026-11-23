export type StoredPhoto={meta:Record<string,unknown>;blob:Blob};
export type StoredProject={version:number;savedAt:string;settings:Record<string,unknown>;photos:StoredPhoto[];audio?:{name:string;seconds:number;blob:Blob}};
const DB='omoide-theater-drafts',STORE='projects',KEY='latest';
export type ProjectSummary={id:string;title:string;savedAt:string;photoCount:number;thumbnail?:Blob};
function openDb():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const request=indexedDB.open(DB,1);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE)};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}
async function transaction<T>(mode:IDBTransactionMode,fn:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,mode);const req=fn(tx.objectStore(STORE));req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);tx.oncomplete=()=>db.close();tx.onerror=()=>{db.close();reject(tx.error)}})}
export async function saveDraft(project:StoredProject){await transaction('readwrite',store=>store.put(project,KEY))}
export async function loadDraft(){return await transaction<StoredProject|undefined>('readonly',store=>store.get(KEY))}
export async function deleteDraft(){await transaction('readwrite',store=>store.delete(KEY))}

export async function listProjects():Promise<ProjectSummary[]>{
 const db=await openDb();
 const keys=await new Promise<IDBValidKey[]>((resolve,reject)=>{
  const tx=db.transaction(STORE,'readonly');
  const req=tx.objectStore(STORE).getAllKeys();
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error);
 });
 db.close();
 const results=await Promise.all(keys.map(async key=>{
  const p=await transaction<StoredProject|undefined>('readonly',store=>store.get(key));
  if(!p)return null;
  const item:ProjectSummary={id:String(key),title:String(p.settings.title||'無題の作品'),savedAt:p.savedAt,photoCount:p.photos.length};
  if(p.photos[0]?.blob&&p.photos[0].blob.type.startsWith('image/'))item.thumbnail=p.photos[0].blob;
  return item;
 }));
 const projects:ProjectSummary[]=[];
 for(const item of results){if(item!==null)projects.push(item)}
 return projects.sort((a,b)=>b.savedAt.localeCompare(a.savedAt));
}
export async function saveProject(id:string,project:StoredProject){await transaction('readwrite',store=>store.put(project,id))}
export async function loadProject(id:string){return transaction<StoredProject|undefined>('readonly',store=>store.get(id))}
export async function deleteProject(id:string){await transaction('readwrite',store=>store.delete(id))}
export async function duplicateProject(id:string,newId:string){const p=await loadProject(id);if(!p)throw new Error('作品が見つかりません');await saveProject(newId,{...p,savedAt:new Date().toISOString(),settings:{...p.settings,title:String(p.settings.title||'無題の作品')+'（コピー）'}})}
