import * as FileSystem from "expo-file-system/legacy";

const SAMPLE_RATE=22_050,DURATION=1.8,cache=new Map<string,string>();
export async function tuningTone(node:number,phase:number,synchronized:boolean){
 const key=`${node}-${phase}-${synchronized?1:0}`,existing=cache.get(key);if(existing)return existing;
 if(!FileSystem.cacheDirectory)throw new Error("Audio cache unavailable");
 const root=110*Math.pow(2,(node%9)/24),ratios=[1,5/4,3/2],detunes=[[ -19,13,31],[24,-27,9],[-32,18,-12]][phase],count=Math.floor(SAMPLE_RATE*DURATION),pcm=new Int16Array(count);
 for(let i=0;i<count;i++){const time=i/SAMPLE_RATE,edge=Math.min(1,time/.035,(DURATION-time)/.035);let sample=0;for(let voice=0;voice<3;voice++){const cents=synchronized?0:detunes[voice],frequency=root*ratios[voice]*Math.pow(2,cents/1200),shimmer=Math.sin(Math.PI*2*frequency*2*time)*.035;sample+=Math.sin(Math.PI*2*frequency*time)*.19+shimmer}sample*=edge*(synchronized?.92:.72);pcm[i]=Math.round(Math.tanh(sample)*32767)}
 const bytes=wav(pcm),uri=`${FileSystem.cacheDirectory}homage-tuning-${key}.wav`;await FileSystem.writeAsStringAsync(uri,base64(bytes),{encoding:FileSystem.EncodingType.Base64});cache.set(key,uri);return uri;
}
function wav(pcm:Int16Array){const bytes=new Uint8Array(44+pcm.length*2),v=new DataView(bytes.buffer);text(bytes,0,"RIFF");v.setUint32(4,36+pcm.length*2,true);text(bytes,8,"WAVE");text(bytes,12,"fmt ");v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,SAMPLE_RATE,true);v.setUint32(28,SAMPLE_RATE*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);text(bytes,36,"data");v.setUint32(40,pcm.length*2,true);for(let i=0;i<pcm.length;i++)v.setInt16(44+i*2,pcm[i],true);return bytes}
function text(bytes:Uint8Array,at:number,value:string){for(let i=0;i<value.length;i++)bytes[at+i]=value.charCodeAt(i)}
function base64(bytes:Uint8Array){const chars="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";let out="";for(let i=0;i<bytes.length;i+=3){const a=bytes[i],b=bytes[i+1],c=bytes[i+2],n=(a<<16)|((b??0)<<8)|(c??0);out+=chars[(n>>18)&63]+chars[(n>>12)&63]+(b===undefined?"=":chars[(n>>6)&63])+(c===undefined?"=":chars[n&63])}return out}
