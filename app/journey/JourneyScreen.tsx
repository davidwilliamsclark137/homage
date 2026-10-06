import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import DowntownMap from './Map';
import { activate, Arrival, emptyProgress, Fix, locationIssue, nearby, PORTALS, Progress, restoreProgress, STORAGE_KEY, updateArrival } from './engine';

export default function JourneyScreen() {
  const [progress,setProgress]=useState<Progress>(emptyProgress);
  const [loaded,setLoaded]=useState(false), [storageError,setStorageError]=useState('');
  const [enabled,setEnabled]=useState(false), [active,setActive]=useState(AppState.currentState==='active');
  const [fix,setFix]=useState<Fix|null>(null), [gpsError,setGpsError]=useState('');
  const [permissionBusy,setPermissionBusy]=useState(false), [saving,setSaving]=useState(false);
  const [now,setNow]=useState(Date.now()), [arrival,setArrival]=useState<Arrival>(null);
  const [diagnostics,setDiagnostics]=useState(false), [resetConfirm,setResetConfirm]=useState(false);
  const [watchVersion,setWatchVersion]=useState(0);
  const busy=useRef(false), arrivalRef=useRef<Arrival>(null), activeRef=useRef(active);
  const index=progress.completed.length, portal=PORTALS[index];
  async function load() {
    try { const saved=restoreProgress(await AsyncStorage.getItem(STORAGE_KEY)); setProgress(saved);setLoaded(true);setStorageError(''); }
    catch { setStorageError('Your saved journey could not be loaded. Retry before continuing.'); }
  }
  useEffect(()=>{void load();},[]);
  useEffect(()=>{
    const listener=AppState.addEventListener('change',state=>{const foreground=state==='active';activeRef.current=foreground;setActive(foreground);setFix(null);arrivalRef.current=null;setArrival(null);});
    return ()=>listener.remove();
  },[]);
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),500);return ()=>clearInterval(timer);},[]);
  useEffect(()=>{
    if(!enabled||!active||!loaded||index===PORTALS.length)return;
    let disposed=false;let subscription:Location.LocationSubscription|undefined;
    (async()=>{
      const permission=await Location.getForegroundPermissionsAsync();
      if(disposed)return;
      if(!permission.granted){setEnabled(false);setGpsError('Allow precise location while using Homage, then try again.');return;}
      if(!await Location.hasServicesEnabledAsync())throw Error('Turn on your phone’s location services, then retry.');
      if(disposed)return;
      const watcher=await Location.watchPositionAsync({accuracy:Location.Accuracy.High,timeInterval:1000,distanceInterval:0},position=>{
        if(disposed)return;
        setGpsError('');setFix({latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy:position.coords.accuracy??Infinity,timestamp:position.timestamp});
      },message=>{if(!disposed){setFix(null);setGpsError('Location stopped. Retry location. '+message);}});
      if(disposed)watcher.remove();else subscription=watcher;
    })().catch(error=>{if(!disposed){setFix(null);setGpsError(error instanceof Error?error.message:'Location is unavailable. Retry location.');}});
    return ()=>{disposed=true;subscription?.remove();};
  },[enabled,active,loaded,index,watchVersion]);
  useEffect(()=>{
    arrivalRef.current=active?updateArrival(arrivalRef.current,fix,index,now):null;
    setArrival(arrivalRef.current);
  },[fix,index,now,active]);
  async function enableLocation() {
    if(permissionBusy)return;setPermissionBusy(true);
    try {
      const permission=await Location.requestForegroundPermissionsAsync();
      if(!permission.granted){setEnabled(false);setGpsError('Location permission is needed to find portals. Allow precise location in Settings.');return;}
      setGpsError('');setEnabled(true);setWatchVersion(v=>v+1);
    }catch{setGpsError('Could not start location. Check Settings and retry.');}
    finally{setPermissionBusy(false);}
  }
  async function activatePortal() {
    if(busy.current||!loaded||!activeRef.current||!portal)return;
    const next=activate(progress,portal.id,fix,arrivalRef.current,Date.now());
    if(next===progress)return;
    busy.current=true;setSaving(true);
    try {await AsyncStorage.setItem(STORAGE_KEY,JSON.stringify(next));setProgress(next);arrivalRef.current=null;setArrival(null);setStorageError('');}
    catch{setStorageError('Could not save this activation. Your progress has not advanced; please try again.');}
    finally{busy.current=false;setSaving(false);}
  }
  async function reset() {
    if(busy.current)return;busy.current=true;setSaving(true);
    try{await AsyncStorage.removeItem(STORAGE_KEY);setProgress(emptyProgress());setLoaded(true);setStorageError('');arrivalRef.current=null;setArrival(null);setResetConfirm(false);setDiagnostics(false);}
    catch{setStorageError('Could not reset the journey. Please retry.');}
    finally{busy.current=false;setSaving(false);}
  }
  const issue=locationIssue(fix,now);
  const revealed=active&&nearby(fix,index,now);
  const ready=active&&revealed&&!!arrival?.ready;
  const status=gpsError||(!enabled?'Enable location when you are ready to explore.':issue||(revealed?(ready?'You found it. Activate your portal.':'You are close. Pause for a few seconds while GPS settles.'):'Follow the clue on foot. Your portal activates within 25 m.'));
  return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.page}>
    <View style={s.header}><Text style={s.brand}>HOMAGE</Text><Pressable accessibilityRole="button" onPress={()=>setDiagnostics(true)}><Text style={s.link}>Field notes</Text></Pressable></View>
    <Text style={s.eyebrow}>DOWNTOWN McKINNEY · FIRST WALK</Text>
    <Text style={s.title}>{index===3?'A small journey, yours.':'There is more to the square.'}</Text>
    <Text style={s.body}>Three places. A little curiosity. One thing to carry home.</Text>
    {storageError!==''&&<View accessibilityLiveRegion="polite" style={s.card}><Text style={s.error}>{storageError}</Text>{!loaded&&<Button label="Retry saved journey" onPress={()=>void load()}/>}</View>}
    {!loaded?<ActivityIndicator accessibilityLabel="Loading saved journey" color="#205a40"/>:<>
      <View style={s.progress}>{PORTALS.map((p,i)=><View key={p.id} style={[s.step,i<index&&s.stepDone]}><Text style={[s.stepText,i<index&&s.doneText]}>{i<index?'✓':i+1}</Text></View>)}<Text style={s.small}>{index} of 3 discovered</Text></View>
      <DowntownMap fix={active&&!issue?fix:null} index={index} revealed={revealed}/>
      {portal?<View style={s.card}>
        <Text style={s.eyebrow}>PORTAL {index+1} OF 3 {portal.hidden?'· HIDDEN NEARBY':''}</Text>
        <Text style={s.heading}>{portal.title}</Text><Text style={s.body}>{portal.clue}</Text>
        {portal.hidden&&<Text style={s.small}>{revealed?'A hidden portal has appeared.':'Its marker stays hidden until you are nearby, and disappears when you leave.'}</Text>}
        <Text accessibilityLiveRegion="polite" style={[s.status,ready&&s.ready]}>{status}</Text>
        {!enabled||gpsError?<><Button label={permissionBusy?'Starting location…':enabled?'Retry location':'Enable location'} disabled={permissionBusy} onPress={()=>void enableLocation()}/>{gpsError!==''&&<Pressable onPress={()=>void Linking.openSettings().catch(()=>setGpsError('Open your phone Settings and allow location for Expo Go.'))}><Text style={s.link}>Open phone settings</Text></Pressable>}</>:<Button label={saving?'Saving…':ready?'Activate portal':'Walk to the portal'} disabled={!ready||saving} onPress={()=>void activatePortal()}/>}
      </View>:<View style={s.card}>
        <Text style={s.eyebrow}>YOUR KEEPSAKE</Text><Text style={s.heading}>A moment around the square</Text>
        <Text style={s.body}>You followed a beginning, found a little wonder, and brought it with you. These three places are now part of your story.</Text>
        <Text style={s.small}>Completed {progress.completedAt?new Date(progress.completedAt).toLocaleDateString():''} · Saved on this phone</Text>
      </View>}
      <Text style={s.footer}>Stay on public sidewalks and use marked crossings. No entry or purchase is needed. Portal positions are provisional for this field test.</Text>
      <Text style={s.footer}>Progress stays on this phone. No account, camera, or motion access is needed.</Text>
    </>}
  </ScrollView>
  <Modal visible={diagnostics} animationType="slide" onRequestClose={()=>setDiagnostics(false)}><SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.page}>
    <Text style={s.title}>Field notes</Text><Text style={s.body}>First test: begin at the north side of MPAC. Complete the three portals in order. Check that the hidden marker disappears when you walk away, and that reopening Homage restores progress.</Text>
    <Text style={s.body}>GPS accuracy: {fix&&Number.isFinite(fix.accuracy)?Math.round(fix.accuracy)+' m':'waiting'}{ '\n'}Reading age: {fix?Math.max(0,Math.round((now-fix.timestamp)/1000))+' seconds':'waiting'}{ '\n'}Arrival: {ready?'ready':arrival?'settling':'outside range'}{ '\n'}Portal coordinates: model estimates, not surveyed entrances.</Text>
    <Text style={s.body}>Two-phone play is planned after this walking loop is proven. This version runs independently on each phone.</Text>
    <Button label="Back to the walk" onPress={()=>setDiagnostics(false)}/>
    {!resetConfirm?<Pressable onPress={()=>setResetConfirm(true)}><Text style={s.link}>Reset this test journey…</Text></Pressable>:<View style={s.card}><Text style={s.body}>Erase this journey and its keepsake on this phone? Other Homage experiments’ saved data will be kept.</Text><Button label="Erase this journey" disabled={saving} onPress={()=>void reset()}/><Pressable onPress={()=>setResetConfirm(false)}><Text style={s.link}>Cancel</Text></Pressable></View>}
  </ScrollView></SafeAreaView></Modal></SafeAreaView>;
}
function Button({label,onPress,disabled=false}:{label:string;onPress:()=>void;disabled?:boolean}){return <Pressable accessibilityRole="button" accessibilityState={{disabled}} onPress={onPress} disabled={disabled} style={[s.button,disabled&&s.disabled]}><Text style={s.buttonText}>{label}</Text></Pressable>;}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:'#f7f4ea'},page:{padding:22,gap:18,paddingBottom:42,maxWidth:620,width:'100%',alignSelf:'center'},header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},brand:{color:'#205a40',fontWeight:'900',letterSpacing:4,fontSize:20},eyebrow:{fontSize:11,letterSpacing:1.6,color:'#56705d',fontWeight:'700'},title:{fontSize:35,lineHeight:40,fontWeight:'800',color:'#172c20'},heading:{fontSize:24,fontWeight:'700',color:'#172c20'},body:{fontSize:16,lineHeight:25,color:'#3e5545'},small:{fontSize:13,lineHeight:20,color:'#526859'},card:{backgroundColor:'#fffdf8',borderRadius:22,padding:22,gap:16},progress:{flexDirection:'row',gap:10,alignItems:'center'},step:{width:32,height:32,borderRadius:16,backgroundColor:'#e1e7dc',alignItems:'center',justifyContent:'center'},stepDone:{backgroundColor:'#205a40'},stepText:{color:'#205a40',fontWeight:'700'},doneText:{color:'white'},status:{fontSize:14,lineHeight:22,color:'#71582b'},ready:{color:'#205a40'},button:{backgroundColor:'#205a40',borderRadius:14,padding:18,alignItems:'center'},disabled:{backgroundColor:'#87978a'},buttonText:{color:'white',fontSize:16,fontWeight:'700'},link:{color:'#205a40',fontSize:14,paddingVertical:10,textDecorationLine:'underline'},error:{color:'#973e30',lineHeight:22},footer:{fontSize:12,lineHeight:19,color:'#647568'}});
