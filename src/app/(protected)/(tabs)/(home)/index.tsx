import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import React from 'react';
import {
  ImageBackground,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View
} from 'react-native';

import { COLORS } from '@/constants/Colors';

const index = () => {
  // Kullanıcının daha önce plan oluşturup oluşturmadığını simüle eden değişken
  // İleride bu veri database'den gelecek
  const hasExistingPlan = true; // true/false ile test edebilirsiniz

  // Progress verileri (simülasyon)
  const completedWorkouts = 12;
  const totalWorkouts = 20;
  const completionPercentage = Math.round((completedWorkouts / totalWorkouts) * 100);
  const totalDistance = 47.5; // km
  const weeklyStreak = 3; // hafta

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="light-content" />
      
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        
        {/* HEADER SECTION */}
        <View style={styles.headerContainer}>
          <ImageBackground 
            source={require('../../../../../assets/images/home/banner-image.jpeg')} 
            style={styles.headerImage}
            imageStyle={{ borderRadius: 30 }}
          >
            <View style={styles.fullImageOverlay}>
              <View style={styles.textContainer}>
                <Text style={styles.headerTitle}>Hoş Geldin, Koşucu!</Text>
                <Text style={styles.headerSubtitle}>Bugün hedeflerini parçalamaya hazır mısın?</Text>
              </View>
            </View>
          </ImageBackground>
        </View>

        {/* ANA AKSİYON: CHATBOT KARTI veya PROGRESS KARTLARI */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {hasExistingPlan ? 'İlerleme Özeti' : 'Antrenman Planı'}
          </Text>
          
          {!hasExistingPlan ? (
            /* Plan Yoksa - Chatbot Kartı */
            <View style={styles.chatbotCardSpecial}>
              <View style={styles.cardIconContainer}>
                <View style={styles.iconGradientCircle}>
                  <Ionicons name="flash" size={36} color="white" />
                </View>
              </View>
              
              <Text style={styles.cardTitleSpecial}>Yapay Zeka Koçun Seni Bekliyor!</Text>
              <Text style={styles.cardDescriptionSpecial}>
                Sana özel hazırlanmış koşu programını oluşturmak için sadece birkaç soru!
              </Text>
              
              <Link href={'/chatbot'} asChild> 
                <Pressable style={styles.primaryButtonSpecial}>
                  <View style={styles.buttonContent}>
                    <Ionicons name="chatbubbles" size={22} color="white" style={{marginRight: 8}} />
                    <Text style={styles.primaryButtonTextSpecial}>İlk Planımı Oluştur</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={22} color="white" />
                </Pressable>
              </Link>
              
              <View style={styles.featuresList}>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={18} color={COLORS.accent} />
                  <Text style={styles.featureText}>Kişiselleştirilmiş program</Text>
                </View>
                <View style={styles.featureItem}>
                  <Ionicons name="checkmark-circle" size={18} color={COLORS.accent} />
                  <Text style={styles.featureText}>Seviyene uygun antrenmanlar</Text>
                </View>
              </View>
            </View>
          ) : (
            /* Plan Varsa - Progress Kartları */
            <View style={styles.progressContainer}>

              {/* Sol Kart - Tamamlanan Antrenmanlar */}
              <Link href={'/progress'} asChild push>
                <Pressable style={styles.progressCard}>
                  <View style={styles.progressHeader}>
                    <Ionicons name="checkmark-done-circle" size={24} color={COLORS.accent} />
                    <Text style={styles.progressLabel}>Tamamlanan</Text>
                  </View>
                  
                  <View style={styles.circularProgress}>
                    <View style={styles.progressCircle}>
                      <Text style={styles.percentageText}>{completionPercentage}%</Text>
                    </View>
                  </View>
                  
                  <Text style={styles.progressDetail}>{completedWorkouts}/{totalWorkouts} Antrenman</Text>
                </Pressable>
              </Link>
              

              {/* Sağ Kart - İstatistikler */}
              <Link href={'/progress'} asChild push>
                <Pressable style={styles.progressCard}>
                  <View style={styles.statsContainer}>
                    <View style={styles.statItem}>
                      <Ionicons name="trending-up" size={28} color={COLORS.accent} />
                      <View style={styles.statTextContainer}>
                        <Text style={styles.statValue}>{totalDistance} km</Text>
                        <Text style={styles.statLabel}>Toplam Mesafe</Text>
                      </View>
                    </View>
                    
                    <View style={styles.divider} />
                    
                    <View style={styles.statItem}>
                      <Ionicons name="flame" size={28} color="#FFA500" />
                      <View style={styles.statTextContainer}>
                        <Text style={styles.statValue}>{weeklyStreak} hafta</Text>
                        <Text style={styles.statLabel}>Aktif Seri</Text>
                      </View>
                    </View>
                  </View>
                </Pressable>
              </Link>


            </View>
          )}
        </View>

        {/* TAKVİM / BİLGİ KARTI */}
        <Link href={'/calendar_modal'} asChild push>        
          <Pressable style={styles.section}>
            <Text style={styles.sectionTitle}>Yaklaşan Antrenman</Text>
            <View style={[styles.infoCard, { flexDirection: 'row', alignItems: 'center' }]}>
              <View style={styles.dateBox}>
                <Text style={styles.dateText}>14</Text>
                <Text style={styles.monthText}>EKM</Text>
              </View>
              <View style={{marginLeft: 15, flex: 1}}>
                <Text style={styles.workoutTitle}>5K Hafif Tempolu</Text>
                <Text style={styles.workoutTime}>07:00 - 07:45</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color={COLORS.text} />
            </View>
          </Pressable>
        </Link>
        

        {/* GRID BUTONLAR */}
        <View style={[styles.gridContainer, { marginTop: 10 }]}> 
          <Link href={'/progress'} asChild push>
            <Pressable style={styles.secondaryButton}>
              <Ionicons name="stats-chart" size={32} color="white" />
              <Text style={styles.secondaryButtonText}>İLERLEMEM</Text>
            </Pressable>
          </Link>

          <Link href={'/plans'} asChild push>
            <Pressable style={styles.secondaryButton}>
              <Ionicons name="list" size={32} color="white" />
              <Text style={styles.secondaryButtonText}>PLANLARIM</Text>
            </Pressable>
          </Link>
        </View>

        {/* Alt boşluk */}
        <View style={{height: 50}} />

      </ScrollView>
    </View>
  )
}

