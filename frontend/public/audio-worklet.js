class CapturePCM extends AudioWorkletProcessor {
  constructor() {
    super();
    this.data = new Float32Array(2048);
    this.offset = 0;
  }
  process(inputs) {
    const channels=inputs[0];
    if(!channels || !channels.length)return true;
    for(let i=0;i<channels[0].length;i++){
      let value=0;
      for(const channel of channels)value+=channel[i];
      this.data[this.offset++]=value/channels.length;
      if(this.offset===this.data.length){
        this.port.postMessage(this.data,[this.data.buffer]);
        this.data=new Float32Array(2048);this.offset=0;
      }
    }
    // The output stays silent. Audio capture is never played back to the speakers.
    return true;
  }
}
registerProcessor('capture-pcm',CapturePCM);
