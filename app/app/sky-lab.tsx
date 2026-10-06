import { useEffect, useState } from 'react';
import { AppState, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SkyScanner from '../sky/SkyScanner';
import { CONSTELLATIONS } from '../sky/engine';
import { skyStyles as s } from '../sky/styles';

export default function SkyLab() {
  const focused = useIsFocused();
  const [foreground,setForeground] = useState(AppState.currentState === 'active');
  const [attempt,setAttempt] = useState(0);
  const [result,setResult] = useState<{id:string;report:string} | null>(null);
  const [shareError,setShareError] = useState('');
  useEffect(()=>{const listener=AppState.addEventListener('change',state=>setForeground(state==='active'));return()=>listener.remove();},[]);
  const reset=()=>{setResult(null);setShareError('');setAttempt(n=>n+1);};
  return <SafeAreaView edges={['bottom']} style={s.safe}><ScrollView contentContainerStyle={s.content}>
    <Text style={s.eyebrow}>SKY ENGINE · PROVING GROUND</Text>
    <Text style={s.title}>One star. One reliable scan.</Text>
    <Text style={s.copy}>Test the aiming mechanics on each phone before trying the two-person event. This screen does not pair phones or start a portal route.</Text>
    <View style={s.card}>
      <Text style={s.copy}>1. Stand still outside with a clear sky. Hold the phone upright in portrait.</Text>
      <Text style={s.copy}>2. Start the camera and choose the same star on both phones. Test them separately, away from metal.</Text>
      <Text style={s.copy}>3. Move slowly toward the displayed direction. Bring the star marker to the crosshair and watch the hold timer.</Text>
      <Text style={s.small}>This measures camera direction using sensors. It does not identify stars in a photograph. Confirm the marker against the actual star; a successful hold alone does not prove calibration.</Text>
    </View>
    {result ? <View style={s.card}>
      <Text accessibilityRole="header" style={s.title}>Direction acquired</Text>
      <Text style={s.copy}>{CONSTELLATIONS.find(c=>c.id===result.id)?.name ?? result.id} · 3 seconds of valid alignment.</Text>
      <Text selectable style={s.small}>{result.report}</Text>
      <Pressable accessibilityRole="button" style={s.button} onPress={reset}><Text style={s.buttonText}>Try another scan</Text></Pressable>
      <Pressable accessibilityRole="button" style={s.choice} onPress={()=>{void Share.share({message:result.report}).catch(()=>setShareError('Could not open sharing. You can select and copy the report above.'));}}><Text style={s.copy}>Share test result</Text></Pressable>
      {!!shareError && <Text style={s.error}>{shareError}</Text>}
    </View> : <SkyScanner key={attempt} active={focused && foreground} laboratory onScan={(id,report)=>setResult({id,report:report ?? 'Capture complete.'})} />}
    <View style={s.card}><Text style={s.eyebrow}>WHAT TO CHECK</Text>
      <Text style={s.copy}>Turning right should increase the heading, wrapping from 359° to 0°. Tilting the rear camera upward should increase “degrees up.”</Text>
      <Text style={s.copy}>A small wobble should pause briefly. Looking away should reset the hold. Backgrounding the app should stop the sensors and require a restart.</Text>
      <Text style={s.small}>If acquisition fails, take a screenshot of the status and live diagnostics. After success, repeat three times on each phone and note whether the marker matched the real star.</Text>
    </View>
  </ScrollView></SafeAreaView>;
}
