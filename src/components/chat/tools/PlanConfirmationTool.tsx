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
            size={20}
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
        <Ionicons name="help-circle" size={20} color={COLORS.accent} />
        <Text style={styles.title}>Plan Onayı</Text>
      </View>

      {message ? <Text style={styles.message}>{message}</Text> : null}

      {mode === "idle" ? (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
            <Ionicons name="checkmark" size={18} color="#000" />
            <Text style={styles.confirmBtnText}>Evet, Oluştur</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.rejectBtn} onPress={handleReject}>
            <Ionicons name="close" size={18} color="#FF5252" />
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
    borderRadius: 16,
    padding: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFF",
  },
  message: {
    fontSize: 13,
    color: "#CCC",
    lineHeight: 18,
    marginBottom: 14,
  },

  // Actions
  actions: {
    gap: 8,
  },
  confirmBtn: {
    backgroundColor: COLORS.accent,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  confirmBtnText: {
    color: "#000",
    fontWeight: "700",
    fontSize: 14,
  },
  rejectBtn: {
    backgroundColor: "#252525",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,82,82,0.3)",
  },
  rejectBtnText: {
    color: "#FF5252",
    fontWeight: "700",
    fontSize: 14,
  },
  feedbackBtn: {
    backgroundColor: "#252525",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#3A3A3A",
  },
  feedbackBtnText: {
    color: COLORS.accent,
    fontWeight: "600",
    fontSize: 13,
  },

  // Feedback Section
  feedbackSection: {
    gap: 10,
  },
  feedbackInputRow: {
    backgroundColor: "#252525",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.accent,
    padding: 12,
  },
  feedbackInput: {
    color: "#FFF",
    fontSize: 13,
    minHeight: 50,
    textAlignVertical: "top",
  },
  feedbackActions: {
    flexDirection: "row",
    gap: 8,
  },
  feedbackCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#252525",
  },
  feedbackCancelText: {
    color: "#AAA",
    fontWeight: "600",
    fontSize: 13,
  },
  feedbackSendBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: COLORS.accent,
  },
  feedbackSendText: {
    color: "#000",
    fontWeight: "700",
    fontSize: 13,
  },

  // Submitted
  submittedCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#252525",
    padding: 12,
    borderRadius: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: "#3A3A3A",
  },
  submittedIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.accent + "20",
    justifyContent: "center",
    alignItems: "center",
  },
  submittedTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFF",
    marginBottom: 2,
  },
  submittedSubtitle: {
    fontSize: 12,
    color: "#999",
  },
});