export default index

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
    // HEADER STYLES
    headerContainer: {
      height: 300,
      width: '100%',
      marginBottom: 20,
    },
    headerImage: {
      flex: 1,
    },
    fullImageOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)', 
      justifyContent: 'flex-end', 
      borderRadius: 30
    },
    textContainer: {
      padding: 20,
      paddingBottom: 40,
    },
    headerTitle: {
      color: 'white',
      fontSize: 40,
      fontWeight: 'bold',
    },
    headerSubtitle: {
      color: COLORS.text,
      fontSize: 20,
      marginTop: 5,
      opacity: 0.9,
    },
    
    // SECTION STYLES
    section: {
      paddingHorizontal: 20,
      marginBottom: 20,
    },
    sectionTitle: {
      color: COLORS.text,
      fontSize: 28,
      fontWeight: '600',
      marginBottom: 14,
    },

    // SPECIAL CHATBOT CARD (Plan Yoksa)
    chatbotCardSpecial: {
      backgroundColor: COLORS.card,
      borderRadius: 20,
      padding: 25,
      borderWidth: 2,
      borderColor: COLORS.accent,
      shadowColor: COLORS.accent,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
      elevation: 10,
    },
    cardIconContainer: {
      alignItems: 'center',
      marginBottom: 15,
    },
    iconGradientCircle: {
      backgroundColor: COLORS.accent,
      width: 70,
      height: 70,
      borderRadius: 35,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: COLORS.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 8,
      elevation: 8,
    },
    cardTitleSpecial: {
      color: COLORS.text,
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 8,
      textAlign: 'center',
    },
    cardDescriptionSpecial: {
      color: '#B0B0B0',
      fontSize: 15,
      marginBottom: 20,
      lineHeight: 22,
      textAlign: 'center',
    },
    primaryButtonSpecial: {
      backgroundColor: COLORS.accent,
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderRadius: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 15,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 5,
      elevation: 6,
    },
    buttonContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    primaryButtonTextSpecial: {
      color: 'white',
      fontSize: 16,
      fontWeight: 'bold',
    },
    featuresList: {
      gap: 8,
    },
    featureItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    featureText: {
      color: '#B0B0B0',
      fontSize: 14,
    },

    // PROGRESS CARDS (Plan Varsa)
    progressContainer: {
      flexDirection: 'row',
      gap: 15,
    },
    progressCard: {
      flex: 1,
      backgroundColor: COLORS.card,
      borderRadius: 15,
      padding: 18,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 5,
      elevation: 8,
    },
    progressHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 15,
    },
    progressLabel: {
      color: COLORS.text,
      fontSize: 14,
      fontWeight: '600',
    },
    circularProgress: {
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: 10,
    },
    progressCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: COLORS.background,
      borderWidth: 6,
      borderColor: COLORS.accent,
      justifyContent: 'center',
      alignItems: 'center',
    },
    percentageText: {
      color: COLORS.accent,
      fontSize: 22,
      fontWeight: 'bold',
    },
    progressDetail: {
      color: '#B0B0B0',
      fontSize: 13,
      textAlign: 'center',
      marginTop: 5,
    },
    statsContainer: {
      flex: 1,
      justifyContent: 'space-between',
    },
    statItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    statTextContainer: {
      flex: 1,
    },
    statValue: {
      color: COLORS.text,
      fontSize: 20,
      fontWeight: 'bold',
    },
    statLabel: {
      color: '#B0B0B0',
      fontSize: 12,
      marginTop: 2,
    },
    divider: {
      height: 1,
      backgroundColor: 'rgba(176, 176, 176, 0.2)',
      marginVertical: 12,
    },

    // INFO CARD STYLES
    infoCard: {
      backgroundColor: COLORS.card,
      padding: 15,
      borderRadius: 12,
    },
    dateBox: {
      backgroundColor: COLORS.background,
      padding: 10,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      width: 50,
    },
    dateText: {
      color: COLORS.accent,
      fontSize: 18,
      fontWeight: 'bold',
    },
    monthText: {
      color: COLORS.text,
      fontSize: 10,
      fontWeight: 'bold',
    },
    workoutTitle: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
    },
    workoutTime: {
      color: '#B0B0B0',
      fontSize: 13,
      marginTop: 2,
    },

    // GRID BUTTONS
    gridContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      gap: 15,
    },
    secondaryButton: {
      flex: 1,
      backgroundColor: COLORS.accent,
      padding: 20,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      height: 100,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      elevation: 6,
    },
    secondaryButtonText: {
      color: 'white',
      marginTop: 8,
      fontSize: 16,
      fontWeight: 'bold',
    }
})