import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

const C={bg:"#F7F4EA",ink:"#17241D",muted:"#657168",green:"#275D45",pale:"#E3ECE6",white:"#FFF"};
export default function Home(){
 const router=useRouter();
 return <SafeAreaView style={s.safe}>
  <View style={s.hero}><View style={s.mark}><View style={s.core}/></View><Text style={s.name}>HOMAGE</Text><Text style={s.tagline}>Connect places. Reveal a signal.</Text></View>
  <View style={s.actions}>
   <Pressable onPress={()=>router.push("/living-signal")} style={s.primary}><Text style={s.primaryText}>Play nearby</Text><Text style={s.primarySub}>Uses your location in downtown McKinney</Text></Pressable>
   <Pressable onPress={()=>router.push({pathname:"/living-signal",params:{simulation:"1"}})} style={s.secondary}><Text style={s.secondaryText}>Test from home</Text><Text style={s.secondarySub}>Same game without location checks</Text></Pressable>
   <Text style={s.note}>Stay on public sidewalks. Never play while driving.</Text>
  </View>
 </SafeAreaView>
}
const s=StyleSheet.create({safe:{backgroundColor:C.bg,flex:1},hero:{alignItems:"center",flex:1,justifyContent:"center",padding:28},mark:{alignItems:"center",backgroundColor:C.pale,borderRadius:36,height:72,justifyContent:"center",width:72},core:{backgroundColor:C.green,borderColor:C.white,borderRadius:14,borderWidth:4,height:28,width:28},name:{color:C.ink,fontSize:41,fontWeight:"900",letterSpacing:7,marginTop:24},tagline:{color:C.green,fontSize:17,fontWeight:"800",marginTop:12,textAlign:"center"},actions:{gap:10,padding:22},primary:{backgroundColor:C.green,borderRadius:16,padding:17},primaryText:{color:C.white,fontSize:16,fontWeight:"900",textAlign:"center"},primarySub:{color:"#CFE2D5",fontSize:10,marginTop:5,textAlign:"center"},secondary:{backgroundColor:C.pale,borderRadius:16,padding:16},secondaryText:{color:C.green,fontSize:14,fontWeight:"900",textAlign:"center"},secondarySub:{color:C.muted,fontSize:10,marginTop:5,textAlign:"center"},note:{color:C.muted,fontSize:9,marginTop:4,textAlign:"center"}});
