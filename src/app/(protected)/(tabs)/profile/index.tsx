import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useContext, useState } from "react";
import {
    Alert,
    Dimensions,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Switch,
    Text,
    View,
} from "react-native";

import { COLORS } from "@/constants/Colors";
import { AuthContext } from "@/utils/authContext";

const { width } = Dimensions.get("window");

const ProfileScreen = () => {
    const { user, logOut } = useContext(AuthContext);

    const [notifications, setNotifications] = useState({
        workoutReminder: user?.notification_workout_reminder ?? true,
        weeklyReport: true,
    });

    // --- HELPERS ---
    const getDisplayName = () => {
        if (user?.first_name && user?.last_name)
            return `${user.first_name} ${user.last_name}`;
        if (user?.first_name) return user.first_name;
        return user?.username || "Koşucu";
    };

    const getMemberSince = () => {
        if (!user?.date_joined) return "Yeni Üye";
        return new Date(user.date_joined).toLocaleDateString("tr-TR", {
            month: "long",
            year: "numeric",
        });
    };

    const formatEnum = (text?: string) => {
        if (!text) return "-";
        return text.charAt(0).toUpperCase() + text.slice(1).replace("_", " ");
    };

    const handleLogout = () => {
        Alert.alert("Çıkış Yap", "Hesabınızdan çıkış yapılacak.", [
            { text: "Vazgeç", style: "cancel" },
            {
                text: "Çıkış Yap",
                style: "destructive",
                onPress: async () => await logOut(),
            },
        ]);
    };

    const showComingSoon = () =>
        Alert.alert("Yakında", "Bu özellik geliştirme aşamasında.");

    // --- REUSABLE MENU ITEM ---
    const MenuItem = ({
        icon,
        color,
        title,
        value,
        isSwitch,
        switchValue,
        onSwitchChange,
        onPress,
        showChevron = true,
    }: any) => (
        <Pressable
            style={({ pressed }) => [
                styles.menuItem,
                pressed && !isSwitch && styles.menuItemPressed,
            ]}
            onPress={isSwitch ? null : onPress}
        >
            <View style={styles.menuLeft}>
                <View
                    style={[styles.iconBox, { backgroundColor: color + "20" }]}
                >
                    <Ionicons name={icon} size={20} color={color} />
                </View>
                <View>
                    <Text style={styles.menuTitle}>{title}</Text>
                    {value && <Text style={styles.menuSubtitle}>{value}</Text>}
                </View>
            </View>

            {isSwitch ? (
                <Switch
                    value={switchValue}
                    onValueChange={onSwitchChange}
                    trackColor={{ false: "#3e3e3e", true: COLORS.accent }}
                    thumbColor={"white"}
                />
            ) : (
                <View style={styles.menuRight}>
                    {showChevron && (
                        <Ionicons
                            name="chevron-forward"
                            size={20}
                            color={COLORS.textDim}
                        />
                    )}
                </View>
            )}
        </Pressable>
    );

    return (
        <View style={styles.container}>
            {/* Status Bar'ı transparan yapıyoruz ki gradient arkada görünsün */}
            <StatusBar
                barStyle="light-content"
                translucent
                backgroundColor="transparent"
            />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {/* --- 1. MODERN HEADER (GRADIENT) --- */}
                <LinearGradient
                    colors={[COLORS.accent, COLORS.background]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 0.8 }}
                    style={styles.headerGradient}
                >
                    <View style={styles.profileContent}>
                        <View style={styles.avatarContainer}>
                            <View style={styles.avatarPlaceholder}>
                                <Text style={styles.avatarText}>
                                    {user?.first_name
                                        ? user.first_name
                                              .charAt(0)
                                              .toUpperCase()
                                        : "U"}
                                </Text>
                            </View>
                            <Pressable
                                style={styles.editBadge}
                                onPress={showComingSoon}
                            >
                                <Ionicons
                                    name="camera"
                                    size={14}
                                    color="white"
                                />
                            </Pressable>
                        </View>

                        <Text style={styles.userName}>{getDisplayName()}</Text>
                        <View style={styles.memberChip}>
                            <Text style={styles.memberText}>
                                {getMemberSince()} tarihinden beri üye
                            </Text>
                        </View>
                    </View>
                </LinearGradient>

                {/* --- 2. FLOATING STATS CARD --- */}
                <View style={styles.statsCard}>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>
                            {user?.total_workouts || 0}
                        </Text>
                        <Text style={styles.statLabel}>Koşu</Text>
                    </View>
                    <View style={styles.verticalDivider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>
                            {user?.total_distance?.toFixed(1) || 0}
                        </Text>
                        <Text style={styles.statLabel}>KM</Text>
                    </View>
                    <View style={styles.verticalDivider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>
                            {Math.floor((user?.total_time || 0) / 60)}
                        </Text>
                        <Text style={styles.statLabel}>Saat</Text>
                    </View>
                </View>

                {/* --- 3. MENU SECTIONS --- */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionHeader}>KİŞİSEL BİLGİLER</Text>
                    <View style={styles.menuGroup}>
                        <MenuItem
                            icon="person"
                            color="#4ECDC4"
                            title="Vücut Ölçüleri"
                            value={`${user?.height || "-"} cm • ${
                                user?.weight || "-"
                            } kg`}
                            onPress={showComingSoon}
                        />
                        <View style={styles.separator} />
                        <MenuItem
                            icon="fitness"
                            color="#FFD93D"
                            title="Deneyim Seviyesi"
                            value={formatEnum(user?.experience_level)}
                            onPress={showComingSoon}
                        />
                        <View style={styles.separator} />
                        <MenuItem
                            icon="trophy"
                            color="#FF6B6B"
                            title="Haftalık Hedef"
                            value={`${user?.weekly_goal || 3} Antrenman`}
                            onPress={showComingSoon}
                        />
                    </View>
                </View>

                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionHeader}>TERCİHLER</Text>
                    <View style={styles.menuGroup}>
                        <MenuItem
                            icon="notifications"
                            color="#A569BD"
                            title="Antrenman Bildirimleri"
                            isSwitch
                            switchValue={notifications.workoutReminder}
                            onSwitchChange={(v: boolean) =>
                                setNotifications((prev) => ({
                                    ...prev,
                                    workoutReminder: v,
                                }))
                            }
                        />
                        <View style={styles.separator} />
                        <MenuItem
                            icon="moon"
                            color="#95A5A6"
                            title="Tema Ayarları"
                            value="Karanlık Mod (Varsayılan)"
                            onPress={showComingSoon}
                        />
                    </View>
                </View>

                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionHeader}>HESAP</Text>
                    <View style={styles.menuGroup}>
                        <MenuItem
                            icon="mail"
                            color={COLORS.textDim}
                            title="E-posta"
                            value={user?.email}
                            showChevron={false}
                        />
                        <View style={styles.separator} />
                        <MenuItem
                            icon="shield-checkmark"
                            color={COLORS.textDim}
                            title="Gizlilik ve Güvenlik"
                            onPress={showComingSoon}
                        />
                    </View>
                </View>

                {/* --- 4. FOOTER --- */}
                <View style={styles.footerContainer}>
                    <Pressable
                        style={styles.logoutButton}
                        onPress={handleLogout}
                    >
                        <Ionicons
                            name="log-out-outline"
                            size={20}
                            color="#FF6B6B"
                        />
                        <Text style={styles.logoutText}>Çıkış Yap</Text>
                    </Pressable>

                    <Text style={styles.versionText}>PaceUp v1.0.0</Text>
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>
        </View>
    );
};

