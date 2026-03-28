import { NativeModules } from 'react-native';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import RNFS from 'react-native-fs';

const { Codec2Module } = NativeModules;

// Duas instâncias separadas: uma para gravar, outra para tocar
// Evita conflito se áudio chegar enquanto o usuário ainda está ouvindo algo
const recorder = new AudioRecorderPlayer();
const player   = new AudioRecorderPlayer();

const AudioRecorder = {

  async start() {
    // Força PCM 16-bit mono 8000Hz — único formato que o Codec2 aceita
    // Sem isso o gravador retorna M4A/AAC e o encode produz lixo
    const audioSet = {
      AudioSampleRateAndroid: 8000,
      AudioChannelsAndroid:   1,        // mono
      AudioEncoderAndroid:    2,        // PCM_16BIT = 2
      OutputFormatAndroid:    2,        // DEFAULT que aceita PCM
    };
    await recorder.startRecorder(
      `${RNFS.CachesDirectoryPath}/ptt_record.pcm`,
      audioSet
    );
  },

  async stopAndEncode() {
    try {
      const path = await recorder.stopRecorder();

      // Lê o PCM bruto gravado e converte para base64
      const pcmBase64 = await RNFS.readFile(path, 'base64');

      // Codec2Module.encode recebe PCM base64 e devolve bits comprimidos base64
      const encodedBase64 = await Codec2Module.encode(pcmBase64);
      return encodedBase64;
    } catch (e) {
      console.error('[AudioRecorder] Erro ao gravar/codificar:', e);
      return null;
    }
  },

  async play(pcmBase64) {
    try {
      // Salva o PCM com header WAV para que o player nativo consiga reproduzir
      // Sem o header o player não sabe interpretar os bytes crus
      const pcmBytes = Buffer.from(pcmBase64, 'base64');
      const wavPath  = `${RNFS.CachesDirectoryPath}/received_audio.wav`;

      await RNFS.writeFile(wavPath, buildWavBase64(pcmBytes), 'base64');
      await player.startPlayer(wavPath);
    } catch (e) {
      console.error('[AudioRecorder] Erro ao tocar áudio:', e);
    }
  }
};

// Monta o header WAV padrão (44 bytes) em torno do PCM bruto
// 8000 Hz, mono, 16-bit — exatamente o que o Codec2 produz
function buildWavBase64(pcmBytes) {
  const numChannels   = 1;
  const sampleRate    = 8000;
  const bitsPerSample = 16;
  const byteRate      = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign    = numChannels * (bitsPerSample / 8);
  const dataSize      = pcmBytes.length;
  const chunkSize     = 36 + dataSize;

  const header = Buffer.alloc(44);
  header.write('RIFF',                  0);
  header.writeUInt32LE(chunkSize,       4);
  header.write('WAVE',                  8);
  header.write('fmt ',                 12);
  header.writeUInt32LE(16,             16); // tamanho do bloco fmt
  header.writeUInt16LE(1,              20); // PCM = 1
  header.writeUInt16LE(numChannels,    22);
  header.writeUInt32LE(sampleRate,     24);
  header.writeUInt32LE(byteRate,       28);
  header.writeUInt16LE(blockAlign,     32);
  header.writeUInt16LE(bitsPerSample,  34);
  header.write('data',                 36);
  header.writeUInt32LE(dataSize,       40);

  return Buffer.concat([header, pcmBytes]).toString('base64');
}

export default AudioRecorder;
