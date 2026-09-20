"""Render the original Cloud Steps theme. Requires Python 3 + numpy.

No recordings, third-party samples, existing melodies, or external generation service.
WAV masters stay in .local; AAC files are encoded separately for the game.
"""
from pathlib import Path
import json
import wave
import numpy as np

RATE = 44100
ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / '.local/audio-masters'
OUT = ROOT / 'output/audio'
MASTER.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)

# Original two-phrase melody in C major. Events are beat, MIDI note, duration.
A = [
    [(0,76,.55),(.75,79,.4),(1.5,84,.75),(2.5,79,.4),(3.25,76,.45)],
    [(0,76,.5),(.75,81,.45),(1.5,79,.5),(2.25,76,.7),(3.25,72,.45)],
    [(0,77,.7),(1,81,.4),(1.75,79,.45),(2.5,77,.5),(3.25,76,.4)],
    [(0,74,.5),(.75,79,.5),(1.5,83,.55),(2.5,81,.4),(3.25,79,.5)],
    [(0,76,.5),(.75,72,.5),(1.5,74,.4),(2.25,76,.45),(3,79,.65)],
    [(0,81,.6),(1,79,.4),(1.75,76,.5),(2.5,72,.4),(3.25,76,.45)],
    [(0,77,.65),(1,76,.45),(1.75,74,.5),(2.5,72,.9)],
    [(0,74,.5),(1,79,.5),(2,77,.45),(2.75,74,.45),(3.5,71,.35)],
]
B = [
    [(0,81,.9),(1.25,79,.5),(2,77,.6),(3,76,.5)],
    [(0,79,.65),(1,76,.5),(1.75,74,.45),(2.5,72,.9)],
    [(0,76,.55),(.75,79,.4),(1.5,81,.75),(2.75,79,.7)],
    [(0,83,.7),(1,81,.5),(1.75,79,.6),(3,74,.5)],
    [(0,77,.6),(.75,81,.6),(1.75,77,.4),(2.5,76,.4),(3.25,74,.45)],
    [(0,76,.8),(1.25,72,.5),(2,76,.5),(3,79,.6)],
    [(0,81,.5),(.75,79,.5),(1.5,77,.65),(2.5,76,.4),(3.25,74,.45)],
    [(0,74,.55),(1,77,.5),(2,79,.7),(3.25,71,.4)],
]
CHORDS = {
    'C': (36,[60,64,67,74]), 'Am': (33,[60,64,69,72]),
    'F': (29,[60,65,69,76]), 'G': (31,[59,62,67,76]),
    'Dm': (38,[60,65,69,74]),
}
PROGRESSION = ['C','Am','F','G','C','Am','F','G'] * 2 + ['F','C','Am','G','Dm','Am','F','G'] + ['C','Am','F','G','C','Am','F','G']

def tone(note, seconds, voice):
    t = np.arange(max(1,round(seconds*RATE))) / RATE
    f = 440 * 2**((note-69)/12)
    onset = 1-np.exp(-t/.0035)
    release = np.minimum(1,(seconds-t)/.04).clip(0,1)
    if voice == 'mallet':
        y = np.sin(2*np.pi*f*t)*np.exp(-t/.34)
        y += .24*np.sin(2*np.pi*f*2.01*t)*np.exp(-t/.11)
        y += .09*np.sin(2*np.pi*f*3.98*t)*np.exp(-t/.055)
    elif voice == 'soft':
        y = np.sin(2*np.pi*f*t)*np.exp(-t/.65)
        y += .13*np.sin(2*np.pi*f*2*t)*np.exp(-t/.22)
    elif voice == 'bass':
        y = (np.sin(2*np.pi*f*t)+.22*np.sin(2*np.pi*f*2*t)+.06*np.sin(2*np.pi*f*3*t))*np.exp(-t/.23)
    else:
        y = (np.sin(2*np.pi*f*t)+.13*np.sin(2*np.pi*f*2*t))*np.exp(-t/.19)
    return y*onset*release

def write_wav(path, samples):
    with wave.open(str(path),'wb') as f:
        f.setnchannels(2); f.setsampwidth(2); f.setframerate(RATE)
        f.writeframes(np.round(samples.clip(-1,1)*32767).astype('<i2').tobytes())

