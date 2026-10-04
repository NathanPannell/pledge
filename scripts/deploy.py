#!/usr/bin/env python3
"""Prepare an immutable release, then optionally switch the existing user service.

No fetch, pull, key output, live payment, database reset, or tunnel change occurs.
First-time service setup/import is documented separately in DEPLOYMENT.md.
"""
import argparse, fcntl, hashlib, os, re, shutil, socket, sqlite3, subprocess
import tempfile, time, urllib.request
from pathlib import Path

def env_file(path):
    st = path.stat()
    if not path.is_file() or st.st_uid != os.getuid() or st.st_mode & 0o077:
        raise RuntimeError('Hosting environment ownership/permissions invalid')
    values = {}
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith('#'): continue
        key, sep, value = line.partition('=')
        if not sep or not key.replace('_', '').isalnum(): raise RuntimeError('Invalid environment assignment')
        values[key] = value.strip().strip('"\'')
    return values

def backup(source, target):
    if not source.exists(): return
    target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    with sqlite3.connect(source.as_uri() + '?mode=ro', uri=True) as src, sqlite3.connect(target) as dst:
        src.backup(dst)
        if dst.execute('PRAGMA integrity_check').fetchone()[0] != 'ok': raise RuntimeError('Backup integrity check failed')
    target.chmod(0o600)

def switch_link(link, target):
    temporary = link.with_name(link.name + '.next')
    temporary.unlink(missing_ok=True)
    temporary.symlink_to(target)
    temporary.replace(link)

def version_assets(root, sha):
    """Version static links in release HTML, leaving the editable frontend intact."""
    pattern = re.compile(r'''(\b(?:src|href)\s*=\s*["'])(/?assets/[^"'?#]+|\./setup\.(?:css|js))(["'])''')
    web = root/'web'
    assets = (web/'assets').resolve()
    setup = root/'roundups/public'
    def replace(match):
        target = ((web/match[2].lstrip('/')) if match[2].startswith('/assets/') else page.parent/match[2]).resolve()
        if not (target.is_relative_to(assets) or target.parent == setup.resolve()) or not target.is_file():
            raise RuntimeError('Release HTML references a missing static asset')
        return match[1] + match[2] + '?v=' + sha[:12] + match[3]
    for page in [*web.glob('*.html'), *setup.glob('*.html')]:
        page.write_text(pattern.sub(replace, page.read_text()))

def smoke(origin, root):
    for path in ['/', '/app.html', '/api/state', '/roundups/', '/roundups/api/health']:
        with urllib.request.urlopen(origin + path, timeout=3) as response:
            body = response.read()
            if response.status != 200: raise RuntimeError('Candidate HTTP check failed')
            if path == '/' and hashlib.sha256(body).digest() != hashlib.sha256((root/'web/index.html').read_bytes()).digest():
                raise RuntimeError('Frontend response differs from candidate source')

