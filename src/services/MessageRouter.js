import { NativeEventEmitter, NativeModules } from 'react-native';
import {
  saveMessage, saveChunk, tryReassemble,
  saveLocation, markMessageRead,
} from './Database';

const { SmsSender, SmsModule } = NativeModules;

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function initMessageRouter({ onText, onVoice, onGps }) {
  // DeviceEventEmitter direto — evita o bug do NativeEventEmitter sem addListener
  const { DeviceEventEmitter } = require('react-native');

  const subscription = DeviceEventEmitter.addListener('SMS_RECEIVED', (event) => {
    handleIncoming(event.body, event.sender, { onText, onVoice, onGps });
  });

  SmsModule?.getPendingMessages().then(pending => {
    pending?.forEach(msg =>
      handleIncoming(msg.body, msg.sender, { onText, onVoice, onGps })
    );
  });

  return () => subscription.remove();
}

export function initSentListener() {
  const { DeviceEventEmitter } = require('react-native');

  const subscription = DeviceEventEmitter.addListener('SMS_SENT', async (event) => {
    const id = generateId();
    await saveMessage({
      id,
      type:      event.type,
      direction: 'sent',
      payload:   event.payload ?? null,
      lat:       event.lat    ?? null,
      lng:       event.lng    ?? null,
      status:    event.status,
    });

    if (event.type === 'GPS' && event.status === 'sent') {
      await saveLocation({ direction: 'sent', lat: event.lat, lng: event.lng });
    }
  });

  return () => subscription.remove();
}

async function handleIncoming(body, sender, { onText, onVoice, onGps }) {
  if (body.startsWith('[MSG]')) {
    const text = body.replace('[MSG]', '');
    const id   = generateId();
    await saveMessage({ id, type: 'MSG', direction: 'received', payload: text, status: 'received' });
    onText({ id, text, sender });

  } else if (body.startsWith('[VOZ]')) {
    const raw = body.replace('[VOZ]', '');
    await handleChunked(raw, 'VOZ', async (payload) => {
      const id = generateId();
      await saveMessage({ id, type: 'VOZ', direction: 'received', payload, status: 'received' });
      onVoice({ id, audioBase64: payload, sender });
    });

  } else if (body.startsWith('[GPS]')) {
    const raw = body.replace('[GPS]', '');
    const [lat, lng] = raw.split(',').map(parseFloat);
    const id = generateId();
    await saveMessage({ id, type: 'GPS', direction: 'received', lat, lng, status: 'received' });
    await saveLocation({ direction: 'received', lat, lng });
    onGps({ id, lat, lng, sender });

  } else if (body.startsWith('[IMG]')) {
    const raw = body.replace('[IMG]', '');
    await handleChunked(raw, 'IMG', async (payload) => {
      const id = generateId();
      await saveMessage({ id, type: 'IMG', direction: 'received', payload, status: 'received' });
    });
  }
}

async function handleChunked(raw, type, onComplete) {
  if (!raw.startsWith('id=')) {
    await onComplete(raw);
    return;
  }
  const [idPart, seqPart, ...rest] = raw.split('|');
  const messageId = idPart.replace('id=', '');
  const [seqStr, totalStr] = seqPart.replace('seq=', '').split('/');
  const seq   = parseInt(seqStr, 10);
  const total = parseInt(totalStr, 10);
  const data  = rest.join('|');

  await saveChunk({ messageId, seq, total, data });
  const reassembled = await tryReassemble(messageId);
  if (reassembled !== null) await onComplete(reassembled);
}

export async function markAsRead(messageId) {
  await markMessageRead(messageId);
}
