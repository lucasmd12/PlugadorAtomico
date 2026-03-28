import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  Image, StyleSheet, ScrollView, Alert
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { getProfile, updateProfile, saveProfileImage } from '../services/Database';

export default function ProfileScreen({ onBack }) {
  const [profile, setProfile] = useState(null);
  const [myName,       setMyName]       = useState('');
  const [contactName,  setContactName]  = useState('');
  const [saving,       setSaving]       = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const p = await getProfile();
    setProfile(p);
    setMyName(p?.my_name       ?? 'Eu');
    setContactName(p?.contact_name ?? 'Contato');
  }

  // Abre a galeria e salva a imagem escolhida no campo indicado
  async function pickImage(field) {
    launchImageLibrary({ mediaType: 'photo', quality: 0.8 }, async (response) => {
      if (response.didCancel || response.errorCode) return;

      const asset = response.assets?.[0];
      if (!asset?.uri) return;

      try {
        const savedPath = await saveProfileImage(field, asset.uri);
        setProfile(prev => ({ ...prev, [field]: savedPath }));
      } catch (e) {
        Alert.alert('Erro', 'Não foi possível salvar a imagem.');
      }
    });
  }

  async function save() {
    setSaving(true);
    try {
      await updateProfile({ my_name: myName, contact_name: contactName });
      Alert.alert('Salvo', 'Perfil atualizado com sucesso.');
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível salvar o perfil.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Text style={styles.backText}>← Voltar</Text>
      </TouchableOpacity>

      <Text style={styles.title}>⚙️ Perfil</Text>

      {/* ── Meu perfil ───────────────────────────────────────────── */}
      <Text style={styles.section}>Meu perfil</Text>

      <Text style={styles.label}>Meu nome</Text>
      <TextInput
        style={styles.input}
        value={myName}
        onChangeText={setMyName}
        placeholder="Como você quer aparecer"
        placeholderTextColor="#888"
      />

      <Text style={styles.label}>Minha foto de perfil</Text>
      <Text style={styles.hint}>Aparece no mapa e no cabeçalho do chat.</Text>
      <TouchableOpacity onPress={() => pickImage('my_avatar_path')}>
        {profile?.my_avatar_path
          ? <Image source={{ uri: profile.my_avatar_path }} style={styles.avatar} />
          : <View style={styles.avatarPlaceholder}><Text style={styles.avatarIcon}>📷</Text></View>
        }
      </TouchableOpacity>

      <Text style={styles.label}>Papel de parede do chat</Text>
      <Text style={styles.hint}>Fundo da conversa visível só para você.</Text>
      <TouchableOpacity onPress={() => pickImage('my_wallpaper_path')}>
        {profile?.my_wallpaper_path
          ? <Image source={{ uri: profile.my_wallpaper_path }} style={styles.wallpaperPreview} />
          : <View style={styles.wallpaperPlaceholder}><Text style={styles.avatarIcon}>🖼 Escolher fundo</Text></View>
        }
      </TouchableOpacity>

      {/* ── Contato ──────────────────────────────────────────────── */}
      <Text style={styles.section}>Contato</Text>

      <Text style={styles.label}>Nome do contato</Text>
      <Text style={styles.hint}>Só você vê esse nome — ele não é transmitido.</Text>
      <TextInput
        style={styles.input}
        value={contactName}
        onChangeText={setContactName}
        placeholder="Nome que você dá pra ele"
        placeholderTextColor="#888"
      />

      <Text style={styles.label}>Foto do contato</Text>
      <Text style={styles.hint}>Aparece no mapa no lugar do pin e no cabeçalho do chat.</Text>
      <TouchableOpacity onPress={() => pickImage('contact_avatar_path')}>
        {profile?.contact_avatar_path
          ? <Image source={{ uri: profile.contact_avatar_path }} style={styles.avatar} />
          : <View style={styles.avatarPlaceholder}><Text style={styles.avatarIcon}>📷</Text></View>
        }
      </TouchableOpacity>

      <Text style={styles.label}>Papel de parede do contato</Text>
      <Text style={styles.hint}>Fundo alternativo — útil para diferenciar conversas.</Text>
      <TouchableOpacity onPress={() => pickImage('contact_wallpaper_path')}>
        {profile?.contact_wallpaper_path
          ? <Image source={{ uri: profile.contact_wallpaper_path }} style={styles.wallpaperPreview} />
          : <View style={styles.wallpaperPlaceholder}><Text style={styles.avatarIcon}>🖼 Escolher fundo</Text></View>
        }
      </TouchableOpacity>

      {/* ── Salvar ───────────────────────────────────────────────── */}
      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={save}
        disabled={saving}>
        <Text style={styles.saveBtnText}>{saving ? 'Salvando...' : 'Salvar perfil'}</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:           { flex: 1, backgroundColor: '#0f0f1a' },
  content:             { padding: 24, paddingBottom: 48 },
  backBtn:             { marginBottom: 16 },
  backText:            { color: '#e94560', fontSize: 16 },
  title:               { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 24 },
  section:             { color: '#e94560', fontSize: 14, fontWeight: 'bold', marginTop: 28, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  label:               { color: '#fff', fontSize: 14, marginBottom: 4, marginTop: 16 },
  hint:                { color: '#888', fontSize: 12, marginBottom: 8 },
  input:               { backgroundColor: '#1a1a2e', color: '#fff', borderRadius: 12, padding: 14, fontSize: 15 },
  avatar:              { width: 80, height: 80, borderRadius: 40 },
  avatarPlaceholder:   { width: 80, height: 80, borderRadius: 40, backgroundColor: '#2a2a3e', alignItems: 'center', justifyContent: 'center' },
  avatarIcon:          { fontSize: 28 },
  wallpaperPreview:    { width: '100%', height: 100, borderRadius: 12 },
  wallpaperPlaceholder:{ width: '100%', height: 100, borderRadius: 12, backgroundColor: '#2a2a3e', alignItems: 'center', justifyContent: 'center' },
  saveBtn:             { backgroundColor: '#e94560', borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 36 },
  saveBtnDisabled:     { opacity: 0.5 },
  saveBtnText:         { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
