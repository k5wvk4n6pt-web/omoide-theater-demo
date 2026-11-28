export type VoiceMixMode = 'together' | 'sequential';

async function decodeVideoAudio(context: AudioContext, file: File) {
 try {
  return await context.decodeAudioData(await file.arrayBuffer());
 } catch {
  // Some browsers cannot decode a MOV directly, even when its audio track is supported.
 }
 const {Input, BlobSource, ALL_FORMATS, Conversion, Output, BufferTarget, Mp4OutputFormat, WavOutputFormat} = await import('mediabunny');
 const input = new Input({source: new BlobSource(file), formats: ALL_FORMATS});
 try {
  if (!await input.getPrimaryAudioTrack()) throw Error('音声トラックがありません。');
  for (const format of [new Mp4OutputFormat(), new WavOutputFormat()]) {
   try {
    const target = new BufferTarget();
    const conversion = await Conversion.init({
     input, output: new Output({format, target}), video: {discard: true},
     tracks: 'primary', showWarnings: false,
    });
    if (!conversion.isValid) continue;
    await conversion.execute();
    if (target.buffer) return await context.decodeAudioData(target.buffer);
   } catch {
    // Try the other audio container before reporting a format error.
   }
  }
  throw Error('このブラウザで音声形式を読み込めませんでした。');
 } finally {
  input.dispose();
 }
}

export async function mixVideoAudio(context: AudioContext, files: File[], mode: VoiceMixMode) {
 const clips: AudioBuffer[] = [];
 for (const file of files) {
  try {
   const audio = await decodeVideoAudio(context, file);
   if (!audio.length) throw Error('音声データが空です。');
   clips.push(audio);
  } catch (error) {
   throw Error(file.name + '：' + (error instanceof Error?error.message:'音声を読み込めませんでした。'));
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
