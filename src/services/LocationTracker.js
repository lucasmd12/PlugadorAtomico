import { NativeModules, NativeEventEmitter } from 'react-native';

const { SmsSender } = NativeModules;

let intervalId = null;

// Inicia o envio periódico da localização via SMS
// intervalMs pode ser 15000 (15s), 60000 (1min), 3600000 (1h), etc.
export function startTracking({ targetPhone, intervalMs = 15000, onMyLocation }) {
  stopTracking(); // garante que não tem dois timers rodando

  // Escuta atualizações da própria localização para atualizar o mapa local
  const emitter = new NativeEventEmitter();
  const sub = emitter.addListener('MY_LOCATION_UPDATED', onMyLocation);

  // O GpsService.kt cuida do envio via SMS — aqui só iniciamos o serviço
  NativeModules.GpsModule?.startService({ targetPhone, intervalMs });

  return () => {
    sub.remove();
    stopTracking();
  };
}

export function stopTracking() {
  NativeModules.GpsModule?.stopService();
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

// Envia a localização atual uma única vez (botão "enviar local agora")
export async function sendLocationOnce(targetPhone) {
  return new Promise((resolve, reject) => {
    const emitter = new NativeEventEmitter();
    // Escuta a próxima atualização de localização e envia só ela
    const sub = emitter.addListener('MY_LOCATION_UPDATED', async ({ lat, lng }) => {
      sub.remove();
      try {
        await SmsSender.sendLocation(targetPhone, lat, lng);
        resolve({ lat, lng });
      } catch (e) {
        reject(e);
      }
    });
    // Solicita uma leitura única do GPS
    NativeModules.GpsModule?.requestSingleUpdate();
  });
}