def render(bpm, gentle):
    beat=60/bpm
    length=round(32*4*beat*RATE)
    mix=np.zeros((length,2),np.float64)
    rng=np.random.default_rng(1809 if gentle else 128)
    def add(sound,when,volume,pan=0):
        indices=(round(when*RATE)+np.arange(len(sound)))%length
        mix[indices,0] += sound*volume*np.sqrt((1-pan)/2)
        mix[indices,1] += sound*volume*np.sqrt((1+pan)/2)
    def note(n,when,duration,volume,voice,pan=0):
        add(tone(n,duration,voice),when,volume,pan)
    def percussion(kind,when,volume):
        dur={'kick':.22,'hat':.075,'tap':.12}[kind]
        t=np.arange(round(dur*RATE))/RATE
        if kind=='kick':
            phase=2*np.pi*(53*t+80*.028*(1-np.exp(-t/.028)))
            y=np.sin(phase)*np.exp(-t/.062)*(1-np.exp(-t/.002))
        else:
            noise=rng.standard_normal(len(t))
            smooth=np.convolve(noise,np.ones(5)/5,mode='same')
            if kind=='hat': y=(noise-smooth)*np.exp(-t/.019)*.24
            else: y=(smooth*.32+np.sin(2*np.pi*970*t)*.18)*np.exp(-t/.027)
            y*=1-np.exp(-t/.001)
        y*=np.minimum(1,(dur-t)/.008).clip(0,1)
        add(y,when,volume,.22 if kind=='hat' else -.1)
    for bar,chord in enumerate(PROGRESSION):
        start=bar*4*beat
        root,notes=CHORDS[chord]
        phrase=B if 16<=bar<24 else A
        for position,n,duration in phrase[bar%8]:
            # Same melody, longer note tails and fewer upper harmonics in practice.
            sound=tone(n,(duration*beat)+(.5 if gentle else .25),'soft' if gentle else 'mallet')
            amp=.16 if gentle else .17
            add(sound,start+position*beat,amp,-.12)
            add(sound,start+(position+.75)*beat,amp*.13,.5)
        bass_positions=[0,2] if gentle else [0,1.5,2,3.5]
        for j,p in enumerate(bass_positions):
            n=root+(7 if j%2 and not gentle else 0)
            note(n,start+p*beat,.65 if gentle else .42,.14 if gentle else .19,'bass')
        # Soft accompaniment with a different voicing on each chord.
        for j,p in enumerate([.5,2.5] if gentle else [.5,1.5,2.5,3.5]):
            for k,n in enumerate(notes[:3]):
                note(n,start+p*beat+k*.012,.7 if gentle else .35,.021 if gentle else .028,'soft' if gentle else 'pluck',(-.6,.45,.65)[k])
        for p in ([0,2] if gentle else [0,2,3.5]): percussion('kick',start+p*beat,.11 if gentle else .19)
        for p in [1,3]: percussion('tap',start+p*beat,.045 if gentle else .12)
        for j,p in enumerate(np.arange(.5,4,1) if gentle else np.arange(0,4,.5)):
            percussion('hat',start+p*beat,.026 if gentle else (.047 if j%2 else .035))
        # A tiny ascending answer only at phrase endings.
        if not gentle and bar in [7,15,23,31]:
            for j,n in enumerate([67,71,74]): note(n,start+(3.25+j*.25)*beat,.18,.035,'mallet',.5)
    # Circular, very light room reflections retain the preceding bar's tail at the seam.
    dry=mix.copy()
    for delay,amount in [(.071,.10),(.127,.065),(.193,.035)]:
        mix += np.roll(dry[:,::-1],round(delay*RATE),axis=0)*amount
    mix -= mix.mean(axis=0)
    mix=np.tanh(mix*1.3)/1.3
    rms=np.sqrt(np.mean(mix**2))
    mix*=min(10**(-19/20)/rms,.79/np.max(np.abs(mix)))
    peak=float(np.max(np.abs(mix)))
    seam=float(np.max(np.abs(mix[0]-mix[-1])))
    assert peak<.81
    assert seam<.025, f'Unexpected loop edge: {seam}'
    name=f'cloud-steps-{bpm}'
    write_wav(MASTER/f'{name}.wav',mix)
    preview=mix[:24*RATE].copy()
    preview[:round(.025*RATE)]*=np.linspace(0,1,round(.025*RATE))[:,None]
    preview[-RATE:]*=np.linspace(1,0,RATE)[:,None]
    write_wav(OUT/f'{name}-preview.wav',preview)
    return {'file':name,'bpm':bpm,'bars':32,'duration':length/RATE,'sampleRate':RATE,'peakDbfs':round(20*np.log10(peak),2),'rmsDbfs':round(20*np.log10(np.sqrt(np.mean(mix**2))),2),'loopEdgeDelta':round(seam,6),'previewSeconds':24}

results=[render(128,False),render(104,True)]
(OUT/'music-metrics.json').write_text(json.dumps(results,indent=2)+'\n')
for result in results: print(json.dumps(result))
