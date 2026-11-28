export type VoiceMixMode = 'together' | 'sequential';

export async function mixVideoAudio(context: AudioContext, files: File[], mode: VoiceMixMode) {
 const clips: AudioBuffer[] = [];
 for (const file of files) {
  try {
   const audio = await context.decodeAudioData(await file.arrayBuffer());
   if (!audio.length) throw Error('Empty audio');
   clips.push(audio);
  } catch {
   throw Error(file.name + 'の音声を読み込めませんでした。音声入りの動画を選んでください。');
  }
 }
 const duration = mode === 'together'
  ? Math.max(...clips.map(clip => clip.duration))
  : clips.reduce((seconds, clip) => seconds + clip.duration, 0);
 const rate = context.sampleRate;
 const renderer = new OfflineAudioContext(2, Math.ceil(duration * rate), rate);
 let offset = 0;
 for (const clip of clips) {
  const source = renderer.createBufferSource();
  source.buffer = clip;
  source.connect(renderer.destination);
  source.start(offset);
  if (mode === 'sequential') offset += clip.duration;
 }
 const mixed = await renderer.startRendering();
 const channels = Array.from({length: mixed.numberOfChannels}, (_, index) => mixed.getChannelData(index));
 let peak = 0;
 for (const channel of channels) {
  for (const sample of channel) peak = Math.max(peak, Math.abs(sample));
 }
 if (peak === 0) throw Error('選んだ動画から音声を確認できませんでした。');
 if (peak > .95) {
  const gain = .95 / peak;
  for (const channel of channels) {
   for (let i = 0; i < channel.length; i++) channel[i] *= gain;
  }
 }
 return mixed;
}
