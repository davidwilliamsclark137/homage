import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { HUBS, Hub } from "../../../lib/hubs";
import { loadLocalHubCandidates } from "../../../lib/localHubDiscovery";
import { MESSAGE_HUNTS_ENABLED } from "../../../api";

type Point = { latitude: number; longitude: number };
type LocatedHub = { hub: Hub; distance: number };

const colors = { ink: "#17241D", muted: "#627067", green: "#275D45", bright: "#5AC47A", cream: "#F8F5EC", gold: "#E0A43A", white: "#FFFFFF" };
const MAP_HTML = createMapHtml();

export default function ExploreHomeScreen() {
  const router = useRouter();
  const mapRef = useRef<WebView>(null);
  const discoveryOriginRef = useRef<Point | null>(null);
  const [location, setLocation] = useState<Point | null>(null);
  const [locationText, setLocationText] = useState("Finding your position…");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [localHubs, setLocalHubs] = useState<Hub[]>([]);

  useEffect(() => {
    let active = true;
    let subscription: Location.LocationSubscription | null = null;
    async function begin() {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") { if (active) setLocationText("Location is needed to reveal nearby hubs."); return; }
      const last = await Location.getLastKnownPositionAsync({ maxAge: 86_400_000, requiredAccuracy: 10_000 });
      if (active && last) { setLocation({ latitude: last.coords.latitude, longitude: last.coords.longitude }); setLocationText("Closest hub ready · refining position"); }
      subscription = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 8, timeInterval: 8_000 }, (reading) => {
        if (!active) return;
        setLocation({ latitude: reading.coords.latitude, longitude: reading.coords.longitude });
        setLocationText("Exploration signal active");
      });
    }
    begin().catch(() => active && setLocationText("Location is unavailable. Try Nearby to search again."));
    return () => { active = false; subscription?.remove(); };
  }, []);

  useEffect(() => {
    if (!mapReady || !location) return;
    const hubs = JSON.stringify([...localHubs, ...HUBS].map(({ id, name, latitude, longitude, kind }) => ({ id, name, latitude, longitude, kind }))).replace(/</g, "\\u003c");
    mapRef.current?.injectJavaScript(`window.setHubs(${hubs});window.setPlayer(${location.latitude},${location.longitude});true;`);
  }, [location, mapReady, localHubs]);

  useEffect(() => {
    if (!location) return;
    if (discoveryOriginRef.current && distanceMeters(discoveryOriginRef.current, location) < 1_000) return;
    discoveryOriginRef.current = location;
    const current = location;
    let active = true;
    async function updateLocalHubs() {
      const result = await loadLocalHubCandidates(current);
      if (active && result.cached.length) { setLocalHubs(result.cached); setLocationText("Local hubs ready · refreshing area"); }
      const fresh = await result.refresh;
      if (active && fresh.length) { setLocalHubs(fresh); setLocationText(`${fresh.length} local hubs found`); }
      else if (active && !result.cached.length) setLocationText("Using closest established hub");
    }
    void updateLocalHubs().catch(() => active && setLocationText("Using closest established hub"));
    return () => { active = false; };
  }, [location]);

  const located = useMemo<LocatedHub[]>(() => location ? [...localHubs, ...HUBS].map((hub) => ({ hub, distance: distanceMeters(location, hub) })).sort((a, b) => a.distance - b.distance) : [], [location, localHubs]);
  const nearest = located[0] ?? null;
  const nearestId = nearest?.hub.id ?? null;
  const selected = located.find((item) => item.hub.id === selectedId) ?? nearest;
  const reached = Boolean(selected && selected.distance <= selected.hub.radiusMeters);

  useEffect(() => { if (nearestId) setSelectedId(nearestId); }, [nearestId]);

  function onMapMessage(event: WebViewMessageEvent) {
    try {
      const message = JSON.parse(event.nativeEvent.data) as { type?: string; id?: string };
      if (message.type === "ready") setMapReady(true);
      if (message.type === "hub" && message.id) setSelectedId(message.id);
    } catch { /* Ignore non-map messages. */ }
  }

  function recenter() {
    if (!location) return;
    mapRef.current?.injectJavaScript(`window.focusPlayer(${location.latitude},${location.longitude});true;`);
  }

  function openSelectedHub() {
    if (!selected) { router.push("/hubs"); return; }
    router.push({ pathname: "/hub", params: hubParams(selected.hub) });
  }

  function leaveAtSelectedHub() {
    if (!selected) { router.push("/create-clue"); return; }
    router.push({ pathname: "/create-clue", params: { hubId: selected.hub.id, hubName: selected.hub.name, hubLocality: selected.hub.locality, hubKind: selected.hub.kind, hubLatitude: String(selected.hub.latitude), hubLongitude: String(selected.hub.longitude), hubRadius: String(selected.hub.radiusMeters) } });
  }

  return <SafeAreaView style={styles.screen}>
    <View style={styles.topBar}>
      <View><Text style={styles.brand}>HOMAGE</Text><Text style={styles.signal}>{locationText}</Text></View>
      <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveText}>LIVE</Text></View>
    </View>

    <View style={styles.mapFrame}>
      <WebView
        ref={mapRef}
        source={{ html: MAP_HTML }}
        originWhitelist={["*"]}
        onMessage={onMapMessage}
        javaScriptEnabled
        domStorageEnabled
        cacheEnabled
        allowsInlineMediaPlayback
        setSupportMultipleWindows={false}
        userAgent="Homage/1.0 interactive-exploration-map"
        style={styles.map}
      />
      <View pointerEvents="none" style={styles.mapShade} />
      <View pointerEvents="none" style={styles.compass}><Text style={styles.compassText}>N</Text></View>
      <Pressable onPress={recenter} style={styles.recenter}><Text style={styles.recenterText}>⌖</Text></Pressable>
      <View pointerEvents="none" style={styles.mapHint}><Text style={styles.mapHintText}>PINCH · PAN · EXPLORE</Text></View>
    </View>

    <View style={styles.sheet}>
      {selected ? <>
        <View style={styles.questLine}><Text style={[styles.questState, reached && styles.questReached]}>{reached ? "HUB REACHED" : "NEAREST SIGNAL"}</Text><Text style={styles.distance}>{formatDistance(selected.distance)}</Text></View>
        <Text style={styles.hubName}>{selected.hub.name}</Text>
        <Text style={styles.hubPlace}>{selected.hub.locality} · {selected.hub.kind}</Text>
        <Text style={styles.prompt}>{reached ? "You made it. This hub is ready to become a quest starting point." : "Your nearest hub is the next objective. Move closer to bring it within range."}</Text>
      </> : <><Text style={styles.hubName}>Finding your hub</Text><Text style={styles.prompt}>Allow location access and Homage will pick up from wherever this phone is.</Text></>}
      <Pressable onPress={openSelectedHub} style={styles.primary}><Text style={styles.primaryText}>{reached ? "Open this hub" : "Explore closest hub"}</Text></Pressable>
      <Pressable onPress={() => router.push("/mckinney-puzzle-lab")} style={styles.previewButton}><Text style={styles.previewButtonText}>Preview McKinney puzzles at home</Text></Pressable>
      <Pressable onPress={leaveAtSelectedHub} style={styles.messageButton}><Text style={styles.messageButtonText}>Leave an encrypted message</Text></Pressable>
      {MESSAGE_HUNTS_ENABLED ? <Pressable onPress={() => router.push("/message-hunt")} style={styles.joinButton}><Text style={styles.joinButtonText}>Join as Player 2</Text></Pressable> : null}
    </View>
  </SafeAreaView>;
}

