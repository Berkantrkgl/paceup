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
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import DateTimePicker from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";

import { PremiumModal } from "@/components/PremiumModal";
import { COLORS } from "@/constants/Colors";
import { API_URL } from "@/constants/Config";
import { AuthContext } from "@/utils/authContext";

// ============================================================
// SABİTLER
// ============================================================
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

const DAYS_SHORT = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

const TOKEN_LIMIT_FREE = 50000;

const generateNumberRange = (start: number, end: number, suffix: string) => {
  const options = [];
  for (let i = start; i <= end; i++) {
    options.push({ label: `${i} ${suffix}`, value: i });
  }
  return options;
};

const PACE_MINUTES = Array.from({ length: 13 }, (_, i) => i + 3);
const PACE_SECONDS = Array.from({ length: 60 }, (_, i) => i);

// ============================================================
// ANA EKRAN
// ============================================================
const ProfileScreen = () => {
  const { user, logOut, refreshUserData } = useContext(AuthContext);
  const [uploading, setUploading] = useState(false);

  // Edit Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [editConfig, setEditConfig] = useState<any>({
    key: "",
    title: "",
    type: "text",
    options: [],
  });
  const [tempValue, setTempValue] = useState<any>("");
  const [tempArrayValue, setTempArrayValue] = useState<number[]>([]);
  const [dateValue, setDateValue] = useState(new Date());
  const [paceValue, setPaceValue] = useState({ min: 5, sec: 30 });
  const [paceUnknown, setPaceUnknown] = useState(false);

  // Avatar Modal
  const [avatarModalVisible, setAvatarModalVisible] = useState(false);
  // Premium Modal
  const [premiumModalVisible, setPremiumModalVisible] = useState(false);

  // ============================================================
  // GÖRÜNTÜLEME FORMATLAYICILARI
  // ============================================================
  const formatDisplayTime = (timeStr: string) =>
    timeStr?.substring(0, 5) || "09:00";

  const formatDisplayPace = (seconds: number | null | undefined) => {
    if (seconds === null || seconds === undefined) return "--:--";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const formatDisplayDays = (daysArray: number[]) => {
    if (!daysArray || daysArray.length === 0) return "Seçilmedi";
    return daysArray.map((d) => DAYS_MAP[d].substring(0, 3)).join(", ");
  };

  const getTokenProgressPercent = () => {
    if (!user || user.is_premium) return 100;
    return Math.min(
      100,
      ((user.total_tokens_used || 0) / TOKEN_LIMIT_FREE) * 100,
    );
  };

  const getTokenProgressColor = () => {
    const pct = getTokenProgressPercent();
    if (pct >= 90) return "#FF5252";
    if (pct >= 70) return "#FFA500";
    return COLORS.accent;
  };

  // ============================================================
  // ACTIONS
  // ============================================================
  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("İzin Gerekli", "Galeri izni vermelisiniz.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
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
      if (currentVal === null || currentVal === undefined) {
        setPaceUnknown(true);
        setPaceValue({ min: 8, sec: 0 });
      } else {
        setPaceUnknown(false);
        const totalSec = currentVal as number;
        setPaceValue({ min: Math.floor(totalSec / 60), sec: totalSec % 60 });
      }
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
        payloadValue = paceUnknown ? null : paceValue.min * 60 + paceValue.sec;
      } else if (editConfig.type === "number") {
        payloadValue = Number(tempValue);
      } else if (editConfig.type === "multiselect") {
        payloadValue = tempArrayValue.sort();
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

  // ============================================================
  // SUB COMPONENTS
  // ============================================================
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

  // ============================================================
  // MODAL CONTENT
  // ============================================================
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
        <View>
          {/* Bilmiyorum toggle */}
          <Pressable
            style={styles.paceUnknownToggle}
            onPress={() => setPaceUnknown((prev) => !prev)}
          >
            <View
              style={[
                styles.paceUnknownCheck,
                paceUnknown && styles.paceUnknownCheckActive,
              ]}
            >
              {paceUnknown && (
                <Ionicons name="checkmark" size={14} color="#000" />
              )}
            </View>
            <Text style={styles.paceUnknownText}>Pace'imi bilmiyorum</Text>
          </Pressable>

          {/* Picker — bilmiyorum seçilince soluklaş */}
          <View
            style={[
              styles.dualPickerContainer,
              paceUnknown && { opacity: 0.3 },
            ]}
            pointerEvents={paceUnknown ? "none" : "auto"}
          >
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
        </View>
      );
    }
    if (editConfig.type === "multiselect") {
      return (
        <View style={styles.multiselectContainer}>
          <View style={styles.dayChipsRow}>
            {DAYS_MAP.map((_, index) => {
              const isSelected = tempArrayValue.includes(index);
              return (
                <Pressable
                  key={index}
                  style={[styles.dayChip, isSelected && styles.dayChipSelected]}
                  onPress={() => toggleDaySelection(index)}
                >
                  <Text
                    style={[
                      styles.dayChipText,
                      isSelected && styles.dayChipTextSelected,
                    ]}
                  >
                    {DAYS_SHORT[index]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.dayInfoBox}>
            <Ionicons
              name="information-circle-outline"
              size={14}
              color={COLORS.textDim}
            />
            <Text style={styles.dayInfoText}>
              Bu değişiklik mevcut aktif programınızı etkilemez. Yeni
              oluşturulacak programlarda baz alınır.
            </Text>
          </View>
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

  // ============================================================
  // TOKEN PROGRESS BAR
  // ============================================================
  const TokenCard = () => {
    const pct = getTokenProgressPercent();
    const remainingPct = Math.max(0, 100 - Math.round(pct));
    const color = getTokenProgressColor();

    return (
      <View style={styles.tokenCard}>
        {/* Başlık */}
        <View style={styles.tokenCardHeader}>
          <View style={styles.tokenCardTitleRow}>
            <Ionicons name="flash" size={16} color={color} />
            <Text style={styles.tokenCardTitle}>Kalan AI Kullanım Hakkı</Text>
          </View>
          {user?.is_premium ? (
            <View style={styles.premiumBadge}>
              <Text style={styles.premiumBadgeText}>💎 Sınırsız</Text>
            </View>
          ) : (
            <Text style={[styles.tokenPctText, { color }]}>
              %{remainingPct}
            </Text>
          )}
        </View>

        {/* Progress Bar */}
        {!user?.is_premium && (
          <>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${pct}%` as any, backgroundColor: color },
                ]}
              />
            </View>
          </>
        )}

        {/* Premium CTA */}
        {!user?.is_premium && (
          <TouchableOpacity
            style={[styles.upgradeCta, pct >= 90 && styles.upgradeCtaUrgent]}
            onPress={() => setPremiumModalVisible(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="flash" size={14} color="#000" />
            <Text style={styles.upgradeCtaText}>
              {pct >= 90
                ? "Limitin Dolmak Üzere! Premium'a Geç →"
                : "Premium'a Geç, Sınırsız Kullan →"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // ============================================================
  // RENDER
  // ============================================================
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
            <Pressable
              onPress={() => setAvatarModalVisible(true)}
              style={styles.avatarContainer}
            >
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
                <TouchableOpacity
                  onPress={() =>
                    !user?.is_premium && setPremiumModalVisible(true)
                  }
                >
                  <Text
                    style={[
                      styles.statText,
                      user?.is_premium && { color: COLORS.accent },
                    ]}
                  >
                    {user?.is_premium ? "💎 PREMIUM" : "🏃‍♂️ STANDART"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* TOKEN KARTI */}
          <TokenCard />

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
              isLast
            />
          </Section>

          {/* SECTION 3: HESAP BİLGİLERİ */}
          <Section title="HESAP BİLGİLERİ">
            <InfoRow
              label="Üyelik Tipi"
              value={user?.is_premium ? "Premium 💎" : "Standart"}
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
              isLast
            />
          </Section>

          {/* SECTION 4: BİLDİRİM TERCİHLERİ */}
          <Section title="BİLDİRİM TERCİHLERİ">
            <InfoRow
              label="Hatırlatma Saati"
              value={formatDisplayTime(user?.preferred_reminder_time ?? "")}
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
            <Text style={styles.versionText}>PaceUp v2.3.0</Text>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Edit Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setModalVisible(false)}
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
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.modalContent}>
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
                <View style={styles.modalBody}>{renderModalContent()}</View>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* Premium Modal */}
      <PremiumModal
        visible={premiumModalVisible}
        onClose={() => setPremiumModalVisible(false)}
        reason="general"
      />

      {/* Avatar Modal */}
      <Modal
        visible={avatarModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <Pressable
          style={styles.avatarModalOverlay}
          onPress={() => setAvatarModalVisible(false)}
        >
          <Pressable
            style={styles.avatarModalContent}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Fotoğraf */}
            {user?.profile_image ? (
              <Image
                source={{ uri: user.profile_image }}
                style={styles.avatarModalImage}
              />
            ) : (
              <View style={styles.avatarModalPlaceholder}>
                <Ionicons name="person" size={80} color={COLORS.textDim} />
              </View>
            )}

            {/* Değiştir */}
            <TouchableOpacity
              style={styles.avatarModalBtn}
              onPress={handlePickImage}
            >
              <Ionicons name="camera-outline" size={16} color={COLORS.text} />
              <Text style={styles.avatarModalBtnText}>
                {user?.profile_image ? "Fotoğrafı Değiştir" : "Fotoğraf Ekle"}
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

// ============================================================
// STYLES
// ============================================================
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

  // User Card
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 24,
    marginBottom: 4,
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

  // Token Card
  tokenCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  tokenCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  tokenCardTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  tokenCardTitle: { color: COLORS.text, fontSize: 14, fontWeight: "600" },
  tokenPctText: { fontSize: 13, fontWeight: "700" },
  premiumBadge: {
    backgroundColor: "rgba(255,69,1,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,69,1,0.3)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  premiumBadgeText: { color: COLORS.accent, fontSize: 11, fontWeight: "700" },
  progressBarBg: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginBottom: 16,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: { height: "100%", borderRadius: 3 },
  tokenCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  tokenUsedText: { color: COLORS.textDim, fontSize: 12 },
  tokenRemainingText: { fontSize: 12, fontWeight: "600" },
  upgradeCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingVertical: 10,
    gap: 6,
  },
  upgradeCtaUrgent: {
    backgroundColor: "#FF5252",
  },
  upgradeCtaText: {
    color: "#000",
    fontSize: 13,
    fontWeight: "700",
  },

  // Sections
  sectionContainer: { marginBottom: 36 },
  sectionHeader: {
    fontSize: 14,
    color: COLORS.textDim,
    fontWeight: "700",
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  sectionContent: {},
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.cardBorder,
  },
  rowLast: { borderBottomWidth: 0 },
  rowPressed: { backgroundColor: COLORS.card },
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

  // Footer
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

  // Edit Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCenteredContainer: { width: "90%", maxWidth: 400 },
  modalContent: {
    backgroundColor: "#1C1C1E",
    borderRadius: 20,
    overflow: "hidden",
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
  dayChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    marginBottom: 16,
  },
  dayChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#2C2C2E",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#3A3A3C",
  },
  dayChipSelected: {
    backgroundColor: COLORS.accent + "25",
    borderColor: COLORS.accent,
  },
  dayChipText: {
    color: COLORS.textDim,
    fontSize: 12,
    fontWeight: "600",
  },
  dayChipTextSelected: {
    color: COLORS.accent,
    fontWeight: "700",
  },
  dayInfoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 8,
    padding: 10,
  },
  dayInfoText: {
    flex: 1,
    color: COLORS.textDim,
    fontSize: 11,
    lineHeight: 16,
  },
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
  paceUnknownToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 4,
  },
  paceUnknownCheck: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#3A3A3C",
    backgroundColor: "#2C2C2E",
    justifyContent: "center",
    alignItems: "center",
  },
  paceUnknownCheckActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  paceUnknownText: {
    color: COLORS.text,
    fontSize: 15,
  },
  avatarModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarModalContent: {
    width: "97%",
    backgroundColor: COLORS.card,
    borderRadius: 20,
    alignItems: "center",
    padding: 16,
    gap: 14,
  },
  avatarModalImage: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 12,
  },
  avatarModalPlaceholder: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: COLORS.cardVariant,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
  },
  avatarModalBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: COLORS.cardVariant,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: "100%",
  },
  avatarModalBtnText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
  },
});

export default ProfileScreen;
