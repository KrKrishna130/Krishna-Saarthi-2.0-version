import React,{useState,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import './style.css';
import {browserBridge} from './browser.js';

function App(){
  const [api,connect]=useState(null),[s,state]=useState(null),[tab,page]=useState('Interview');
  const [focused,focusAnswer]=useState(false);
  const [audioConsent,allowAudio]=useState(false),[screenConsent,allowScreen]=useState(false);
  const [q,question]=useState(''),[p,project]=useState(''),[audio,device]=useState(-1),[screen,display]=useState('');
  useEffect(()=>{
    function attach(bridge){
      let previous=null;
      function sync(raw){
        const next=JSON.parse(raw);
        if(!previous || previous.question!==next.question)question(next.question);
        if(!previous || previous.device!==next.device || JSON.stringify(previous.devices)!==JSON.stringify(next.devices))device(next.device);
        if(!previous || previous.display!==next.display)display(next.display);
        previous=next;state(next);
      }
      bridge.changed.connect(sync);bridge.snapshot(sync);connect(bridge);
    }
    if(window.qt && window.QWebChannel)new QWebChannel(qt.webChannelTransport,channel=>attach(channel.objects.assistant));
    else if(location.protocol.startsWith('http'))browserBridge().then(attach).catch(error=>{document.getElementById('root').textContent=error.message;});
  },[]);
  if(!s)return <main><h1>Krishna Saarthi</h1><p>Connecting to the local application…</p></main>;
  const idle=s.phase==='idle',n=Array.from(p).length;
  const selectedScreen=s.continuous && s.displays.some(source=>source.id===screen);
  return <>
    <header><strong>Krishna Saarthi</strong><span>{s.provider==='ollama'?'Local · Gemma / Ollama':'OpenAI'}</span></header>
    <nav>{['Interview','Candidate profile'].map(t=><button key={t} aria-pressed={tab===t} onClick={()=>page(t)}>{t}</button>)}</nav>
    {s.desktop&&<aside className="sharing-status"><strong>{s.floating?'Floating above meeting':'Floating disabled'}</strong><span>{s.captureNotice}</span></aside>}
    <main>{tab==='Interview'?<>
      {s.desktop&&<button className="focus-toggle" onClick={()=>focusAnswer(!focused)}>{focused?'Show workspace':'Focus answer'}</button>}
      {!focused&&<>
        <h1>Interview workspace</h1>
        {s.continuous?<>
          <section>
            <h2>Audio permission</h2>
            <label>Capture audio from
              <select disabled={!idle||s.prepared} value={audio} onChange={e=>device(+e.target.value)}>
                {s.devices.map((name,i)=><option key={i} value={i}>{name}</option>)}
              </select>
            </label>
            <label className="consent"><input type="checkbox" checked={audioConsent} disabled={!idle||s.prepared} onChange={e=>allowAudio(e.target.checked)}/>I allow the selected audio sources until I stop audio or close this app.</label>
            <div className="actions">
              <button disabled={!idle||s.prepared||!audioConsent} onClick={()=>api.listen(audio,audioConsent)}>{s.prepared?'Audio active':'Allow audio & start'}</button>
              <button disabled={!s.prepared||!idle} onClick={()=>api.stopAudio()}>Stop audio</button>
            </div>
            <small>Audio starts independently. No screen-analysis source is required.</small>
          </section>
          <section>
            <div className="line"><h2>Screen permission</h2><button disabled={!idle||s.screenPrepared} onClick={()=>api.sources()}>Refresh screen sources</button></div>
            <label>Window or display to analyse
              <select disabled={!idle||s.screenPrepared} value={screen} onChange={e=>display(e.target.value)}>
                <option value="">Choose when screen analysis is needed</option>
                {s.displays.map(source=><option key={source.id} value={source.id}>{source.name}</option>)}
              </select>
            </label>
            <label className="consent"><input type="checkbox" checked={screenConsent} disabled={!idle||s.screenPrepared} onChange={e=>allowScreen(e.target.checked)}/>I allow this screen source until I stop screen capture or close this app.</label>
            <div className="actions">
              <button disabled={!idle||s.screenPrepared||!screenConsent||!selectedScreen} onClick={()=>api.prepareScreen(screen,screenConsent)}>{s.screenPrepared?'Screen ready':'Allow screen'}</button>
              <button disabled={!idle||!s.screenPrepared} onClick={()=>api.capture()}>Analyse my screen</button>
              <button disabled={!idle||!s.screenPrepared} onClick={()=>api.stopScreen()}>Stop screen</button>
            </div>
            <small>Screen permission can be granted later. Audio continues during screen setup and analysis.</small>
          </section>
        </>:<section>
          <label>Meeting audio input<select disabled={!idle} value={audio} onChange={e=>device(+e.target.value)}>{s.devices.map((name,i)=><option key={i} value={i}>{name}</option>)}</select></label>
          <label>Display<select value={screen} onChange={e=>display(+e.target.value)}>{s.displays.map((name,i)=><option key={i} value={i}>{name}</option>)}</select></label>
          <div className="actions">
            <button onClick={()=>api.sources()} disabled={!idle}>Refresh sources</button>
            <button onClick={()=>api.listen(audio)} disabled={!idle}>Start listening</button>
            <button onClick={()=>api.capture(screen)} disabled={!idle}>Analyse my screen</button>
          </div>
        </section>}
      </>}
      {s.continuous&&<section className="capture-status">
        <strong>Audio {s.prepared?'active':'off'} • Screen {s.screenPrepared?'active':'off'}</strong>
        <p>{s.prepared?`Recent audio buffer · ${s.audio_window_seconds} seconds. Listening continues during responses.`:'Allow audio once before the interview.'}</p>
        {s.levels.map(level=><span key={level.label}>{level.label} • {level.active?'sound detected':'quiet'} </span>)}
        <button disabled={(!s.prepared&&!s.screenPrepared)||s.phase.startsWith('opening')} onClick={()=>api.stopSession()}>Stop all capture</button>
        <label>Response uses<select disabled={!idle} value={s.inputMode} onChange={e=>api.setInputMode(e.target.value)}>
          <option value="typed">Typed / edited question</option>
          <option disabled={!s.prepared} value="audio">Recent audio</option>
          <option value="screen">Analysed screen question</option>
        </select></label>
      </section>}
      <section>
        <label>Interview question<textarea readOnly={!idle} placeholder="Type a question or capture one above" value={q} onChange={e=>{question(e.target.value);if(s.continuous)api.setInputMode('typed');}}/></label>
        <button className="primary" disabled={!idle&&s.phase!=='listening'} onClick={()=>api.respond(q)}>Response</button>
        <small role="status">{s.status}</small>
      </section>
      <section><h2>Answer</h2><pre>{s.answer || 'Your response will appear here.'}</pre></section>
      <details><summary>Window controls and screen sharing</summary><p>{s.notice}</p></details>
    </>:<>
      <h1>Candidate profile</h1>
      <section><h2>Résumé PDF</h2><p>{s.pdf || 'Choose a PDF with selectable text.'}</p><button onClick={()=>api.pdf()}>Upload résumé PDF</button> {s.pdf&&<button onClick={()=>api.removePdf()}>Remove</button>}<small>{s.profileError}</small></section>
      <section><label>Project description<textarea className="long" value={p} placeholder="Describe your role, architecture, decisions and results" onChange={e=>{project(e.target.value);api.setProject(e.target.value);}}/></label><small className={n>s.limit?'error':''}>{n.toLocaleString()} / {s.limit.toLocaleString()} characters{n>s.limit?' • Shorten this description before responding.':''}</small></section>
    </>}</main>
  </>;
}
createRoot(document.getElementById('root')).render(<App/>);
