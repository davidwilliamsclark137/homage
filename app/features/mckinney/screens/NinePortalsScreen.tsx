import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, G, Line, Polygon } from "react-native-svg";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Location from "expo-location";
import { NINE_BUILDINGS } from "../simulations/catalog";
import { nearestPortal, PORTAL_RADIUS_METERS } from "../portals/locations";

const C = { bg: "#090D12", card: "#111820", ink: "#F3F1E8", muted: "#93A29A", line: "#26333A", green: "#69E4A6" };
const ACCENTS = ["#78E6B0", "#8DBBFF", "#F4B860", "#C994FF", "#55D6D1", "#FF7D8B", "#FFD166", "#7EE8FA", "#B8F26D"];

export default function NinePortalsScreen() {
  const router = useRouter();
  const params=useLocalSearchParams<{simulation?:string}>();
  const simulation=params.simulation==="1";
  const [selected, setSelected] = useState(4);
  const [nearest,setNearest]=useState<{index:number;distance:number}|null>(null);
  const [locationStatus,setLocationStatus]=useState(simulation?"Simulation access: all portals available.":"Checking your position…");
  useEffect(()=>{if(simulation)return;void (async()=>{const permission=await Location.requestForegroundPermissionsAsync();if(!permission.granted){setLocationStatus("Location permission is required to open a field portal.");return}const position=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced});const found=nearestPortal(position.coords);setNearest(found);setSelected(found.index);setLocationStatus(found.distance<=PORTAL_RADIUS_METERS?`Portal ${found.index+1} is within range.`:`Nearest portal: ${Math.round(found.distance)} m away.`)})().catch(()=>setLocationStatus("Your position could not be read. Try again outdoors."))},[simulation]);
  const canEnter=simulation||(nearest?.index===selected&&(nearest?.distance??Infinity)<=PORTAL_RADIUS_METERS);
  return <SafeAreaView style={s.safe} edges={["bottom"]}>
    <ScrollView contentContainerStyle={s.content}>
      <Text style={s.eye}>{simulation?"SIMULATION LAB · REMOTE ACCESS":"DOWNTOWN MCKINNEY · FIELD PORTALS"}</Text>
      <Text style={s.title}>Nine portals</Text>
      <Text style={s.intro}>Each block holds its own signal. Tap one of the nine areas to bring its portal into focus.</Text>

      <View style={s.portalStage}>
        <FractalPortal seed={selected} color={ACCENTS[selected]} size={250} />
        <Text style={s.portalNumber}>PORTAL {selected + 1}</Text>
        <Text style={s.portalName}>{NINE_BUILDINGS[selected]}</Text>
        <View style={s.status}><View style={[s.statusDot,{backgroundColor:canEnter?ACCENTS[selected]:C.muted}]}/><Text style={s.statusText}>{canEnter?"SIGNAL AVAILABLE":"FIELD SIGNAL LOCKED"}</Text></View>
        <Pressable disabled={!canEnter} onPress={()=>router.push({pathname:"/portal/[id]",params:{id:String(selected),simulation:simulation?"1":"0"}})} style={[s.enter,{borderColor:canEnter?ACCENTS[selected]:C.line,opacity:canEnter?1:.45}]}><Text style={s.enterText}>{canEnter?"Enter this portal":"Travel to this block to enter"}</Text></Pressable>
        <Text style={s.location}>{locationStatus}</Text>
      </View>

      <Pressable onPress={() => router.push("/rooftop-portal")} style={s.enter}><Text style={s.enterText}>Try a top-deck portal · Chestnut Commons</Text></Pressable>
      <Text style={s.choose}>CHOOSE AN AREA</Text>
      <View style={s.grid}>
        {NINE_BUILDINGS.map((name, index) => <Pressable accessibilityRole="button" accessibilityLabel={`Select portal at ${name}`} key={name} onPress={() => setSelected(index)} style={[s.cell, selected === index && { borderColor: ACCENTS[index], backgroundColor: "#172229" }]}>
          <View style={s.mini}><FractalPortal seed={index} color={ACCENTS[index]} size={62} /></View>
          <Text style={[s.cellNumber,{color:ACCENTS[index]}]}>{index + 1}</Text>
          <Text numberOfLines={2} style={s.cellName}>{name}</Text>
        </Pressable>)}
      </View>
      <Text style={s.note}>Choose a block, then enter its full-screen fractal simulation. Tap or drag inside a portal to disturb its signal.</Text>
    </ScrollView>
  </SafeAreaView>;
}

