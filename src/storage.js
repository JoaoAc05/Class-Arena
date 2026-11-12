const NAME = 'class-arena';
const VERSION = 5;
export const done = tx => new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
export const request = req => new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
export const DB = {
  raw:null,
  async open(){
    this.raw=await new Promise((resolve,reject)=>{
      const r=indexedDB.open(NAME,VERSION);
      r.onupgradeneeded=()=>{
        const db=r.result;
        const add=(name,key='id',indexes=[])=>{if(db.objectStoreNames.contains(name))return;const s=db.createObjectStore(name,{keyPath:key});indexes.forEach(([n,k])=>s.createIndex(n,k,{unique:false}));};
        add('questions','id',[['disciplineId','disciplineId'],['activityTypeId','activityTypeId']]);
        add('disciplines'); add('activityTypes','id',[['disciplineId','disciplineId']]); add('teams','id',[['name','name']]); add('themes');
        add('games','id',[['createdAt','createdAt'],['status','status'],['disciplineId','disciplineId']]);
        add('gameTeams','id',[['gameId','gameId']]); add('activities','id',[['gameId','gameId']]);
        add('encounters','id',[['gameId','gameId'],['round','round']]); add('responses','id',[['activityId','activityId']]);
        add('academicScores','id',[['gameId','gameId'],['gameTeamId','gameTeamId']]); add('competitionScores','id',[['gameId','gameId'],['gameTeamId','gameTeamId']]);
        add('cardUsages','id',[['gameId','gameId'],['gameTeamId','gameTeamId']]); add('settings','key');
      };
      r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(new Error('Feche outras abas do CLASS ARENA e atualize.'));
    }); return this;
  },
  async all(store){const tx=this.raw.transaction(store);const result=await request(tx.objectStore(store).getAll());await done(tx);return result;},
  async put(store,value){const tx=this.raw.transaction(store,'readwrite');tx.objectStore(store).put(value);await done(tx);},
  async delete(store,key){const tx=this.raw.transaction(store,'readwrite');tx.objectStore(store).delete(key);await done(tx);}
};
