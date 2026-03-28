import { NativeEventEmitter, NativeModules } from 'react-native';
import {
  saveMessage,
  saveChunk,
  tryReassemble,
  saveLocation,
  markMessageRead,
  updateMessageStatus,
} from './Database';

const { SmsModule } = NativeModules;

// Gera um ID único para cada mensagem local
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function initMessageRouter({ onText, onVoice, onGps }) {
  const emitter = new NativeEventEmitter(NativeModules.SmsSender);

  const subscription = emitter.addListener('SMS_RECEIVED', (event) => {
    handleIncoming(event.body, event.sender, { onText, onVoice, onGps });
  });

  // Entrega mensagens que chegaram com o app fechado
  SmsModule?.getPendingMessages().then(pending => {
    pending.forEach(msg =>
      handleIncoming(msg.body, msg.sender, { onText, onVoice, onGps })
    );
  });

  return () => subscription.remove();
}

async function handleIncoming(body, sender, { onText, onVoice, onGps }) {
  // Mensagem simples de texto
  if (body.startsWith('[MSG]')) {
    const text = body.replace('[MSG]', '');
    const id = generateId();
    await saveMessage({ id, type: 'MSG', direction: 'received', payload: text, status: 'received' });
    onText({ id, text, sender });

  // Áudio fragmentado — pode chegar em vários SMS
  } else if (body.startsWith('[VOZ]')) {
    const raw = body.replace('[VOZ]', '');
    await handleChunked(raw, 'VOZ', async (payload) => {
      const id = generateId();
      await saveMessage({ id, type: 'VOZ', direction: 'received', payload, status: 'received' });
      onVoice({ id, audioBase64: payload, sender });
    });

  // Localização pontual
  } else if (body.startsWith('[GPS]')) {
    const raw = body.replace('[GPS]', '');
    const [lat, lng] = raw.split(',').map(parseFloat);
    const id = generateId();
    await saveMessage({ id, type: 'GPS', direction: 'received', lat, lng, status: 'received' });
    await saveLocation({ direction: 'received', lat, lng });
    onGps({ id, lat, lng, sender });

  // Imagem de perfil fragmentada
  } else if (body.startsWith('[IMG]')) {
    const raw = body.replace('[IMG]', '');
    await handleChunked(raw, 'IMG', async (payload) => {
      const id = generateId();
      await saveMessage({ id, type: 'IMG', direction: 'received', payload, status: 'received' });
    });
  }
}

// Lida com mensagens que podem chegar em múltiplos SMS
// Formato esperado: id=abc|seq=1/3|dados...
async function handleChunked(raw, type, onComplete) {
  const isChunked = raw.startsWith('id=');

  if (!isChunked) {
    // Mensagem pequena que coube em um único SMS — processa direto
    await onComplete(raw);
    return;
  }

  // Extrai cabeçalho: id=abc|seq=1/3|payload
  const [idPart, seqPart, ...rest] = raw.split('|');
  const messageId = idPart.replace('id=', '');
  const [seqStr, totalStr] = seqPart.replace('seq=', '').split('/');
  const seq   = parseInt(seqStr, 10);
  const total = parseInt(totalStr, 10);
  const data  = rest.join('|');

  await saveChunk({ messageId, seq, total, data });

  // Tenta remontar — retorna null se ainda faltam partes
  const reassembled = await tryReassemble(messageId);
  if (reassembled !== null) {
    await onComplete(reassembled);
  }
}

// Marca uma mensagem como lida quando o usuário abre o chat
export async function markAsRead(messageId) {
  await markMessageRead(messageId);
}
