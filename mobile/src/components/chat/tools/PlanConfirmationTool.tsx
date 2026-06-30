import { useTheme } from "@/theme/ThemeContext";
import { useThemedStyles } from "@/theme/useThemedStyles";
import type { Theme } from "@/theme/tokens";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";

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
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
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
            !isConfirmed && { backgroundColor: colors.danger + "20" },
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
            color={isConfirmed ? colors.accent : colors.danger}
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
        <Ionicons name="help-circle" size={20} color={colors.accent} />
        <Text style={styles.title}>Plan Onayı</Text>
      </View>

      {message ? <Text style={styles.message}>{message}</Text> : null}

      {mode === "idle" ? (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
            <Ionicons name="checkmark" size={18} color={colors.text.inverse} />
            <Text style={styles.confirmBtnText}>Evet, Oluştur</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.rejectBtn} onPress={handleReject}>
            <Ionicons name="close" size={18} color={colors.danger} />
            <Text style={styles.rejectBtnText}>Hayır</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.feedbackBtn}
            onPress={() => setMode("feedback")}
          >
            <Ionicons name="create-outline" size={18} color={colors.accent} />
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
              placeholderTextColor={colors.text.secondary}
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
              <Ionicons name="arrow-forward" size={16} color={colors.text.inverse} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const makeStyles = (t: Theme) => {
  const c = t.colors;
  return {
    container: {
      width: "100%" as const,
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 16,
    },
    header: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 8,
      marginBottom: 8,
    },
    title: {
      fontSize: 17,
      fontWeight: "700" as const,
      color: c.text.primary,
    },
    message: {
      fontSize: 13,
      color: c.text.secondary,
      lineHeight: 18,
      marginBottom: 14,
    },

    // Actions
    actions: {
      gap: 8,
    },
    confirmBtn: {
      backgroundColor: c.accent,
      flexDirection: "row" as const,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      gap: 6,
      paddingVertical: 12,
      borderRadius: 12,
    },
    confirmBtnText: {
      color: c.text.inverse,
      fontWeight: "700" as const,
      fontSize: 14,
    },
    rejectBtn: {
      backgroundColor: c.surfaceVariant,
      flexDirection: "row" as const,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      gap: 6,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.danger + "4D",
    },
    rejectBtnText: {
      color: c.danger,
      fontWeight: "700" as const,
      fontSize: 14,
    },
    feedbackBtn: {
      backgroundColor: c.surfaceVariant,
      flexDirection: "row" as const,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      gap: 6,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
    },
    feedbackBtnText: {
      color: c.accent,
      fontWeight: "600" as const,
      fontSize: 13,
    },

    // Feedback Section
    feedbackSection: {
      gap: 10,
    },
    feedbackInputRow: {
      backgroundColor: c.surfaceVariant,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.accent,
      padding: 12,
    },
    feedbackInput: {
      color: c.text.primary,
      fontSize: 13,
      minHeight: 50,
      textAlignVertical: "top" as const,
    },
    feedbackActions: {
      flexDirection: "row" as const,
      gap: 8,
    },
    feedbackCancelBtn: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 10,
      backgroundColor: c.surfaceVariant,
    },
    feedbackCancelText: {
      color: c.text.secondary,
      fontWeight: "600" as const,
      fontSize: 13,
    },
    feedbackSendBtn: {
      flex: 1,
      flexDirection: "row" as const,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      gap: 6,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: c.accent,
    },
    feedbackSendText: {
      color: c.text.inverse,
      fontWeight: "700" as const,
      fontSize: 13,
    },

    // Submitted
    submittedCard: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: c.surfaceVariant,
      padding: 12,
      borderRadius: 12,
      gap: 10,
      borderWidth: 1,
      borderColor: c.border,
    },
    submittedIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: c.accent + "20",
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    submittedTitle: {
      fontSize: 14,
      fontWeight: "700" as const,
      color: c.text.primary,
      marginBottom: 2,
    },
    submittedSubtitle: {
      fontSize: 12,
      color: c.text.secondary,
    },
  } as const;
};
