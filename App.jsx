import React, { useState, useEffect } from 'react';
import SetupScreen   from './src/screens/SetupScreen';
import HomeScreen    from './src/screens/HomeScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import { initDatabase, getSavedContactPhone, saveContactPhone } from './src/services/Database';

export default function App() {
  const [ready,       setReady]       = useState(false);
  const [targetPhone, setTargetPhone] = useState(null);
  const [screen,      setScreen]      = useState('home');

  useEffect(() => {
    initDatabase()
      .then(() => getSavedContactPhone())
      .then(phone => {
        if (phone) setTargetPhone(phone);
        setReady(true);
      })
      .catch(() => setReady(true));
  }, []);

  async function handleSetupComplete(phone) {
    await saveContactPhone(phone);
    setTargetPhone(phone);
  }

  if (!ready) return null;

  if (!targetPhone) {
    return <SetupScreen onSetupComplete={handleSetupComplete} />;
  }
  if (screen === 'profile') {
    return <ProfileScreen onBack={() => setScreen('home')} />;
  }
  return (
    <HomeScreen
      targetPhone={targetPhone}
      onOpenProfile={() => setScreen('profile')}
    />
  );
}
