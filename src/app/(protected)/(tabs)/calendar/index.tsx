import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { Calendar } from 'react-native-calendars';

import { COLORS } from '@/constants/Colors';

const index = () => {
  const [viewMode, setViewMode] = useState('month'); // 'week' or 'month'
  const [selectedDate, setSelectedDate] = useState('2024-10-14');

  // Simülasyon verileri - Antrenman etkinlikleri
  const workouts = {
    '2024-10-12': [
      {
        id: 1,
        title: '5K Tempolu Koşu',
        time: '07:00',
        duration: '45 dk',
        type: 'tempo',
        status: 'completed',
      }
    ],
    '2024-10-14': [
      {
        id: 2,
        title: '5K Hafif Tempolu',
        time: '07:00',
        duration: '45 dk',
        type: 'easy',
        status: 'scheduled',
      },
      {
        id: 3,
        title: 'Interval Antrenmanı',
        time: '18:00',
        duration: '60 dk',
        type: 'interval',
        status: 'scheduled',
      }
    ],
    '2024-10-15': [
      {
        id: 4,
        title: 'Dinlenme Günü',
        time: '-',
        duration: '-',
        type: 'rest',
        status: 'scheduled',
      }
    ],
    '2024-10-16': [
      {
        id: 5,
        title: '10K Uzun Koşu',
        time: '08:00',
        duration: '90 dk',
        type: 'long',
        status: 'scheduled',
      }
    ],
    '2024-10-18': [
      {
        id: 6,
        title: '8K Tempo Koşusu',
        time: '07:00',
        duration: '60 dk',
        type: 'tempo',
        status: 'scheduled',
      }
    ],
  };

  // Takvim için marked dates oluştur
  const markedDates = {};
  Object.keys(workouts).forEach(date => {
    const workout = workouts[date][0];
    markedDates[date] = {
      marked: true,
      dotColor: workout.status === 'completed' ? '#4CAF50' : COLORS.accent,
      selected: date === selectedDate,
      selectedColor: date === selectedDate ? COLORS.accent : undefined,
    };
  });

  const handleDayPress = (day) => {
    setSelectedDate(day.dateString);
  };

    const handleWorkoutPress = (workout, date) => {
    router.push({
      pathname: '/calendar/detail_modal',
      params: {
        workoutId: workout.id,
        date: date,
        title: workout.title,
        time: workout.time,
        duration: workout.duration,
        type: workout.type,
        status: workout.status,
      }
    });
  };

  const getWorkoutTypeIcon = (type) => {
    switch (type) {
      case 'tempo':
        return 'speedometer-outline';
      case 'easy':
        return 'walk-outline';
      case 'interval':
        return 'flash-outline';
      case 'long':
        return 'trending-up-outline';
      case 'rest':
        return 'moon-outline';
      default:
        return 'fitness-outline';
    }
  };

  const getWorkoutTypeColor = (type) => {
    switch (type) {
      case 'tempo':
        return '#FF6B6B';
      case 'easy':
        return '#4ECDC4';
      case 'interval':
        return '#FFD93D';
      case 'long':
        return '#A569BD';
      case 'rest':
        return '#95A5A6';
      default:
        return COLORS.accent;
    }
  };

  const renderWeekView = () => {
    // Haftalık görünüm için son 7 günü al
    const today = new Date();
    const weekDays = [];
    
    for (let i = -3; i <= 3; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateString = date.toISOString().split('T')[0];
      
      weekDays.push({
        dateString: dateString,
        day: date.getDate(),
        dayName: date.toLocaleDateString('tr-TR', { weekday: 'short' }),
        isToday: i === 0,
        workouts: workouts[dateString] || []
      });
    }

    return (
      <View style={styles.weekView}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {weekDays.map((day) => (
            <Pressable
              key={day.dateString}
              style={[
                styles.weekDayCard,
                day.isToday && styles.weekDayCardToday,
                day.dateString === selectedDate && styles.weekDayCardSelected,
              ]}
              onPress={() => setSelectedDate(day.dateString)}
            >
              <Text style={[
                styles.weekDayName,
                day.isToday && styles.weekDayTextToday,
              ]}>
                {day.dayName}
              </Text>
              <Text style={[
                styles.weekDayNumber,
                day.isToday && styles.weekDayTextToday,
              ]}>
                {day.day}
              </Text>
              {day.workouts.length > 0 && (
                <View style={styles.weekDayDots}>
                  {day.workouts.map((w, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.weekDayDot,
                        { backgroundColor: getWorkoutTypeColor(w.type) }
                      ]}
                    />
                  ))}
                </View>
              )}
            </Pressable>
          ))}
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header with View Toggle */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Antrenman Takvimi</Text>
        <View style={styles.viewToggle}>
          <Pressable
            style={[
              styles.toggleButton,
              viewMode === 'week' && styles.toggleButtonActive
            ]}
            onPress={() => setViewMode('week')}
          >
            <Ionicons 
              name="list-outline" 
              size={20} 
              color={viewMode === 'week' ? 'white' : COLORS.text} 
            />
            <Text style={[
              styles.toggleButtonText,
              viewMode === 'week' && styles.toggleButtonTextActive
            ]}>
              Hafta
            </Text>
          </Pressable>
          
          <Pressable
            style={[
              styles.toggleButton,
              viewMode === 'month' && styles.toggleButtonActive
            ]}
            onPress={() => setViewMode('month')}
          >
            <Ionicons 
              name="calendar-outline" 
              size={20} 
              color={viewMode === 'month' ? 'white' : COLORS.text} 
            />
            <Text style={[
              styles.toggleButtonText,
              viewMode === 'month' && styles.toggleButtonTextActive
            ]}>
              Ay
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Calendar View */}
        {viewMode === 'month' ? (
          <View style={styles.calendarContainer}>
            <Calendar
              current={selectedDate}
              onDayPress={handleDayPress}
              markedDates={markedDates}
              theme={{
                calendarBackground: COLORS.card,
                textSectionTitleColor: COLORS.text,
                selectedDayBackgroundColor: COLORS.accent,
                selectedDayTextColor: 'white',
                todayTextColor: COLORS.accent,
                dayTextColor: COLORS.text,
                textDisabledColor: '#666',
                monthTextColor: COLORS.text,
                textMonthFontSize: 18,
                textMonthFontWeight: 'bold',
                arrowColor: COLORS.accent,
                'stylesheet.calendar.header': {
                  week: {
                    marginTop: 5,
                    flexDirection: 'row',
                    justifyContent: 'space-between'
                  }
                }
              }}
              style={styles.calendar}
            />
          </View>
        ) : (
          renderWeekView()
        )}

        {/* Selected Day Workouts */}
        <View style={styles.workoutsSection}>
          <Text style={styles.workoutsSectionTitle}>
            {new Date(selectedDate).toLocaleDateString('tr-TR', { 
              day: 'numeric', 
              month: 'long',
              year: 'numeric'
            })}
          </Text>

          {workouts[selectedDate] ? (
            workouts[selectedDate].map((workout, index) => (
              <Pressable
                key={index}
                style={styles.workoutCard}
                onPress={() => handleWorkoutPress(workout, selectedDate)}
              >
                <View style={[
                  styles.workoutTypeIndicator,
                  { backgroundColor: getWorkoutTypeColor(workout.type) }
                ]} />
                
                <View style={[
                  styles.workoutIconContainer,
                  { backgroundColor: `${getWorkoutTypeColor(workout.type)}20` }
                ]}>
                  <Ionicons 
                    name={getWorkoutTypeIcon(workout.type)} 
                    size={24} 
                    color={getWorkoutTypeColor(workout.type)} 
                  />
                </View>

                <View style={styles.workoutContent}>
                  <View style={styles.workoutHeader}>
                    <Text style={styles.workoutTitle}>{workout.title}</Text>
                    {workout.status === 'completed' && (
                      <View style={styles.completedBadge}>
                        <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                        <Text style={styles.completedText}>Tamamlandı</Text>
                      </View>
                    )}
                  </View>
                  
                  <View style={styles.workoutDetails}>
                    {workout.time !== '-' && (
                      <View style={styles.workoutDetail}>
                        <Ionicons name="time-outline" size={14} color="#B0B0B0" />
                        <Text style={styles.workoutDetailText}>{workout.time}</Text>
                      </View>
                    )}
                    {workout.duration !== '-' && (
                      <View style={styles.workoutDetail}>
                        <Ionicons name="timer-outline" size={14} color="#B0B0B0" />
                        <Text style={styles.workoutDetailText}>{workout.duration}</Text>
                      </View>
                    )}
                  </View>
                </View>

                <Ionicons name="chevron-forward" size={22} color="#B0B0B0" />
              </Pressable>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={60} color="#666" />
              <Text style={styles.emptyStateText}>Bu günde antrenman yok</Text>
              <Pressable style={styles.addWorkoutButton}>
                <Ionicons name="add-circle-outline" size={20} color={COLORS.accent} />
                <Text style={styles.addWorkoutButtonText}>Antrenman Ekle</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
};

export default index;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Header
  header: {
    backgroundColor: COLORS.card,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 10,
    gap: 6,
  },
  toggleButtonActive: {
    backgroundColor: COLORS.accent,
  },
  toggleButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  toggleButtonTextActive: {
    color: 'white',
  },

  scrollView: {
    flex: 1,
  },

  // Calendar
  calendarContainer: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 15,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  calendar: {
    borderRadius: 15,
  },

  // Week View
  weekView: {
    paddingVertical: 20,
    paddingLeft: 20,
  },
  weekDayCard: {
    backgroundColor: COLORS.card,
    borderRadius: 15,
    padding: 15,
    marginRight: 12,
    alignItems: 'center',
    minWidth: 70,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  weekDayCardToday: {
    borderWidth: 2,
    borderColor: COLORS.accent,
  },
  weekDayCardSelected: {
    backgroundColor: COLORS.accent,
  },
  weekDayName: {
    color: '#B0B0B0',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  weekDayNumber: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  weekDayTextToday: {
    color: COLORS.accent,
  },
  weekDayDots: {
    flexDirection: 'row',
    gap: 4,
  },
  weekDayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // Workouts Section
  workoutsSection: {
    paddingHorizontal: 20,
    marginTop: 25,
  },
  workoutsSectionTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 15,
  },

  // Workout Card
  workoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 15,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  workoutTypeIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 15,
    borderBottomLeftRadius: 15,
  },
  workoutIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    marginRight: 12,
  },
  workoutContent: {
    flex: 1,
  },
  workoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  workoutTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  completedText: {
    color: '#4CAF50',
    fontSize: 11,
    fontWeight: '600',
  },
  workoutDetails: {
    flexDirection: 'row',
    gap: 15,
  },
  workoutDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  workoutDetailText: {
    color: '#B0B0B0',
    fontSize: 13,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    backgroundColor: COLORS.card,
    borderRadius: 15,
  },
  emptyStateText: {
    color: '#B0B0B0',
    fontSize: 16,
    marginTop: 15,
    marginBottom: 20,
  },
  addWorkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.background,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  addWorkoutButtonText: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: '600',
  },
});