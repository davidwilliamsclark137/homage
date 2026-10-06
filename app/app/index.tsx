import { ScrollView, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import TwoPhoneGuide from "../features/mckinney/encounter/TwoPhoneGuide";

const C={bg:"#F7F4EA",ink:"#17241D",muted:"#657168",green:"#275D45",pale:"#E3ECE6",white:"#FFF"};
export default function Home(){
 const router=useRouter();
 return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={{flexGrow:1}}>
  <View style={s.hero}><View style={s.mark}><View style={s.core}/></View><Text style={s.name}>HOMAGE</Text><Text style={s.tagline}>Connect places. Reveal a signal.</Text></View>
  <View style={s.actions}>
   <TwoPhoneGuide />
   <Pressable accessibilityRole="button" onPress={()=>router.push("/sky-lab")} style={s.secondary}><Text style={s.secondaryText}>Sky scanning lab</Text><Text style={s.secondarySub}>One star · live diagnostics · test camera alignment</Text></Pressable>
   <Pressable onPress={()=>router.push("/rooftop-portal")} style={s.primary}><Text style={s.primaryText}>Explore portal map</Text><Text style={s.primarySub}>Find storefront and rooftop portals around the square</Text></Pressable>
   <Pressable accessibilityRole="button" onPress={()=>router.push("/night-encounter")} style={s.secondary}><Text style={s.secondaryText}>Find the same sky</Text><Text style={s.secondarySub}>Scan a constellation · follow two connected paths</Text></Pressable>
   <Pressable accessibilityRole="button" onPress={()=>router.push({pathname:"/night-encounter",params:{test:"1"}})} style={s.secondary}><Text style={s.secondaryText}>Test the night</Text><Text style={s.secondarySub}>Try the whole constellation journey on two phones</Text></Pressable>
   <Pressable accessibilityRole="button" onPress={()=>router.push("/shared-signal")} style={s.secondary}><Text style={s.secondaryText}>Try together</Text><Text style={s.secondarySub}>Two phones · two fragments · one shared discovery</Text></Pressable>
   <Pressable onPress={()=>router.push("/living-signal")} style={s.secondary}><Text style={s.secondaryText}>Play nearby</Text><Text style={s.secondarySub}>Uses your location in downtown McKinney</Text></Pressable>
   <Pressable onPress={()=>router.push({pathname:"/living-signal",params:{simulation:"1"}})} style={s.secondary}><Text style={s.secondaryText}>Test from home</Text><Text style={s.secondarySub}>Same game without location checks</Text></Pressable>
   <Text style={s.note}>Use public pedestrian areas. Never play while driving.</Text>
  </View>
 </ScrollView></SafeAreaView>
}
const s=StyleSheet.create({safe:{backgroundColor:C.bg,flex:1},hero:{minHeight:260,alignItems:"center",flex:1,justifyContent:"center",padding:28},mark:{alignItems:"center",backgroundColor:C.pale,borderRadius:36,height:72,justifyContent:"center",width:72},core:{backgroundColor:C.green,borderColor:C.white,borderRadius:14,borderWidth:4,height:28,width:28},name:{color:C.ink,fontSize:41,fontWeight:"900",letterSpacing:7,marginTop:24},tagline:{color:C.green,fontSize:17,fontWeight:"800",marginTop:12,textAlign:"center"},actions:{gap:10,padding:22},primary:{backgroundColor:C.green,borderRadius:16,padding:17},primaryText:{color:C.white,fontSize:16,fontWeight:"900",textAlign:"center"},primarySub:{color:"#CFE2D5",fontSize:10,marginTop:5,textAlign:"center"},secondary:{backgroundColor:C.pale,borderRadius:16,padding:16},secondaryText:{color:C.green,fontSize:14,fontWeight:"900",textAlign:"center"},secondarySub:{color:C.muted,fontSize:10,marginTop:5,textAlign:"center"},note:{color:C.muted,fontSize:9,marginTop:4,textAlign:"center"}});
