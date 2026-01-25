import { COLORS } from "@/constants/Colors";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { height, width } = Dimensions.get("window");

interface RescheduleModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (date: string) => void;
  planTitle: string;
}

export const RescheduleModal = ({
  visible,
  onClose,
  onConfirm,
  planTitle,
}: RescheduleModalProps) => {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Gelecek 14 günü oluştur
  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1); // Yarından başla
    return d;
  });

  const formatDate = (date: Date) => {
    return date.toISOString().split("T")[0]; // YYYY-MM-DD
  };

  const handleConfirm = () => {
    if (selectedDate) {
      onConfirm(formatDate(selectedDate));
    }
  };

  const getDayName = (date: Date) => {
    const days = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
    return days[date.getDay()];
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.modalContainer}>
          {/* HEADER */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Programı Kaydır</Text>
              <Text style={styles.subtitle}>{planTitle}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {/* AÇIKLAMA */}
            <Text style={styles.description}>
              Kaçırdığınız ve kalan tüm antrenmanlarınız, seçeceğiniz yeni
              başlangıç tarihine göre yeniden planlanacaktır.
            </Text>

            {/* TARİH SEÇİCİ */}
            <Text style={styles.label}>Yeni Başlangıç Tarihi Seçin:</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dateScroll}
            >
              {dates.map((date, index) => {
                const isSelected =
                  selectedDate?.toDateString() === date.toDateString();
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.dateCard,
                      isSelected && styles.dateCardSelected,
                    ]}
                    onPress={() => setSelectedDate(date)}
                  >
                    <Text
                      style={[
                        styles.dayName,
                        isSelected && { color: COLORS.white },
                      ]}
                    >
                      {getDayName(date)}
                    </Text>
                    <Text
                      style={[
                        styles.dayNumber,
                        isSelected && { color: COLORS.white },
                      ]}
                    >
                      {date.getDate()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* UYARI KUTUSU */}
            <View style={styles.warningBox}>
              <Ionicons
                name="warning"
                size={24}
                color="#FFD93D"
                style={{ marginBottom: 8 }}
              />
              <Text style={styles.warningTitle}>
                Program Düzeni Değişebilir
              </Text>
              <Text style={styles.warningText}>
                Başlangıç gününü değiştirmek, antrenman günlerinizin kaymasına
                neden olur. Örneğin; Cumartesi olan "Uzun Koşu"nuz Salı gününe
                denk gelebilir.
              </Text>
            </View>

            {/* BUTONLAR */}
            <View style={styles.footer}>
              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelText}>Vazgeç</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  !selectedDate && { opacity: 0.5 },
                ]}
                onPress={handleConfirm}
                disabled={!selectedDate}
              >
                <Text style={styles.confirmText}>Onayla ve Kaydır</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default RescheduleModal;

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "center", alignItems: "center" },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.85)",
  },
  modalContainer: {
    width: width * 0.9,
    backgroundColor: COLORS.background,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
    backgroundColor: COLORS.card,
  },
  title: { color: COLORS.text, fontSize: 18, fontWeight: "700" },
  subtitle: { color: COLORS.textDim, fontSize: 12, marginTop: 2 },
  closeBtn: {
    padding: 5,
    backgroundColor: COLORS.cardVariant,
    borderRadius: 15,
  },
  content: { padding: 20 },
  description: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  label: {
    color: COLORS.textDim,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 10,
    textTransform: "uppercase",
  },
  dateScroll: { gap: 10, paddingBottom: 20 },
  dateCard: {
    width: 60,
    height: 70,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
  dateCardSelected: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  dayName: { color: COLORS.textDim, fontSize: 12, fontWeight: "600" },
  dayNumber: { color: COLORS.text, fontSize: 18, fontWeight: "800" },
  warningBox: {
    backgroundColor: "rgba(255, 217, 61, 0.1)",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 217, 61, 0.3)",
    marginBottom: 20,
  },
  warningTitle: {
    color: "#FFD93D",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  warningText: { color: COLORS.textDim, fontSize: 12, lineHeight: 18 },
  footer: { flexDirection: "row", gap: 15 },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    alignItems: "center",
  },
  cancelText: { color: COLORS.text, fontWeight: "600" },
  confirmButton: {
    flex: 1.5,
    padding: 16,
    borderRadius: 16,
    backgroundColor: COLORS.accent,
    alignItems: "center",
  },
  confirmText: { color: COLORS.white, fontWeight: "700" },
});