def main():
    os.umask(0o077)
    args = argparse.ArgumentParser()
    args.add_argument('--ref', default='HEAD')
    args.add_argument('--stage-only', action='store_true')
    args.add_argument('--rollback', action='store_true')
    args.add_argument('--import-source', type=Path, help='Read-only old ledger for first-time staging; this does not import live data')
    args = args.parse_args()
    repo = Path(__file__).resolve().parents[1]
    state = Path.home()/'.local/state/pledge'
    releases = Path.home()/'.local/share/pledge'
    for directory in [state, releases, releases/'releases']:
        directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    with (state/'deploy.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        values = env_file(Path.home()/'.config/pledge/demo.env')
        environment = {**os.environ, **values}
        environment.pop('OP_SERVICE_ACCOUNT_TOKEN', None)
        live = Path(values['ROUNDUPS_DB'])
        company = Path(values['DATA_DIR'])
        if not live.is_absolute() or not company.is_absolute(): raise RuntimeError('Hosted data paths must be absolute')
        service = ['systemctl', '--user']
        if args.rollback:
            previous = (releases/'previous').resolve(strict=True)
            current = (releases/'current').resolve(strict=True)
            switch_link(releases/'current', previous)
            try:
                subprocess.run(service+['restart', 'spare-cad-demo.service'], check=True)
                for attempt in range(40):
                    try: smoke('http://127.0.0.1:'+values['PORT'], previous); break
                    except Exception:
                        if attempt == 39: raise
                        time.sleep(.25)
            except Exception:
                switch_link(releases/'current', current)
                subprocess.run(service+['restart', 'spare-cad-demo.service'], check=True)
                raise
            switch_link(releases/'previous', current)
            print('Rolled back code; current databases and credentials were preserved.')
            return
        dirty = subprocess.check_output(['git', 'status', '--porcelain'], cwd=repo, text=True)
        if dirty.strip(): raise RuntimeError('Commit or stash checkout changes before deployment; no files will be discarded')
        sha = subprocess.check_output(['git', 'rev-parse', '--verify', args.ref+'^{commit}'], cwd=repo, text=True).strip()
        release = releases/'releases'/sha
        if release.exists(): raise RuntimeError('Immutable release already exists; choose its existing path or a new commit')
        release.mkdir(mode=0o700)
        log = state/('prepare-'+sha[:12]+'.log')
        try:
            with tempfile.TemporaryDirectory(dir=state, prefix='candidate-') as temp:
                temporary = Path(temp)
                archive = temporary/'source.tar'
                subprocess.run(['git', 'archive', '--format=tar', '--output='+str(archive), sha], cwd=repo, check=True)
                subprocess.run(['tar', '-xf', str(archive), '-C', str(release)], check=True)
                version_assets(release, sha)
                staging = {**environment, 'DATA_DIR': str(temporary/'company'), 'ROUNDUPS_DB': str(temporary/'roundups.sqlite')}
                backup(live if live.exists() else args.import_source or live, temporary/'roundups.sqlite')
                backup(company/'pledge.db', temporary/'company/pledge.db')
                if (company/'secret.key').exists(): shutil.copy2(company/'secret.key', temporary/'company/secret.key')
                with log.open('w') as output:
                    for command in [['npm', 'ci', '--ignore-scripts'], ['npm', 'test'], ['npm', 'run', 'validate']]:
                        subprocess.run(command, cwd=release, env=staging, stdout=output, stderr=subprocess.STDOUT, check=True, timeout=180)
                with socket.socket() as sock:
                    sock.bind(('127.0.0.1', 0)); port = sock.getsockname()[1]
                with log.open('a') as output:
                    process = subprocess.Popen(['node', 'server/src/main.js'], cwd=release, env={**staging, 'PORT': str(port)}, stdout=output, stderr=subprocess.STDOUT)
                    try:
                        for attempt in range(40):
                            if process.poll() is not None: raise RuntimeError('Candidate process did not start; inspect protected preparation log')
                            try: smoke('http://127.0.0.1:'+str(port), release); break
                            except Exception:
                                if attempt == 39: raise
                                time.sleep(.25)
                    finally:
                        process.terminate(); process.wait(timeout=20)
            if args.stage_only:
                print('Prepared and tested immutable release: '+str(release)); return
            if not live.exists() or not (releases/'current').is_symlink(): raise RuntimeError('Complete the documented first-time service/data setup before activation')
            stamp = str(int(time.time()))
            backup(live, state/'backups'/stamp/'roundups.sqlite')
            backup(company/'pledge.db', state/'backups'/stamp/'pledge.db')
            if (company/'secret.key').exists(): shutil.copy2(company/'secret.key', state/'backups'/stamp/'secret.key')
            previous = (releases/'current').resolve(strict=True)
            switch_link(releases/'current', release)
            try:
                subprocess.run(service+['restart', 'spare-cad-demo.service'], check=True)
                for attempt in range(40):
                    try: smoke('http://127.0.0.1:'+values['PORT'], release); break
                    except Exception:
                        if attempt == 39: raise
                        time.sleep(.25)
            except Exception:
                switch_link(releases/'current', previous)
                subprocess.run(service+['restart', 'spare-cad-demo.service'], check=True)
                raise RuntimeError('Activation failed; previous code restored with live data unchanged')
            switch_link(releases/'previous', previous)
            print('Activated '+sha+'; frontend and both APIs passed checks on one service.')
        except Exception:
            # Leave protected logs; a failed candidate is not a valid immutable release.
            if not (releases/'current').is_symlink() or (releases/'current').resolve() != release:
                shutil.rmtree(release, ignore_errors=True)
            raise

if __name__ == '__main__': main()
