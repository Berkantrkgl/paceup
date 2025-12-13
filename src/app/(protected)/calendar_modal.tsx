import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View
} from 'react-native';

import { COLORS } from '@/constants/Colors';

const calendar_modal = () => {
  const [selectedDay, setSelectedDay] = useState(3); // Varsayılan olarak 14 Ekim seçili

  // Haftalık takvim verileri
  const weekDays = [
    { day: 'Pzt', date: 12, hasWorkout: true },
    { day: 'Sal', date: 13, hasWorkout: false },
    { day: 'Çar', date: 14, hasWorkout: true }, // Bugün
    { day: 'Per', date: 15, hasWorkout: false },
    { day: 'Cum', date: 16, hasWorkout: true },
    { day: 'Cmt', date: 17, hasWorkout: false },
    { day: 'Paz', date: 18, hasWorkout: false },
  ];

  // Seçili günün antrenman detayları
  const workoutDetails = {
    title: '5K Hafif Tempolu',
    time: '07:00 - 07:45',
    duration: '45 dakika',
    distance: '5 km',
    pace: '5:30 /km',
    type: 'Tempo Koşusu',
    description: 'Rahat bir tempo ile 5 kilometrelik koşu. Isınma ve soğuma hareketlerini ihmal etme.',
    warmup: '10 dakika yavaş koşu',
    main: '25 dakika tempo koşusu',
    cooldown: '10 dakika soğuma',
  };

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="light-content" />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Haftalık Takvim */}
        <View style={styles.section}>
          <View style={styles.calendarHeader}>
            <Text style={styles.sectionTitle}>Ekim 2024</Text>
            <Pressable 
              style={styles.fullCalendarButton}
              onPress={() => router.push('/calendar')}
            >
              <Text style={styles.fullCalendarButtonText}>Tüm Takvim</Text>
              <Ionicons name="calendar-outline" size={18} color={COLORS.accent} />
            </Pressable>
          </View>

          <View style={styles.weekContainer}>
            {weekDays.map((item, index) => (
              <Pressable
                key={index}
                style={[
                  styles.dayCard,
                  selectedDay === index && styles.dayCardSelected,
                  item.hasWorkout && styles.dayCardWithWorkout
                ]}
                onPress={() => setSelectedDay(index)}
              >
                <Text style={[
                  styles.dayText,
                  selectedDay === index && styles.dayTextSelected
                ]}>
                  {item.day}
                </Text>
                <Text style={[
                  styles.dateText,
                  selectedDay === index && styles.dateTextSelected
                ]}>
                  {item.date}
                </Text>
                {item.hasWorkout && (
                  <View style={[
                    styles.workoutDot,
                    selectedDay === index && styles.workoutDotSelected
                  ]} />
                )}
              </Pressable>
            ))}
          </View>
        </View>

        {/* Antrenman Detayları */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Antrenman Detayları</Text>
          
          {/* Ana Bilgi Kartı */}
          <View style={styles.workoutCard}>
            <View style={styles.workoutHeader}>
              <View style={styles.iconCircle}>
                <Ionicons name="fitness" size={28} color={COLORS.accent} />
              </View>
              <View style={styles.workoutHeaderText}>
                <Text style={styles.workoutTitle}>{workoutDetails.title}</Text>
                <Text style={styles.workoutTime}>
                  <Ionicons name="time-outline" size={14} color="#B0B0B0" /> {workoutDetails.time}
                </Text>
              </View>
              <View style={styles.typeTag}>
                <Text style={styles.typeTagText}>{workoutDetails.type}</Text>
              </View>
            </View>

            {/* İstatistikler */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Ionicons name="timer-outline" size={24} color={COLORS.accent} />
                <Text style={styles.statLabel}>Süre</Text>
                <Text style={styles.statValue}>{workoutDetails.duration}</Text>
              </View>
              
              <View style={styles.statDivider} />
              
              <View style={styles.statBox}>
                <Ionicons name="navigate-outline" size={24} color={COLORS.accent} />
                <Text style={styles.statLabel}>Mesafe</Text>
                <Text style={styles.statValue}>{workoutDetails.distance}</Text>
              </View>
              
              <View style={styles.statDivider} />
              
              <View style={styles.statBox}>
                <Ionicons name="speedometer-outline" size={24} color={COLORS.accent} />
                <Text style={styles.statLabel}>Tempo</Text>
                <Text style={styles.statValue}>{workoutDetails.pace}</Text>
              </View>
            </View>
          </View>

          {/* Açıklama */}
          <View style={styles.infoCard}>
            <View style={styles.infoCardHeader}>
              <Ionicons name="information-circle" size={22} color={COLORS.accent} />
              <Text style={styles.infoCardTitle}>Açıklama</Text>
            </View>
            <Text style={styles.infoCardText}>{workoutDetails.description}</Text>
          </View>

          {/* Antrenman Planı */}
          <View style={styles.infoCard}>
            <View style={styles.infoCardHeader}>
              <Ionicons name="list" size={22} color={COLORS.accent} />
              <Text style={styles.infoCardTitle}>Antrenman Planı</Text>
            </View>
            
            <View style={styles.planItem}>
              <View style={styles.planBullet}>
                <Text style={styles.planNumber}>1</Text>
              </View>
              <View style={styles.planContent}>
                <Text style={styles.planTitle}>Isınma</Text>
                <Text style={styles.planText}>{workoutDetails.warmup}</Text>
              </View>
            </View>

            <View style={styles.planItem}>
              <View style={styles.planBullet}>
                <Text style={styles.planNumber}>2</Text>
              </View>
              <View style={styles.planContent}>
                <Text style={styles.planTitle}>Ana Antrenman</Text>
                <Text style={styles.planText}>{workoutDetails.main}</Text>
              </View>
            </View>

            <View style={styles.planItem}>
              <View style={styles.planBullet}>
                <Text style={styles.planNumber}>3</Text>
              </View>
              <View style={styles.planContent}>
                <Text style={styles.planTitle}>Soğuma</Text>
                <Text style={styles.planText}>{workoutDetails.cooldown}</Text>
              </View>
            </View>
          </View>

          {/* Aksiyon Butonları */}
          <View style={styles.actionButtons}>
            <Pressable style={styles.primaryButton}>
              <Ionicons name="play" size={22} color="white" style={{marginRight: 8}} />
              <Text style={styles.primaryButtonText}>Antrenmana Başla</Text>
            </Pressable>

            <View style={styles.secondaryButtonsRow}>
              <Pressable style={styles.secondaryButton}>
                <Ionicons name="create-outline" size={22} color={COLORS.accent} />
                <Text style={styles.secondaryButtonText}>Düzenle</Text>
              </Pressable>

              <Pressable style={styles.secondaryButton}>
                <Ionicons name="share-social-outline" size={22} color={COLORS.accent} />
                <Text style={styles.secondaryButtonText}>Paylaş</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Alt boşluk */}
        <View style={{height: 30}} />

      </ScrollView>
    </View>
  );
};

