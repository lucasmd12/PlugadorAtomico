import { NativeModules, DeviceEventEmitter } from 'react-native';

const { GpsModule, SmsSender } = NativeModules;

let intervalId = null;

export function startTracking({ targetPhone, intervalMs = 15000, onMyLocation }) {
  stopTracking();

  // DeviceEventEmitter direto — sem NativeEventEmitter que quebrava
  const sub = DeviceEventEmitter.addListener('MY_LOCATION_UPDATED', onMyLocation);

  GpsModule?.startService({ targetPhone, intervalMs });

  return () => {
    sub.remove();
    stopTracking();
  };
}

export function stopTracking() {
  GpsModule?.stopService();
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export async function sendLocationOnce(targetPhone) {
  return new Promise((resolve, reject) => {
    const sub = DeviceEventEmitter.addListener('MY_LOCATION_UPDATED', async ({ lat, lng }) => {
      sub.remove();
      try {
        await SmsSender.sendLocation(targetPhone, lat, lng);
        resolve({ lat, lng });
      } catch (e) {
        reject(e);
      }
    });
    GpsModule?.requestSingleUpdate();
  });
}
