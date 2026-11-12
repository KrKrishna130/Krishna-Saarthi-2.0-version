import {AudioBufferWindow} from './audio-buffer.js';
const headers={'X-Krishna-Saarthi-Client':'web'};
async function request(path,body,json=false,signal) {
  const response=await fetch('/api/'+path,{
    method:body===undefined?'GET':'POST',
    headers:json?{...headers,'Content-Type':'application/json'}:headers,
    body:json?JSON.stringify(body):body,signal
  });
  if(!response.ok)throw Error((await response.json()).detail || 'Request failed.');
  return response;
}

export async function browserBridge() {
  const config=await (await request('config')).json();
  const native=window.krishnaSaarthiDesktop;
  const desktop=native ? await native.info() : null;
  let snapshot={...config,web:true,continuous:true,phase:'idle',status:'Allow audio before the interview. Screen permission is optional and separate.',
    question:'',answer:'',pdf:'',profileError:'',device:desktop?.platform==='darwin'?2:0,display:'',displays:[],
    devices:['Meeting playback + my microphone','Meeting playback only','Microphone / routed input only'],
    prepared:false,screenPrepared:false,inputMode:'typed',levels:[],desktop:!!desktop,floating:desktop?.floating,
    captureNotice:desktop?.captureNotice,
    notice:'Audio and screen have separate consent and stop controls. OS prompts and sharing indicators can still appear.'};
  let notify,project='',resume='',audioSession=null,screenSession=null,operation=null;
  native?.onChange(info=>update({floating:info.floating,captureNotice:info.captureNotice}));
  function update(values){snapshot={...snapshot,...values};notify?.(JSON.stringify(snapshot));}
  function release(stream){stream?.getTracks().forEach(track=>track.stop());}
  function errorText(error){return error.name==='AbortError'?'Request cancelled.':error.message;}

  async function stopAudio(reason='Audio stopped.'){
    const old=audioSession;audioSession=null;
    if(old){
      old.stopping=true;clearInterval(old.meter);
      release(old.playback);release(old.microphone);
      for(const input of old.inputs){input.source.disconnect();input.node.port.onmessage=null;input.node.disconnect();}
      await old.context.close().catch(()=>{});
    }
    await native?.releaseAudio().catch(()=>{});
    update({prepared:false,levels:[],status:reason,inputMode:snapshot.inputMode==='audio'?'typed':snapshot.inputMode});
  }

  async function stopScreen(reason='Screen capture stopped.'){
    const old=screenSession;screenSession=null;
    if(old){old.stopping=true;old.video.pause();old.video.srcObject=null;release(old.stream);}
    await native?.releaseScreen().catch(()=>{});
    update({screenPrepared:false,status:reason});
  }

  async function stopSession(){
    operation?.abort();operation=null;
    await stopAudio();await stopScreen();
    update({phase:'idle',status:'All capture stopped.'});
  }

  async function sources(){
    if(snapshot.screenPrepared || snapshot.phase!=='idle')return;
    try{
      if(native){
        const list=await native.sources();
        update({displays:list,display:list[0]?.id || '',status:'Select a screen source only when screen analysis is needed.'});
      }else update({displays:[{id:'browser',name:'Choose in browser picker'}],display:'browser'});
    }catch(error){update({status:error.message});}
  }

  async function listen(index,consent){
    if(snapshot.prepared || snapshot.phase!=='idle')return;
    if(consent!==true){update({status:'Confirm the audio consent checkbox first.'});return;}
    update({phase:'opening',status:'Preparing audio permission…'});
    let current;
    let stage='meeting playback';
    try{
      if(![0,1,2].includes(index))throw Error('Select an audio mode.');
      if(native)await native.prepareAudio(index,true);
      current={playback:null,microphone:null,context:new AudioContext({sampleRate:16000}),inputs:[],stopping:false};
      audioSession=current;
      await current.context.audioWorklet.addModule('/audio-worklet.js');
      async function add(stream,label){
        const source=current.context.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
        const node=new AudioWorkletNode(current.context,'capture-pcm');
        const buffer=new AudioBufferWindow(current.context.sampleRate,config.audio_window_seconds);
        const input={source,node,buffer,label,cursor:0,peak:0};
        node.port.onmessage=event=>{
          buffer.push(event.data);
          input.peak=event.data.reduce((peak,value)=>Math.max(peak,Math.abs(value)),0);
        };
        source.connect(node);node.connect(current.context.destination);current.inputs.push(input);
      }
      if(index!==2){
        // This display track is required by Windows loopback and is never used for image analysis.
        current.playback=await navigator.mediaDevices.getDisplayMedia({video:true,audio:true});
        if(!current.playback.getAudioTracks().length)throw Error('Playback audio unavailable. Try Microphone / routed input.');
        await add(current.playback,'Meeting playback');
      }
      if(index!==1){
        stage='microphone';
        current.microphone=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
        await add(current.microphone,index===2?'Microphone / routed input':'Candidate microphone');
      }
      await current.context.resume();
      const lost=()=>{if(audioSession===current && !current.stopping)void stopAudio('Audio source disconnected. Allow audio again before continuing.');};
      for(const stream of [current.playback,current.microphone])stream?.getTracks().forEach(track=>track.addEventListener('ended',lost,{once:true}));
      current.meter=setInterval(()=>{
        if(audioSession===current)update({levels:current.inputs.map(input=>({label:input.label,active:input.peak>0.001}))});
      },1000);
      stage='speech model loading';update({status:'Audio ready. Loading the speech model…'});
      await request('warmup',new Blob());
      if(audioSession!==current)throw Error('Audio capture ended during setup.');
      update({phase:'idle',prepared:true,inputMode:'audio',question:'',answer:'',
        status:'Audio active for this session. Click Response after each question.'});
    }catch(error){
      if(current)await stopAudio();else await native?.releaseAudio().catch(()=>{});
      const message=error.name==='NotAllowedError'
        ? stage+' permission denied. Enable Windows Microphone access and Let desktop apps access your microphone when microphone access is denied. Restart Electron and allow audio again.'
        : stage+': '+errorText(error);
      update({phase:'idle',status:message});
    }
  }

  async function prepareScreen(displayId,consent){
    if(snapshot.screenPrepared || snapshot.phase!=='idle')return;
    if(consent!==true){update({status:'Confirm the separate screen consent checkbox first.'});return;}
    if(native && !snapshot.displays.some(source=>source.id===displayId)){
      update({status:'Click Refresh screen sources and select a window or display.'});return;
    }
    update({phase:'opening-screen',status:'Preparing the selected screen. Audio continues if active.'});
    let current;
    try{
      if(native)await native.prepareScreen(displayId,true);
      const stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});
      current={stream,video:document.createElement('video'),stopping:false};screenSession=current;
      current.video.muted=true;current.video.srcObject=stream;await current.video.play();
      const lost=()=>{if(screenSession===current && !current.stopping)void stopScreen('Screen source closed. Audio is unaffected.');};
      stream.getVideoTracks().forEach(track=>track.addEventListener('ended',lost,{once:true}));
      update({phase:'idle',screenPrepared:true,status:'Screen ready. Click Analyse my screen, then Response.'});
    }catch(error){
      await stopScreen();
      update({phase:'idle',status:'Screen capture: '+errorText(error)});
    }
  }

  async function audioQuestion(signal){
    const current=audioSession;
    if(!current || current.context.state==='closed')throw Error('Allow audio first.');
    await current.context.resume();
    const clips=current.inputs.map(input=>({input,...input.buffer.wav(input.cursor)}));
    const audible=clips.filter(clip=>clip.speech);
    if(!audible.length)throw Error('No recent speech detected. Check the audio activity indicators and source.');
    const texts=await Promise.all(audible.map(async clip=>{
      const result=await (await request('audio',clip.blob,false,signal)).json();
      return clip.input.label+': '+result.text;
    }));
    return {question:texts.join('\n'),clips};
  }

  async function respond(question){
    if(snapshot.phase!=='idle')return;
    if(Array.from(project).length>config.limit){update({status:'Shorten the project description first.'});return;}
    const controller=new AbortController();operation=controller;
    const signal=controller.signal;
    let clips=[];
    try{
      if(snapshot.inputMode==='audio'){
        update({phase:'speech',status:'Transcribing recent audio. Listening continues…'});
        const result=await audioQuestion(signal);question=result.question;clips=result.clips;
      }
      if(!question.trim())throw Error('Type a question, capture a screen question or select Recent audio.');
      update({phase:'answer',question,status:'Generating response. Listening continues if the session is active.',answer:''});
      const response=await request('answer',{question,resume,project},true,signal);
      const reader=response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer='',answer='',complete=false;
      while(true){
        const {value,done}=await reader.read();if(done)break;
        buffer+=value;
        const lines=buffer.split('\n');buffer=lines.pop();
        for(const line of lines){
          if(!line)continue;
          const event=JSON.parse(line);
          if(event.error)throw Error(event.error);
          if(event.done)complete=true;
          if(event.delta){answer+=event.delta;update({answer});}
        }
      }
      if(!complete)throw Error('Connection interrupted. Retry the question.');
      for(const clip of clips)clip.input.cursor=clip.end;
      if(operation===controller)update({phase:'idle',status:'Response complete. Session continues.'});
    }catch(error){
      if(operation===controller)update({phase:'idle',status:errorText(error),answer:errorText(error)});
    }finally{if(operation===controller)operation=null;}
  }

  async function capture(){
    if(snapshot.phase!=='idle')return;
    if(!screenSession || !snapshot.screenPrepared){update({status:'Allow screen separately before analysing it. Audio can stay active.'});return;}
    const current=screenSession,controller=new AbortController();operation=controller;
    update({phase:'screen',status:'Reading the prepared screen source…',question:'',answer:''});
    try{
      if(current.video.readyState<2 || !current.stream.getVideoTracks().some(track=>track.readyState==='live'))
        throw Error('Screen source unavailable. Stop sharing, then prepare again.');
      const canvas=document.createElement('canvas');canvas.width=current.video.videoWidth;canvas.height=current.video.videoHeight;
      canvas.getContext('2d').drawImage(current.video,0,0);
      const image=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.85));
      if(!image)throw Error('Could not encode the selected screen.');
      const result=await (await request('screen',image,false,controller.signal)).json();
      const question=result.text.trim()==='NO_QUESTION'?'':result.text.trim();
      if(operation===controller)update({phase:'idle',question,inputMode:'screen',
        status:question?'Review the screen question, then click Response.':'No readable screen question found.'});
    }catch(error){
      if(operation===controller)update({phase:'idle',status:errorText(error),answer:errorText(error)});
    }finally{if(operation===controller)operation=null;}
  }

  function pdf(){
    const picker=document.createElement('input');picker.type='file';picker.accept='application/pdf';
    picker.onchange=async()=>{
      const file=picker.files[0];if(!file)return;
      try{
        const {text}=await (await request('profile',file)).json();
        resume=text;update({pdf:file.name,profileError:''});
      }catch(error){update({profileError:error.message});}
    };
    picker.click();
  }
  window.addEventListener('beforeunload',()=>{
    if(audioSession){release(audioSession.playback);release(audioSession.microphone);void audioSession.context.close();}
    if(screenSession)release(screenSession.stream);
    void native?.release().catch(()=>{});
  });
  return {snapshot:cb=>cb(JSON.stringify(snapshot)),changed:{connect:cb=>{notify=cb;}},
    sources,setProject:text=>{project=text;},removePdf:()=>{resume='';update({pdf:'',profileError:''});},
    pdf,listen,prepareScreen,capture,respond,stopAudio:()=>stopAudio(),stopScreen:()=>stopScreen(),stopSession:()=>stopSession(),
    setInputMode:mode=>update({inputMode:mode})};
}
