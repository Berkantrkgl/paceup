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

const DAYS_MAP = [
  "Pazartesi",
  "Salı",
  "Çarşamba",
  "Perşembe",
  "Cuma",
  "Cumartesi",
  "Pazar",
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
const PACE_MINUTES = Array.from({ length: 13 }, (_, i) => i + 3);
const PACE_SECONDS = Array.from({ length: 60 }, (_, i) => i);

const ProfileScreen = () => {
  const { user, logOut, refreshUserData } = useContext(AuthContext);
  const [uploading, setUploading] = useState(false);

  // --- MODAL STATE ---
  const [modalVisible, setModalVisible] = useState(false);

  // Edit Config: 'text', 'picker', 'date', 'time', 'pace', 'multiselect'
  const [editConfig, setEditConfig] = useState<any>({
    key: "",
    title: "",
    type: "text",
    options: [],
  });

  // Geçici Değerler
  const [tempValue, setTempValue] = useState<any>(""); // Text ve Tekli Picker için
  const [tempArrayValue, setTempArrayValue] = useState<number[]>([]); // Çoklu Seçim (Günler) için
  const [dateValue, setDateValue] = useState(new Date()); // Date ve Time için
  const [paceValue, setPaceValue] = useState({ min: 5, sec: 30 }); // Pace için

  // --- GÖRÜNTÜLEME FORMATLAYICILARI ---
  const formatDisplayTime = (timeStr: string) =>
    timeStr?.substring(0, 5) || "09:00";

  const formatDisplayPace = (seconds: number) => {
    if (!seconds) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const formatDisplayDays = (daysArray: number[]) => {
    if (!daysArray || daysArray.length === 0) return "Seçilmedi";
    // 0=Pzt, 6=Paz. İlk 3 harflerini alıp gösterelim.
    return daysArray.map((d) => DAYS_MAP[d].substring(0, 3)).join(", ");
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
    const currentVal = user?.[config.key as keyof typeof user];

    if (config.type === "date") {
      setDateValue(
        currentVal ? new Date(currentVal as string) : new Date(1995, 0, 1),
      );
    } else if (config.type === "time") {
      const [h, m] = ((currentVal as string) || "09:00").split(":");
      const d = new Date();
      d.setHours(parseInt(h), parseInt(m));
      setDateValue(d);
    } else if (config.type === "pace") {
      const totalSec = (currentVal as number) || 330;
      setPaceValue({ min: Math.floor(totalSec / 60), sec: totalSec % 60 });
    } else if (config.type === "multiselect") {
      setTempArrayValue((currentVal as number[]) || []);
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

      if (editConfig.type === "date") {
        payloadValue = dateValue.toISOString().split("T")[0];
      } else if (editConfig.type === "time") {
        const h = dateValue.getHours();
        const m = dateValue.getMinutes();
        payloadValue = `${h < 10 ? "0" + h : h}:${m < 10 ? "0" + m : m}:00`;
      } else if (editConfig.type === "pace") {
        payloadValue = paceValue.min * 60 + paceValue.sec;
      } else if (editConfig.type === "number") {
        payloadValue = Number(tempValue);
      } else if (editConfig.type === "multiselect") {
        payloadValue = tempArrayValue.sort(); // Günleri sıraya dizerek kaydet
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

  const toggleDaySelection = (dayIndex: number) => {
    if (tempArrayValue.includes(dayIndex)) {
      setTempArrayValue(tempArrayValue.filter((d) => d !== dayIndex));
    } else {
      setTempArrayValue([...tempArrayValue, dayIndex]);
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

  const InfoRow = ({ label, value, onPress, isLast, isReadonly }: any) => (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        pressed && !isReadonly && styles.rowPressed,
        isLast && styles.rowLast,
      ]}
      onPress={!isReadonly ? onPress : undefined}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        <Text style={[styles.rowValue, isReadonly && { color: COLORS.accent }]}>
          {value}
        </Text>
        {!isReadonly && (
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

    if (editConfig.type === "pace") {
      return (
        <View style={styles.dualPickerContainer}>
          <View style={styles.pickerColumn}>
            <Text style={styles.columnLabel}>Dakika</Text>
            <Picker
              selectedValue={paceValue.min}
              onValueChange={(v) => setPaceValue({ ...paceValue, min: v })}
              style={{ width: 100, color: "white" }}
              itemStyle={{ color: "white" }}
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
              style={{ width: 100, color: "white" }}
              itemStyle={{ color: "white" }}
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

    if (editConfig.type === "multiselect") {
      return (
        <View style={styles.multiselectContainer}>
          {DAYS_MAP.map((day, index) => {
            const isSelected = tempArrayValue.includes(index);
            return (
              <Pressable
                key={index}
                style={[
                  styles.dayButton,
                  isSelected && styles.dayButtonSelected,
                ]}
                onPress={() => toggleDaySelection(index)}
              >
                <Text
                  style={[
                    styles.dayButtonText,
                    isSelected && styles.dayButtonTextSelected,
                  ]}
                >
                  {day}
                </Text>
                {isSelected && (
                  <Ionicons
                    name="checkmark"
                    size={18}
                    color={COLORS.background}
                  />
                )}
              </Pressable>
            );
          })}
        </View>
      );
    }

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

    return (
      <View>
        <TextInput
          style={styles.input}
          value={tempValue}
          onChangeText={setTempValue}
          keyboardType={editConfig.type === "number" ? "numeric" : "default"}
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
                <Text
                  style={[
                    styles.statText,
                    user?.is_premium && { color: COLORS.accent },
                  ]}
                >
                  {user?.is_premium ? "💎 PREMIUM" : "🏃‍♂️ STANDART"}
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

          {/* SECTION 2: KOŞU PROFİLİ (Güncellendi) */}
          <Section title="KOŞU PROFİLİ">
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
            />
            <InfoRow
              label="Maksimum Mesafe"
              value={`${user?.max_runned_distance} km`}
              onPress={() =>
                openEditor({
                  key: "max_runned_distance",
                  title: "Maks. Mesafe (km)",
                  type: "number",
                })
              }
            />
            <InfoRow
              label="Koşu Günleri"
              value={formatDisplayDays(user?.preferred_running_days || [])}
              onPress={() =>
                openEditor({
                  key: "preferred_running_days",
                  title: "Koşu Günleri Seçimi",
                  type: "multiselect",
                })
              }
            />
          </Section>

          {/* SECTION 3: HESAP BİLGİLERİ (YENİ) */}
          <Section title="HESAP BİLGİLERİ">
            <InfoRow
              label="Üyelik Tipi"
              value={user?.is_premium ? "Premium" : "Standart"}
              isReadonly
            />
            <InfoRow
              label="Kalan Erteleme Hakkı"
              value={
                user?.is_premium
                  ? "Sınırsız"
                  : `${user?.remaining_reschedules} / 2`
              }
              isReadonly
            />
            <InfoRow
              label="Kullanılan AI Token"
              value={`${user?.total_tokens_used}`}
              isReadonly
              isLast
            />
          </Section>

          {/* SECTION 4: TERCİHLER */}
          <Section title="BİLDİRİM TERCİHLERİ">
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
            <Text style={styles.versionText}>
              PaceUp v2.3.0 (Centered Modal Update)
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* --- CENTERED MODAL --- */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setModalVisible(false)} // Dışarı tıklanınca kapat
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{
              width: "100%",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Pressable
              style={styles.modalCenteredContainer}
              onPress={(e) => e.stopPropagation()} // İçeri tıklanmayı engelle
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
                    <Text style={styles.headerBtnTextSave}>Kaydet</Text>
                  </Pressable>
                </View>

                {/* Body */}
                <View style={styles.modalBody}>{renderModalContent()}</View>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
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

  // --- CENTERED MODAL STYLES ---
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)", // Biraz daha koyu bir arka plan
    justifyContent: "center", // DİKKAT: Artık ortalıyoruz
    alignItems: "center",
  },
  modalCenteredContainer: {
    width: "90%", // Ekranın %90'ını kaplasın
    maxWidth: 400,
  },
  modalContent: {
    backgroundColor: "#1C1C1E",
    borderRadius: 20, // Köşeleri tüm kenarlardan yuvarlattık
    overflow: "hidden", // Köşe taşmalarını engellemek için
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
    backgroundColor: "#242426",
  },
  modalTitle: { fontSize: 16, fontWeight: "600", color: COLORS.white },
  headerBtn: { padding: 5 },
  headerBtnTextCancel: { color: COLORS.textDim, fontSize: 15 },
  headerBtnTextSave: { color: COLORS.accent, fontSize: 15, fontWeight: "bold" },
  modalBody: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: "#1C1C1E",
    minHeight: 150,
    justifyContent: "center",
  },

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
    zHeight: 1,
  },
  pickerSeparator: {
    fontSize: 30,
    color: "white",
    paddingBottom: 20,
    paddingHorizontal: 10,
  },

  // --- MULTISELECT STYLES ---
  multiselectContainer: { padding: 10 },
  dayButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: "#2C2C2E",
  },
  dayButtonSelected: {
    backgroundColor: COLORS.accent + "20",
    borderColor: COLORS.accent,
    borderWidth: 1,
  },
  dayButtonText: { color: COLORS.white, fontSize: 16 },
  dayButtonTextSelected: { color: COLORS.accent, fontWeight: "bold" },

  input: {
    backgroundColor: "#2C2C2E",
    color: COLORS.text,
    fontSize: 18,
    padding: 16,
    borderRadius: 12,
    margin: 10,
    borderWidth: 1,
    borderColor: "#3A3A3C",
    textAlign: "center",
  },
});

export default ProfileScreen;
