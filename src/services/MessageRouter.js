import { NativeEventEmitter, NativeModules } from 'react-native';

// Escuta todos os SMS que o SmsReceiver.kt capturou e classifica por tipo
export function initMessageRouter({ onText, onVoice, onGps }) {
  const emitter = new NativeEventEmitter(NativeModules.SmsSender);

  const subscription = emitter.addListener('SMS_RECEIVED', (event) => {
    const { body, sender } = event;

    if (body.startsWith('[MSG]')) {
      // Mensagem de texto — remove o prefixo e entrega
      onText({ text: body.replace('[MSG]', ''), sender });

    } else if (body.startsWith('[VOZ]')) {
      // Áudio comprimido em Base64 — entrega pro AudioRecorder descomprimir
      onVoice({ audioBase64: body.replace('[VOZ]', ''), sender });

    } else if (body.startsWith('[GPS]')) {
      // Coordenadas — faz parse e entrega pro mapa
      const coords = body.replace('[GPS]', '').split(',');
      onGps({
        lat: parseFloat(coords[0]),
        lng: parseFloat(coords[1]),
        sender
      });
    }
  });

  // Retorna função de cleanup para usar no useEffect
  return () => subscription.remove();
}
