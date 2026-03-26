import { NativeEventEmitter, NativeModules } from 'react-native';

const { SmsModule } = NativeModules;

export function initMessageRouter({ onText, onVoice, onGps }) {
  const emitter = new NativeEventEmitter(NativeModules.SmsSender);

  // Escuta SMS chegando em tempo real (app aberto)
  const subscription = emitter.addListener('SMS_RECEIVED', (event) => {
    routeMessage(event.body, event.sender, { onText, onVoice, onGps });
  });

  // Busca mensagens que chegaram enquanto o app estava fechado
  SmsModule?.getPendingMessages().then(pending => {
    pending.forEach(msg => routeMessage(msg.body, msg.sender, { onText, onVoice, onGps }));
  });

  return () => subscription.remove();
}

// Função central de roteamento — classifica a mensagem pelo prefixo
function routeMessage(body, sender, { onText, onVoice, onGps }) {
  if (body.startsWith('[MSG]')) {
    onText({ text: body.replace('[MSG]', ''), sender });

  } else if (body.startsWith('[VOZ]')) {
    onVoice({ audioBase64: body.replace('[VOZ]', ''), sender });

  } else if (body.startsWith('[GPS]')) {
    const coords = body.replace('[GPS]', '').split(',');
    onGps({
      lat: parseFloat(coords[0]),
      lng: parseFloat(coords[1]),
      sender
    });
  }
}
