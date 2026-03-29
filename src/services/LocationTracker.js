import { NativeModules, DeviceEventEmitter } from 'react-native';
import { getSavedSubscriptionId } from './Database';

const { GpsModule, SmsSender } = NativeModules;

let intervalId = null;

export function startTracking({ targetPhone, intervalMs = 15000, onMyLocation, subscriptionId = -1 }) {
  stopTracking();

  const sub = DeviceEventEmitter.addListener('MY_LOCATION_UPDATED', onMyLocation);

  GpsModule?.startService({ targetPhone, intervalMs, subscriptionId });

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
  const subscriptionId = await getSavedSubscriptionId();

  return new Promise((resolve, reject) => {
    const sub = DeviceEventEmitter.addListener('MY_LOCATION_UPDATED', async ({ lat, lng }) => {
      sub.remove();
      try {
        await SmsSender.sendLocation(targetPhone, lat, lng, subscriptionId);
        resolve({ lat, lng });
      } catch (e) {
        reject(e);
      }
    });
    GpsModule?.requestSingleUpdate();
  });
}
