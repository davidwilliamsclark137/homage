import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const STEPS = [
  { title: 'Before leaving', body: 'Keep the computer awake, online, and running Expo. Charge both phones and confirm Homage opens on each.' },
  { title: 'Start outside after dark', body: 'Near the downtown McKinney square, stop somewhere with a clear view of the sky. On both phones choose Find the same sky. Allow camera, location, and motion access.' },
  { title: 'Find the same constellation', body: 'Choose a constellation offered on both phones. Center its bright anchor star and hold steady for 3 seconds. On each phone, tap Let my signal answer someone within a minute of scanning.', pass: 'One phone receives amber, the other teal. If scanning will not work after about 5 minutes, record what both screens say and stop the sky test.' },
  { title: 'Walk both portal routes', body: 'Amber: Landon → Patina.\nTeal: Emporium → Fair & Square.\n\nYou can carry both phones for this technical test. Keep the encounter open on both. Collect the first discovery on each before attempting the second.', pass: 'Each first discovery changes the other phone’s fragment and reveals its next clue. Each collection unlocks near its intended outdoor location.' },
  { title: 'Share at MPAC', body: 'Go to the final portal on the north side of MPAC. Tap Share this moment on only one phone first. Then share on the second.', pass: 'The first phone waits. After both share, both reveal Between us.' },
  { title: 'Check the keepsakes', body: 'Close and reopen Homage on both phones.', pass: 'Both phones still show their saved keepsake.' },
];

export default function TwoPhoneGuide({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="Open tonight’s two-phone test instructions" onPress={() => setOpen(true)} style={[s.launch, compact && s.compact]}>
      <Text style={s.launchTitle}>{compact ? 'Two-phone test guide' : 'Tonight’s two-phone test'}</Text>
      {!compact && <Text style={s.launchCopy}>About 30 minutes · 6 steps · open the field checklist</Text>}
    </Pressable>
    <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)} presentationStyle="pageSheet">
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <View style={s.heading}><Text accessibilityRole="header" style={s.title}>Tonight’s two-phone test</Text><Text style={s.subtitle}>Outdoor checklist · about 30 minutes</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close test instructions" onPress={() => setOpen(false)} style={s.close}><Text style={s.closeText}>Done</Text></Pressable>
        </View>
        <ScrollView contentContainerStyle={s.content}>
          <Text style={s.intro}>Use Find the same sky for this outdoor test. Test the night is the separate simulation that skips the sky and GPS checks. This guide only displays instructions; it does not start, reset, or complete your encounter.</Text>
          {STEPS.map((step, index) => <View key={step.title} style={s.step}>
            <Text accessibilityRole="header" style={s.stepTitle}>{index + 1}. {step.title}</Text>
            <Text style={s.body}>{step.body}</Text>
            {step.pass && <View style={s.pass}><Text style={s.passTitle}>What should happen</Text><Text style={s.body}>{step.pass}</Text></View>}
          </View>)}
          <View style={s.report}><Text accessibilityRole="header" style={s.stepTitle}>Tell me afterward</Text><Text style={s.body}>{'Did sky alignment work on both phones?\nDid any portal fail to unlock or point somewhere awkward?\nDid either phone lose progress?'}</Text><Text style={s.body}>For a problem, note the portal, time, phone model, and what each screen said. A screenshot can help.</Text></View>
          <Text style={s.caution}>Portal positions are provisional. If a marker points into a road or an inaccessible area, stop and report it. Stay on public pedestrian paths and stop walking before looking up through the camera.</Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  </>;
}
const s = StyleSheet.create({
  launch: { borderWidth: 1, borderColor: '#ADBDAC', backgroundColor: '#F0EAD9', borderRadius: 16, padding: 17, gap: 5 },
  compact: { padding: 12 }, launchTitle: { color: '#254D3C', fontSize: 15, fontWeight: '800', textAlign: 'center' }, launchCopy: { color: '#657168', fontSize: 12, textAlign: 'center', lineHeight: 18 },
  safe: { flex: 1, backgroundColor: '#F7F4EA' }, header: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 12, borderBottomWidth: 1, borderBottomColor: '#D9E1D6' }, heading: { flex: 1 },
  title: { color: '#17241D', fontSize: 22, fontWeight: '800' }, subtitle: { color: '#657168', fontSize: 12, marginTop: 6 },
  close: { padding: 12, backgroundColor: '#275D45', borderRadius: 12 }, closeText: { color: '#FFF', fontWeight: '700' },
  content: { padding: 20, gap: 16, paddingBottom: 40 }, intro: { color: '#526458', fontSize: 14, lineHeight: 21 },
  step: { padding: 18, gap: 12, borderRadius: 16, backgroundColor: '#FFF' }, stepTitle: { color: '#254D3C', fontSize: 17, fontWeight: '800' }, body: { color: '#354C3F', fontSize: 15, lineHeight: 23 },
  pass: { backgroundColor: '#EDF3ED', borderRadius: 12, padding: 12, gap: 6 }, passTitle: { color: '#275D45', fontSize: 12, fontWeight: '800' },
  report: { backgroundColor: '#E3ECE6', padding: 18, borderRadius: 16, gap: 12 }, caution: { color: '#66573C', fontSize: 13, lineHeight: 20 },
});