function createMapHtml() {
  const hubs = JSON.stringify(HUBS.map(({ id, name, latitude, longitude, kind }) => ({ id, name, latitude, longitude, kind }))).replace(/</g, "\\u003c");
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>
html,body,#map{height:100%;margin:0;overflow:hidden;background:#c7d9c5;touch-action:none}#stage{position:absolute;left:50%;top:50%;width:400px;height:400px;transform-origin:center;will-change:transform}.art{position:absolute;inset:0;width:400px;height:400px}.hub,.player{position:absolute;transform:translate(-50%,-50%);border-radius:50%;display:grid;place-items:center;box-sizing:border-box}.hub{width:38px;height:38px;background:#e0a43a;border:4px solid white;box-shadow:0 4px 10px rgba(23,36,29,.35);color:white;font:900 15px system-ui}.hub.city{background:#426a9b}.hub.monument{background:#815b9e}.hub.active{box-shadow:0 0 0 8px rgba(224,164,58,.25),0 4px 10px rgba(23,36,29,.35)}.player{left:200px;top:200px;width:30px;height:30px;background:#275d45;border:4px solid white;box-shadow:0 0 0 13px rgba(90,196,122,.25),0 4px 10px rgba(23,36,29,.3);z-index:5}.label{position:absolute;left:50%;top:42px;transform:translateX(-50%);background:rgba(248,245,236,.94);border-radius:8px;color:#17241d;font:800 10px system-ui;padding:5px 7px;white-space:nowrap;display:none}.hub.active .label{display:block}</style></head><body><div id="map"><div id="stage"><svg class="art" viewBox="0 0 400 400"><rect width="400" height="400" fill="#C7D9C5"/><path d="M-20 95 C75 60 118 130 204 91 S343 28 440 78" fill="none" stroke="#EEF3E9" stroke-width="23"/><path d="M-30 330 C72 286 121 317 191 260 S310 181 430 203" fill="none" stroke="#EEF3E9" stroke-width="18"/><path d="M77 -20 C104 89 149 112 129 202 S70 334 105 430" fill="none" stroke="#A9C2AD" stroke-width="7"/><path d="M322 -20 C288 76 314 148 273 220 S238 351 267 430" fill="none" stroke="#EEF3E9" stroke-width="13"/><circle cx="200" cy="200" r="58" fill="none" stroke="#275D45" stroke-opacity=".22" stroke-width="1.5" stroke-dasharray="6 7"/><circle cx="200" cy="200" r="112" fill="none" stroke="#275D45" stroke-opacity=".18" stroke-width="1.5" stroke-dasharray="6 7"/><circle cx="200" cy="200" r="170" fill="none" stroke="#275D45" stroke-opacity=".15" stroke-width="1.5" stroke-dasharray="6 7"/></svg><div class="player"></div></div></div><script>
let hubs=${hubs},map=document.getElementById('map'),stage=document.getElementById('stage'),origin=null;let scale=1,tx=0,ty=0,start=null,startTx=0,startTy=0,startScale=1,markers=[];const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));const render=()=>stage.style.transform='translate(-50%,-50%) translate('+tx+'px,'+ty+'px) scale('+scale+')';const rad=n=>n*Math.PI/180;const distance=(a,b)=>{const R=6371000,dLat=rad(b.latitude-a.latitude),dLon=rad(b.longitude-a.longitude),la=rad(a.latitude),lb=rad(b.latitude),v=Math.sin(dLat/2)**2+Math.cos(la)*Math.cos(lb)*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(v))};const bearing=(a,b)=>{const d=rad(b.longitude-a.longitude),la=rad(a.latitude),lb=rad(b.latitude);return(Math.atan2(Math.sin(d)*Math.cos(lb),Math.cos(la)*Math.sin(lb)-Math.sin(la)*Math.cos(lb)*Math.cos(d))*180/Math.PI+360)%360};
function placeHubs(lat,lon){markers.forEach(m=>m.remove());markers=[];const origin={latitude:lat,longitude:lon};hubs.map(h=>({...h,d:distance(origin,h)})).filter(h=>h.d<=40000).sort((a,b)=>a.d-b.d).forEach((h,i)=>{const angle=rad(bearing(origin,h)),radius=h.d<100?35:48+Math.min(h.d/40000,1)*104,x=200+Math.sin(angle)*radius,y=200-Math.cos(angle)*radius,m=document.createElement('button');m.className='hub '+h.kind+(i===0?' active':'');m.style.left=x+'px';m.style.top=y+'px';m.innerHTML='◆<span class="label">'+h.name.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))+'</span>';m.onclick=e=>{e.stopPropagation();document.querySelectorAll('.hub').forEach(n=>n.classList.remove('active'));m.classList.add('active');window.ReactNativeWebView.postMessage(JSON.stringify({type:'hub',id:h.id}))};stage.appendChild(m);markers.push(m)})}
const gap=t=>Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY);map.addEventListener('touchstart',e=>{startTx=tx;startTy=ty;startScale=scale;start=e.touches.length===1?{x:e.touches[0].clientX,y:e.touches[0].clientY}:{gap:gap(e.touches)}},{passive:false});map.addEventListener('touchmove',e=>{e.preventDefault();if(e.touches.length===1&&start?.x!==undefined){tx=clamp(startTx+e.touches[0].clientX-start.x,-320,320);ty=clamp(startTy+e.touches[0].clientY-start.y,-320,320)}else if(e.touches.length===2&&start?.gap){scale=clamp(startScale*gap(e.touches)/start.gap,.85,4)}render()},{passive:false});map.addEventListener('wheel',e=>{e.preventDefault();scale=clamp(scale*(e.deltaY<0?1.15:.87),.85,4);render()},{passive:false});window.setHubs=next=>{hubs=next;if(origin)placeHubs(origin.latitude,origin.longitude)};window.setPlayer=(lat,lon)=>{origin={latitude:lat,longitude:lon};placeHubs(lat,lon)};window.focusPlayer=()=>{scale=1;tx=0;ty=0;render()};render();window.ReactNativeWebView.postMessage(JSON.stringify({type:'ready'}));</script></body></html>`;
}

function distanceMeters(a: Point, b: Point) { const r = 6_371_000, rad = (n: number) => n * Math.PI / 180, dLat = rad(b.latitude - a.latitude), dLon = rad(b.longitude - a.longitude); const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2; return 2 * r * Math.asin(Math.sqrt(h)); }
function formatDistance(m: number) { if (m < 100) return `${Math.round(m)} m`; if (m < 1_000) return `${Math.round(m / 10) * 10} m`; return `${(m / 1609.344).toFixed(1)} mi`; }
function hubParams(hub: Hub) { return { id: hub.id, name: hub.name, locality: hub.locality, kind: hub.kind, latitude: String(hub.latitude), longitude: String(hub.longitude), radius: String(hub.radiusMeters) }; }

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.cream, flex: 1 }, topBar: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 13 }, brand: { color: colors.ink, fontSize: 18, fontWeight: "900", letterSpacing: 2 }, signal: { color: colors.muted, fontSize: 11, marginTop: 3 }, liveBadge: { alignItems: "center", backgroundColor: colors.white, borderRadius: 20, flexDirection: "row", gap: 6, paddingHorizontal: 11, paddingVertical: 8 }, liveDot: { backgroundColor: colors.bright, borderRadius: 4, height: 8, width: 8 }, liveText: { color: colors.green, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  mapFrame: { flex: 1, minHeight: 360, overflow: "hidden", position: "relative" }, map: { backgroundColor: "#C7D9C5", flex: 1 }, mapShade: { backgroundColor: "rgba(39,93,69,.04)", bottom: 0, left: 0, position: "absolute", right: 0, top: 0 }, compass: { alignItems: "center", backgroundColor: "rgba(248,245,236,.94)", borderRadius: 18, height: 36, justifyContent: "center", left: 14, position: "absolute", top: 14, width: 36 }, compassText: { color: colors.green, fontSize: 12, fontWeight: "900" }, recenter: { alignItems: "center", backgroundColor: colors.cream, borderRadius: 22, bottom: 24, height: 44, justifyContent: "center", position: "absolute", right: 14, shadowColor: colors.ink, shadowOpacity: .2, shadowRadius: 6, width: 44 }, recenterText: { color: colors.green, fontSize: 25, fontWeight: "800" }, mapHint: { backgroundColor: "rgba(248,245,236,.9)", borderRadius: 10, bottom: 25, left: 14, paddingHorizontal: 9, paddingVertical: 6, position: "absolute" }, mapHintText: { color: colors.muted, fontSize: 9, fontWeight: "800", letterSpacing: .7 },
  sheet: { backgroundColor: colors.cream, borderTopLeftRadius: 27, borderTopRightRadius: 27, minHeight: 390, marginTop: -16, padding: 22, paddingTop: 25 }, questLine: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" }, questState: { color: colors.gold, fontSize: 10, fontWeight: "900", letterSpacing: 1.3 }, questReached: { color: colors.bright }, distance: { color: colors.green, fontSize: 13, fontWeight: "800" }, hubName: { color: colors.ink, fontSize: 25, fontWeight: "800", letterSpacing: -.5, marginTop: 8 }, hubPlace: { color: colors.muted, fontSize: 12, marginTop: 4, textTransform: "capitalize" }, prompt: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 11 }, primary: { alignItems: "center", backgroundColor: colors.green, borderRadius: 14, marginTop: 18, padding: 15 }, primaryText: { color: colors.white, fontSize: 14, fontWeight: "800" }, previewButton: { alignItems: "center", backgroundColor: "#F4E8CB", borderColor: colors.gold, borderRadius: 14, borderWidth: 1, marginTop: 9, padding: 13 }, previewButtonText: { color: "#765414", fontSize: 13, fontWeight: "900" }, messageButton: { alignItems: "center", borderColor: colors.green, borderRadius: 14, borderWidth: 1, marginTop: 9, padding: 13 }, messageButtonText: { color: colors.green, fontSize: 13, fontWeight: "800" }, joinButton: { alignItems: "center", padding: 11 }, joinButtonText: { color: colors.muted, fontSize: 12, fontWeight: "800" },
});
