import { API_URL, FASTAPI_URL } from "@/constants/Config";
import { Ionicons } from "@expo/vector-icons";
import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
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

import { useTheme } from "@/theme/ThemeContext";
import { useThemedStyles } from "@/theme/useThemedStyles";
import type { Theme, ThemeColors } from "@/theme/tokens";
import { ChatMessage } from "@/types/plans";
import { AuthContext } from "@/utils/authContext";

import { AvailabilityTool } from "@/components/chat/tools/AvailabilityTool";
import { PlanConfirmationTool } from "@/components/chat/tools/PlanConfirmationTool";
import { ProgramSetupTool } from "@/components/chat/tools/ProgramSetupTool";
import { RunnerProfileTool } from "@/components/chat/tools/RunnerProfileTool";
import { useRouter } from "expo-router";

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
  colors,
  styles,
}: {
  isFinished: boolean;
  isError?: boolean;
  colors: ThemeColors;
  styles: any;
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
        isError && { borderColor: colors.danger },
      ]}
    >
      {isFinished && (
        <View style={styles.iconContainer}>
          <Ionicons
            name={isError ? "alert-circle" : "checkmark-circle"}
            size={18}
            color={isError ? colors.danger : colors.success}
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
  const router = useRouter();
  const { getValidToken, user, refreshUserData } = useContext(AuthContext);
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const flatListRef = useRef<FlatList>(null);

  // Markdown stilleri tema-aware — useMemo ile.
  const markdownStylesAi = useMemo(
    () =>
      StyleSheet.create({
        body: { color: colors.text.primary, fontSize: 14, lineHeight: 20 },
        heading1: {
          fontSize: 16,
          fontWeight: "bold",
          color: colors.text.primary,
          marginVertical: 5,
        },
        strong: { color: colors.text.primary, fontWeight: "700" },
      }),
    [colors],
  );

  const markdownStylesUser = useMemo(
    () =>
      StyleSheet.create({
        body: {
          color: colors.text.inverse,
          fontSize: 14,
          lineHeight: 20,
          fontWeight: "500",
        },
        paragraph: { margin: 0 },
      }),
    [colors],
  );

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

  const openPremium = (reason: string = "general") =>
    router.push({ pathname: "/(protected)/premium", params: { reason } });

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
      openPremium(!canUseChat ? "token_limit" : "general");
    }
  }, [canUseChat]);

  // ============================================================
  // 🚀 CHAT BAŞLATMA
  // ============================================================
  useEffect(() => {
    if (messages.length > 0) return;

    // Thread'i backend'e bağla — hesap silinince LangGraph checkpoint'leri
    // bu thread_id üzerinden temizlenir. Fire-and-forget; UI'ı bloklamaz.
    (async () => {
      const validToken = await getValidToken();
      if (!validToken) return;
      fetch(`${API_URL}/users/register_chat_session/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${validToken}`,
        },
        body: JSON.stringify({ thread_id: threadId }),
      }).catch(() => {
        // Best-effort — thread register başarısızsa sohbet yine de çalışsın.
      });
    })();

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
      openPremium(!canUseChat ? "token_limit" : "general");
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
      const eventSource = new EventSource<
        | "token"
        | "ask_user"
        | "token_usage"
        | "tool_use_notification"
        | "status"
      >(`${FASTAPI_URL}/chat-stream`, {
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
              .filter(
                (m) =>
                  !(m.id === activeAiMsgId && (m.text || "").trim() === ""),
              )
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
            colors={colors}
            styles={styles}
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
            <Ionicons name="sparkles" size={16} color={colors.accent} />
          </View>
          <View style={[styles.bubble, styles.bubbleAi]}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        </View>
      );
    }

    if (!item.text && !item.isStreaming) return null;

    return (
      <View style={[styles.messageRow, isUser ? styles.rowUser : styles.rowAi]}>
        {!isUser && (
          <View style={styles.aiAvatar}>
            <Ionicons name="sparkles" size={16} color={colors.accent} />
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
  const isSendDisabled = isTyping || !!activeToolId || !canUseChat;
  const isInputEditable = canUseChat && !activeToolId;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 115 : 0}
    >
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Token Bloke Banner */}
      {!canUseChat && (
        <TouchableOpacity
          style={styles.tokenBlockedBanner}
          onPress={() => openPremium(!canUseChat ? "token_limit" : "general")}
          activeOpacity={0.8}
        >
          <Ionicons name="lock-closed" size={16} color={colors.danger} />
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
            onPress={() => openPremium(!canUseChat ? "token_limit" : "general")}
            activeOpacity={0.8}
          >
            <Ionicons name="warning-outline" size={14} color={colors.warning} />
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

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder={
            !canUseChat
              ? "Limit doldu..."
              : activeToolId
                ? "Seçimi tamamlayın..."
                : isTyping
                  ? "Yanıt bekleniyor..."
                  : "Mesaj yazın..."
          }
          placeholderTextColor={colors.text.secondary}
          editable={isInputEditable}
          multiline
        />
        <TouchableOpacity
          onPress={
            !canUseChat ? () => openPremium(!canUseChat ? "token_limit" : "general") : handleUserSend
          }
          disabled={canUseChat && (!inputText.trim() || isSendDisabled)}
          style={[
            styles.sendBtn,
            canUseChat &&
              (!inputText.trim() || isSendDisabled) && { opacity: 0.5 },
            !canUseChat && { backgroundColor: colors.accent },
          ]}
        >
          <Ionicons
            name={!canUseChat ? "flash" : "arrow-up"}
            size={20}
            color={colors.text.inverse}
          />
        </TouchableOpacity>
      </View>

    </KeyboardAvoidingView>
  );
};

export default ChatbotScreen;

// ============================================================
// 🎨 STYLES
// ============================================================
const makeStyles = (t: Theme) => {
  const c = t.colors;
  return {
    container: { flex: 1, backgroundColor: c.background },
    messageRow: {
      flexDirection: "row" as const,
      marginBottom: 16,
      alignItems: "flex-end" as const,
      gap: 8,
    },
    rowUser: { justifyContent: "flex-end" as const },
    rowAi: { justifyContent: "flex-start" as const },
    modernSystemContainer: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: c.surface,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 30,
      borderWidth: 1,
      borderColor: c.accent + "33",
      shadowColor: c.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 4.65,
      elevation: 8,
      maxWidth: "90%" as const,
    },
    iconContainer: {
      marginRight: 10,
      width: 24,
      height: 24,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    systemText: {
      color: c.text.primary,
      fontSize: 13,
      fontWeight: "600" as const,
      fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
      letterSpacing: 0.3,
    },
    aiAvatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: c.surface,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      borderWidth: 1,
      borderColor: c.border,
    },
    bubble: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 18,
      maxWidth: "82%" as const,
    },
    bubbleUser: { backgroundColor: c.accent, borderBottomRightRadius: 2 },
    bubbleAi: {
      backgroundColor: c.surface,
      borderBottomLeftRadius: 2,
      borderWidth: 1,
      borderColor: c.border,
    },
    toolContainer: {
      width: "100%" as const,
      marginBottom: 16,
      paddingHorizontal: 5,
    },
    inputContainer: {
      flexDirection: "row" as const,
      padding: 10,
      backgroundColor: c.background,
      borderTopWidth: 1,
      borderTopColor: c.border,
      alignItems: "flex-end" as const,
      gap: 10,
    },
    textInput: {
      flex: 1,
      backgroundColor: c.surface,
      color: c.text.primary,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 10,
      fontSize: 14,
      maxHeight: 100,
      borderWidth: 1,
      borderColor: c.border,
    },
    sendBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.accent,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    // Token Bloke Banner
    tokenBlockedBanner: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: c.danger + "1A",
      borderBottomWidth: 1,
      borderBottomColor: c.danger + "33",
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 8,
    },
    tokenBlockedText: {
      color: c.danger,
      fontSize: 13,
      flex: 1,
      fontWeight: "600" as const,
    },
    tokenBlockedBtn: {
      backgroundColor: c.danger + "33",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.danger + "66",
    },
    tokenBlockedBtnText: {
      color: c.danger,
      fontSize: 12,
      fontWeight: "700" as const,
    },
    // Token Uyarı Banner
    tokenWarningBanner: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: c.warning + "14",
      borderBottomWidth: 1,
      borderBottomColor: c.warning + "26",
      paddingHorizontal: 16,
      paddingVertical: 8,
      gap: 6,
    },
    tokenWarningText: {
      color: c.warning,
      fontSize: 12,
      fontWeight: "500" as const,
      flex: 1,
    },
    tokenWarningLink: {
      color: c.accent,
      fontSize: 12,
      fontWeight: "700" as const,
    },
  } as const;
};
