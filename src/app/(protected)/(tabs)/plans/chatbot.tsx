import React, { useContext, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";
import EventSource from "react-native-sse";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS } from "@/constants/Colors";
import { FASTAPI_URL } from "@/constants/Config";
import { AuthContext } from "@/utils/authContext";
import { ChatMessage } from "@/types/plans";

// WIDGET IMPORTS
import { RunnerProfileTool } from "@/components/chat/tools/RunnerProfileTool";
import { ProgramSetupTool } from "@/components/chat/tools/ProgramSetupTool";
import { AvailabilityTool } from "@/components/chat/tools/AvailabilityTool";

const ChatbotScreen = () => {
  const { getValidToken, user } = useContext(AuthContext);
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);

  const [threadId, setThreadId] = useState(
    `thread-${Math.random().toString(36).substring(7)}`
  );

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  // Widget kontrolü: Submit edilmemiş bir tool var mı?
  const activeToolId = messages.find(
    (m) => m.sender === "tool_widget" && !m.toolData?.submitted
  )?.id;

  useEffect(() => {
    setMessages([
      {
        id: "welcome",
        text: "Selam! 👋 Ben Pace. Kişiselleştirilmiş koşu programını hazırlamak için buradayım.",
        sender: "ai",
        timestamp: new Date(),
      },
    ]);
  }, [threadId]);

  const connectAndStream = async (payloadMessages: any[]) => {
    const validToken = await getValidToken();
    if (!validToken) return;

    setIsTyping(true);
    const aiMsgId = Date.now().toString();

    // 🔴 DÜZELTME BURADA:
    // lastRole kontrolünü kaldırdık. Tool cevabı versek bile (Resume),
    // AI'ın "Teşekkürler, şimdi sıradaki adım..." demesi için balon açıyoruz.
    setMessages((prev) => [
      ...prev,
      {
        id: aiMsgId,
        text: "", // Tokenlar geldikçe burası dolacak
        sender: "ai",
        timestamp: new Date(),
        isStreaming: true,
      },
    ]);

    try {
      console.log(
        `Connecting: ${FASTAPI_URL}/chat-stream [Thread: ${threadId}]`
      );

      const eventSource = new EventSource(`${FASTAPI_URL}/chat-stream`, {
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

      // 1. METİN AKIŞI (Bu artık tool yanıtından sonra da çalışacak)
      eventSource.addEventListener("token", (event) => {
        if (!event.data) return;
        try {
          const data = JSON.parse(event.data);
          if (data.content) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === aiMsgId
                  ? {
                      ...msg,
                      text: (msg.text || "") + data.content,
                      isStreaming: true,
                    }
                  : msg
              )
            );
          }
        } catch (e) {
          console.error("Token Parse Error:", e);
        }
      });

      // 2. WIDGET GELDİĞİNDE (Metnin altına eklenecek)
      eventSource.addEventListener("tool_use", (event) => {
        if (!event.data) return;
        try {
          const tool = JSON.parse(event.data);
          if (!tool.name) return;

          console.log("🔥 WIDGET GELDİ (tool_use):", tool.name);

          // A) Önce şu an akan metin mesajını bitir (isStreaming: false)
          setIsTyping(false);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMsgId ? { ...msg, isStreaming: false } : msg
            )
          );

          // B) Sonra Widget'ı AYRI BİR MESAJ olarak listenin sonuna ekle
          // Böylece ekranda: [Metin Balonu] + [Widget] alt alta görünür.
          setMessages((prev) => {
            if (prev.some((m) => m.id === tool.id)) return prev;
            return [
              ...prev,
              {
                id: tool.id,
                sender: "tool_widget",
                timestamp: new Date(),
                toolData: { id: tool.id, name: tool.name, submitted: false },
                text: "",
              },
            ];
          });
        } catch (e) {
          console.error("Tool Use Parse Error:", e);
        }
      });

      // ... (Error ve Status eventleri aynı kalabilir)
      eventSource.addEventListener("status", () => {
        setIsTyping(false);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMsgId ? { ...msg, isStreaming: false } : msg
          )
        );
        eventSource.close();
      });

      eventSource.addEventListener("error", (event) => {
        // ... hata kodları aynı ...
        setIsTyping(false);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMsgId ? { ...msg, isStreaming: false } : msg
          )
        );
        eventSource.close();
      });

      return () => {
        eventSource.removeAllEventListeners();
        eventSource.close();
      };
    } catch (err) {
      console.error(err);
      setIsTyping(false);
    }
  };

  const handleUserSend = () => {
    if (!inputText.trim()) return;
    const text = inputText.trim();
    setInputText("");
    Keyboard.dismiss();

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        text,
        sender: "user",
        timestamp: new Date(),
      },
    ]);

    // Kullanıcı mesajı gönderdiğinde akışı başlat
    connectAndStream([{ role: "user", content: [{ type: "text", text }] }]);
  };

  const handleToolSubmit = (toolId: string, responseJson: object) => {
    // 1. Tool'u submitted olarak işaretle (UI'da buton disable olsun vs.)
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === toolId && msg.toolData
          ? { ...msg, toolData: { ...msg.toolData, submitted: true } }
          : msg
      )
    );

    console.log("📤 WIDGET CEVAP:", responseJson);

    // 2. Cevabı Backend'e gönder (role: "tool") -> LangGraph Resume
    connectAndStream([
      {
        role: "tool",
        tool_call_id: toolId,
        content: JSON.stringify(responseJson),
      },
    ]);
  };

  const renderItem = ({ item }: { item: ChatMessage }) => {
    // --- TOOL WIDGET RENDER ---
    if (item.sender === "tool_widget" && item.toolData) {
      const { name, id, submitted } = item.toolData;

      if (!name) return null;
      const toolName = name.toLowerCase();

      // Tool isimlerine göre ilgili component'i döndür
      if (toolName === "request_runner_profile") {
        return (
          <View style={styles.toolContainer}>
            <RunnerProfileTool
              onSubmit={(data) => handleToolSubmit(id, data)}
              submitted={submitted}
              initialData={{
                weight: user?.weight ? String(user.weight) : "70",
                height: user?.height ? String(user.height) : "175",
                gender: (user as any)?.gender || "male",
                pace: (user as any)?.pace_display || "6:00",
                experience: (user as any)?.experience_level || "beginner",
              }}
            />
          </View>
        );
      } else if (toolName === "request_program_setup") {
        return (
          <View style={styles.toolContainer}>
            <ProgramSetupTool
              onSubmit={(data) => handleToolSubmit(id, data)}
              submitted={submitted}
            />
          </View>
        );
      } else if (toolName === "request_availability_preferences") {
        return (
          <View style={styles.toolContainer}>
            <AvailabilityTool
              onSubmit={(data) => handleToolSubmit(id, data)}
              submitted={submitted}
            />
          </View>
        );
      }
      return null;
    }

    // --- TEXT MESSAGE RENDER ---
    const isUser = item.sender === "user";
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
          {item.text === "" && item.isStreaming ? (
            <ActivityIndicator size="small" color={COLORS.accent} />
          ) : (
            <Text
              style={[
                styles.msgText,
                isUser ? styles.msgTextUser : styles.msgTextAi,
              ]}
            >
              {item.text}
            </Text>
          )}
        </View>
      </View>
    );
  };

  const isInputDisabled = isTyping || !!activeToolId;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 15, paddingBottom: 60 }}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
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
              activeToolId ? "Lütfen seçimi yapın..." : "Mesaj yazın..."
            }
            placeholderTextColor="#666"
            editable={!isInputDisabled}
            multiline
          />
          <TouchableOpacity
            onPress={handleUserSend}
            disabled={!inputText.trim() || isInputDisabled}
            style={[
              styles.sendBtn,
              (!inputText.trim() || isInputDisabled) && { opacity: 0.5 },
            ]}
          >
            <Ionicons name="arrow-up" size={20} color={COLORS.background} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

export default ChatbotScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  messageRow: {
    flexDirection: "row",
    marginBottom: 20,
    alignItems: "flex-end",
    gap: 8,
  },
  rowUser: { justifyContent: "flex-end" },
  rowAi: { justifyContent: "flex-start" },
  aiAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.card,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  bubble: { padding: 14, borderRadius: 20, maxWidth: "80%" },
  bubbleUser: { backgroundColor: COLORS.accent, borderBottomRightRadius: 4 },
  bubbleAi: {
    backgroundColor: COLORS.card,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  msgText: { fontSize: 15, lineHeight: 22 },
  msgTextUser: { color: "#000", fontWeight: "600" },
  msgTextAi: { color: COLORS.text },
  toolContainer: { width: "100%", marginBottom: 20, paddingHorizontal: 5 },
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
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontSize: 15,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.accent,
    justifyContent: "center",
    alignItems: "center",
  },
});
