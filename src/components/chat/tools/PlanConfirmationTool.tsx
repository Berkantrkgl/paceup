import { COLORS } from "@/constants/Colors";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// --- TYPES ---
interface PlanConfirmationToolProps {
  onSubmit: (data: { confirmed: boolean; feedback?: string }) => void;
  submitted?: boolean;
  message?: string;
}

export const PlanConfirmationTool = ({
  onSubmit,
  submitted,
  message,
}: PlanConfirmationToolProps) => {
  const [mode, setMode] = useState<"idle" | "feedback">("idle");
  const [feedback, setFeedback] = useState("");
  const [submittedChoice, setSubmittedChoice] = useState<
    "confirmed" | "rejected" | "feedback" | null
  >(null);

  const handleConfirm = () => {
    setSubmittedChoice("confirmed");
    onSubmit({ confirmed: true });
  };

  const handleReject = () => {
    setSubmittedChoice("rejected");
    onSubmit({ confirmed: false });
  };

  const handleFeedbackSubmit = () => {
    if (!feedback.trim()) return;
    setSubmittedChoice("feedback");
    onSubmit({ confirmed: false, feedback: feedback.trim() });
  };

  if (submitted) {
    const isConfirmed = submittedChoice === "confirmed";
    const isFeedback = submittedChoice === "feedback";

    return (
      <View style={styles.submittedCard}>
        <View
          style={[
            styles.submittedIcon,
            !isConfirmed && { backgroundColor: "#FF525220" },
          ]}
        >
          <Ionicons
            name={
              isConfirmed
                ? "checkmark-circle"
                : isFeedback
                  ? "chatbubble-ellipses"
                  : "close-circle"
            }
            size={24}
            color={isConfirmed ? COLORS.accent : "#FF5252"}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.submittedTitle}>
            {isConfirmed
              ? "Plan Onaylandı"
              : isFeedback
                ? "Değişiklik İstendi"
                : "Plan Reddedildi"}
          </Text>
          {isFeedback && feedback ? (
            <Text style={styles.submittedSubtitle} numberOfLines={2}>
              {feedback}
            </Text>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="help-circle" size={24} color={COLORS.accent} />
        <Text style={styles.title}>Plan Onayı</Text>
      </View>

      {message ? <Text style={styles.message}>{message}</Text> : null}

      {mode === "idle" ? (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
            <Ionicons name="checkmark" size={20} color="#000" />
            <Text style={styles.confirmBtnText}>Evet, Oluştur</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.rejectBtn} onPress={handleReject}>
            <Ionicons name="close" size={20} color="#FF5252" />
            <Text style={styles.rejectBtnText}>Hayır</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.feedbackBtn}
            onPress={() => setMode("feedback")}
          >
            <Ionicons name="create-outline" size={18} color={COLORS.accent} />
            <Text style={styles.feedbackBtnText}>Değişiklik Belirt</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.feedbackSection}>
          <View style={styles.feedbackInputRow}>
            <TextInput
              style={styles.feedbackInput}
              value={feedback}
              onChangeText={setFeedback}
              placeholder="Ne değişmeli? (ör. daha kısa olsun)"
              placeholderTextColor="#666"
              multiline
              autoFocus
            />
          </View>
          <View style={styles.feedbackActions}>
            <TouchableOpacity
              style={styles.feedbackCancelBtn}
              onPress={() => {
                setMode("idle");
                setFeedback("");
              }}
            >
              <Text style={styles.feedbackCancelText}>Vazgeç</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.feedbackSendBtn,
                !feedback.trim() && { opacity: 0.5 },
              ]}
              onPress={handleFeedbackSubmit}
              disabled={!feedback.trim()}
            >
              <Text style={styles.feedbackSendText}>Gönder</Text>
              <Ionicons name="arrow-forward" size={16} color="#000" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    backgroundColor: "#1A1A1A",
    borderRadius: 20,
    padding: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFF",
  },
  message: {
    fontSize: 14,
    color: "#CCC",
    lineHeight: 20,
    marginBottom: 20,
  },

  // Actions
  actions: {
    gap: 10,
  },
  confirmBtn: {
    backgroundColor: COLORS.accent,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  confirmBtnText: {
    color: "#000",
    fontWeight: "700",
    fontSize: 15,
  },
  rejectBtn: {
    backgroundColor: "#252525",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,82,82,0.3)",
  },
  rejectBtnText: {
    color: "#FF5252",
    fontWeight: "700",
    fontSize: 15,
  },
  feedbackBtn: {
    backgroundColor: "#252525",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#3A3A3A",
  },
  feedbackBtnText: {
    color: COLORS.accent,
    fontWeight: "600",
    fontSize: 14,
  },

  // Feedback Section
  feedbackSection: {
    gap: 12,
  },
  feedbackInputRow: {
    backgroundColor: "#252525",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.accent,
    padding: 14,
  },
  feedbackInput: {
    color: "#FFF",
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: "top",
  },
  feedbackActions: {
    flexDirection: "row",
    gap: 10,
  },
  feedbackCancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: "#252525",
  },
  feedbackCancelText: {
    color: "#AAA",
    fontWeight: "600",
    fontSize: 14,
  },
  feedbackSendBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
  },
  feedbackSendText: {
    color: "#000",
    fontWeight: "700",
    fontSize: 14,
  },

  // Submitted
  submittedCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#252525",
    padding: 16,
    borderRadius: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: "#3A3A3A",
  },
  submittedIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.accent + "20",
    justifyContent: "center",
    alignItems: "center",
  },
  submittedTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFF",
    marginBottom: 4,
  },
  submittedSubtitle: {
    fontSize: 13,
    color: "#999",
  },
});
