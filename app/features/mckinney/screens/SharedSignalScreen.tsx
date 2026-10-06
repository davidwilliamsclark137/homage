import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { MAP_PORTALS, portalAccess } from '../portals/mapAccess';
import type { Fix } from '../portals/rooftop';
import SharedSignal from '../social/SharedSignal';

export default function SharedSignalScreen() {
  const { portal: id } = useLocalSearchParams<{ portal?: string }>();
  const portal = MAP_PORTALS.find(p => p.id === id);
  const test = !id;
  const focused = useIsFocused();
  const [fix, setFix] = useState<Fix | null>(null);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState('');
  useEffect(() => {
    if (test || !focused) return;
    let stopped = false;
    let subscription: Location.LocationSubscription | undefined;
    setFix(null); setError('');
    const timer = setInterval(() => setNow(Date.now()), 1000);
    void (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (stopped) return;
      if (!permission.granted) throw Error('Location permission is needed to share at this portal.');
      subscription = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Highest, timeInterval: 2000, distanceInterval: 1 }, value => {
        if (!stopped) { setFix({ ...value.coords, timestamp: value.timestamp }); setNow(Date.now()); setError(''); }
      }, () => { if (!stopped) setError('Location unavailable. Your signal is paused.'); });
      if (stopped) subscription.remove();
    })().catch(e => { if (!stopped) setError(e instanceof Error ? e.message : 'Location unavailable.'); });
    return () => { stopped = true; clearInterval(timer); subscription?.remove(); };
  }, [test, focused]);
  const access = portal ? portalAccess(portal, fix, Platform.OS, now) : null;
  const enabled = focused && (test || (!!portal && !!access?.ready && !error));
  return <SafeAreaView style={s.safe} edges={['bottom']}>
    <ScrollView contentContainerStyle={s.content}>
      <Text style={s.label}>{test ? 'TRY TOGETHER · NO LOCATION REQUIRED' : 'SHARED SIGNAL'}</Text>
      <Text style={s.note}>{test ? 'Open Try together on both phones, then tap Share my signal on each. Keep both screens open. This test connects participants regardless of distance.' : enabled ? portal?.place + ' · your signal pauses when you leave this portal.' : error || access?.message || 'This portal is unavailable.'}</Text>
      <SharedSignal room={test ? 'test:shared' : id!} enabled={enabled} />
      <Text style={s.note}>Live prototype · this computer’s Expo server must remain running.</Text>
    </ScrollView>
  </SafeAreaView>;
}
const s = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#101f1c' }, content: { padding: 24, paddingBottom: 40 }, label: { color: '#8fb8a4', fontSize: 10, fontWeight: '800', letterSpacing: 1.3, marginBottom: 12 }, note: { color: '#adc1b5', fontSize: 12, lineHeight: 19, textAlign: 'center' } });
