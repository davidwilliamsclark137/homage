import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import TwoPhoneGuide from '../encounter/TwoPhoneGuide';
import SkyScan from '../encounter/SkyScan';
import { nightStyles as s } from '../encounter/styles';
import story from '../encounter/story.json';
import { createCredential, credentialKey, encounterRequest, type Credential, type Encounter } from '../encounter/client';
import { MAP_PORTALS, portalAccess } from '../portals/mapAccess';
import type { Fix } from '../portals/rooftop';
import { haversine } from '../../../lib/geo';

const COLLECTION = 'homage.night.collection.v1';
type Keepsake = { eventId:string; title:string; constellation:string; mode:string };
export default function NightEncounterScreen() {
  const params = useLocalSearchParams<{test?:string}>();
  const test = params.test === '1';
  const mode = test ? 'test' : 'field';
  const focused = useIsFocused();
  const router = useRouter();
  const [foreground,setForeground] = useState(AppState.currentState === 'active');
  const active = focused && foreground;
  const [loaded,setLoaded] = useState(false);
  const [credential,setCredential] = useState<Credential|null>(null);
  const [scan,setScan] = useState<{id:string;at:number}|null>(null);
  const [encounter,setEncounter] = useState<Encounter|null>(null);
  const [error,setError] = useState('');
  const [expired,setExpired] = useState(false);
  const [connected,setConnected] = useState(false);
  const [busy,setBusy] = useState(false);
  const [fix,setFix] = useState<Fix|null>(null);
  const [gpsError,setGpsError] = useState('');
  const [gpsAttempt,setGpsAttempt] = useState(0);
  const [now,setNow] = useState(Date.now());
  const [keepsakes,setKeepsakes] = useState<Keepsake[]>([]);
  const [saveError,setSaveError] = useState('');
  const [saveAttempt,setSaveAttempt] = useState(0);
  const serial = useRef(0), applied = useRef(0), generation = useRef(0);
  const atFinal = useRef(false);
  const currentCredential = useRef(credential); currentCredential.current = credential;
  const activeRef = useRef(active); activeRef.current = active;
  const route = story.routes[encounter?.role ?? 'amber'];
  const stop = encounter?.progress === 2 ? null : route[encounter?.progress ?? 0];
  const destination = MAP_PORTALS.find(p => p.id === (stop?.portalId ?? story.finalPortalId))!;
  const access = portalAccess(destination,fix,Platform.OS,now);
  const arrived = active && (test || (!gpsError && access.ready));
  atFinal.current = arrived && encounter?.progress === 2;

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()),500);
    const sub = AppState.addEventListener('change',state => setForeground(state === 'active'));
    return () => { clearInterval(timer);sub.remove(); };
  },[]);
  useEffect(() => {
    let live = true;
    setLoaded(false); setCredential(null); setEncounter(null); setScan(null);setExpired(false);
    void Promise.all([AsyncStorage.getItem(credentialKey(mode)),AsyncStorage.getItem(COLLECTION)]).then(([raw,collection]) => {
      if (!live) return;
      if (raw) { const c = JSON.parse(raw); if (c.mode===mode && /^[a-f0-9]{48}$/.test(c.key)) setCredential(c); }
      if (collection) {const values=JSON.parse(collection); if(Array.isArray(values)) setKeepsakes(values);}
    }).catch(() => {if(live)setError('Saved state could not be read. Please reopen the encounter.');}).finally(() => {if(live)setLoaded(true);});
    return () => {live=false;};
  },[mode]);
  useEffect(() => {
    if (test || !credential || !active) return;
    let stopped=false; let watcher:Location.LocationSubscription|undefined;
    setFix(null);setGpsError('');
    void (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (stopped)return;
      if (!permission.granted) throw Error('Allow location access to discover the outdoor portals.');
      watcher=await Location.watchPositionAsync({accuracy:Location.Accuracy.Highest,timeInterval:2000,distanceInterval:0},p=>{if(!stopped){setFix({...p.coords,timestamp:p.timestamp});setGpsError('');}},()=>{if(!stopped)setGpsError('GPS unavailable. Arrival checks are paused.');});
      if(stopped)watcher.remove();
    })().catch(e=>{if(!stopped)setGpsError(e.message);});
    return ()=>{stopped=true;watcher?.remove();};
  },[test,credential,active,gpsAttempt]);

  const accept = useCallback((value:Encounter, sequence:number) => {
    if (sequence < applied.current) return;
    applied.current=sequence;setEncounter(value);setError('');setConnected(true);
  },[]);
  useEffect(() => {
    const gen=++generation.current;
    if(!credential || !active || expired)return;
    let stopped=false; let timer:ReturnType<typeof setTimeout>|undefined;
    let initialized=false;
    async function poll() {
      const seq=++serial.current;
      try {
        const value=await encounterRequest(credential!,initialized?'pulse':'join',{atFinal:atFinal.current});initialized=true;
        if(!stopped && gen===generation.current)accept(value,seq);
      }catch(e){if(!stopped){setConnected(false);setError(e instanceof Error?e.message:'Connection interrupted. Your progress is retained.');if((e as {status?:number}).status===410 || (e as {status?:number}).status===400)setExpired(true);}}
      if(!stopped)timer=setTimeout(()=>void poll(),2500);
    }
    void poll();
    return ()=>{stopped=true;clearTimeout(timer);setConnected(false);void encounterRequest(credential,'pause').catch(()=>{});};
  },[credential,active,expired,accept]);
  async function action(name:string,values:Record<string,unknown>={}) {
    if(!credential || busy)return;
    setBusy(true); const seq=++serial.current;
    try {const next=await encounterRequest(credential,name,values);if(currentCredential.current?.key===credential.key)accept(next,seq);}
    catch(e){setError(e instanceof Error?e.message:'Connection interrupted. Try again.');}
    finally{setBusy(false);}
  }
  async function join() {
    if(!scan || busy)return;
    setBusy(true);setError('');
    try {const c=await createCredential(mode,scan.id,scan.at);setExpired(false);setCredential(c);setScan(null);}
    catch{setError('Could not save this encounter on your phone. Please try again.');}
    finally{setBusy(false);}
  }
  async function reset() {
    if(busy)return;setBusy(true);
    try {
      if(credential && !expired && encounter?.phase!=='complete' && encounter?.phase!=='left') await encounterRequest(credential,'leave');
      await AsyncStorage.removeItem(credentialKey(mode));
      generation.current++;setCredential(null);setEncounter(null);setScan(null);setExpired(false);setError('');setConnected(false);
    }catch{setError('Could not leave yet. Reconnect and try again.');}
    finally{setBusy(false);}
  }
  const onScan = useCallback((id:string)=>setScan({id,at:Date.now()}),[]);
  useEffect(()=>{if(scan && now-scan.at>60000){setScan(null);setError("Your scan expired. Find the constellation again to connect.");}},[scan,now]);
  useEffect(() => {
    if(encounter?.phase!=='complete' || keepsakes.some(k=>k.eventId===encounter.eventId))return;
    let live=true;
    const next=[...keepsakes,{eventId:encounter.eventId,title:encounter.ending==='shared'?story.sharedKeepsake:story.soloKeepsake,constellation:encounter.constellation,mode}];
    void AsyncStorage.setItem(COLLECTION,JSON.stringify(next)).then(()=>{if(live){setKeepsakes(next);setSaveError('');}}).catch(()=>{if(live)setSaveError('The ending is complete, but the keepsake could not be saved.');});
    return()=>{live=false;};
  },[encounter,keepsakes,mode,saveAttempt]);
  const complete=encounter?.phase==='complete';
  const tint=encounter?.role==='teal'?'#7fe6d5':'#ffc174';
  function button(label:string,onPress:()=>void,disabled=false){return <Pressable accessibilityRole="button" disabled={disabled} style={[s.button,disabled&&s.disabled]} onPress={onPress}><Text style={s.buttonText}>{label}</Text></Pressable>;}
  return <SafeAreaView style={s.safe} edges={['bottom']}><ScrollView contentContainerStyle={s.content}>
    <Text style={s.eyebrow}>{test?'TEST THE NIGHT · SIMULATED SKY & ARRIVALS':'TWO HALVES OF THE NIGHT'}</Text>
    <TwoPhoneGuide compact />
    {!loaded ? <Text style={s.copy}>Restoring your journey…</Text> : !credential ? scan ? <View style={s.card}>
      <Text style={s.title}>{scan.id.replace('-',' ')} found</Text><Text style={s.copy}>Let this fragment connect you with one other person who finds the same pattern. You’ll follow different portal routes and can choose to meet at the end.</Text>
      {button('Let my signal answer someone',()=>void join(),busy)}
      {button('Scan again',()=>setScan(null),busy)}
    </View> : <SkyScan key={mode} test={test} active={active} onScan={onScan}/> : <>
      {!encounter && <Text style={s.copy}>Connecting your constellation…</Text>}
      {encounter && <View style={s.card}>
        <Text style={s.eyebrow}>{encounter.constellation.toUpperCase()} · {encounter.role.toUpperCase()} FRAGMENT</Text>
        <View style={{alignItems:'center'}}><Svg width={210} height={210} viewBox="0 0 260 260" accessibilityLabel={complete?'Your completed night keepsake':'Your constellation fragment'}>
          <Circle cx="130" cy="130" r="105" fill="none" stroke="#3c5955"/>
          {complete ? [0,30,60,90,120,150].map((a,i)=><Ellipse key={a} cx="130" cy="130" rx="38" ry="94" transform={`rotate(${a} 130 130)`} stroke={encounter.ending==='shared' && i%2?'#7fe6d5':tint} fill="none" strokeWidth="2"/>) : <>
            <Path d="M130 42 A88 88 0 0 1 130 218 Q205 130 130 42" stroke={tint} fill="none" strokeWidth="3"/>
            {encounter.peerProgress>0 && <Path d="M130 42 A88 88 0 0 0 130 218" stroke={encounter.role==='teal'?'#ffc174':'#7fe6d5'} fill="none" strokeWidth="3"/>}
          </>}
          <Circle cx="130" cy="130" r={5+encounter.progress*3} fill="#f5f2da"/>
        </Svg></View>
        <Text style={s.title}>{complete ? encounter.ending==='shared'?story.sharedKeepsake:story.soloKeepsake : encounter.phase==='waiting'?'Your fragment is listening':encounter.phase==='solo'?'A path of your own':'One sky. Two paths.'}</Text>
        <Text style={s.copy}>{complete?'Your journey is complete. This moment belongs to you.':encounter.phase==='waiting'?'Waiting for one other phone to scan this same constellation and opt in. Matching stays open for 15 minutes.':encounter.phase==='solo'?'Your discoveries form a complete ending of their own.':encounter.peerLeft?'The other person has continued separately. You can finish your own path.':encounter.peerOnline?'Your companion’s signal is connected.':'Your companion’s signal is paused. Their progress is safe.'}</Text>
        {encounter.phase!=='waiting' && !complete && <Text style={s.small}>Your discoveries {encounter.progress}/2 · Their discoveries {encounter.peerProgress}/2</Text>}
        {encounter.peerProgress>0 && !complete && <Text style={s.notice}>A light arrived from the other path. Your fragment now carries both colors.</Text>}
      </View>}
      {encounter && !complete && !expired && encounter.phase!=='left' && encounter.phase!=='waiting' && <View style={s.card}>
        <Text style={s.eyebrow}>{stop?'YOUR NEXT PORTAL':'THE FINAL PORTAL'}</Text>
        <Text style={s.title}>{stop && !encounter.canCollect ? "A clue is taking shape" : stop?stop.clue:story.finalClue}</Text>
        {(!stop || encounter.canCollect) && <Text style={s.copy}>{destination.place} · {destination.address}</Text>}
        {(!stop || encounter.canCollect) && <Text style={s.small}>{test?'Test arrival bypasses GPS.':gpsError || (fix?Math.round(haversine(fix,destination))+' m away · '+access.message:access.message)}</Text>}
        {!test && (!stop || encounter.canCollect) && <>
          <Pressable accessibilityRole="button" onPress={()=>void Linking.openURL('https://www.google.com/maps/dir/?api=1&destination='+destination.latitude+','+destination.longitude+'&travelmode=walking')}><Text style={s.link}>Walking directions</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={()=>router.push({pathname:'/rooftop-portal',params:{portal:destination.id}})}><Text style={s.link}>Open portal map</Text></Pressable>
          <Text style={s.small}>Outdoor, model-based portal positions. Use public pedestrian paths; no purchase or building entry required. The exact meeting spot still needs an on-site check.</Text>
        </>}
        {stop ? <>
          {button(test?'Simulate arrival · '+stop.action:stop.action,()=>void action('collect',{step:encounter.progress,portalId:stop.portalId,arrived:true}),busy||!connected||!arrived||!encounter.canCollect)}
          {!encounter.canCollect && <Text style={s.notice}>Your first light is helping their path. This second discovery opens when they collect their first light.</Text>}
        </> : <>
          <Text style={s.copy}>{encounter.phase==='solo'?'Your final light can open here.':encounter.peerAtFinal?'The other fragment is here. You can both choose to share this moment.':'Follow the clue to the same gathering point. No profile or live location is shown.'}</Text>
          {button(encounter.consent?'Waiting for the other fragment…':encounter.phase==='solo'?'Complete my solo ending':test?'Simulate final arrival · share this moment':'Share this moment',()=>void action('consent',{atFinal:true}),busy||!connected||!arrived||encounter.consent)}
        </>}
        {!!gpsError && button('Retry location',()=>setGpsAttempt(n=>n+1))}
      </View>}
      {encounter && encounter.progress>0 && !complete && <View style={s.card}><Text style={s.eyebrow}>YOUR LAST DISCOVERY</Text><Text style={s.copy}>{encounter.phase==='solo' ? encounter.progress===1 ? 'A feather of light. The first piece of a pattern you can carry onward.' : 'Your two lights form an arch. Bring them to the final portal to complete your own pattern.' : route[encounter.progress-1].discovery}</Text></View>}
      {encounter && !complete && encounter.phase!=='solo' && encounter.phase!=='left' && !expired && (encounter.canSolo ? button('Continue my path solo',()=>void action('solo'),busy||!connected) : <Text style={s.small}>If you wait two minutes for a partner or a clue, a solo path opens.</Text>)}
      {button(complete?'Begin another night':expired?'Start a new scan':'Leave this encounter',()=>void reset(),busy)}
    </>}
    {!!error && <Text style={s.error} accessibilityRole="alert">{error}</Text>}
    {!!saveError && <>{<Text style={s.error}>{saveError}</Text>}{button('Retry saving keepsake',()=>setSaveAttempt(n=>n+1))}</>}
    {keepsakes.length>0 && <View style={s.card}><Text style={s.eyebrow}>YOUR NIGHT COLLECTION</Text>{keepsakes.slice(-5).reverse().map(k=><Text key={k.eventId} style={s.copy}>✧ {k.title} · {k.constellation}{k.mode==='test'?' · test':''}</Text>)}</View>}
    <Text style={s.small}>Prototype · Keep this computer’s Expo server running. No camera images or GPS coordinates are uploaded. Encounter progress can resume for two hours; keepsakes stay on this phone.</Text>
  </ScrollView></SafeAreaView>;
}
