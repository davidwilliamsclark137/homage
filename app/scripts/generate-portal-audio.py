"""Generate original, seamless PCM chord loops for portal proximity playback.

No inputs. Writes two WAV assets into app/assets/audio. Integer frequencies
complete whole cycles across the four-second loop, avoiding seam clicks.
"""
import math
import struct
import wave
from pathlib import Path

OUTPUT = Path(__file__).resolve().parents[1] / 'assets' / 'audio'
OUTPUT.mkdir(parents=True, exist_ok=True)
for name, frequencies in [('dissonant', [220, 233, 311]), ('tuned', [220, 275, 330])]:
    with wave.open(str(OUTPUT / f'{name}.wav'), 'wb') as output:
        output.setparams((1, 2, 22050, 0, 'NONE', 'not compressed'))
        samples = bytearray()
        for index in range(22050 * 4):
            time = index / 22050
            sample = sum(math.sin(2 * math.pi * freq * time) for freq in frequencies) / 3
            samples.extend(struct.pack('<h', round(sample * 16000)))
        output.writeframes(samples)

# Short tones for the tap-driven portal activities, with attack and decay.
for name, frequency in [('low', 220), ('middle', 275), ('high', 330)]:
    with wave.open(str(OUTPUT / f'note-{name}.wav'), 'wb') as output:
        output.setparams((1, 2, 22050, 0, 'NONE', 'not compressed'))
        samples = bytearray()
        for index in range(26460):
            envelope = min(1, index / 441) * max(0, 1 - index / 26460)
            sample = math.sin(2 * math.pi * frequency * index / 22050)
            samples.extend(struct.pack('<h', round(sample * envelope * 15000)))
        output.writeframes(samples)
