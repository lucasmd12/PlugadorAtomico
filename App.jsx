import React, { useState, useEffect } from 'react';
import SetupScreen   from './src/screens/SetupScreen';
import HomeScreen    from './src/screens/HomeScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import { initDatabase } from './src/services/Database';

export default function App() {
  const [ready,       setReady]       = useState(false);
  const [targetPhone, setTargetPhone] = useState(null);
  const [screen,      setScreen]      = useState('home');

  useEffect(() => {
    initDatabase()
      .then(() => setReady(true))
      .catch(e => {
        console.error('Erro ao iniciar banco:', e);
        setReady(true); // mostra o app mesmo se o banco falhar
      });
  }, []);

  if (!ready) return null; // tela preta enquanto inicializa — rápido

  if (!targetPhone) return <SetupScreen onSetupComplete={setTargetPhone} />;
  if (screen === 'profile') return <ProfileScreen onBack={() => setScreen('home')} />;

  return <HomeScreen targetPhone={targetPhone} onOpenProfile={() => setScreen('profile')} />;
}
