import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import React, { useContext, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// --- NATIVE MODÜLLER ---
import DateTimePicker from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";

import { COLORS } from "@/constants/Colors";
import { API_URL } from "@/constants/Config";
import { AuthContext } from "@/utils/authContext";

// --- SEÇENEK SABİTLERİ ---
const GENDER_OPTIONS = [
  { label: "Erkek", value: "male" },
  { label: "Kadın", value: "female" },
  { label: "Diğer", value: "other" },
];

const EXPERIENCE_OPTIONS = [
  { label: "Başlangıç", value: "beginner" },
  { label: "Orta Seviye", value: "intermediate" },
  { label: "İleri Seviye", value: "advanced" },
];

const DISTANCE_OPTIONS = [
  { label: "5K", value: "5K" },
  { label: "10K", value: "10K" },
  { label: "Yarı Maraton", value: "half_marathon" },
  { label: "Maraton", value: "marathon" },
];

// --- YARDIMCI FONKSİYONLAR ---
const generateNumberRange = (start: number, end: number, suffix: string) => {
  const options = [];
  for (let i = start; i <= end; i++) {
    options.push({ label: `${i} ${suffix}`, value: i });
  }
  return options;
};

// Pace için dakika (3dk - 15dk arası mantıklı) ve saniye (0-59) dizileri
const PACE_MINUTES = Array.from({ length: 13 }, (_, i) => i + 3); // 3, 4, ... 15
const PACE_SECONDS = Array.from({ length: 60 }, (_, i) => i); // 0, 1, ... 59

const ProfileScreen = () => {
  const { user, logOut, refreshUserData } = useContext(AuthContext);
  const [uploading, setUploading] = useState(false);

  // --- MODAL STATE ---
  const [modalVisible, setModalVisible] = useState(false);

  // Edit Config: 'text', 'picker', 'date', 'time', 'pace'
  const [editConfig, setEditConfig] = useState<any>({
    key: "",
    title: "",
    type: "text",
    options: [],
  });

  // Geçici Değerler
  const [tempValue, setTempValue] = useState<any>(""); // Text ve Tekli Picker için
  const [dateValue, setDateValue] = useState(new Date()); // Date ve Time için
  const [paceValue, setPaceValue] = useState({ min: 5, sec: 30 }); // Pace için {min, sec}

  // --- GÖRÜNTÜLEME FORMATLAYICILARI ---
  const formatDisplayTime = (timeStr: string) =>
    timeStr?.substring(0, 5) || "09:00";

  const formatDisplayPace = (seconds: number) => {
    if (!seconds) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // --- ACTIONS ---
  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("İzin Gerekli", "Galeri izni vermelisiniz.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) uploadProfileImage(result.assets[0].uri);
  };

  const uploadProfileImage = async (uri: string) => {
    setUploading(true);
    try {
      const token = await AsyncStorage.getItem("auth-access-token");
      const formData = new FormData();
      const filename = uri.split("/").pop();
      const match = /\.(\w+)$/.exec(filename || "");
      const type = match ? `image/${match[1]}` : `image/jpeg`;

      formData.append("profile_image", {
        uri: Platform.OS === "android" ? uri : uri.replace("file://", ""),
        name: filename || "profile.jpg",
        type,
      } as any);

      await fetch(`${API_URL}/users/me/`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: formData,
      });
      await refreshUserData();
    } catch (e) {
      Alert.alert("Hata", "Fotoğraf yüklenemedi.");
    } finally {
      setUploading(false);
    }
  };

  const openEditor = (config: any) => {
    setEditConfig(config);
    const currentVal = user?.[config.key];

    if (config.type === "date") {
      setDateValue(currentVal ? new Date(currentVal) : new Date(1995, 0, 1));
    } else if (config.type === "time") {
      const [h, m] = (currentVal || "09:00").split(":");
      const d = new Date();
      d.setHours(parseInt(h), parseInt(m));
      setDateValue(d);
    } else if (config.type === "pace") {
      // Saniyeyi Dakika/Saniye objesine çevir
      const totalSec = currentVal || 330; // Default 5:30
      setPaceValue({
        min: Math.floor(totalSec / 60),
        sec: totalSec % 60,
      });
    } else if (config.type === "picker") {
      setTempValue(currentVal || config.options[0]?.value);
    } else {
      setTempValue(String(currentVal || ""));
    }

    setModalVisible(true);
  };

  const saveChange = async () => {
    try {
      const token = await AsyncStorage.getItem("auth-access-token");
      let payloadValue: any = tempValue;

      // Özel payload hazırlığı
      if (editConfig.type === "date") {
        const d = dateValue;
        payloadValue = d.toISOString().split("T")[0];
      } else if (editConfig.type === "time") {
        const h = dateValue.getHours();
        const m = dateValue.getMinutes();
        payloadValue = `${h < 10 ? "0" + h : h}:${m < 10 ? "0" + m : m}:00`;
      } else if (editConfig.type === "pace") {
        // Dakika/Saniye -> Toplam Saniye
        payloadValue = paceValue.min * 60 + paceValue.sec;
      } else if (editConfig.type === "number") {
        payloadValue = Number(tempValue);
      }

      const response = await fetch(`${API_URL}/users/me/`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ [editConfig.key]: payloadValue }),
      });

      if (response.ok) {
        await refreshUserData();
        setModalVisible(false);
      } else {
        Alert.alert("Hata", "Kaydedilemedi");
      }
    } catch (e) {
      Alert.alert("Hata", "Bağlantı hatası.");
    }
  };

  const toggleSwitch = async (key: string, value: boolean) => {
    try {
      const token = await AsyncStorage.getItem("auth-access-token");
      await fetch(`${API_URL}/users/me/`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ [key]: value }),
      });
      await refreshUserData();
    } catch (e) {
      console.log(e);
    }
  };

  // --- SUB COMPONENTS ---
  const Section = ({ title, children }: any) => (
    <View style={styles.sectionContainer}>
      <Text style={styles.sectionHeader}>{title}</Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );

  const InfoRow = ({ label, value, onPress, isLast }: any) => (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        pressed && styles.rowPressed,
        isLast && styles.rowLast,
      ]}
      onPress={onPress}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        <Text style={styles.rowValue}>{value || "Seçiniz"}</Text>
        {onPress && (
          <Ionicons
            name="chevron-forward"
            size={16}
            color={COLORS.textDim}
            style={{ marginLeft: 6 }}
            opacity={0.5}
          />
        )}
      </View>
    </Pressable>
  );

  const ToggleRow = ({ label, value, onValueChange, isLast }: any) => (
    <View style={[styles.row, isLast && styles.rowLast]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: COLORS.cardBorder, true: COLORS.accent }}
        thumbColor={COLORS.white}
      />
    </View>
  );

  // --- MODAL CONTENT RENDERERS ---

  const renderModalContent = () => {
    // 1. DATE / TIME PICKER (Native iOS Wheel)
    if (editConfig.type === "date" || editConfig.type === "time") {
      return (
        <View style={styles.pickerWrapper}>
          <DateTimePicker
            value={dateValue}
            mode={editConfig.type}
            is24Hour={true}
            display="spinner"
            onChange={(_, selectedDate) =>
              setDateValue(selectedDate || dateValue)
            }
            textColor="white"
            themeVariant="dark"
            style={{ height: 180 }}
          />
        </View>
      );
    }

    // 2. PACE PICKER (Custom Dual Column)
    if (editConfig.type === "pace") {
      return (
        <View style={styles.dualPickerContainer}>
          <View style={styles.pickerColumn}>
            <Text style={styles.columnLabel}>Dakika</Text>
            <Picker
              selectedValue={paceValue.min}
              onValueChange={(v) => setPaceValue({ ...paceValue, min: v })}
              itemStyle={{ color: "white", fontSize: 20 }}
              style={{ width: 100, color: "white" }}
            >
              {PACE_MINUTES.map((m) => (
                <Picker.Item key={m} label={m.toString()} value={m} />
              ))}
            </Picker>
          </View>
          <Text style={styles.pickerSeparator}>:</Text>
          <View style={styles.pickerColumn}>
            <Text style={styles.columnLabel}>Saniye</Text>
            <Picker
              selectedValue={paceValue.sec}
              onValueChange={(v) => setPaceValue({ ...paceValue, sec: v })}
              itemStyle={{ color: "white", fontSize: 20 }}
              style={{ width: 100, color: "white" }}
            >
              {PACE_SECONDS.map((s) => (
                <Picker.Item
                  key={s}
                  label={s < 10 ? `0${s}` : s.toString()}
                  value={s}
                />
              ))}
            </Picker>
          </View>
        </View>
      );
    }

    // 3. STANDARD PICKER (Gender, Experience etc.)
    if (editConfig.type === "picker") {
      return (
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={tempValue}
            onValueChange={(itemValue) => setTempValue(itemValue)}
            itemStyle={{ color: "white", fontSize: 20 }}
            dropdownIconColor="white"
            style={{ color: "white" }}
          >
            {editConfig.options.map((opt: any) => (
              <Picker.Item
                key={opt.value}
                label={opt.label.toString()}
                value={opt.value}
              />
            ))}
          </Picker>
        </View>
      );
    }

    // 4. FALLBACK TEXT INPUT
    return (
      <View>
        <TextInput
          style={styles.input}
          value={tempValue}
          onChangeText={setTempValue}
          keyboardType="default"
          placeholder="Değer giriniz"
          placeholderTextColor={COLORS.textDim}
          autoFocus
        />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profil</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* USER CARD */}
          <View style={styles.userCard}>
            <Pressable onPress={handlePickImage} style={styles.avatarContainer}>
              {user?.profile_image ? (
                <Image
                  source={{ uri: user.profile_image }}
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>
                    {user?.first_name?.[0] || "U"}
                  </Text>
                </View>
              )}
              {uploading && (
                <ActivityIndicator
                  size="small"
                  color={COLORS.accent}
                  style={StyleSheet.absoluteFill}
                />
              )}
              <View style={styles.editBadge}>
                <Text style={styles.editBadgeText}>Fotoğraf</Text>
              </View>
            </Pressable>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>
                {user?.first_name} {user?.last_name}
              </Text>
              <View style={styles.statsRow}>
                <Text style={styles.statText}>
                  🔥 {user?.current_streak} Gün Seri
                </Text>
                <Text style={styles.statDot}>•</Text>
                <Text style={styles.statText}>
                  🏆 {user?.experience_level?.toUpperCase()}
                </Text>
              </View>
            </View>
          </View>

          {/* SECTION 1: KİMLİK & FİZİKSEL */}
          <Section title="KİMLİK VE FİZİKSEL">
            <InfoRow
              label="Ad"
              value={user?.first_name}
              onPress={() =>
                openEditor({ key: "first_name", title: "Ad", type: "text" })
              }
            />
            <InfoRow
              label="Soyad"
              value={user?.last_name}
              onPress={() =>
                openEditor({ key: "last_name", title: "Soyad", type: "text" })
              }
            />

            <InfoRow
              label="Cinsiyet"
              value={
                GENDER_OPTIONS.find((o) => o.value === user?.gender)?.label
              }
              onPress={() =>
                openEditor({
                  key: "gender",
                  title: "Cinsiyet",
                  type: "picker",
                  options: GENDER_OPTIONS,
                })
              }
            />

            <InfoRow
              label="Doğum Tarihi"
              value={user?.date_of_birth}
              onPress={() =>
                openEditor({
                  key: "date_of_birth",
                  title: "Doğum Tarihi",
                  type: "date",
                })
              }
            />

            <InfoRow
              label="Boy"
              value={user?.height ? `${user.height} cm` : ""}
              onPress={() =>
                openEditor({
                  key: "height",
                  title: "Boy",
                  type: "picker",
                  options: generateNumberRange(140, 230, "cm"),
                })
              }
            />

            <InfoRow
              label="Kilo"
              value={user?.weight ? `${user.weight} kg` : ""}
              onPress={() =>
                openEditor({
                  key: "weight",
                  title: "Kilo",
                  type: "picker",
                  options: generateNumberRange(40, 160, "kg"),
                })
              }
              isLast
            />
          </Section>

          {/* SECTION 2: KOŞU PROFİLİ */}
          <Section title="KOŞU PROFİLİ">
            <InfoRow
              label="Deneyim"
              value={
                EXPERIENCE_OPTIONS.find(
                  (o) => o.value === user?.experience_level,
                )?.label
              }
              onPress={() =>
                openEditor({
                  key: "experience_level",
                  title: "Deneyim Seviyesi",
                  type: "picker",
                  options: EXPERIENCE_OPTIONS,
                })
              }
            />
            <InfoRow
              label="Mesafe Tercihi"
              value={
                DISTANCE_OPTIONS.find(
                  (o) => o.value === user?.preferred_distance,
                )?.label
              }
              onPress={() =>
                openEditor({
                  key: "preferred_distance",
                  title: "Tercih Edilen Mesafe",
                  type: "picker",
                  options: DISTANCE_OPTIONS,
                })
              }
            />
            <InfoRow
              label="Haftalık Hedef"
              value={`${user?.weekly_goal} Antrenman`}
              onPress={() =>
                openEditor({
                  key: "weekly_goal",
                  title: "Haftalık Hedef",
                  type: "picker",
                  options: generateNumberRange(1, 7, "Gün"),
                })
              }
            />
            <InfoRow
              label="Maksimum Mesafe"
              value={`${user?.current_max_distance} km`}
              onPress={() =>
                openEditor({
                  key: "current_max_distance",
                  title: "Maks. Mesafe",
                  type: "number",
                })
              }
            />

            {/* YENİ PACE ROW */}
            <InfoRow
              label="Ortalama Pace"
              value={`${formatDisplayPace(user?.current_pace)} /km`}
              onPress={() =>
                openEditor({
                  key: "current_pace",
                  title: "Pace Seçimi",
                  type: "pace",
                })
              }
              isLast
            />
          </Section>

          {/* SECTION 3: TERCİHLER (Eksiksiz) */}
          <Section title="TERCİHLER">
            <InfoRow
              label="Hatırlatma Saati"
              value={formatDisplayTime(user?.preferred_reminder_time)}
              onPress={() =>
                openEditor({
                  key: "preferred_reminder_time",
                  title: "Hatırlatma Saati",
                  type: "time",
                })
              }
            />
            <ToggleRow
              label="Antrenman Bildirimleri"
              value={user?.notification_workout_reminder}
              onValueChange={(v: boolean) =>
                toggleSwitch("notification_workout_reminder", v)
              }
            />
            <ToggleRow
              label="Haftalık Rapor"
              value={user?.notification_weekly_report}
              onValueChange={(v: boolean) =>
                toggleSwitch("notification_weekly_report", v)
              }
            />
            <ToggleRow
              label="Başarı Rozetleri"
              value={user?.notification_achievements}
              onValueChange={(v: boolean) =>
                toggleSwitch("notification_achievements", v)
              }
            />
            <ToggleRow
              label="Plan Güncellemeleri"
              value={user?.notification_plan_updates}
              onValueChange={(v: boolean) =>
                toggleSwitch("notification_plan_updates", v)
              }
              isLast
            />
          </Section>

          {/* FOOTER */}
          <View style={styles.footer}>
            <Pressable style={styles.logoutBtn} onPress={logOut}>
              <Text style={styles.logoutText}>Oturumu Kapat</Text>
            </Pressable>
            <Text style={styles.versionText}>PaceUp v2.2.0 (Build 2401)</Text>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* --- NATIVE STYLE MODAL --- */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Pressable
                onPress={() => setModalVisible(false)}
                style={styles.headerBtn}
              >
                <Text style={styles.headerBtnTextCancel}>Vazgeç</Text>
              </Pressable>
              <Text style={styles.modalTitle}>{editConfig.title}</Text>
              <Pressable onPress={saveChange} style={styles.headerBtn}>
                <Text style={styles.headerBtnTextSave}>Bitti</Text>
              </Pressable>
            </View>

            {/* Body */}
            <View style={styles.modalBody}>{renderModalContent()}</View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  scrollContent: { paddingBottom: 80 },

  // User Card & Sections
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 24,
    marginBottom: 10,
  },
  avatarContainer: { marginRight: 20, position: "relative" },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: COLORS.cardBorder,
  },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.card,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: COLORS.cardBorder,
  },
  avatarInitial: { fontSize: 28, color: COLORS.textDim, fontWeight: "bold" },
  editBadge: {
    position: "absolute",
    bottom: -5,
    alignSelf: "center",
    backgroundColor: COLORS.cardVariant,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.background,
  },
  editBadgeText: { fontSize: 9, color: COLORS.textDim, fontWeight: "600" },
  userInfo: { flex: 1, justifyContent: "center" },
  userName: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 2,
  },
  statsRow: { flexDirection: "row", alignItems: "center" },
  statText: { fontSize: 12, color: COLORS.secondary, fontWeight: "600" },
  statDot: { color: COLORS.textDim, marginHorizontal: 6, fontSize: 10 },
  sectionContainer: { marginBottom: 30 },
  sectionHeader: {
    fontSize: 12,
    color: COLORS.textDim,
    fontWeight: "600",
    marginBottom: 8,
    marginLeft: 20,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionContent: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    marginHorizontal: 20,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  rowLast: { borderBottomWidth: 0 },
  rowPressed: { backgroundColor: COLORS.cardVariant },
  rowLabel: { fontSize: 15, color: COLORS.text, fontWeight: "500" },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    justifyContent: "flex-end",
  },
  rowValue: {
    fontSize: 15,
    color: COLORS.textDim,
    marginRight: 4,
    textAlign: "right",
  },
  footer: { paddingHorizontal: 20, alignItems: "center", paddingBottom: 20 },
  logoutBtn: {
    width: "100%",
    backgroundColor: COLORS.card,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 15,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  logoutText: { color: COLORS.danger, fontSize: 15, fontWeight: "600" },
  versionText: { fontSize: 11, color: COLORS.textDim, opacity: 0.4 },

  // --- NATIVE MODAL STYLES ---
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#1C1C1E",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
    backgroundColor: "#2C2C2E",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  modalTitle: { fontSize: 16, fontWeight: "600", color: COLORS.white },
  headerBtn: { padding: 5 },
  headerBtnTextCancel: { color: COLORS.textDim, fontSize: 16 },
  headerBtnTextSave: { color: COLORS.accent, fontSize: 16, fontWeight: "bold" },
  modalBody: { paddingVertical: 10, backgroundColor: "#1C1C1E" },

  pickerWrapper: { justifyContent: "center" },

  // Custom Dual Picker Styles
  dualPickerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  pickerColumn: { alignItems: "center" },
  columnLabel: {
    color: COLORS.textDim,
    fontSize: 12,
    marginBottom: -10,
    zIndex: 1,
  },
  pickerSeparator: {
    fontSize: 30,
    color: "white",
    paddingBottom: 20,
    paddingHorizontal: 10,
  },

  input: {
    backgroundColor: "#2C2C2E",
    color: COLORS.text,
    fontSize: 18,
    padding: 16,
    borderRadius: 12,
    margin: 20,
    borderWidth: 1,
    borderColor: "#3A3A3C",
  },
});

export default ProfileScreen;
