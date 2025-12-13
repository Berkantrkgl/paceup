import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View
} from 'react-native';

import { COLORS } from '@/constants/Colors';

const detail_modal = () => {
  const params = useLocalSearchParams();
  const { workoutId, date, title, time, duration, type, status } = params;

  // Detaylı workout bilgileri - normalde API'den gelecek
  const [workoutDetail] = useState({
    id: workoutId,
    title: title,
    date: date,
    time: time,
    duration: duration,
    type: type,
    status: status,
    distance: '5.0 km',
    targetPace: '5:30 /km',
    notes: 'Rahat bir tempo ile koşu yapılacak. İlk 10 dakika ısınma, son 10 dakika soğuma.',
    location: 'Maçka Parkı',
    weather: '18°C, Parçalı Bulutlu',
    
    // Plan detayları
    planDetails: {
      warmup: '10 dakika yavaş koşu',
      main: '25 dakika tempo koşusu',
      cooldown: '10 dakika soğuma ve germe',
    },
    
    // Tamamlanmış ise
    actualData: status === 'completed' ? {
      completedTime: '07:15',
      actualDistance: '5.2 km',
      actualPace: '5:25 /km',
      avgHeartRate: '152 bpm',
      calories: '420 kcal',
      feeling: 'good', // good, okay, hard
    } : null,
  });

  const getWorkoutTypeInfo = (type) => {
    switch (type) {
      case 'tempo':
        return { icon: 'speedometer-outline', color: '#FF6B6B', name: 'Tempo Koşusu' };
      case 'easy':
        return { icon: 'walk-outline', color: '#4ECDC4', name: 'Kolay Koşu' };
      case 'interval':
        return { icon: 'flash-outline', color: '#FFD93D', name: 'Interval' };
      case 'long':
        return { icon: 'trending-up-outline', color: '#A569BD', name: 'Uzun Koşu' };
      case 'rest':
        return { icon: 'moon-outline', color: '#95A5A6', name: 'Dinlenme' };
      default:
        return { icon: 'fitness-outline', color: COLORS.accent, name: 'Antrenman' };
    }
  };

  const typeInfo = getWorkoutTypeInfo(type);

  const handleEditWorkout = () => {
    router.push({
      pathname: '/(protected)/chatbot_modal',
      params: {
        workoutId: workoutId,
        workoutTitle: title,
        context: 'workout'
      }
    });
  };

  const handleCompleteWorkout = () => {
    Alert.alert(
      'Antrenmanı Tamamla',
      'Bu antrenmanı tamamlandı olarak işaretlemek istiyor musunuz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Tamamla',
          onPress: () => {
            // API call to mark as completed
            router.back();
          }
        }
      ]
    );
  };

  const handleDeleteWorkout = () => {
    Alert.alert(
      'Antrenmanı Sil',
      'Bu antrenmanı silmek istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () => {
            // API call to delete
            router.back();
          }
        }
      ]
    );
  };

  const getFeelingIcon = (feeling) => {
    switch (feeling) {
      case 'good':
        return { icon: 'happy-outline', color: '#4CAF50', text: 'Harika' };
      case 'okay':
        return { icon: 'happy-outline', color: '#FFA726', text: 'İyi' };
      case 'hard':
        return { icon: 'sad-outline', color: '#FF6B6B', text: 'Zorlandım' };
      default:
        return { icon: 'remove-outline', color: '#B0B0B0', text: '-' };
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Card */}
        <View style={styles.headerCard}>
          <View style={[styles.typeIconLarge, { backgroundColor: `${typeInfo.color}20` }]}>
            <Ionicons name={typeInfo.icon} size={40} color={typeInfo.color} />
          </View>
          
          <View style={styles.headerInfo}>
            <View style={styles.headerTop}>
              <View style={[styles.typeBadge, { backgroundColor: `${typeInfo.color}20` }]}>
                <Text style={[styles.typeBadgeText, { color: typeInfo.color }]}>
                  {typeInfo.name}
                </Text>
              </View>
              {status === 'completed' && (
                <View style={styles.completedBadge}>
                  <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                  <Text style={styles.completedText}>Tamamlandı</Text>
                </View>
              )}
            </View>
            
            <Text style={styles.workoutTitle}>{workoutDetail.title}</Text>
            
            <View style={styles.dateTimeInfo}>
              <View style={styles.infoItem}>
                <Ionicons name="calendar-outline" size={16} color="#B0B0B0" />
                <Text style={styles.infoText}>
                  {new Date(date).toLocaleDateString('tr-TR', { 
                    day: 'numeric', 
                    month: 'long',
                    year: 'numeric'
                  })}
                </Text>
              </View>
              {time !== '-' && (
                <View style={styles.infoItem}>
                  <Ionicons name="time-outline" size={16} color="#B0B0B0" />
                  <Text style={styles.infoText}>{time}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Stats Grid */}
        {type !== 'rest' && (
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Ionicons name="timer-outline" size={24} color={COLORS.accent} />
              <Text style={styles.statLabel}>Süre</Text>
              <Text style={styles.statValue}>{duration}</Text>
            </View>
            
            <View style={styles.statCard}>
              <Ionicons name="navigate-outline" size={24} color={COLORS.accent} />
              <Text style={styles.statLabel}>Mesafe</Text>
              <Text style={styles.statValue}>{workoutDetail.distance}</Text>
            </View>
            
            <View style={styles.statCard}>
              <Ionicons name="speedometer-outline" size={24} color={COLORS.accent} />
              <Text style={styles.statLabel}>Hedef Tempo</Text>
              <Text style={styles.statValue}>{workoutDetail.targetPace}</Text>
            </View>
          </View>
        )}

        {/* Actual Data (if completed) */}
        {workoutDetail.actualData && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Gerçekleşen Veriler</Text>
            
            <View style={styles.actualDataCard}>
              <View style={styles.actualDataRow}>
                <View style={styles.actualDataItem}>
                  <Ionicons name="navigate" size={20} color="#4CAF50" />
                  <Text style={styles.actualDataLabel}>Mesafe</Text>
                  <Text style={styles.actualDataValue}>{workoutDetail.actualData.actualDistance}</Text>
                </View>
                
                <View style={styles.actualDataItem}>
                  <Ionicons name="speedometer" size={20} color="#4CAF50" />
                  <Text style={styles.actualDataLabel}>Tempo</Text>
                  <Text style={styles.actualDataValue}>{workoutDetail.actualData.actualPace}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.actualDataRow}>
                <View style={styles.actualDataItem}>
                  <Ionicons name="heart" size={20} color="#FF6B6B" />
                  <Text style={styles.actualDataLabel}>Nabız</Text>
                  <Text style={styles.actualDataValue}>{workoutDetail.actualData.avgHeartRate}</Text>
                </View>
                
                <View style={styles.actualDataItem}>
                  <Ionicons name="flame" size={20} color="#FFA726" />
                  <Text style={styles.actualDataLabel}>Kalori</Text>
                  <Text style={styles.actualDataValue}>{workoutDetail.actualData.calories}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.feelingSection}>
                <Text style={styles.feelingLabel}>Nasıl Hissettim?</Text>
                <View style={styles.feelingBadge}>
                  <Ionicons 
                    name={getFeelingIcon(workoutDetail.actualData.feeling).icon} 
                    size={20} 
                    color={getFeelingIcon(workoutDetail.actualData.feeling).color} 
                  />
                  <Text style={[
                    styles.feelingText,
                    { color: getFeelingIcon(workoutDetail.actualData.feeling).color }
                  ]}>
                    {getFeelingIcon(workoutDetail.actualData.feeling).text}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Plan Details */}
        {type !== 'rest' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Antrenman Planı</Text>
            
            <View style={styles.planCard}>
              <View style={styles.planItem}>
                <View style={styles.planBullet}>
                  <Text style={styles.planNumber}>1</Text>
                </View>
                <View style={styles.planContent}>
                  <Text style={styles.planTitle}>Isınma</Text>
                  <Text style={styles.planText}>{workoutDetail.planDetails.warmup}</Text>
                </View>
              </View>

              <View style={styles.planItem}>
                <View style={styles.planBullet}>
                  <Text style={styles.planNumber}>2</Text>
                </View>
                <View style={styles.planContent}>
                  <Text style={styles.planTitle}>Ana Antrenman</Text>
                  <Text style={styles.planText}>{workoutDetail.planDetails.main}</Text>
                </View>
              </View>

              <View style={styles.planItem}>
                <View style={styles.planBullet}>
                  <Text style={styles.planNumber}>3</Text>
                </View>
                <View style={styles.planContent}>
                  <Text style={styles.planTitle}>Soğuma</Text>
                  <Text style={styles.planText}>{workoutDetail.planDetails.cooldown}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notlar</Text>
          <View style={styles.notesCard}>
            <Ionicons name="document-text-outline" size={22} color={COLORS.accent} />
            <Text style={styles.notesText}>{workoutDetail.notes}</Text>
          </View>
        </View>

        {/* Additional Info */}
        {type !== 'rest' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ek Bilgiler</Text>
            
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={20} color={COLORS.accent} />
                <Text style={styles.infoLabel}>Konum</Text>
                <Text style={styles.infoValue}>{workoutDetail.location}</Text>
              </View>
              
              <View style={styles.divider} />
              
              <View style={styles.infoRow}>
                <Ionicons name="cloud-outline" size={20} color={COLORS.accent} />
                <Text style={styles.infoLabel}>Hava Durumu</Text>
                <Text style={styles.infoValue}>{workoutDetail.weather}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionSection}>
          {status !== 'completed' && (
            <>
              <Pressable style={styles.primaryButton} onPress={handleCompleteWorkout}>
                <Ionicons name="checkmark-circle-outline" size={22} color="white" />
                <Text style={styles.primaryButtonText}>Tamamlandı Olarak İşaretle</Text>
              </Pressable>

              <View style={styles.secondaryButtons}>
                <Pressable style={styles.secondaryButton} onPress={handleEditWorkout}>
                  <Ionicons name="create-outline" size={20} color={COLORS.accent} />
                  <Text style={styles.secondaryButtonText}>Düzenle</Text>
                </Pressable>

                <Pressable style={styles.deleteButton} onPress={handleDeleteWorkout}>
                  <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
                  <Text style={styles.deleteButtonText}>Sil</Text>
                </Pressable>
              </View>
            </>
          )}

          {status === 'completed' && (
            <View style={styles.secondaryButtons}>
              <Pressable style={styles.secondaryButton} onPress={handleEditWorkout}>
                <Ionicons name="create-outline" size={20} color={COLORS.accent} />
                <Text style={styles.secondaryButtonText}>Düzenle</Text>
              </Pressable>

              <Pressable style={styles.deleteButton} onPress={handleDeleteWorkout}>
                <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
                <Text style={styles.deleteButtonText}>Sil</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
};

export default detail_modal;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },

  // Header Card
  headerCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  typeIconLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 15,
  },
  headerInfo: {
    alignItems: 'center',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  typeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  completedText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '600',
  },
  workoutTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
  },
  dateTimeInfo: {
    flexDirection: 'row',
    gap: 20,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    color: '#B0B0B0',
    fontSize: 14,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 15,
    padding: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  statLabel: {
    color: '#B0B0B0',
    fontSize: 11,
    marginTop: 8,
    marginBottom: 4,
    textAlign: 'center',
  },
  statValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  // Section
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },

  // Actual Data Card
  actualDataCard: {
    backgroundColor: COLORS.card,
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  actualDataRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actualDataItem: {
    flex: 1,
    alignItems: 'center',
  },
  actualDataLabel: {
    color: '#B0B0B0',
    fontSize: 12,
    marginTop: 6,
    marginBottom: 4,
  },
  actualDataValue: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  feelingSection: {
    alignItems: 'center',
  },
  feelingLabel: {
    color: '#B0B0B0',
    fontSize: 13,
    marginBottom: 10,
  },
  feelingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  feelingText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Plan Card
  planCard: {
    backgroundColor: COLORS.card,
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  planItem: {
    flexDirection: 'row',
    marginBottom: 20,
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

  // Notes Card
  notesCard: {
    backgroundColor: COLORS.card,
    borderRadius: 15,
    padding: 18,
    flexDirection: 'row',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  notesText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 22,
  },

  // Info Card
  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 15,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoLabel: {
    color: '#B0B0B0',
    fontSize: 14,
    flex: 1,
  },
  infoValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },

  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 15,
  },

  // Action Buttons
  actionSection: {
    marginTop: 10,
  },
  primaryButton: {
    backgroundColor: COLORS.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginBottom: 12,
    shadowColor: '#000',
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
  secondaryButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: COLORS.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.accent,
    gap: 6,
  },
  secondaryButtonText: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: 'bold',
  },
  deleteButton: {
    flex: 1,
    backgroundColor: COLORS.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF6B6B',
    gap: 6,
  },
  deleteButtonText: {
    color: '#FF6B6B',
    fontSize: 14,
    fontWeight: 'bold',
  },
});