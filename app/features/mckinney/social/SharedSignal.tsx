import { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMultiplayerProfile } from '../../../lib/multiplayerSession';
import { signalRequest, type Signal } from './client';

const KEEPSAKE_KEY = 'homage.shared-signal.keepsake.v1';
export default function SharedSignal({ room, enabled }: { room: string; enabled: boolean }) {
  const [joining, setJoining] = useState(false);
  const [signal, setSignal] = useState<Signal | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const spin = useRef(new Animated.Value(0)).current;
  const active = enabled && foreground;
  const revealed = signal?.phase === 'revealed';
  useEffect(() => {
    const animation = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 18000, useNativeDriver: true }));
    animation.start();
    return () => animation.stop();
  }, [spin]);
  useEffect(() => {
    let live = true;
    void AsyncStorage.getItem(KEEPSAKE_KEY).then(v => { if (live) { setSaved(!!v); setStorageReady(true); } }).catch(() => { if (live) setStorageReady(true); });
    const sub = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => { live = false; sub.remove(); };
  }, []);
  useEffect(() => { if (!active) { setJoining(false); setSignal(null); } }, [active]);
  useEffect(() => {
    if (!joining || !active) return;
    let disposed = false;
    let token: string | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setError('');
    setSignal(null);
    async function pulse() {
      try {
        const next = token
          ? await signalRequest({ action: 'pulse', token })
          : await signalRequest({ action: 'join', room, device: (await getMultiplayerProfile()).playerId });
        token = next.token;
        if (disposed) { void signalRequest({ action: 'leave', token }).catch(() => {}); return; }
        setSignal(next);
        timer = setTimeout(() => void pulse(), 1500);
      } catch (e) {
        if (!disposed) { setError(e instanceof Error ? e.message : 'Connection interrupted. Try again.'); setJoining(false); setSignal(null); }
      }
    }
    void pulse();
    return () => { disposed = true; clearTimeout(timer); if (token) void signalRequest({ action: 'leave', token }).catch(() => {}); };
  }, [joining, active, room]);
  useEffect(() => {
    if (!revealed || saved || !storageReady) return;
    let live = true;
    void AsyncStorage.setItem(KEEPSAKE_KEY, JSON.stringify({ title: 'Between us', discoveredAt: new Date().toISOString(), room }))
      .then(() => { if (live) { setSaved(true); setSaveError(false); } })
      .catch(() => { if (live) setSaveError(true); });
    return () => { live = false; };
  }, [revealed, saved, room, storageReady]);
  const color = signal?.fragment === 'teal' ? '#7fe6d5' : '#ffc174';
  const paired = signal?.phase === 'resonating';
  return <View style={s.wrap}>
    <Text style={s.eyebrow}>{revealed ? 'A SHARED DISCOVERY' : paired ? 'SOMETHING IS ANSWERING' : 'A FRAGMENT OF YOUR OWN'}</Text>
    <View style={s.art}>
      <Animated.View style={{ transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
        <Svg width={260} height={260} viewBox="0 0 260 260" accessibilityLabel={revealed ? 'An amber and teal flower formed by both fragments' : 'A slowly turning luminous fragment'}>
          <Circle cx="130" cy="130" r="111" stroke="#29453e" strokeWidth="1" fill="none" />
          {revealed ? [0, 30, 60, 90, 120, 150].map((angle, i) => <Ellipse key={angle} cx="130" cy="130" rx="38" ry="94" transform={`rotate(${angle} 130 130)`} stroke={i % 2 ? '#7fe6d5' : '#ffc174'} strokeWidth="2" fill="none" />) : <>
            <Path d="M 130 42 A 88 88 0 0 1 130 218" stroke={color} strokeWidth="4" fill="none" />
            <Path d="M 130 72 Q 218 130 130 188 Q 166 130 130 72" stroke={color} strokeWidth="2" fill="none" />
            {paired && <Path d="M 130 42 A 88 88 0 0 0 130 218 Q 42 130 130 42" stroke={signal?.fragment === 'teal' ? '#ffc174' : '#7fe6d5'} strokeWidth="3" fill="none" />}
          </>}
          <Circle cx="130" cy="130" r={revealed ? 10 : 4} fill={revealed ? '#f5f2da' : color} />
        </Svg>
      </Animated.View>
    </View>
    <Text style={s.title}>{revealed ? 'Between us' : paired ? 'Two fragments. One moment.' : signal ? `You carry ${signal.fragment}.` : 'Carry a little light.'}</Text>
    <Text style={s.copy} accessibilityLiveRegion="polite">{revealed ? 'Something neither fragment could make alone. Yours to keep, even after you part ways.' : paired ? 'Another person’s fragment is responding. Stay for a breath and watch what forms.' : signal ? 'Your fragment is alive. If someone else shares a signal here, it may become something new.' : 'A quiet experiment in discovering something together. You can leave whenever you like.'}</Text>
    {paired && <Text style={s.hint}>Forming · about {Math.max(1, Math.ceil(signal.remainingMs / 1000))} seconds</Text>}
    {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
    {!joining ? <Pressable accessibilityRole="button" disabled={!active} style={[s.button, !active && s.disabled]} onPress={() => setJoining(true)}><Text style={s.buttonText}>{error ? 'Reconnect signal' : 'Share my signal'}</Text></Pressable> : <Pressable accessibilityRole="button" style={s.button} onPress={() => { setJoining(false); setSignal(null); }}><Text style={s.buttonText}>{revealed ? 'Keep this moment · leave signal' : 'Leave signal'}</Text></Pressable>}
    {joining && !signal && <Text style={s.hint}>Connecting…</Text>}
    <Text style={s.hint}>Only people who choose to share here can connect. No names, profiles, or coordinates are exchanged.</Text>
    {saved && <View style={s.keepsake}><Text style={s.keepsakeTitle}>✧ Between us · in your collection</Text><Text style={s.copy}>An amber and teal bloom, made in a shared moment. Saved on this phone.</Text></View>}
    {saveError && <Text style={s.error}>Your discovery appeared, but could not be saved on this phone.</Text>}
  </View>;
}
const s = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 16, paddingVertical: 20 },
  eyebrow: { color: '#a2c5b7', fontSize: 10, letterSpacing: 2, fontWeight: '800', textAlign: 'center' },
  art: { height: 270, justifyContent: 'center' },
  title: { fontSize: 27, color: '#f4f0df', fontWeight: '700', textAlign: 'center' },
  copy: { color: '#c0d0c8', fontSize: 15, lineHeight: 23, textAlign: 'center' },
  hint: { color: '#9bb2a7', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  error: { color: '#ffbfaa', fontSize: 13, textAlign: 'center' },
  button: { backgroundColor: '#bcebd4', padding: 17, borderRadius: 16, alignSelf: 'stretch' },
  buttonText: { color: '#14392d', fontWeight: '800', textAlign: 'center', fontSize: 15 },
  disabled: { opacity: 0.4 },
  keepsake: { borderColor: '#49685b', borderWidth: 1, padding: 18, borderRadius: 18, gap: 8, alignSelf: 'stretch' },
  keepsakeTitle: { color: '#ffc174', textAlign: 'center', fontWeight: '700' },
});
