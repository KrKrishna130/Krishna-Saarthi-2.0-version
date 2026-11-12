export class AudioBufferWindow {
  constructor(sampleRate,seconds) {
    this.sampleRate=sampleRate;
    this.capacity=Math.floor(sampleRate*seconds);
    this.samples=new Float32Array(this.capacity);
    this.total=0;
  }
  push(block) {
    for(let i=0;i<block.length;i++)this.samples[(this.total+i)%this.capacity]=block[i];
    this.total+=block.length;
  }
  wav(from=0) {
    const start=Math.max(from,this.total-this.capacity,0), length=this.total-start;
    let peak=0;
    const data=new ArrayBuffer(44+length*2),view=new DataView(data);
    const text=(offset,value)=>{for(let i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i));};
    text(0,'RIFF');view.setUint32(4,36+length*2,true);text(8,'WAVE');text(12,'fmt ');
    view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);
    view.setUint32(24,this.sampleRate,true);view.setUint32(28,this.sampleRate*2,true);
    view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,length*2,true);
    for(let i=0;i<length;i++){
      const value=Math.max(-1,Math.min(1,this.samples[(start+i)%this.capacity]));
      peak=Math.max(peak,Math.abs(value));
      view.setInt16(44+i*2,value<0?value*32768:value*32767,true);
    }
    return {blob:new Blob([data],{type:'audio/wav'}),end:this.total,speech:peak>=0.001 && length>=this.sampleRate/10};
  }
}
