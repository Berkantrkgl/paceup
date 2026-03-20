import { API_URL, FASTAPI_URL } from "@/constants/Config";
import { Ionicons } from "@expo/vector-icons";
import React, { useContext, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  ListRenderItemInfo,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Markdown from "react-native-markdown-display";
import EventSource from "react-native-sse";

import { COLORS } from "@/constants/Colors";
import { ChatMessage } from "@/types/plans";
import { AuthContext } from "@/utils/authContext";

import { AvailabilityTool } from "@/components/chat/tools/AvailabilityTool";
import { PlanConfirmationTool } from "@/components/chat/tools/PlanConfirmationTool";
import { ProgramSetupTool } from "@/components/chat/tools/ProgramSetupTool";
import { RunnerProfileTool } from "@/components/chat/tools/RunnerProfileTool";
import { PremiumModal } from "@/components/PremiumModal";

// ============================================================
// 💬 SABİTLER
// ============================================================
const LOADING_TEXTS = [
  "🚀 Koşu verilerin işleniyor...",
  "🔥 Çok az kaldı, beklemene değecek...",
  "🧠 Sana özel programın hazırlanıyor...",
  "👟 Kişisel bilgilerine göre düzenleniyor...",
  "🎯 Hedeflerine en uygun takvim oluşturuluyor...",
];

const TOKEN_WARNING_THRESHOLD = 10000;

// ============================================================
// ✨ DynamicSystemMessage
// ============================================================
const DynamicSystemMessage = ({
  isFinished,
  isError,
}: {
  isFinished: boolean;
  isError?: boolean;
}) => {
  const [textIndex, setTextIndex] = useState(() =>
    Math.floor(Math.random() * LOADING_TEXTS.length),
  );
  const fadeAnim = useRef(new Animated.Value(0.6)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isFinished) return;
    const interval = setInterval(() => {
      Animated.sequence([
        Animated.timing(slideAnim, {
          toValue: -5,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
      setTextIndex((prev) => {
        let next;
        do {
          next = Math.floor(Math.random() * LOADING_TEXTS.length);
        } while (next === prev && LOADING_TEXTS.length > 1);
        return next;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [isFinished]);

  useEffect(() => {
    if (isFinished) {
      fadeAnim.setValue(1);
      return;
    }
    Animated.loop(
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.timing(fadeAnim, {
          toValue: 0.6,
          duration: 800,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
      ]),
    ).start();
  }, [isFinished]);

  const currentText = isFinished
    ? isError
      ? "⚠️ Bir sorun oluştu."
      : "✅ Programın başarıyla oluşturuldu!"
    : LOADING_TEXTS[textIndex];

  return (
    <Animated.View
      style={[
        styles.modernSystemContainer,
        { opacity: fadeAnim },
        isError && { borderColor: "#FF5252" },
      ]}
    >
      {isFinished && (
        <View style={styles.iconContainer}>
          <Ionicons
            name={isError ? "alert-circle" : "checkmark-circle"}
            size={18}
            color={isError ? "#FF5252" : "#4CAF50"}
          />
        </View>
      )}
      <Animated.Text
        style={[
          styles.systemText,
          { transform: [{ translateY: slideAnim }] },
          !isFinished && { textAlign: "center", width: "100%" },
        ]}
      >
        {currentText}
      </Animated.Text>
    </Animated.View>
  );
};

// ============================================================
// 📱 ANA EKRAN
// ============================================================
const ChatbotScreen = () => {
  const { getValidToken, user, refreshUserData } = useContext(AuthContext);
  const flatListRef = useRef<FlatList>(null);

  const [threadId] = useState(
    `thread-${Math.random().toString(36).substring(7)}`,
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [userScrolling, setUserScrolling] = useState(false);
  const isUserInteracting = useRef(false);

  // Token state
  const [canUseChat, setCanUseChat] = useState(true);
  const [remainingTokens, setRemainingTokens] = useState<number | null>(null);

  // Premium modal
  const [premiumModalVisible, setPremiumModalVisible] = useState(false);

  const activeToolId = messages.find(
    (m) => m.sender === "tool_widget" && !m.toolData?.submitted,
  )?.id;

  // ============================================================
  // 🚀 USER'DAN TOKEN DURUMUNU OKU
  // ============================================================
  useEffect(() => {
    if (!user) return;
    setRemainingTokens(user.remaining_tokens ?? null);
    setCanUseChat(user.can_use_chat ?? true);
  }, [user]);

  // Token dolunca otomatik modal aç
  useEffect(() => {
    if (!canUseChat) {
      setPremiumModalVisible(true);
    }
  }, [canUseChat]);

  // ============================================================
  // 🚀 CHAT BAŞLATMA
  // ============================================================
  useEffect(() => {
    if (messages.length > 0) return;
    connectAndStream([
      { role: "user", content: [{ type: "text", text: "Selam!" }] },
    ]);
  }, [threadId]);

  // ============================================================
  // 📡 DJANGO TOKEN GÜNCELLEME
  // ============================================================
  const reportTokenUsage = async (tokensUsed: number) => {
    if (tokensUsed <= 0) return;
    try {
      const validToken = await getValidToken();
      if (!validToken) return;

      const res = await fetch(`${API_URL}/users/update_token_usage/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${validToken}`,
        },
        body: JSON.stringify({ tokens_used: tokensUsed }),
      });

      if (!res.ok) {
        console.warn("reportTokenUsage HTTP error:", res.status);
        return;
      }

      const data = await res.json();
      setRemainingTokens(data.remaining_tokens ?? null);
      setCanUseChat(data.can_use_chat ?? true);

      // AuthContext user'ını da güncelle (Profile sayfası için)
      await refreshUserData();
    } catch (e) {
      console.error("Token usage güncelleme hatası:", e);
    }
  };

  // ============================================================
  // 📡 SSE STREAM
  // ============================================================
  const connectAndStream = async (payloadMessages: any[]) => {
    // Token kontrolü — modal aç, mesaj gönderme
    if (!canUseChat) {
      setPremiumModalVisible(true);
      return;
    }

    const validToken = await getValidToken();
    if (!validToken) return;

    setIsTyping(true);
    let activeAiMsgId = Date.now().toString();

    setMessages((prev) => [
      ...prev,
      {
        id: activeAiMsgId,
        text: "",
        sender: "ai",
        timestamp: new Date(),
        isStreaming: true,
      },
    ]);

    let sessionTokenAccumulator = 0;

    try {
      const eventSource = new EventSource<"token" | "ask_user" | "token_usage" | "tool_use_notification" | "status">(`${FASTAPI_URL}/chat-stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${validToken}`,
        },
        body: JSON.stringify({
          thread_id: threadId,
          messages: payloadMessages,
        }),
        pollingInterval: 0,
      });

      // --- TEXT TOKEN ---
      eventSource.addEventListener("token", (event) => {
        if (!event.data) return;
        try {
          const data = JSON.parse(event.data);
          if (data.content) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === activeAiMsgId
                  ? {
                      ...msg,
                      text: (msg.text || "") + data.content,
                      isStreaming: true,
                    }
                  : msg,
              ),
            );
          }
        } catch (e) {
          console.error("token event parse error:", e);
        }
      });

      // --- LLM TOKEN KULLANIMI ---
      eventSource.addEventListener("token_usage", (event) => {
        if (!event.data) return;
        try {
          const data = JSON.parse(event.data);
          sessionTokenAccumulator += data.total_tokens || 0;
        } catch (e) {
          console.error("token_usage parse error:", e);
        }
      });

      // --- BACKEND TOOL BİLDİRİMİ ---
      eventSource.addEventListener("tool_use_notification", (event) => {
        if (!event.data) return;
        try {
          setMessages((prev) => {
            const cleanHistory = prev
              .filter((m) => !(m.id === activeAiMsgId && (m.text || "").trim() === ""))
              .map((m) =>
                m.id === activeAiMsgId ? { ...m, isStreaming: false } : m,
              );

            const notificationMsg: ChatMessage = {
              id: `notify-${Date.now()}`,
              sender: "system_info",
              text: "",
              timestamp: new Date(),
              isStreaming: false,
            };

            const newAiMsgId = `ai-${Date.now()}`;
            activeAiMsgId = newAiMsgId;

            return [
              ...cleanHistory,
              notificationMsg,
              {
                id: newAiMsgId,
                sender: "ai",
                text: "",
                timestamp: new Date(),
                isStreaming: true,
              },
            ];
          });
        } catch (e) {
          console.error("tool_use_notification error:", e);
        }
      });

      // --- UI TOOL ---
      eventSource.addEventListener("ask_user", (event) => {
        if (!event.data) return;
        try {
          const tool = JSON.parse(event.data);
          if (!tool.name) return;

          setIsTyping(false);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === activeAiMsgId ? { ...msg, isStreaming: false } : msg,
            ),
          );
          setMessages((prev) => {
            if (prev.some((m) => m.id === tool.id)) return prev;
            return [
              ...prev,
              {
                id: tool.id,
                sender: "tool_widget",
                timestamp: new Date(),
                toolData: {
                  id: tool.id,
                  name: tool.name,
                  input: tool.input,
                  submitted: false,
                },
                text: "",
              },
            ];
          });
        } catch (e) {
          console.error("ask_user event error:", e);
        }
      });

      // --- STREAM BİTİŞİ ---
      const finalizeStream = async () => {
        setIsTyping(false);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === activeAiMsgId ? { ...msg, isStreaming: false } : msg,
          ),
        );
        eventSource.removeAllEventListeners();
        eventSource.close();

        if (sessionTokenAccumulator > 0) {
          await reportTokenUsage(sessionTokenAccumulator);
        }
      };

      eventSource.addEventListener("status", finalizeStream);
      eventSource.addEventListener("error", finalizeStream);

      return () => {
        eventSource.removeAllEventListeners();
        eventSource.close();
      };
    } catch (err) {
      console.error("Connection error:", err);
      setIsTyping(false);
    }
  };

  // ============================================================
  // 📤 KULLANICI MESAJ GÖNDERME
  // ============================================================
  const handleUserSend = () => {
    if (!inputText.trim()) return;
    const text = inputText.trim();
    setInputText("");
    Keyboard.dismiss();
    setUserScrolling(false);
    isUserInteracting.current = false;

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        text,
        sender: "user",
        timestamp: new Date(),
      },
    ]);
    connectAndStream([{ role: "user", content: [{ type: "text", text }] }]);
  };

  // ============================================================
  // 🛠️ TOOL SUBMIT
  // ============================================================
  const handleToolSubmit = (toolId: string, responseJson: object) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === toolId && msg.toolData
          ? { ...msg, toolData: { ...msg.toolData, submitted: true } }
          : msg,
      ),
    );
    setUserScrolling(false);
    const toolMsg = messages.find((m) => m.id === toolId);
    connectAndStream([
      {
        role: "tool",
        tool_call_id: toolId,
        tool_name: toolMsg?.toolData?.name || "",
        content: JSON.stringify(responseJson),
      },
    ]);
  };

  // ============================================================
  // 🎨 RENDER ITEM
  // ============================================================
  const renderItem = ({ item, index }: ListRenderItemInfo<ChatMessage>) => {
    if (item.sender === "system_info") {
      const nextMsg = messages[index + 1];
      const hasContentStarted =
        nextMsg && nextMsg.text && nextMsg.text.length > 2;
      const isProcessFinished =
        index < messages.length - 1 && !!hasContentStarted;
      const isError =
        nextMsg?.text &&
        (nextMsg.text.startsWith("Üzgünüm") ||
          nextMsg.text.includes("hata oluştu"));
      return (
        <View
          style={{ width: "100%", alignItems: "center", marginVertical: 10 }}
        >
          <DynamicSystemMessage
            isFinished={isProcessFinished}
            isError={!!isError}
          />
        </View>
      );
    }

    if (item.sender === "tool_widget" && item.toolData) {
      const { name, id, submitted, input } = item.toolData;
      const toolName = name.toLowerCase();
      let ToolComponent = null;

      if (toolName === "request_runner_profile") {
        ToolComponent = (
          <RunnerProfileTool
            onSubmit={(data) => handleToolSubmit(id, data)}
            submitted={submitted}
            initialData={{
              weight: user?.weight ? String(user.weight) : "70",
              height: user?.height ? String(user.height) : "175",
              gender: (user as any)?.gender || "male",
              pace: (user as any)?.current_pace
                ? Math.floor((user as any).current_pace / 60) +
                  ":" +
                  ((user as any).current_pace % 60).toString().padStart(2, "0")
                : "06:00",
            }}
          />
        );
      } else if (toolName === "request_program_setup") {
        ToolComponent = (
          <ProgramSetupTool
            onSubmit={(data) => handleToolSubmit(id, data)}
            submitted={submitted}
          />
        );
      } else if (toolName === "request_availability_preferences") {
        ToolComponent = (
          <AvailabilityTool
            onSubmit={(data) => handleToolSubmit(id, data)}
            submitted={submitted}
          />
        );
      } else if (toolName === "request_plan_confirmation") {
        ToolComponent = (
          <PlanConfirmationTool
            onSubmit={(data) => handleToolSubmit(id, data)}
            submitted={submitted}
            message={input?.message}
          />
        );
      }

      return ToolComponent ? (
        <View style={styles.toolContainer}>{ToolComponent}</View>
      ) : null;
    }

    const isUser = item.sender === "user";

    if (!item.text && item.isStreaming) {
      return (
        <View style={[styles.messageRow, styles.rowAi]}>
          <View style={styles.aiAvatar}>
            <Ionicons name="sparkles" size={16} color={COLORS.accent} />
          </View>
          <View style={[styles.bubble, styles.bubbleAi]}>
            <ActivityIndicator size="small" color={COLORS.accent} />
          </View>
        </View>
      );
    }

    if (!item.text && !item.isStreaming) return null;

    return (
      <View style={[styles.messageRow, isUser ? styles.rowUser : styles.rowAi]}>
        {!isUser && (
          <View style={styles.aiAvatar}>
            <Ionicons name="sparkles" size={16} color={COLORS.accent} />
          </View>
        )}
        <View
          style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAi]}
        >
          <Markdown style={isUser ? markdownStylesUser : markdownStylesAi}>
            {item.text}
          </Markdown>
        </View>
      </View>
    );
  };

  // ============================================================
  // 🎨 RENDER
  // ============================================================
  const isInputDisabled = isTyping || !!activeToolId || !canUseChat;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Token Bloke Banner */}
      {!canUseChat && (
        <TouchableOpacity
          style={styles.tokenBlockedBanner}
          onPress={() => setPremiumModalVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="lock-closed" size={16} color="#FF5252" />
          <Text style={styles.tokenBlockedText}>
            Ücretsiz kullanım hakkın doldu.
          </Text>
          <View style={styles.tokenBlockedBtn}>
            <Text style={styles.tokenBlockedBtnText}>Premium Al →</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Token Uyarı Banner */}
      {canUseChat &&
        remainingTokens !== null &&
        remainingTokens < TOKEN_WARNING_THRESHOLD && (
          <TouchableOpacity
            style={styles.tokenWarningBanner}
            onPress={() => setPremiumModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="warning-outline" size={14} color="#FFA500" />
            <Text style={styles.tokenWarningText}>
              Kalan: {remainingTokens.toLocaleString()} token
            </Text>
            <Text style={styles.tokenWarningLink}>Premium Al</Text>
          </TouchableOpacity>
        )}

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 15, paddingBottom: 60 }}
        onContentSizeChange={() => {
          if (!userScrolling && !isUserInteracting.current)
            flatListRef.current?.scrollToEnd({ animated: true });
        }}
        onScroll={(event) => {
          const { layoutMeasurement, contentOffset, contentSize } =
            event.nativeEvent;
          if (
            layoutMeasurement.height + contentOffset.y >=
            contentSize.height - 20
          ) {
            setUserScrolling(false);
            isUserInteracting.current = false;
          }
        }}
        onScrollBeginDrag={() => {
          setUserScrolling(true);
          isUserInteracting.current = true;
        }}
        removeClippedSubviews={Platform.OS === "android"}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
      >
        <View
          style={[
            styles.inputContainer,
            { paddingBottom: Platform.OS === "ios" ? 20 : 10 },
            isInputDisabled && { opacity: 0.6 },
          ]}
        >
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder={
              !canUseChat
                ? "Limit doldu..."
                : activeToolId
                  ? "Seçimi tamamlayın..."
                  : "Mesaj yazın..."
            }
            placeholderTextColor="#666"
            editable={!isInputDisabled}
            multiline
          />
          <TouchableOpacity
            onPress={
              !canUseChat ? () => setPremiumModalVisible(true) : handleUserSend
            }
            disabled={canUseChat && (!inputText.trim() || isInputDisabled)}
            style={[
              styles.sendBtn,
              canUseChat &&
                (!inputText.trim() || isInputDisabled) && { opacity: 0.5 },
              !canUseChat && { backgroundColor: COLORS.accent },
            ]}
          >
            <Ionicons
              name={!canUseChat ? "flash" : "arrow-up"}
              size={20}
              color={COLORS.background}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Premium Modal */}
      <PremiumModal
        visible={premiumModalVisible}
        onClose={() => setPremiumModalVisible(false)}
        reason={!canUseChat ? "token_limit" : "general"}
      />
    </View>
  );
};