export default ProfileScreen;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    scrollContent: { paddingBottom: 20 },

    // HEADER & GRADIENT
    headerGradient: {
        paddingTop: 85, // <--- BURASI ARTIRILDI (Eskiden 60'tı, tepeden margin etkisi verir)
        paddingBottom: 50,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        alignItems: "center",
    },
    profileContent: { alignItems: "center" },
    avatarContainer: { marginBottom: 15, position: "relative" },
    avatarPlaceholder: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: COLORS.card,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 4,
        borderColor: "rgba(255,255,255,0.1)",
    },
    avatarText: { fontSize: 40, fontWeight: "bold", color: COLORS.text },
    editBadge: {
        position: "absolute",
        bottom: 0,
        right: 0,
        backgroundColor: COLORS.accent,
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 3,
        borderColor: COLORS.background,
    },
    userName: {
        fontSize: 24,
        fontWeight: "800",
        color: COLORS.white,
        marginBottom: 5,
    },
    memberChip: {
        backgroundColor: "rgba(255,255,255,0.15)",
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 20,
    },
    memberText: {
        color: "rgba(255,255,255,0.9)",
        fontSize: 12,
        fontWeight: "600",
    },

    // FLOATING STATS
    statsCard: {
        flexDirection: "row",
        backgroundColor: COLORS.card,
        marginHorizontal: 20,
        borderRadius: 20,
        paddingVertical: 20,
        marginTop: -35, // Floating effect
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 10,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        alignItems: "center",
        justifyContent: "space-evenly",
    },
    statItem: { alignItems: "center", width: "30%" },
    statValue: {
        fontSize: 22,
        fontWeight: "800",
        color: COLORS.text,
        marginBottom: 2,
    },
    statLabel: {
        fontSize: 12,
        color: COLORS.textDim,
        fontWeight: "600",
        textTransform: "uppercase",
    },
    verticalDivider: {
        width: 1,
        height: 30,
        backgroundColor: COLORS.cardBorder,
    },

    // MENU SECTIONS
    sectionContainer: { marginTop: 25, paddingHorizontal: 20 },
    sectionHeader: {
        color: COLORS.textDim,
        fontSize: 12,
        fontWeight: "700",
        marginBottom: 10,
        marginLeft: 10,
    },
    menuGroup: {
        backgroundColor: COLORS.card,
        borderRadius: 16,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    menuItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 16,
        paddingHorizontal: 16,
    },
    menuItemPressed: { backgroundColor: COLORS.cardVariant },
    menuLeft: { flexDirection: "row", alignItems: "center", gap: 15, flex: 1 },
    iconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: "center",
        alignItems: "center",
    },
    menuTitle: { color: COLORS.text, fontSize: 16, fontWeight: "600" },
    menuSubtitle: { color: COLORS.textDim, fontSize: 13, marginTop: 2 },
    menuRight: { flexDirection: "row", alignItems: "center" },
    separator: {
        height: 1,
        backgroundColor: COLORS.cardBorder,
        marginLeft: 67,
    },

    // FOOTER
    footerContainer: { marginTop: 40, alignItems: "center", gap: 20 },
    logoutButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 25,
        backgroundColor: "rgba(255, 107, 107, 0.1)",
        borderWidth: 1,
        borderColor: "rgba(255, 107, 107, 0.3)",
    },
    logoutText: { color: "#FF6B6B", fontSize: 16, fontWeight: "700" },
    versionText: { color: COLORS.textDim, fontSize: 12 },
});
