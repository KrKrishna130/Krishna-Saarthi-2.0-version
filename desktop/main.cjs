const {app, BrowserWindow, globalShortcut, screen, Menu, dialog, desktopCapturer, ipcMain} = require('electron');
const path = require('node:path');
require('dotenv').config({path:path.join(__dirname,'../.env'),quiet:true});
let win;
let shortcutStatus=[];
let audioGranted=false;
let screenGranted=false;
let pendingCapture=null;
let availableSources=new Map();
const floatingEnabled = process.env.DESKTOP_ALWAYS_ON_TOP !== 'false';
const captureProtectionRequested = process.env.DESKTOP_CONTENT_PROTECTION !== 'false';
let captureProtectionApplied = false;
const skipTaskbar = process.platform === 'win32' && process.env.DESKTOP_SKIP_TASKBAR !== 'false';

function desktopInfo(){
  return {platform:process.platform,shortcuts:shortcutStatus,
    floating:win.isAlwaysOnTop(),captureProtectionRequested,captureProtectionApplied,
    captureNotice:process.platform==='darwin'
      ? 'macOS screen capture can still include this window. Share a selected meeting tab or window and verify the attendee view.'
      : 'Capture exclusion was requested for this window. Verify the attendee view before sharing.'};
}

function floating(enabled){
  win.setAlwaysOnTop(enabled, 'floating');
  if(process.platform==='darwin')win.setVisibleOnAllWorkspaces(enabled,{visibleOnFullScreen:enabled});
  win.webContents.send('desktop:changed',desktopInfo());
}
const port = process.env.WEB_PORT || '8787';
const target = new URL(process.env.DESKTOP_URL || 'http://localhost:'+port);
if(target.protocol!=='http:' || !['localhost','127.0.0.1'].includes(target.hostname)){
  throw Error('DESKTOP_URL must use http://localhost or http://127.0.0.1.');
}

function trusted(url) {
  try {return new URL(url).origin===target.origin;} catch {return false;}
}

function move(side) {
  if(!win || win.isDestroyed())return;
  function position(){
    const area=screen.getDisplayMatching(win.getBounds()).workArea;
    const bounds=win.getBounds();
    const width=Math.min(bounds.width,area.width), height=Math.min(bounds.height,area.height);
    win.setBounds({x:side==='left'?area.x:area.x+area.width-width,
      y:Math.max(area.y,Math.min(bounds.y,area.y+area.height-height)),width,height});
    win.showInactive();
  }
  if(win.isFullScreen()){win.once('leave-full-screen',position);win.setFullScreen(false);}
  else {if(win.isMaximized())win.unmaximize();position();}
}

function toggle(){
  if(win.isVisible())win.hide();
  else {win.show();win.focus();}
}

function registerShortcuts(){
  const actions=[
    ['Move left',process.env.SHORTCUT_LEFT || 'Control+Left',()=>move('left')],
    ['Move right',process.env.SHORTCUT_RIGHT || 'Control+Right',()=>move('right')],
    ['Hide / restore',process.env.SHORTCUT_TOGGLE || 'Control+H',toggle]
  ];
  shortcutStatus=actions.map(([label,key,fn])=>{
    let ok=false;
    try {if(!globalShortcut.isRegistered(key))ok=globalShortcut.register(key,fn);}catch{}
    console.log(label+' • '+key+' • '+(ok?'registered':'FAILED'));
    return {label,key,ok};
  });
}

