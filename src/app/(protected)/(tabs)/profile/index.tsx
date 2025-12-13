import { Ionicons } from "@expo/vector-icons";
import React, { useContext, useState } from "react";
import {
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    View,
} from "react-native";

import { COLORS } from "@/constants/Colors";
import { AuthContext } from "@/utils/authContext"; // <--- Context Import Edildi

const ProfileScreen = () => {
    // Context'ten user verisini ve logOut fonksiyonunu alıyoruz
    const { user, logOut } = useContext(AuthContext);

    // Bildirim ayarları şimdilik local state (İleride backend'e bağlanabilir)
    const [notifications, setNotifications] = useState({
        workoutReminder: user?.notification_workout_reminder ?? true, // Varsa user'dan al
        weeklyReport: true,
        achievements: true,
        planUpdates: true,
    });

    // --- HELPER: İsim Formatlama ---
    const getDisplayName = () => {
        if (user?.first_name && user?.last_name) {
            return `${user.first_name} ${user.last_name}`;
        }
        if (user?.first_name) return user.first_name;
        return user?.username || "Koşucu";
    };

    // --- HELPER: Tarih Formatlama ---
    const getMemberSince = () => {
        if (!user?.date_joined) return "Yeni Üye";
        const date = new Date(user.date_joined);
        return date.toLocaleDateString("tr-TR", {
            month: "long",
            year: "numeric",
        });
    };

    // --- HELPER: Enum Formatlama (beginner -> Beginner) ---
    const formatText = (text?: string) => {
        if (!text) return "-";
        return text.charAt(0).toUpperCase() + text.slice(1).replace("_", " ");
    };

    const handleLogout = () => {
        Alert.alert("Çıkış Yap", "Çıkış yapmak istediğinize emin misiniz?", [
            { text: "İptal", style: "cancel" },
            {
                text: "Çıkış Yap",
                style: "destructive",
                onPress: async () => {
                    await logOut(); // Context'teki logout fonksiyonunu çağır
                },
            },
        ]);
    };

    // Diğer butonlar için placeholder fonksiyonlar
    const showComingSoon = () =>
        Alert.alert("Yakında", "Bu özellik yakında eklenecek!");

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
                        {/* Profil resmi backend'de varsa göster, yoksa placeholder */}
                        <View style={styles.profileImagePlaceholder}>
                            <Text
                                style={{
                                    fontSize: 36,
                                    fontWeight: "bold",
                                    color: COLORS.text,
                                }}
                            >
                                {user?.first_name
                                    ? user.first_name.charAt(0).toUpperCase()
                                    : "U"}
                            </Text>
                        </View>

                        <Pressable
                            style={styles.editImageButton}
                            onPress={showComingSoon}
                        >
                            <Ionicons name="camera" size={20} color="white" />
                        </Pressable>
                    </View>

                    <Text style={styles.userName}>{getDisplayName()}</Text>
                    <Text style={styles.userEmail}>{user?.email}</Text>

                    <View style={styles.memberBadge}>
                        <Ionicons
                            name="time-outline"
                            size={16}
                            color={COLORS.accent}
                        />
                        <Text style={styles.memberText}>
                            Üye: {getMemberSince()}
                        </Text>
                    </View>
                </View>

                {/* Quick Stats - CANLI VERİLER */}
                <View style={styles.statsSection}>
                    <View style={styles.statBox}>
                        <Text style={styles.statValue}>
                            {user?.total_workouts || 0}
                        </Text>
                        <Text style={styles.statLabel}>Koşu</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statBox}>
                        <Text style={styles.statValue}>
                            {user?.total_distance?.toFixed(1) || 0}
                        </Text>
                        <Text style={styles.statLabel}>KM</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statBox}>
                        {/* Dakikayı saate çevir */}
                        <Text style={styles.statValue}>
                            {Math.floor((user?.total_time || 0) / 60)}
                        </Text>
                        <Text style={styles.statLabel}>Saat</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statBox}>
                        {/* Aktif Plan sayısı şimdilik sabit veya hesaplanabilir */}
                        <Text style={styles.statValue}>1</Text>
                        <Text style={styles.statLabel}>Plan</Text>
                    </View>
                </View>

                {/* Personal Info Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Kişisel Bilgiler</Text>

                    <Pressable style={styles.menuItem} onPress={showComingSoon}>
                        <View style={styles.menuItemLeft}>
                            <View style={styles.menuIconContainer}>
                                <Ionicons
                                    name="person-outline"
                                    size={22}
                                    color={COLORS.accent}
                                />
                            </View>
                            <View style={styles.menuItemContent}>
                                <Text style={styles.menuItemTitle}>
                                    Profil Bilgileri
                                </Text>
                                <Text style={styles.menuItemSubtitle}>
                                    {/* Yaş hesaplama karmaşık olduğu için şimdilik boy/kilo */}
                                    {user?.height || "-"} cm •{" "}
                                    {user?.weight || "-"} kg
                                </Text>
                            </View>
                        </View>
                        <Ionicons
                            name="chevron-forward"
                            size={22}
                            color="#B0B0B0"
                        />
                    </Pressable>

                    <Pressable style={styles.menuItem} onPress={showComingSoon}>
                        <View style={styles.menuItemLeft}>
                            <View style={styles.menuIconContainer}>
                                <Ionicons
                                    name="fitness-outline"
                                    size={22}
                                    color={COLORS.accent}
                                />
                            </View>
                            <View style={styles.menuItemContent}>
                                <Text style={styles.menuItemTitle}>
                                    Koşu Tercihleri
                                </Text>
                                <Text style={styles.menuItemSubtitle}>
                                    {formatText(user?.experience_level)} •{" "}
                                    {formatText(user?.preferred_distance)}
                                </Text>
                            </View>
                        </View>
                        <Ionicons
                            name="chevron-forward"
                            size={22}
                            color="#B0B0B0"
                        />
                    </Pressable>

                    <Pressable style={styles.menuItem} onPress={showComingSoon}>
                        <View style={styles.menuItemLeft}>
                            <View style={styles.menuIconContainer}>
                                <Ionicons
                                    name="locate-outline"
                                    size={22}
                                    color={COLORS.accent}
                                />
                            </View>
                            <View style={styles.menuItemContent}>
                                <Text style={styles.menuItemTitle}>
                                    Haftalık Hedef
                                </Text>
                                <Text style={styles.menuItemSubtitle}>
                                    Haftada {user?.weekly_goal || 3} antrenman
                                </Text>
                            </View>
                        </View>
                        <Ionicons
                            name="chevron-forward"
                            size={22}
                            color="#B0B0B0"
                        />
                    </Pressable>
                </View>

                {/* Notifications Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Bildirimler</Text>

                    <View style={styles.menuItem}>
                        <View style={styles.menuItemLeft}>
                            <View style={styles.menuIconContainer}>
                                <Ionicons
                                    name="alarm-outline"
                                    size={22}
                                    color={COLORS.accent}
                                />
                            </View>
                            <View style={styles.menuItemContent}>
                                <Text style={styles.menuItemTitle}>
                                    Antrenman Hatırlatıcı
                                </Text>
                                <Text style={styles.menuItemSubtitle}>
                                    Antrenman saatinden önce bildirim
                                </Text>
                            </View>
                        </View>
                        <Switch
                            value={notifications.workoutReminder}
                            onValueChange={(value) =>
                                setNotifications({
                                    ...notifications,
                                    workoutReminder: value,
                                })
                            }
                            trackColor={{
                                false: "#767577",
                                true: COLORS.accent,
                            }}
                            thumbColor={"white"}
                        />
                    </View>
                    {/* Diğer switchler aynı kalabilir */}
                </View>

                {/* Account Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Hesap</Text>

                    <Pressable style={styles.menuItem}>
                        <View style={styles.menuItemLeft}>
                            <View style={styles.menuIconContainer}>
                                <Ionicons
                                    name="mail-outline"
                                    size={22}
                                    color={COLORS.accent}
                                />
                            </View>
                            <View style={styles.menuItemContent}>
                                <Text style={styles.menuItemTitle}>
                                    E-posta Adresi
                                </Text>
                                <Text style={styles.menuItemSubtitle}>
                                    {user?.email}
                                </Text>
                            </View>
                        </View>
                        {/* E-posta değiştirilemez olduğu için ok işaretini kaldırdım */}
                    </Pressable>

                    <Pressable style={styles.menuItem} onPress={showComingSoon}>
                        <View style={styles.menuItemLeft}>
                            <View style={styles.menuIconContainer}>
                                <Ionicons
                                    name="lock-closed-outline"
                                    size={22}
                                    color={COLORS.accent}
                                />
                            </View>
                            <View style={styles.menuItemContent}>
                                <Text style={styles.menuItemTitle}>
                                    Şifre Değiştir
                                </Text>
                                <Text style={styles.menuItemSubtitle}>
                                    Hesap güvenliği
                                </Text>
                            </View>
                        </View>
                        <Ionicons
                            name="chevron-forward"
                            size={22}
                            color="#B0B0B0"
                        />
                    </Pressable>
                </View>

                {/* Support Section - Aynı Kalabilir */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Destek</Text>
                    {/* ... Mevcut kodlar ... */}
                    <Pressable style={styles.menuItem} onPress={showComingSoon}>
                        <View style={styles.menuItemLeft}>
                            <View style={styles.menuIconContainer}>
                                <Ionicons
                                    name="information-circle-outline"
                                    size={22}
                                    color={COLORS.accent}
                                />
                            </View>
                            <View style={styles.menuItemContent}>
                                <Text style={styles.menuItemTitle}>
                                    Uygulama Hakkında
                                </Text>
                                <Text style={styles.menuItemSubtitle}>
                                    Versiyon 1.0.0
                                </Text>
                            </View>
                        </View>
                    </Pressable>
                </View>

                {/* Danger Zone */}
                <View style={styles.section}>
                    <Pressable
                        style={styles.logoutButton}
                        onPress={handleLogout}
                    >
                        <Ionicons
                            name="log-out-outline"
                            size={22}
                            color="white"
                        />
                        <Text style={styles.logoutButtonText}>Çıkış Yap</Text>
                    </Pressable>

                    <Pressable
                        style={styles.deleteButton}
                        onPress={() =>
                            Alert.alert(
                                "Dikkat",
                                "Hesap silme işlemi henüz aktif değil."
                            )
                        }
                    >
                        <Ionicons
                            name="trash-outline"
                            size={22}
                            color="#FF6B6B"
                        />
                        <Text style={styles.deleteButtonText}>Hesabı Sil</Text>
                    </Pressable>
                </View>

                <View style={{ height: 30 }} />
            </ScrollView>
        </View>
    );
};

