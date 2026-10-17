const {neon}=require('@neondatabase/serverless');

// Serialize first-time schema setup across independently starting Vercel functions.
const SETUP=[
 'SELECT pg_advisory_xact_lock(4820193501)',
 `CREATE TABLE IF NOT EXISTS maison_rooms (
   key text PRIMARY KEY, value text NOT NULL, expires_at timestamptz NOT NULL
 )`,
 `CREATE TABLE IF NOT EXISTS maison_limits (
   key text PRIMARY KEY, count integer NOT NULL, expires_at timestamptz NOT NULL
 )`,
 'DELETE FROM maison_rooms WHERE expires_at <= now()',
 'DELETE FROM maison_limits WHERE expires_at <= now()'
];
class NeonDatabase {
 constructor(url){this.sql=neon(url);this.ready=null}
 async initialize(){
  if(!this.ready)this.ready=this.sql.transaction(SETUP.map(q=>this.sql.query(q,[])),{fetchOptions:{signal:AbortSignal.timeout(15000)}}).catch(e=>{this.ready=null;throw e});
  await this.ready;
 }
 async query(sql,params=[]){await this.initialize();return this.sql.query(sql,params,{fetchOptions:{signal:AbortSignal.timeout(6000)}})}
}
class NeonStore {
 constructor(database,key){this.database=database;this.key=key}
 async read(){
  const rows=await this.database.query('SELECT value FROM maison_rooms WHERE key=$1 AND expires_at>now()',[this.key]);
  return rows[0]?.value??null;
 }
 async cas(old,next){
  // Preserve the exact JSON string: text equality provides the same CAS contract as Redis.
  const rows=old===null
   ?await this.database.query(`INSERT INTO maison_rooms AS r (key,value,expires_at)
     VALUES ($1,$2,now()+interval '7 days')
     ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value,expires_at=EXCLUDED.expires_at
     WHERE r.expires_at<=now() RETURNING key`,[this.key,next])
   :await this.database.query(`UPDATE maison_rooms SET value=$2,expires_at=now()+interval '7 days'
     WHERE key=$1 AND value=$3 AND expires_at>now() RETURNING key`,[this.key,next,old]);
  return rows.length===1;
 }
 async limit(key){
  const rows=await this.database.query(`INSERT INTO maison_limits AS l (key,count,expires_at)
    VALUES ($1,1,now()+interval '1 minute')
    ON CONFLICT (key) DO UPDATE SET
      count=CASE WHEN l.expires_at<=now() THEN 1 ELSE LEAST(l.count+1,1000000) END,
      expires_at=CASE WHEN l.expires_at<=now() THEN now()+interval '1 minute' ELSE l.expires_at END
    RETURNING count`,[this.key+':'+key]);
  return rows[0].count<=12;
 }
}
module.exports={NeonDatabase,NeonStore,SETUP};
