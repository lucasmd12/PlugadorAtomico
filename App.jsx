import React, { useState } from 'react';
import SetupScreen   from './src/screens/SetupScreen';
import HomeScreen    from './src/screens/HomeScreen';
import ProfileScreen from './src/screens/ProfileScreen';

export default function App() {
  const [targetPhone, setTargetPhone] = useState(null);
  const [screen,      setScreen]      = useState('home');

  if (!targetPhone) return <SetupScreen onSetupComplete={setTargetPhone} />;
  if (screen === 'profile') return <ProfileScreen onBack={() => setScreen('home')} />;

  return <HomeScreen targetPhone={targetPhone} onOpenProfile={() => setScreen('profile')} />;
}