export default calendar_modal;

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 20,
    marginTop: 15,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 14,
  },

  // Calendar Header
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  fullCalendarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  fullCalendarButtonText: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: '600',
  },

  // Week Calendar
  weekContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  dayCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dayCardSelected: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  dayCardWithWorkout: {
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  dayText: {
    color: '#B0B0B0',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  dayTextSelected: {
    color: 'white',
  },
  dateText: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  dateTextSelected: {
    color: 'white',
  },
  workoutDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.accent,
    marginTop: 6,
  },
  workoutDotSelected: {
    backgroundColor: 'white',
  },

  // Workout Card
  workoutCard: {
    backgroundColor: COLORS.card,
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  workoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    backgroundColor: COLORS.background,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  workoutHeaderText: {
    flex: 1,
  },
  workoutTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  workoutTime: {
    color: '#B0B0B0',
    fontSize: 14,
  },
  typeTag: {
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  typeTagText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '600',
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 15,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    color: '#B0B0B0',
    fontSize: 12,
    marginTop: 6,
    marginBottom: 2,
  },
  statValue: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(176, 176, 176, 0.2)',
  },

  // Info Card
  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 15,
    padding: 18,
    marginBottom: 15,
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  infoCardTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  infoCardText: {
    color: '#B0B0B0',
    fontSize: 14,
    lineHeight: 22,
  },

  // Plan Items
  planItem: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  planBullet: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  planNumber: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  planContent: {
    flex: 1,
  },
  planTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  planText: {
    color: '#B0B0B0',
    fontSize: 14,
    lineHeight: 20,
  },

  // Action Buttons
  actionButtons: {
    marginTop: 10,
  },
  primaryButton: {
    backgroundColor: COLORS.accent,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: COLORS.card,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  secondaryButtonText: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: '600',
  },
});