(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.HanziSpeechGate=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 class SpeechGate{
  constructor(options={}){
   this.minimumEnergy=options.minimumEnergy??0.004;
   this.minimumVoiceMs=options.minimumVoiceMs??120;
   this.finishQuietMs=options.finishQuietMs??2100;
   this.noiseFloor=0.0008;this.voicedMs=0;this.heardSpeech=false;
   this.lastVoiceAt=null;this.lastHypothesisAt=null;this.text='';this.finalText='';this.committed=[];this.level=0;
  }
  feed(samples,sampleRate,now){
   let sum=0;for(let i=0;i<samples.length;i++)sum+=samples[i]*samples[i];
   const rms=Math.sqrt(sum/Math.max(1,samples.length));
   const threshold=Math.max(this.minimumEnergy,this.noiseFloor*2.8);
   const voiced=rms>=threshold;
   this.level=Math.min(1,rms*12);
   if(voiced){
    let activeSamples=0;for(let i=0;i<samples.length;i++)if(Math.abs(samples[i])>=threshold)activeSamples++;
    this.voicedMs+=activeSamples/sampleRate*1000;this.lastVoiceAt=now;
    if(this.voicedMs>=this.minimumVoiceMs)this.heardSpeech=true;
   }else if(rms<this.minimumEnergy){
    this.noiseFloor=this.noiseFloor*.97+rms*.03;
    if(!this.heardSpeech&&this.lastVoiceAt!==null&&now-this.lastVoiceAt>500)this.voicedMs=0;
   }
   return {voiced,heardSpeech:this.heardSpeech,level:this.level,rms};
  }
  hypothesis(text,now,final=false,confidence=null){
   text=String(text||'').replace(/\s+/g,'');
   if(!this.heardSpeech||!text)return false;
   if(final&&confidence!==null&&confidence<.4){this.text=this.committed.join('');this.lastHypothesisAt=now;return false;}
   if(final){this.committed.push(text);this.finalText=this.committed.join('');text=this.finalText;}
   else text=this.committed.join('')+text;
   if(text!==this.text){this.text=text;this.lastHypothesisAt=now;}
   return true;
  }
  shouldFinish(now){
   return this.heardSpeech&&!!this.text&&this.lastVoiceAt!==null&&this.lastHypothesisAt!==null&&now-this.lastVoiceAt>=this.finishQuietMs&&now-this.lastHypothesisAt>=500;
  }
  result(){return this.text||this.finalText;}
 }
 return SpeechGate;
});

