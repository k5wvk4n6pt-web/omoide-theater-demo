export type StoredPhoto={meta:Record<string,unknown>;blob:Blob};
export type StoredProject={version:number;savedAt:string;settings:Record<string,unknown>;photos:StoredPhoto[];audio?:{name:string;seconds:number;blob:Blob}};
const DB='omoide-theater-drafts',STORE='projects',KEY='latest';
function openDb():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const request=indexedDB.open(DB,1);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE)};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}
async function transaction<T>(mode:IDBTransactionMode,fn:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,mode);const req=fn(tx.objectStore(STORE));req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);tx.oncomplete=()=>db.close();tx.onerror=()=>{db.close();reject(tx.error)}})}
export async function saveDraft(project:StoredProject){await transaction('readwrite',store=>store.put(project,KEY))}
export async function loadDraft(){return await transaction<StoredProject|undefined>('readonly',store=>store.get(KEY))}
export async function deleteDraft(){await transaction('readwrite',store=>store.delete(KEY))}
