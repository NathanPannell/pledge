import http from 'node:http';
import { mkdirSync } from 'node:fs';
import worker from '../worker/index.js';
import { SQLiteD1 } from './sqlite-adapter.mjs';
mkdirSync('.local',{recursive:true});const db=new SQLiteD1(process.env.SPARE_DB||'.local/spare.sqlite');db.migrate();
const env={...process.env,DB:db,APP_ORIGIN:process.env.APP_ORIGIN||'http://localhost:4175'};
http.createServer(async(req,res)=>{try{const chunks=[];for await(const c of req)chunks.push(c);const request=new Request(`${env.APP_ORIGIN}${req.url}`,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)});const response=await worker.fetch(request,env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch{res.writeHead(500);res.end('Spare unavailable');}}).listen(4175,'127.0.0.1',()=>console.log('Spare preview: http://localhost:4175'));
