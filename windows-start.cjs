const {spawnSync} = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const root = __dirname;
require('./desktop/node_modules/dotenv').config({path:path.join(root,'.env'),quiet:true});

function command(program,args,inherit=false){
  const result=spawnSync(program,args,{cwd:root,encoding:'utf8',
    stdio:inherit?'inherit':'pipe',windowsHide:false});
  if(result.error)throw Error('Could not start '+program+': '+result.error.message);
  if(result.status!==0)throw Error(program+' '+args.join(' ')+' failed.\n'+(result.stderr || '')+
    '\nIf Docker is unavailable, open Docker Desktop, select Linux containers and check wsl --status.');
  return result.stdout?.trim();
}
function requireNode(){
  const [major,minor]=process.versions.node.split('.').map(Number);
  if(major<22 || (major===22 && minor<12))throw Error('This Windows launcher requires Node 22.12 or newer.');
}
async function main(){
  requireNode();
  console.log('Krishna Saarthi • Windows startup');
  console.log('Host Node',process.version,'• Electron 45.3.0');
  command('docker',['compose','version'],true);
  const os=command('docker',['info','--format','{{.OSType}}']);
  if(os!=='linux')throw Error('Select Linux containers in Docker Desktop before starting this project.');
  if(!fs.existsSync(path.join(root,'.env')))throw Error('Copy .env.example to .env first.');
  command('docker',['compose','up','--build','-d','--wait','--wait-timeout','180'],true);
  const provider=(process.env.PROVIDER || 'ollama').toLowerCase();
  if(provider==='ollama'){
    console.log('Checking Ollama from inside the container…');
    // Credentials stay in the container environment. Only model availability is printed.
    const probe=[
      'import os,httpx',
      "base=os.environ.get('OLLAMA_BASE_URL','').rstrip('/')",
      "model=os.environ.get('OLLAMA_MODEL','gemma3:4b')",
      "r=httpx.get(base+'/models',timeout=15)",
      'r.raise_for_status()',
      "ids=[item['id'] for item in r.json().get('data',[])]",
      "assert model in ids, 'Configured model missing. Run ollama pull '+model+' on Windows.'",
      "print('Ollama model ready:',model)"
    ].join(';');
    command('docker',['compose','exec','-T','assistant','python','-c',probe],true);
  }else if(provider==='openai'){
    if(!process.env.OPENAI_API_KEY)throw Error('Set OPENAI_API_KEY in .env and rerun the launcher.');
    console.log('OpenAI configured. The first question will verify model access.');
  }else throw Error('Set PROVIDER to ollama or openai in .env.');
  if(process.argv.includes('--backend-only')){
    console.log('Backend and dependencies are ready. On Desktop 2, double-click Open-UI-Windows.wsf.');
    return;
  }
  console.log('Starting the floating desktop UI. Docker services remain running after the UI closes.');
  command(process.execPath,[path.join(root,'desktop/node_modules/electron/cli.js'),path.join(root,'desktop')],true);
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
