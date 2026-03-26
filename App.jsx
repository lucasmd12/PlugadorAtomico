import React, { useState } from 'react';
import SetupScreen from './src/screens/SetupScreen';
import HomeScreen from './src/screens/HomeScreen';

export default function App() {
  const [targetPhone, setTargetPhone] = useState(null);

  if (!targetPhone) {
    return <SetupScreen onSetupComplete={setTargetPhone} />;
  }

  return <HomeScreen targetPhone={targetPhone} />;
}
