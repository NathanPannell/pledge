"""Run a child with Hermie credentials in memory. Never print credential values."""
from pathlib import Path
import os, subprocess, json, sys

def op_environment():
    path=Path('/home/paurav/.config/hermes/secrets/op-service-account.env')
    st=path.stat()
    if not path.is_file() or st.st_uid!=os.getuid() or st.st_mode & 0o077:
        raise RuntimeError('Protected 1Password bootstrap unavailable')
    values=[]
    for raw in path.read_text().splitlines():
        line=raw.strip()
        if line.startswith('export '): line=line[7:].lstrip()
        if line.startswith('OP_SERVICE_ACCOUNT_TOKEN='):
            value=line.split('=',1)[1].strip()
            if len(value)>1 and value[0]==value[-1] and value[0] in '\"\'': value=value[1:-1]
            values.append(value)
    if len(values)!=1 or not values[0]: raise RuntimeError('Invalid bootstrap')
    return dict(os.environ,OP_SERVICE_ACCOUNT_TOKEN=values[0])

def item(title, env):
    r=subprocess.run(['op','item','get',title,'--vault','Hermie','--format=json'],env=env,capture_output=True,text=True,stdin=subprocess.DEVNULL,timeout=30)
    if r.returncode: raise RuntimeError('Required Hermie item unavailable: '+title)
    return json.loads(r.stdout)

def stripe_environment():
    env=op_environment()
    for name,prefix in [('STRIPE_API_KEY','rk_test_'),('STRIPE_PUBLISHABLE_KEY','pk_test_')]:
        values=[f.get('value','') for f in item(name,env).get('fields',[]) if f.get('value','').startswith(prefix)]
        if len(values)!=1: raise RuntimeError('Expected one sandbox key in '+name)
        env[name]=values[0]
    if env.get('SPARE_DROP_VAULT_TOKEN')=='1': env.pop('OP_SERVICE_ACCOUNT_TOKEN',None)
    return env

if __name__=='__main__':
    if len(sys.argv)<2: raise SystemExit('Provide a child command')
    if os.isatty(0):
        import termios
        settings=termios.tcgetattr(0)
        settings[3] &= ~termios.ECHO
        termios.tcsetattr(0,termios.TCSANOW,settings)
    os.execvpe(sys.argv[1],sys.argv[1:],stripe_environment())
