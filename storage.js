let db;
export async function database(){
 if(db)return db;
 db=await new Promise((resolve,reject)=>{const r=indexedDB.open('umaplan-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('state');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});return db;
}
export async function readState(){const d=await database();return new Promise((resolve,reject)=>{const r=d.transaction('state').objectStore('state').get('workspace');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function writeState(state){const d=await database();return new Promise((resolve,reject)=>{const t=d.transaction('state','readwrite');t.objectStore('state').put(state,'workspace');t.oncomplete=resolve;t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error);});}
