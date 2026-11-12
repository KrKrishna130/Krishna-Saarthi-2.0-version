const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('krishnaSaarthiDesktop',{
  info:()=>ipcRenderer.invoke('desktop:info'),
  sources:()=>ipcRenderer.invoke('desktop:sources'),
  prepareAudio:(mode,consent)=>ipcRenderer.invoke('desktop:prepare-audio',mode,consent),
  prepareScreen:(id,consent)=>ipcRenderer.invoke('desktop:prepare-screen',id,consent),
  releaseAudio:()=>ipcRenderer.invoke('desktop:release-audio'),
  releaseScreen:()=>ipcRenderer.invoke('desktop:release-screen'),
  release:()=>ipcRenderer.invoke('desktop:release'),
  onChange:callback=>{
    const listener=(_event,info)=>callback(info);
    ipcRenderer.on('desktop:changed',listener);
    return ()=>ipcRenderer.removeListener('desktop:changed',listener);
  }
});
