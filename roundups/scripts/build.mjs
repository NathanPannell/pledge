import { mkdir, readFile, writeFile, cp, rm, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadEnv, readConfig, REPO_ROOT } from '../../server/src/config.js';

loadEnv();
const config = readConfig();
const root = fileURLToPath(new URL('../', import.meta.url));
const publicRoot = path.join(root, 'public');
const extension = path.join(REPO_ROOT, '.local/extension');
const origin = new URL(process.env.EXTENSION_ORIGIN || config.appOrigin).origin;
await mkdir(publicRoot, { recursive: true });
await rm(extension, { recursive: true, force: true });
await cp(path.join(root, 'extension'), extension, { recursive: true });
await writeFile(path.join(extension, 'config.js'),
  `globalThis.SPARE_ORIGIN=${JSON.stringify(origin)};\nglobalThis.SPARE_API_PREFIX='/roundups';\nglobalThis.SPARE_SETUP_PATH='/roundups/';\n`);
const manifest = JSON.parse(await readFile(path.join(extension, 'manifest.json'), 'utf8'));
manifest.host_permissions = [origin + '/*'];
await writeFile(path.join(extension, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
// Windows installs Python 3 as "python"; "python3" there is a Store shortcut.
const python = process.platform === 'win32' ? 'python' : 'python3';
execFileSync(python, ['-c',
  'import pathlib,zipfile,sys; root=pathlib.Path(sys.argv[1]); z=zipfile.ZipFile(sys.argv[2],"w",zipfile.ZIP_DEFLATED); [z.write(p,p.relative_to(root)) for p in sorted(root.rglob("*")) if p.is_file()]; z.close()',
  extension, path.join(publicRoot, 'extension.zip')]);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.woff2': 'font/woff2', '.zip': 'application/zip' };
const assets = {};
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(file);
    else assets['/' + path.relative(publicRoot, file)] = {
      base64: (await readFile(file)).toString('base64'),
      type: types[path.extname(file)] || 'application/octet-stream',
    };
  }
}
await walk(publicRoot);
await writeFile(path.join(root, 'worker/assets.generated.js'), `export default ${JSON.stringify(assets)};\n`);
console.log('Built standalone extension and setup/payment-return assets for ' + origin);