async function createWindow(){
  win=new BrowserWindow({title:'Krishna Saarthi',width:520,height:760,minWidth:380,minHeight:420,skipTaskbar,
    webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,
      contextIsolation:true,sandbox:true,backgroundThrottling:false,partition:'krishna-saarthi-desktop'}});
  win.setAlwaysOnTop(floatingEnabled, 'floating');
  if(process.platform==='darwin')win.setVisibleOnAllWorkspaces(floatingEnabled,{visibleOnFullScreen:floatingEnabled});
  try {
    win.setContentProtection(captureProtectionRequested);
    captureProtectionApplied=win.isContentProtected();
  }catch(error){console.error('Capture exclusion unavailable:',error.message);}
  console.log('Floating window:',floatingEnabled,'Capture exclusion setting:',captureProtectionApplied);
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',(event,url)=>{if(!trusted(url))event.preventDefault();});
  const session=win.webContents.session;
  // Consent is explicit in the Prepare interview UI. Grants last only for this session.
  session.setPermissionCheckHandler((contents,permission,origin,details={})=>{
    const allowed=contents===win.webContents && trusted(origin) &&
      (permission==='media'?audioGranted:permission==='display-capture' && (audioGranted||screenGranted));
    // Display video is screen capture. Only physical-camera access is excluded.
    return allowed && !(permission==='media' && details.mediaType==='video');
  });
  session.setPermissionRequestHandler((contents,permission,callback,details={})=>{
    const allowed=contents===win.webContents && trusted(details.requestingUrl) &&
      (permission==='media'?audioGranted:permission==='display-capture' && (audioGranted||screenGranted));
    callback(allowed && !(permission==='media' && details.mediaTypes?.includes('video')));
  });
  session.setDisplayMediaRequestHandler(async(request,callback)=>{
    const pending=pendingCapture;pendingCapture=null;
    if(!pending || !trusted(request.securityOrigin)){callback(null);return;}
    if(pending.kind==='audio' && (!audioGranted || !request.audioRequested)){callback(null);return;}
    if(pending.kind==='screen' && (!screenGranted || request.audioRequested)){callback(null);return;}
    try{
      const sources=await desktopCapturer.getSources({types:['window','screen']});
      const selected=sources.find(source=>source.id===pending.source);
      if(!selected){callback(null);return;}
      const options={video:selected};
      if(pending.kind==='audio' && process.platform==='win32')options.audio='loopback';
      callback(options);
    }catch(error){console.error('Capture failed',error.message);callback(null);}
  });
  win.webContents.on('did-fail-load',(_event,code,description,_url,mainFrame)=>{
    if(mainFrame && code!==-3)dialog.showErrorBox('Start the Docker service','Could not open '+target.href+
      '\nRun docker compose up --build -d, then choose App > Reload.\n'+description);
  });
  registerShortcuts();
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {label:'App',submenu:[
      {label:'Show assistant',click:()=>{win.show();win.focus();}},
      {label:'Show taskbar button',type:'checkbox',checked:!skipTaskbar,click:item=>win.setSkipTaskbar(!item.checked)},
      {label:'Move left',click:()=>move('left')},{label:'Move right',click:()=>move('right')},
      {label:'Hide / restore',click:toggle},
      {label:'Keep above meeting',type:'checkbox',checked:floatingEnabled,click:item=>floating(item.checked)},
      {label:'Screen-sharing status',click:()=>dialog.showMessageBox(win,{message:desktopInfo().captureNotice,
        detail:'Requested exclusion: '+captureProtectionRequested+' • OS setting: '+captureProtectionApplied+
        '\nThis setting does not verify what other participants receive.'})},{type:'separator'},
      {label:'Shortcut status',click:()=>dialog.showMessageBox(win,{message:shortcutStatus.map(s=>s.label+' • '+s.key+' • '+(s.ok?'registered':'FAILED')).join('\n')})},
      {label:'Reload',click:()=>win.loadURL(target.href)},
      {label:'Developer console',click:()=>win.webContents.openDevTools()},
      {role:'quit'}]}
  ]));
  await win.loadURL(target.href).catch(()=>{});
  const failed=shortcutStatus.filter(s=>!s.ok);
  if(failed.length)dialog.showMessageBox(win,{type:'warning',message:'Some keyboard shortcuts could not register.',
    detail:failed.map(s=>s.key).join(', ')+'\nChange SHORTCUT_LEFT / RIGHT / TOGGLE in .env, resolve OS conflicts, then restart. App menu controls remain available.'});
}

if(!app.requestSingleInstanceLock())app.quit();
else{
  function checkSender(event){
    if(event.sender!==win.webContents || !trusted(event.senderFrame.url))throw Error('Untrusted page');
  }
  ipcMain.handle('desktop:sources',async event=>{
    checkSender(event);
    const sources=await desktopCapturer.getSources({types:['window','screen'],thumbnailSize:{width:0,height:0}});
    const ownId=win.getMediaSourceId();
    const candidates=sources.filter(source=>source.id!==ownId);
    availableSources=new Map(candidates.map(source=>[source.id,source]));
    return candidates.map(source=>({id:source.id,name:source.name}));
  });
  ipcMain.handle('desktop:prepare-audio',async(event,mode,consent)=>{
    checkSender(event);
    if(consent!==true || ![0,1,2].includes(mode))throw Error('Confirm audio permission and choose an audio mode.');
    if(mode!==2){
      if(process.platform!=='win32')throw Error('Use a routed microphone input on this platform.');
      // Windows playback capture requires a desktop-media route. No screen frames are read by the audio workflow.
      const displays=await desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:0,height:0}});
      if(!displays.length)throw Error('Windows playback capture is unavailable. Try Microphone / routed input.');
      pendingCapture={kind:'audio',source:displays[0].id};
    }
    audioGranted=true;
  });
  ipcMain.handle('desktop:prepare-screen',(event,id,consent)=>{
    checkSender(event);
    if(consent!==true)throw Error('Confirm screen permission first.');
    if(!availableSources.has(id))throw Error('Select a screen source from Refresh screen sources.');
    screenGranted=true;pendingCapture={kind:'screen',source:id};
  });
  ipcMain.handle('desktop:release-audio',event=>{
    checkSender(event);audioGranted=false;
    if(pendingCapture?.kind==='audio')pendingCapture=null;
  });
  ipcMain.handle('desktop:release-screen',event=>{
    checkSender(event);screenGranted=false;
    if(pendingCapture?.kind==='screen')pendingCapture=null;
  });
  ipcMain.handle('desktop:release',event=>{
    checkSender(event);audioGranted=false;screenGranted=false;pendingCapture=null;
  });
  app.on('second-instance',()=>{if(win){win.show();win.focus();}});
  ipcMain.handle('desktop:info',event=>{
    if(event.sender!==win.webContents || !trusted(event.senderFrame.url))throw Error('Untrusted page');
    return desktopInfo();
  });
  app.whenReady().then(createWindow).catch(error=>{dialog.showErrorBox('Launch failed',error.message);app.quit();});
  app.on('activate',()=>{if(win && !win.isDestroyed()){win.show();win.focus();}});
  app.on('window-all-closed',()=>app.quit());
  app.on('will-quit',()=>globalShortcut.unregisterAll());
}