export default ChatbotScreen;

// ============================================================
// 🎨 STYLES
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  messageRow: {
    flexDirection: "row",
    marginBottom: 16,
    alignItems: "flex-end",
    gap: 8,
  },
  rowUser: { justifyContent: "flex-end" },
  rowAi: { justifyContent: "flex-start" },
  modernSystemContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "rgba(255, 165, 0, 0.2)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
    maxWidth: "90%",
  },
  iconContainer: {
    marginRight: 10,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  systemText: {
    color: "#E0E0E0",
    fontSize: 13,
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
    letterSpacing: 0.3,
  },
  aiAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  bubble: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    maxWidth: "82%",
  },
  bubbleUser: { backgroundColor: COLORS.accent, borderBottomRightRadius: 2 },
  bubbleAi: {
    backgroundColor: COLORS.card,
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  toolContainer: { width: "100%", marginBottom: 16, paddingHorizontal: 5 },
  inputContainer: {
    flexDirection: "row",
    padding: 10,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
    alignItems: "flex-end",
    gap: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: COLORS.card,
    color: COLORS.text,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  // Token Bloke Banner
  tokenBlockedBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,82,82,0.1)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,82,82,0.2)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  tokenBlockedText: {
    color: "#FF5252",
    fontSize: 13,
    flex: 1,
    fontWeight: "600",
  },
  tokenBlockedBtn: {
    backgroundColor: "rgba(255,82,82,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,82,82,0.4)",
  },
  tokenBlockedBtnText: {
    color: "#FF5252",
    fontSize: 12,
    fontWeight: "700",
  },
  // Token Uyarı Banner
  tokenWarningBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,165,0,0.08)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,165,0,0.15)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  tokenWarningText: {
    color: "#FFA500",
    fontSize: 12,
    fontWeight: "500",
    flex: 1,
  },
  tokenWarningLink: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: "700",
  },
});

const markdownStylesAi = StyleSheet.create({
  body: { color: "#E0E0E0", fontSize: 14, lineHeight: 20 },
  heading1: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginVertical: 5,
  },
  strong: { color: "#FFFFFF", fontWeight: "700" },
});

const markdownStylesUser = StyleSheet.create({
  body: { color: "#000000", fontSize: 14, lineHeight: 20, fontWeight: "500" },
  paragraph: { margin: 0 },
});
