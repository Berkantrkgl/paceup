import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';

import { COLORS } from '@/constants/Colors';

const progress = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('week'); // week, month, all

  // Simülasyon verileri
  const userProgress = {
    totalWorkouts: 47,
    completedWorkouts: 32,
    totalDistance: 187.5, // km
    startingDistance: 3, // km
    currentDistance: 8, // km
    daysInProgram: 45,
    programStartDate: '15 Eylül 2024',
    currentWeek: 7,
    totalWeeks: 16,
    averagePace: '5:45', // dk/km
    bestPace: '5:12', // dk/km
    totalTime: 1240, // dakika
    streak: 12, // ardışık gün
    longestStreak: 15,
    caloriesBurned: 15420,
  };

  // Haftalık mesafe verileri
  const weeklyDistanceData = {
    labels: ['Hf 1', 'Hf 2', 'Hf 3', 'Hf 4', 'Hf 5', 'Hf 6', 'Hf 7'],
    datasets: [{
      data: [12, 15, 18, 20, 22, 25, 28],
      color: (opacity = 1) => `rgba(255, 107, 107, ${opacity})`,
      strokeWidth: 3
    }]
  };

  // Tempo gelişimi
  const paceData = {
    labels: ['Hf 1', 'Hf 2', 'Hf 3', 'Hf 4', 'Hf 5', 'Hf 6', 'Hf 7'],
    datasets: [{
      data: [6.5, 6.3, 6.1, 5.9, 5.8, 5.7, 5.45],
      color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
      strokeWidth: 3
    }]
  };

  const completionPercentage = Math.round((userProgress.completedWorkouts / userProgress.totalWorkouts) * 100);
  const programProgress = Math.round((userProgress.currentWeek / userProgress.totalWeeks) * 100);
  const distanceImprovement = Math.round(((userProgress.currentDistance - userProgress.startingDistance) / userProgress.startingDistance) * 100);

  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}s ${mins}dk`;
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Stats */}
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>İlerleme Özeti</Text>
          <Text style={styles.heroSubtitle}>{userProgress.programStartDate} tarihinden beri</Text>
          
          <View style={styles.heroStatsContainer}>
            <View style={styles.heroStatCard}>
              <View style={styles.heroStatIconContainer}>
                <Ionicons name="flame" size={32} color="#FF6B6B" />
              </View>
              <Text style={styles.heroStatValue}>{userProgress.daysInProgram}</Text>
              <Text style={styles.heroStatLabel}>Gün Aktif</Text>
            </View>

            <View style={styles.heroStatCard}>
              <View style={styles.heroStatIconContainer}>
                <Ionicons name="navigate" size={32} color="#4ECDC4" />
              </View>
              <Text style={styles.heroStatValue}>{userProgress.totalDistance}</Text>
              <Text style={styles.heroStatLabel}>Toplam KM</Text>
            </View>

            <View style={styles.heroStatCard}>
              <View style={styles.heroStatIconContainer}>
                <Ionicons name="trophy" size={32} color="#FFD93D" />
              </View>
              <Text style={styles.heroStatValue}>{userProgress.completedWorkouts}</Text>
              <Text style={styles.heroStatLabel}>Antrenman</Text>
            </View>
          </View>
        </View>

        {/* Program Progress */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Program İlerlemesi</Text>
          
          <View style={styles.card}>
            <View style={styles.progressHeader}>
              <View style={styles.progressInfo}>
                <Text style={styles.progressWeek}>Hafta {userProgress.currentWeek}/{userProgress.totalWeeks}</Text>
                <Text style={styles.progressPercentage}>{programProgress}% Tamamlandı</Text>
              </View>
              <View style={styles.progressCircle}>
                <Text style={styles.progressCircleText}>{programProgress}%</Text>
              </View>
            </View>

            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBar, { width: `${programProgress}%` }]} />
            </View>

            <View style={styles.workoutStats}>
              <View style={styles.workoutStat}>
                <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                <Text style={styles.workoutStatText}>{userProgress.completedWorkouts} Tamamlandı</Text>
              </View>
              <View style={styles.workoutStat}>
                <Ionicons name="time-outline" size={20} color="#FFA726" />
                <Text style={styles.workoutStatText}>{userProgress.totalWorkouts - userProgress.completedWorkouts} Kaldı</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Distance Progress */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mesafe Gelişimi</Text>
          
          <View style={styles.card}>
            <View style={styles.improvementContainer}>
              <View style={styles.improvementItem}>
                <Text style={styles.improvementLabel}>Başlangıç</Text>
                <Text style={styles.improvementValue}>{userProgress.startingDistance} km</Text>
              </View>

              <View style={styles.improvementArrow}>
                <Ionicons name="arrow-forward" size={32} color={COLORS.accent} />
                <View style={styles.improvementBadge}>
                  <Text style={styles.improvementBadgeText}>+{distanceImprovement}%</Text>
                </View>
              </View>

              <View style={styles.improvementItem}>
                <Text style={styles.improvementLabel}>Şu An</Text>
                <Text style={styles.improvementValue}>{userProgress.currentDistance} km</Text>
              </View>
            </View>

            <View style={styles.chartContainer}>
              <Text style={styles.chartTitle}>Haftalık Mesafe Grafiği</Text>
              <LineChart
                data={weeklyDistanceData}
                width={Dimensions.get('window').width - 80}
                height={200}
                chartConfig={{
                  backgroundColor: COLORS.card,
                  backgroundGradientFrom: COLORS.card,
                  backgroundGradientTo: COLORS.card,
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(255, 107, 107, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                  style: {
                    borderRadius: 16,
                  },
                  propsForDots: {
                    r: '6',
                    strokeWidth: '2',
                    stroke: COLORS.accent,
                  },
                }}
                bezier
                style={styles.chart}
              />
            </View>
          </View>
        </View>

        {/* Pace Progress */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tempo Gelişimi</Text>
          
          <View style={styles.card}>
            <View style={styles.paceStats}>
              <View style={styles.paceStatItem}>
                <Ionicons name="speedometer-outline" size={24} color="#4CAF50" />
                <Text style={styles.paceStatLabel}>Ortalama Tempo</Text>
                <Text style={styles.paceStatValue}>{userProgress.averagePace}</Text>
                <Text style={styles.paceStatUnit}>dk/km</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.paceStatItem}>
                <Ionicons name="rocket-outline" size={24} color="#FFD93D" />
                <Text style={styles.paceStatLabel}>En İyi Tempo</Text>
                <Text style={styles.paceStatValue}>{userProgress.bestPace}</Text>
                <Text style={styles.paceStatUnit}>dk/km</Text>
              </View>
            </View>

            <View style={styles.chartContainer}>
              <Text style={styles.chartTitle}>Haftalık Tempo Grafiği (dk/km)</Text>
              <LineChart
                data={paceData}
                width={Dimensions.get('window').width - 80}
                height={200}
                chartConfig={{
                  backgroundColor: COLORS.card,
                  backgroundGradientFrom: COLORS.card,
                  backgroundGradientTo: COLORS.card,
                  decimalPlaces: 1,
                  color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                  style: {
                    borderRadius: 16,
                  },
                  propsForDots: {
                    r: '6',
                    strokeWidth: '2',
                    stroke: '#4CAF50',
                  },
                }}
                bezier
                style={styles.chart}
              />
            </View>
          </View>
        </View>

        {/* Additional Stats Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Diğer İstatistikler</Text>
          
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Ionicons name="time" size={28} color={COLORS.accent} />
              <Text style={styles.statCardValue}>{formatTime(userProgress.totalTime)}</Text>
              <Text style={styles.statCardLabel}>Toplam Süre</Text>
            </View>

            <View style={styles.statCard}>
              <Ionicons name="flash" size={28} color="#FF6B6B" />
              <Text style={styles.statCardValue}>{userProgress.streak}</Text>
              <Text style={styles.statCardLabel}>Günlük Seri</Text>
            </View>

            <View style={styles.statCard}>
              <Ionicons name="flame" size={28} color="#FFA726" />
              <Text style={styles.statCardValue}>{userProgress.caloriesBurned}</Text>
              <Text style={styles.statCardLabel}>Kalori</Text>
            </View>

            <View style={styles.statCard}>
              <Ionicons name="star" size={28} color="#FFD93D" />
              <Text style={styles.statCardValue}>{userProgress.longestStreak}</Text>
              <Text style={styles.statCardLabel}>En Uzun Seri</Text>
            </View>
          </View>
        </View>

        {/* Achievements Preview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Son Başarılar</Text>
          
          <View style={styles.achievementsContainer}>
            <View style={styles.achievementCard}>
              <View style={styles.achievementIcon}>
                <Ionicons name="medal" size={32} color="#FFD93D" />
              </View>
              <View style={styles.achievementContent}>
                <Text style={styles.achievementTitle}>İlk 50 KM</Text>
                <Text style={styles.achievementDescription}>50 km mesafe tamamladın!</Text>
              </View>
            </View>

            <View style={styles.achievementCard}>
              <View style={styles.achievementIcon}>
                <Ionicons name="trophy" size={32} color="#4ECDC4" />
              </View>
              <View style={styles.achievementContent}>
                <Text style={styles.achievementTitle}>Hafta Şampiyonu</Text>
                <Text style={styles.achievementDescription}>7 gün üst üste antrenman!</Text>
              </View>
            </View>

            <View style={styles.achievementCard}>
              <View style={styles.achievementIcon}>
                <Ionicons name="rocket" size={32} color="#FF6B6B" />
              </View>
              <View style={styles.achievementContent}>
                <Text style={styles.achievementTitle}>Hız Canavarı</Text>
                <Text style={styles.achievementDescription}>5:00/km altı tempo!</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Alt boşluk */}
        <View style={{ height: 30 }} />

      </ScrollView>
    </View>
  );
};

export default progress;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },

  // Hero Section
  heroSection: {
    backgroundColor: COLORS.card,
    paddingHorizontal: 20,
    paddingVertical: 30,
    borderRadius: 30,
    marginBottom: 20,
  },
  heroTitle: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  heroSubtitle: {
    color: '#B0B0B0',
    fontSize: 14,
    marginBottom: 25,
  },
  heroStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
  },
  heroStatCard: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 15,
    padding: 15,
    alignItems: 'center',
  },
  heroStatIconContainer: {
    marginBottom: 10,
  },
  heroStatValue: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  heroStatLabel: {
    color: '#B0B0B0',
    fontSize: 12,
  },

  // Section
  section: {
    paddingHorizontal: 20,
    marginBottom: 25,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 15,
  },

  // Card
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },

  // Progress
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  progressInfo: {
    flex: 1,
  },
  progressWeek: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  progressPercentage: {
    color: '#B0B0B0',
    fontSize: 14,
  },
  progressCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.background,
    borderWidth: 4,
    borderColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressCircleText: {
    color: COLORS.accent,
    fontSize: 16,
    fontWeight: 'bold',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: COLORS.background,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 15,
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: 4,
  },
  workoutStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  workoutStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  workoutStatText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },

  // Improvement
  improvementContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  improvementItem: {
    alignItems: 'center',
  },
  improvementLabel: {
    color: '#B0B0B0',
    fontSize: 12,
    marginBottom: 8,
  },
  improvementValue: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: 'bold',
  },
  improvementArrow: {
    alignItems: 'center',
  },
  improvementBadge: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  improvementBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },

  // Chart
  chartContainer: {
    alignItems: 'center',
  },
  chartTitle: {
    color: '#B0B0B0',
    fontSize: 14,
    marginBottom: 15,
    textAlign: 'center',
  },
  chart: {
    borderRadius: 16,
  },

  // Pace Stats
  paceStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 25,
  },
  paceStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  paceStatLabel: {
    color: '#B0B0B0',
    fontSize: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  paceStatValue: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: 'bold',
  },
  paceStatUnit: {
    color: '#B0B0B0',
    fontSize: 12,
    marginTop: 4,
  },
  divider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 15,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.card,
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  statCardValue: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 5,
  },
  statCardLabel: {
    color: '#B0B0B0',
    fontSize: 12,
    textAlign: 'center',
  },

  // Achievements
  achievementsContainer: {
    gap: 12,
  },
  achievementCard: {
    backgroundColor: COLORS.card,
    borderRadius: 15,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  achievementIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  achievementContent: {
    flex: 1,
  },
  achievementTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  achievementDescription: {
    color: '#B0B0B0',
    fontSize: 13,
  },
});