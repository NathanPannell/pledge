import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
const migrationRoot = new URL('../drizzle/', import.meta.url);
export class SQLiteD1 {
  constructor(filename=':memory:'){this.db=new DatabaseSync(filename);this.db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');}
  migrate(){this.db.exec('CREATE TABLE IF NOT EXISTS local_migrations(name TEXT PRIMARY KEY)');for(const name of readdirSync(migrationRoot).filter(n=>n.endsWith('.sql')).sort()){if(this.db.prepare('SELECT 1 FROM local_migrations WHERE name=?').get(name))continue;this.db.exec('BEGIN IMMEDIATE');try{this.db.exec(readFileSync(new URL(name,migrationRoot),'utf8'));this.db.prepare('INSERT INTO local_migrations VALUES(?)').run(name);this.db.exec('COMMIT');}catch(e){this.db.exec('ROLLBACK');throw e;}}}
  prepare(sql){const database=this;return{args:[],sql,bind(...args){return{...this,args};},async first(){return database.db.prepare(sql).get(...this.args)??null;},async all(){return{results:database.db.prepare(sql).all(...this.args)};},async run(){const r=database.db.prepare(sql).run(...this.args);return{success:true,results:[],meta:{changes:Number(r.changes)}};}};}
  async batch(statements){this.db.exec('BEGIN IMMEDIATE');try{const results=statements.map(s=>{const st=this.db.prepare(s.sql);if(/^\s*(SELECT|WITH)/i.test(s.sql))return{success:true,results:st.all(...s.args),meta:{changes:0}};const r=st.run(...s.args);return{success:true,results:[],meta:{changes:Number(r.changes)}};});this.db.exec('COMMIT');return results;}catch(e){this.db.exec('ROLLBACK');throw e;}}
  close(){this.db.close();}
}
