import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View
} from 'react-native';

import { COLORS } from '@/constants/Colors';

const profile = () => {
  // Kullanıcı bilgileri - ileride API'den gelecek
  const [userInfo, setUserInfo] = useState({
    name: 'Ahmet Yılmaz',
    email: 'ahmet.yilmaz@email.com',
    phone: '+90 555 123 4567',
    memberSince: 'Eylül 2024',
    profileImage: null, // URL olabilir
    
    // Koşu bilgileri
    age: 28,
    weight: 75, // kg
    height: 178, // cm
    gender: 'Erkek',
    experienceLevel: 'Orta Seviye',
    preferredDistance: '10K',
    weeklyGoal: 4, // antrenman/hafta
    
    // İstatistikler
    totalRuns: 47,
    totalDistance: 187.5, // km
    totalTime: 1240, // dakika
    activePlans: 2,
  });

  const [notifications, setNotifications] = useState({
    workoutReminder: true,
    weeklyReport: true,
    achievements: true,
    planUpdates: true,
  });

  const handleLogout = () => {
    Alert.alert(
      'Çıkış Yap',
      'Çıkış yapmak istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Çıkış Yap',
          style: 'destructive',
          onPress: () => {
            // Logout işlemi
            router.replace('/login');
          }
        }
      ]
    );
  };

  const handleEditProfile = () => {
    // Edit profile sayfasına git
    Alert.alert('Yakında', 'Profil düzenleme özelliği yakında eklenecek!');
  };

  const handleChangePassword = () => {
    Alert.alert('Yakında', 'Şifre değiştirme özelliği yakında eklenecek!');
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Hesabı Sil',
      'Hesabınızı silmek istediğinize emin misiniz? Bu işlem geri alınamaz!',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Hesabı Sil',
          style: 'destructive',
          onPress: () => {
            // Delete account işlemi
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <View style={styles.headerSection}>
          <View style={styles.profileImageContainer}>
            {userInfo.profileImage ? (
              <Image source={{ uri: userInfo.profileImage }} style={styles.profileImage} />
            ) : (
              <View style={styles.profileImagePlaceholder}>
                <Ionicons name="person" size={60} color={COLORS.text} />
              </View>
            )}
            <Pressable style={styles.editImageButton}>
              <Ionicons name="camera" size={20} color="white" />
            </Pressable>
          </View>
          
          <Text style={styles.userName}>{userInfo.name}</Text>
          <Text style={styles.userEmail}>{userInfo.email}</Text>
          
          <View style={styles.memberBadge}>
            <Ionicons name="time-outline" size={16} color={COLORS.accent} />
            <Text style={styles.memberText}>Üye: {userInfo.memberSince}</Text>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsSection}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{userInfo.totalRuns}</Text>
            <Text style={styles.statLabel}>Koşu</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{userInfo.totalDistance}</Text>
            <Text style={styles.statLabel}>KM</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{Math.floor(userInfo.totalTime / 60)}</Text>
            <Text style={styles.statLabel}>Saat</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{userInfo.activePlans}</Text>
            <Text style={styles.statLabel}>Plan</Text>
          </View>
        </View>

        {/* Personal Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kişisel Bilgiler</Text>
          
          <Pressable style={styles.menuItem} onPress={handleEditProfile}>
            <View style={styles.menuItemLeft}>
              <View style={styles.menuIconContainer}>
                <Ionicons name="person-outline" size={22} color={COLORS.accent} />
              </View>
              <View style={styles.menuItemContent}>
                <Text style={styles.menuItemTitle}>Profil Bilgileri</Text>
                <Text style={styles.menuItemSubtitle}>
                  {userInfo.age} yaş • {userInfo.height} cm • {userInfo.weight} kg
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#B0B0B0" />
          </Pressable>

          <Pressable style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <View style={styles.menuIconContainer}>
                <Ionicons name="fitness-outline" size={22} color={COLORS.accent} />
              </View>
              <View style={styles.menuItemContent}>
                <Text style={styles.menuItemTitle}>Koşu Tercihleri</Text>
                <Text style={styles.menuItemSubtitle}>
                  {userInfo.experienceLevel} • {userInfo.preferredDistance}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#B0B0B0" />
          </Pressable>

          <Pressable style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <View style={styles.menuIconContainer}>
                <Ionicons name="target-outline" size={22} color={COLORS.accent} />
              </View>
              <View style={styles.menuItemContent}>
                <Text style={styles.menuItemTitle}>Haftalık Hedef</Text>
                <Text style={styles.menuItemSubtitle}>
                  Haftada {userInfo.weeklyGoal} antrenman
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#B0B0B0" />
          </Pressable>
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bildirimler</Text>
          
          <View style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <View style={styles.menuIconContainer}>
                <Ionicons name="alarm-outline" size={22} color={COLORS.accent} />
              </View>
              <View style={styles.menuItemContent}>
                <Text style={styles.menuItemTitle}>Antrenman Hatırlatıcı</Text>
                <Text style={styles.menuItemSubtitle}>Antrenman saatinden önce bildirim</Text>
              </View>
            </View>
            <Switch
              value={notifications.workoutReminder}
              onValueChange={(value) => 
                setNotifications({...notifications, workoutReminder: value})
              }
              trackColor={{ false: '#767577', true: COLORS.accent }}
              thumbColor={'white'}
            />
          </View>

          <View style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <View style={styles.menuIconContainer}>
                <Ionicons name="stats-chart-outline" size={22} color={COLORS.accent} />
              </View>
              <View style={styles.menuItemContent}>
                <Text style={styles.menuItemTitle}>Haftalık Rapor</Text>
                <Text style={styles.menuItemSubtitle}>Haftalık ilerleme özeti</Text>
              </View>
            </View>
            <Switch
              value={notifications.weeklyReport}
              onValueChange={(value) => 
                setNotifications({...notifications, weeklyReport: value})
              }
              trackColor={{ false: '#767577', true: COLORS.accent }}
              thumbColor={'white'}
            />
          </View>

          <View style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <View style={styles.menuIconContainer}>
                <Ionicons name="trophy-outline" size={22} color={COLORS.accent} />
              </View>
              <View style={styles.menuItemContent}>
                <Text style={styles.menuItemTitle}>Başarımlar</Text>
                <Text style={styles.menuItemSubtitle}>Yeni rozetler ve ödüller</Text>
              </View>
            </View>
            <Switch
              value={notifications.achievements}
              onValueChange={(value) => 
                setNotifications({...notifications, achievements: value})
              }
              trackColor={{ false: '#767577', true: COLORS.accent }}
              thumbColor={'white'}
            />
          </View>

          <View style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <View style={styles.menuIconContainer}>
                <Ionicons name="newspaper-outline" size={22} color={COLORS.accent} />
              </View>
              <View style={styles.menuItemContent}>
                <Text style={styles.menuItemTitle}>Plan Güncellemeleri</Text>
                <Text style={styles.menuItemSubtitle}>Plan değişiklikleri</Text>
              </View>
            </View>
            <Switch
              value={notifications.planUpdates}
              onValueChange={(value) => 
                setNotifications({...notifications, planUpdates: value})
              }
              trackColor={{ false: '#767577', true: COLORS.accent }}
              thumbColor={'white'}
            />
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hesap</Text>
          
          <Pressable style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <View style={styles.menuIconContainer}>
                <Ionicons name="mail-outline" size={22} color={COLORS.accent} />
              </View>
              <View style={styles.menuItemContent}>
                <Text style={styles.menuItemTitle}>E-posta Adresi</Text>
                <Text style={styles.menuItemSubtitle}>{userInfo.email}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#B0B0B0" />
          </Pressable>

          <Pressable style={styles.menuItem} onPress={handleChangePassword}>
            <View style={styles.menuItemLeft}>
              <View style={styles.menuIconContainer}>
                <Ionicons name="lock-closed-outline" size={22} color={COLORS.accent} />
              </View>
              <View style={styles.menuItemContent}>
                <Text style={styles.menuItemTitle}>Şifre Değiştir</Text>
                <Text style={styles.menuItemSubtitle}>Hesap güvenliği</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#B0B0B0" />
          </Pressable>

          <Pressable style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <View style={styles.menuIconContainer}>
                <Ionicons name="language-outline" size={22} color={COLORS.accent} />
              </View>
              <View style={styles.menuItemContent}>
                <Text style={styles.menuItemTitle}>Dil</Text>
                <Text style={styles.menuItemSubtitle}>Türkçe</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#B0B0B0" />
          </Pressable>
        </View>

        {/* Support Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Destek</Text>
          
          <Pressable style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <View style={styles.menuIconContainer}>
                <Ionicons name="help-circle-outline" size={22} color={COLORS.accent} />
              </View>
              <Text style={styles.menuItemTitle}>Yardım Merkezi</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#B0B0B0" />
          </Pressable>

          <Pressable style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <View style={styles.menuIconContainer}>
                <Ionicons name="document-text-outline" size={22} color={COLORS.accent} />
              </View>
              <Text style={styles.menuItemTitle}>Kullanım Koşulları</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#B0B0B0" />
          </Pressable>

          <Pressable style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <View style={styles.menuIconContainer}>
                <Ionicons name="shield-checkmark-outline" size={22} color={COLORS.accent} />
              </View>
              <Text style={styles.menuItemTitle}>Gizlilik Politikası</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#B0B0B0" />
          </Pressable>

          <Pressable style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <View style={styles.menuIconContainer}>
                <Ionicons name="information-circle-outline" size={22} color={COLORS.accent} />
              </View>
              <View style={styles.menuItemContent}>
                <Text style={styles.menuItemTitle}>Uygulama Hakkında</Text>
                <Text style={styles.menuItemSubtitle}>Versiyon 1.0.0</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#B0B0B0" />
          </Pressable>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Pressable style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color="white" />
            <Text style={styles.logoutButtonText}>Çıkış Yap</Text>
          </Pressable>

          <Pressable style={styles.deleteButton} onPress={handleDeleteAccount}>
            <Ionicons name="trash-outline" size={22} color="#FF6B6B" />
            <Text style={styles.deleteButtonText}>Hesabı Sil</Text>
          </Pressable>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
};

export default profile;

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

  // Header Section
  headerSection: {
    backgroundColor: COLORS.card,
    paddingVertical: 30,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: 20,
  },
  profileImageContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  profileImagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editImageButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.accent,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.card,
  },
  userName: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  userEmail: {
    color: '#B0B0B0',
    fontSize: 14,
    marginBottom: 15,
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  memberText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '600',
  },

  // Stats Section
  statsSection: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    marginHorizontal: 20,
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    color: '#B0B0B0',
    fontSize: 12,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 10,
  },

  // Section
  section: {
    paddingHorizontal: 20,
    marginBottom: 25,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
  },

  // Menu Item
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  menuItemSubtitle: {
    color: '#B0B0B0',
    fontSize: 13,
  },

  // Buttons
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
    padding: 16,
    borderRadius: 12,
    gap: 10,
    marginBottom: 12,
  },
  logoutButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    padding: 16,
    borderRadius: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: '#FF6B6B',
  },
  deleteButtonText: {
    color: '#FF6B6B',
    fontSize: 16,
    fontWeight: 'bold',
  },
});