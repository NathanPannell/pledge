import { build } from 'esbuild';
import { mkdir, readdir, readFile, writeFile, cp, rm, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
await mkdir('public/assets',{recursive:true});
await mkdir('extension/assets',{recursive:true});
for(const font of ['dm-sans.woff2','newsreader.woff2']){try{await access(`public/assets/${font}`);}catch{await cp(`../spare-quick/dist/assets/${font}`,`public/assets/${font}`);}await cp(`public/assets/${font}`,`extension/assets/${font}`);}
// Package an installable MV3 extension, excluding build/runtime data.
execFileSync('python3',['-c',"import pathlib,zipfile; root=pathlib.Path('extension'); z=zipfile.ZipFile('public/extension.zip','w',zipfile.ZIP_DEFLATED); [z.write(p,p.relative_to(root)) for p in root.rglob('*') if p.is_file()]; z.close()"]);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2','.zip':'application/zip','.png':'image/png','.json':'application/json; charset=utf-8'};
const assets={};
async function walk(dir){for(const x of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,x.name);if(x.isDirectory())await walk(p);else assets['/'+path.relative('public',p)]={base64:(await readFile(p)).toString('base64'),type:types[path.extname(p)]||'application/octet-stream'};}}
await walk('public');await writeFile('worker/assets.generated.js',`export default ${JSON.stringify(assets)};`);
await rm('dist',{recursive:true,force:true});await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});
await build({entryPoints:['worker/index.js'],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'browser',target:'es2022'});
await cp('.openai/hosting.json','dist/.openai/hosting.json');
console.log('Built application Worker, static assets, and Chrome extension.');
