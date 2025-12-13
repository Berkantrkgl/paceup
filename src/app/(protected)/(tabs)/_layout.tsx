import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

// 1. Adımda oluşturduğun dosyadan renkleri çekiyoruz
// Eğer dosyayı henüz oluşturmadıysan bu satırı silip alttaki "Local Colors"ı kullanabilirsin.
import { COLORS } from '@/constants/Colors';

/* // EĞER CONFIG DOSYASI YAPMADIYSAN BU BLOĞU AÇABİLİRSİN:
const COLORS = {
  background: '#2F2519', 
  card: '#4A3F35',       
  text: '#DDDDDD',       
  accent: '#FF4301',     
  inactive: '#9CA3AF',   
};
*/

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: COLORS.accent, // Aktif yazı rengi (Turuncu)
        tabBarInactiveTintColor: COLORS.inactive, // Pasif yazı rengi (Soluk Gri)
        
        tabBarStyle: {
          backgroundColor: COLORS.card, // Bar arkaplanı (Kart rengiyle aynı - Kahve)
          height: Platform.OS === 'ios' ? 90 : 70,
          borderTopWidth: 0, // Üst çizgiyi kaldırdık, temiz görüntü
          paddingBottom: Platform.OS === 'ios' ? 25 : 10,
          paddingTop: 10,
          // Barın üstünde hafif bir gölge olsun mu? (İsteğe bağlı, şu an kapalı/düz)
          elevation: 0, 
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        }
      }}
    >
      <Tabs.Screen 
        name='(home)' 
        options={{
          title: 'Ana Sayfa',
          tabBarIcon: ({ focused, color }) => (
            <View style={styles.iconWrapper}>
               {/* Çizgi Rengi: Accent (Turuncu) */}
              {focused && <View style={[styles.topLineIndicator, { backgroundColor: COLORS.accent }]} />}
              <Ionicons name="home" size={26} color={color} />
            </View>
          )
        }}
      />
      <Tabs.Screen 
        name='calendar' 
        options={{
          title: 'Takvim',
          tabBarIcon: ({ focused, color }) => (
            <View style={styles.iconWrapper}>
              {focused && <View style={[styles.topLineIndicator, { backgroundColor: COLORS.accent }]} />}
              <Ionicons name="calendar" size={26} color={color} />
            </View>
          )
        }}
      />
      
      {/* Planlarım Ekranı */}
      <Tabs.Screen 
        name='plans' 
        options={{
          title: 'Planlarım',
          tabBarIcon: ({ focused, color }) => (
            <View style={styles.iconWrapper}>
              {focused && <View style={[styles.topLineIndicator, { backgroundColor: COLORS.accent }]} />}
              <Ionicons name="list" size={26} color={color} />
            </View>
          ),
        }}
      />

      <Tabs.Screen 
        name='profile' 
        options={{
          title: 'Profil',
          tabBarIcon: ({ focused, color }) => (
            <View style={styles.iconWrapper}>
              {focused && <View style={[styles.topLineIndicator, { backgroundColor: COLORS.accent }]} />}
              <Ionicons name="person" size={26} color={color} />
            </View>
          )
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    width: 60,
  },
  topLineIndicator: {
    position: 'absolute',
    bottom: -21, // Senin ayarladığın o güzel konum
    width: 45,
    height: 4,
    borderRadius: 4,
    // Parlama efektini de turuncuya göre ayarlıyoruz
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  }
});