function FractalPortal({ seed, color, size }: { seed: number; color: string; size: number }) {
  const turn = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    turn.setValue(0); breathe.setValue(0);
    const spin = Animated.loop(Animated.timing(turn, { toValue: 1, duration: 10000 + seed * 520, easing: Easing.linear, useNativeDriver: true }));
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1, duration: 1700 + seed * 70, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breathe, { toValue: 0, duration: 1700 + seed * 70, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    spin.start(); pulse.start(); return () => { spin.stop(); pulse.stop(); };
  }, [breathe, seed, turn]);
  const rotation = turn.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const counterRotation = turn.interpolate({ inputRange: [0, 1], outputRange: ["360deg", "0deg"] });
  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.04] });
  const geometry = useMemo(() => makeGeometry(seed), [seed]);
  return <View style={{height:size,width:size,alignItems:"center",justifyContent:"center"}}>
    <View style={[StyleSheet.absoluteFill,s.glow,{borderRadius:size/2,shadowColor:color}]} />
    <Animated.View style={{height:size,width:size,transform:[{rotate:rotation},{scale}]}}>
      <Svg height={size} width={size} viewBox="0 0 100 100">
        <Circle cx="50" cy="50" r="45" fill="none" stroke={color} strokeOpacity=".22" strokeWidth=".7" />
        <Circle cx="50" cy="50" r="38" fill="none" stroke={color} strokeOpacity=".48" strokeWidth=".8" strokeDasharray={`${3 + seed % 4} 3`} />
        <Polygon points="50,8 92,50 50,92 8,50" fill="none" stroke={color} strokeOpacity=".5" strokeWidth=".8" />
        <G>{geometry.map((p,i)=><Line key={i} x1="50" y1="50" x2={p.x} y2={p.y} stroke={color} strokeOpacity={.18 + (i%3)*.1} strokeWidth=".55" />)}</G>
      </Svg>
    </Animated.View>
    <Animated.View style={[s.inner,{height:size*.58,width:size*.58,borderRadius:size*.29,borderColor:color,transform:[{rotate:counterRotation}]}]}>
      {[0,1,2,3].map(i=><View key={i} style={[s.branch,{backgroundColor:color,height:size*.19,width:1.5,transform:[{rotate:`${i*45 + seed*7}deg`},{translateY:-size*.105}]}]} />)}
      <View style={[s.core,{backgroundColor:color,height:size*.12,width:size*.12,borderRadius:size*.06,shadowColor:color}]} />
    </Animated.View>
  </View>;
}

function makeGeometry(seed:number){return Array.from({length:18},(_,i)=>{const a=(i/18)*Math.PI*2+(seed*.17);const r=i%2?43:29;return{x:50+Math.cos(a)*r,y:50+Math.sin(a)*r}})}

const s=StyleSheet.create({
  safe:{backgroundColor:C.bg,flex:1},content:{padding:20,paddingBottom:52},eye:{color:C.green,fontSize:9,fontWeight:"900",letterSpacing:1.4},title:{color:C.ink,fontSize:36,fontWeight:"900",marginTop:6},intro:{color:C.muted,fontSize:13,lineHeight:20,marginTop:7},portalStage:{alignItems:"center",backgroundColor:C.card,borderColor:C.line,borderRadius:24,borderWidth:1,marginTop:18,overflow:"hidden",paddingBottom:20,paddingTop:9},portalNumber:{color:C.muted,fontSize:9,fontWeight:"900",letterSpacing:1.5,marginTop:-5},portalName:{color:C.ink,fontSize:20,fontWeight:"900",marginTop:5},status:{alignItems:"center",flexDirection:"row",gap:7,marginTop:9},statusDot:{borderRadius:4,height:7,width:7},statusText:{color:C.muted,fontSize:8,fontWeight:"900",letterSpacing:1},enter:{borderRadius:14,borderWidth:1,marginTop:14,paddingHorizontal:28,paddingVertical:11},enterText:{color:C.ink,fontSize:11,fontWeight:"900"},location:{color:C.muted,fontSize:9,marginTop:9},choose:{color:C.muted,fontSize:9,fontWeight:"900",letterSpacing:1.4,marginBottom:10,marginTop:22},grid:{flexDirection:"row",flexWrap:"wrap",gap:8},cell:{backgroundColor:C.card,borderColor:C.line,borderRadius:14,borderWidth:1,minHeight:130,padding:9,width:"31.6%"},mini:{alignItems:"center",height:63,justifyContent:"center"},cellNumber:{fontSize:8,fontWeight:"900",marginTop:3},cellName:{color:C.ink,fontSize:10,fontWeight:"800",lineHeight:13,marginTop:3},note:{color:C.muted,fontSize:10,lineHeight:15,marginTop:18,textAlign:"center"},glow:{backgroundColor:"rgba(255,255,255,.015)",shadowOpacity:.4,shadowRadius:30},inner:{alignItems:"center",borderWidth:1,justifyContent:"center",position:"absolute"},branch:{position:"absolute"},core:{shadowOpacity:.85,shadowRadius:12},
});