export default ProfileScreen;

const styles = StyleSheet.create({
    // Stylelar önceki kod ile BİREBİR AYNI kalabilir.
    // Tekrar kopyalamana gerek yok, mevcut styles objesini kullanabilirsin.
    // Sadece container, scrollView vb. temel yapıların olduğundan emin ol.
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
    headerSection: {
        backgroundColor: COLORS.card,
        paddingVertical: 30,
        paddingHorizontal: 20,
        alignItems: "center",
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        marginBottom: 20,
    },
    profileImageContainer: {
        position: "relative",
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
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 2,
        borderColor: COLORS.accent,
    },
    editImageButton: {
        position: "absolute",
        bottom: 0,
        right: 0,
        backgroundColor: COLORS.accent,
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 3,
        borderColor: COLORS.card,
    },
    userName: {
        color: COLORS.text,
        fontSize: 24,
        fontWeight: "bold",
        marginBottom: 5,
    },
    userEmail: {
        color: "#B0B0B0",
        fontSize: 14,
        marginBottom: 15,
    },
    memberBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(255, 107, 107, 0.15)",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        gap: 6,
    },
    memberText: {
        color: COLORS.accent,
        fontSize: 12,
        fontWeight: "600",
    },
    statsSection: {
        flexDirection: "row",
        backgroundColor: COLORS.card,
        marginHorizontal: 20,
        borderRadius: 15,
        padding: 20,
        marginBottom: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 8,
    },
    statBox: {
        flex: 1,
        alignItems: "center",
    },
    statValue: {
        color: COLORS.text,
        fontSize: 20,
        fontWeight: "bold",
        marginBottom: 4,
    },
    statLabel: {
        color: "#B0B0B0",
        fontSize: 12,
    },
    statDivider: {
        width: 1,
        backgroundColor: "rgba(255, 255, 255, 0.1)",
        marginHorizontal: 10,
    },
    section: {
        paddingHorizontal: 20,
        marginBottom: 25,
    },
    sectionTitle: {
        color: COLORS.text,
        fontSize: 18,
        fontWeight: "600",
        marginBottom: 15,
    },
    menuItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: COLORS.card,
        padding: 16,
        borderRadius: 12,
        marginBottom: 10,
    },
    menuItemLeft: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
    },
    menuIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.background,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
    },
    menuItemContent: {
        flex: 1,
    },
    menuItemTitle: {
        color: COLORS.text,
        fontSize: 15,
        fontWeight: "600",
        marginBottom: 2,
    },
    menuItemSubtitle: {
        color: "#B0B0B0",
        fontSize: 13,
    },
    logoutButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: COLORS.accent,
        padding: 16,
        borderRadius: 12,
        gap: 10,
        marginBottom: 12,
    },
    logoutButtonText: {
        color: "white",
        fontSize: 16,
        fontWeight: "bold",
    },
    deleteButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255, 107, 107, 0.15)",
        padding: 16,
        borderRadius: 12,
        gap: 10,
        borderWidth: 1,
        borderColor: "#FF6B6B",
    },
    deleteButtonText: {
        color: "#FF6B6B",
        fontSize: 16,
        fontWeight: "bold",
    },
});
