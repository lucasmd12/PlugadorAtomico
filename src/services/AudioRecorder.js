import { NativeModules } from 'react-native';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';

const { Codec2Module } = NativeModules;
const recorder = new AudioRecorderPlayer();

const AudioRecorder = {
  // Inicia gravação quando o PTT é pressionado
  async start() {
    await recorder.startRecorder();
  },

  // Para a gravação, comprime com Codec2 e retorna Base64 pronto pra enviar
  async stopAndEncode() {
    try {
      const path = await recorder.stopRecorder();
      // Lê o arquivo PCM gravado e converte pra Base64
      const RNFS = require('react-native-fs');
      const pcmBase64 = await RNFS.readFile(path, 'base64');
      // Comprime com Codec2 (1200bps) — resultado cabe num SMS
      const encodedBase64 = await Codec2Module.encode(pcmBase64);
      return encodedBase64;
    } catch (e) {
      console.error('Erro ao gravar/codificar:', e);
      return null;
    }
  },

  // Toca áudio recebido — descompressão já foi feita pelo MessageRouter
  async play(pcmBase64) {
    try {
      const RNFS = require('react-native-fs');
      const path = `${RNFS.CachesDirectoryPath}/received_audio.pcm`;
      await RNFS.writeFile(path, pcmBase64, 'base64');
      await recorder.startPlayer(path);
    } catch (e) {
      console.error('Erro ao tocar áudio:', e);
    }
  }
};

export default AudioRecorder;
