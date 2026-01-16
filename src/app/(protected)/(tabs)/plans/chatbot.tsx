import { FASTAPI_URL } from "@/constants/Config";
import { Ionicons } from "@expo/vector-icons";
import React, { useContext, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
// 📦 MARKDOWN IMPORT
import Markdown from "react-native-markdown-display";
import EventSource from "react-native-sse";

import { COLORS } from "@/constants/Colors";
import { ChatMessage } from "@/types/plans";
import { AuthContext } from "@/utils/authContext";

// WIDGET IMPORTS
import { AvailabilityTool } from "@/components/chat/tools/AvailabilityTool";
import { ProgramSetupTool } from "@/components/chat/tools/ProgramSetupTool";
import { RunnerProfileTool } from "@/components/chat/tools/RunnerProfileTool";

const ChatbotScreen = () => {
  const { getValidToken, user } = useContext(AuthContext);
  const flatListRef = useRef<FlatList>(null);

  const [threadId, setThreadId] = useState(
    `thread-${Math.random().toString(36).substring(7)}`,
  );

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  // Kullanıcı manuel scroll yaptığında auto-scroll'u durdur
  const [userScrolling, setUserScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUserInteracting = useRef(false);

  const activeToolId = messages.find(
    (m) => m.sender === "tool_widget" && !m.toolData?.submitted,
  )?.id;

  // ------------------------------------------------------------
  // 🚀 AÇILIŞ MANTIĞI
  // ------------------------------------------------------------
  useEffect(() => {
    if (messages.length > 0) return;

    const initChat = async () => {
      console.log("💬 Chat başlatılıyor...");
      const hiddenTriggerMessage =
        "Selam, uygulamayı açtım. Beni ismimle ve koşu istatistiklerimle motive edici şekilde karşıla.";

      await connectAndStream([
        {
          role: "user",
          content: [{ type: "text", text: hiddenTriggerMessage }],
        },
      ]);
    };

    initChat();
  }, [threadId]);

  // ------------------------------------------------------------
  // 🎯 SCROLL CONTROL FUNCTIONS
  // ------------------------------------------------------------

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 20;
    const isAtBottom =
      layoutMeasurement.height + contentOffset.y >=
      contentSize.height - paddingToBottom;

    if (isAtBottom) {
      setUserScrolling(false);
      isUserInteracting.current = false;
    }
  };

  const handleScrollBeginDrag = () => {
    setUserScrolling(true);
    isUserInteracting.current = true;

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
  };

  const handleScrollEndDrag = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 20;
    const isAtBottom =
      layoutMeasurement.height + contentOffset.y >=
      contentSize.height - paddingToBottom;

    if (isAtBottom) {
      setUserScrolling(false);
      isUserInteracting.current = false;
    } else {
      scrollTimeoutRef.current = setTimeout(() => {
        setUserScrolling(false);
        isUserInteracting.current = false;
      }, 5000);
    }
  };

  const handleMomentumScrollEnd = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 20;
    const isAtBottom =
      layoutMeasurement.height + contentOffset.y >=
      contentSize.height - paddingToBottom;

    if (isAtBottom) {
      setUserScrolling(false);
      isUserInteracting.current = false;
    }
  };

  // ------------------------------------------------------------
  // 🌊 STREAMING CONNECTION
  // ------------------------------------------------------------
  const connectAndStream = async (payloadMessages: any[]) => {
    const validToken = await getValidToken();
    if (!validToken) {
      console.error("❌ Token alınamadı!");
      return;
    }

    setIsTyping(true);
    const aiMsgId = Date.now().toString();

    setMessages((prev) => [
      ...prev,
      {
        id: aiMsgId,
        text: "",
        sender: "ai",
        timestamp: new Date(),
        isStreaming: true,
      },
    ]);

    try {
      console.log(`🔗 Bağlanıyor: ${FASTAPI_URL}/chat-stream`);
      console.log(`📌 Thread ID: ${threadId}`);

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
                  : msg,
              ),
            );
          }
        } catch (e) {
          console.error("❌ Token parse hatası:", e);
        }
      });

      eventSource.addEventListener("tool_use", (event) => {
        if (!event.data) return;
        try {
          const tool = JSON.parse(event.data);
          if (!tool.name) return;

          console.log(`🔧 Widget çağrıldı: ${tool.name}`);
          console.log(`📋 Tool ID: ${tool.id}`);

          setIsTyping(false);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMsgId ? { ...msg, isStreaming: false } : msg,
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
          console.error("❌ Tool parse hatası:", e);
        }
      });

      eventSource.addEventListener("status", () => {
        console.log("✅ Stream tamamlandı");
        setIsTyping(false);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMsgId ? { ...msg, isStreaming: false } : msg,
          ),
        );
        eventSource.close();
      });

      eventSource.addEventListener("error", (event) => {
        console.error("❌ Stream hatası:", event);
        setIsTyping(false);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMsgId ? { ...msg, isStreaming: false } : msg,
          ),
        );
        eventSource.close();
      });

      return () => {
        eventSource.removeAllEventListeners();
        eventSource.close();
      };
    } catch (err) {
      console.error("❌ Bağlantı hatası:", err);
      setIsTyping(false);
    }
  };

  // ------------------------------------------------------------
  // 📤 USER MESSAGE HANDLER
  // ------------------------------------------------------------
  const handleUserSend = () => {
    if (!inputText.trim()) return;
    const text = inputText.trim();
    setInputText("");
    Keyboard.dismiss();

    console.log(
      `📤 Kullanıcı mesajı: "${text.substring(0, 50)}${text.length > 50 ? "..." : ""}"`,
    );

    setUserScrolling(false);
    isUserInteracting.current = false;
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

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

  // ------------------------------------------------------------
  // 🔧 TOOL SUBMIT HANDLER
  // ------------------------------------------------------------
  const handleToolSubmit = (toolId: string, responseJson: object) => {
    console.log(`✅ Widget gönderildi: ${toolId}`);
    console.log(`📊 Yanıt:`, responseJson);

    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === toolId && msg.toolData
          ? { ...msg, toolData: { ...msg.toolData, submitted: true } }
          : msg,
      ),
    );

    setUserScrolling(false);
    isUserInteracting.current = false;

    connectAndStream([
      {
        role: "tool",
        tool_call_id: toolId,
        content: JSON.stringify(responseJson),
      },
    ]);
  };

  // ------------------------------------------------------------
  // 🎨 RENDER ITEM
  // ------------------------------------------------------------
  const renderItem = ({ item }: { item: ChatMessage }) => {
    // --- WIDGET RENDER ---
    if (item.sender === "tool_widget" && item.toolData) {
      const { name, id, submitted, input } = item.toolData;
      if (!name) return null;
      const toolName = name.toLowerCase();

      if (toolName === "request_runner_profile") {
        return (
          <View style={styles.toolContainer}>
            <RunnerProfileTool
              onSubmit={(data) => handleToolSubmit(id, data)}
              submitted={submitted}
              requestedFields={
                input?.fields_to_collect || input?.missing_fields
              }
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
    const showSpinner = item.text === "" && item.isStreaming;

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
          {showSpinner ? (
            <ActivityIndicator size="small" color={COLORS.accent} />
          ) : (
            <Markdown style={isUser ? markdownStylesUser : markdownStylesAi}>
              {item.text}
            </Markdown>
          )}
        </View>
      </View>
    );
  };

  const isInputDisabled = isTyping || !!activeToolId;

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 15, paddingBottom: 60 }}
        onContentSizeChange={() => {
          if (!userScrolling && !isUserInteracting.current) {
            setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
          }
        }}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        scrollEventThrottle={16}
        onLayout={() => {
          if (messages.length > 0) {
            flatListRef.current?.scrollToEnd({ animated: false });
          }
        }}
        removeClippedSubviews={Platform.OS === "android"}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        windowSize={10}
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
              activeToolId ? "Seçimi tamamlayın..." : "Mesaj yazın..."
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

// ------------------------------------------------------------
// 🎨 MARKDOWN STYLES
// ------------------------------------------------------------

const markdownStylesAi = StyleSheet.create({
  body: {
    color: "#E0E0E0",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  heading1: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginTop: 5,
    marginBottom: 5,
    lineHeight: 22,
  },
  heading2: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginTop: 5,
    marginBottom: 5,
  },
  paragraph: {
    marginTop: 0,
    marginBottom: 6,
    flexWrap: "wrap",
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "flex-start",
  },
  list_item: {
    marginVertical: 2,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  bullet_list_icon: {
    color: COLORS.accent,
    fontSize: 16,
    lineHeight: 20,
    marginRight: 6,
    marginLeft: 0,
  },
  strong: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});

const markdownStylesUser = StyleSheet.create({
  body: {
    color: "#000000",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  paragraph: {
    marginTop: 0,
    marginBottom: 0,
  },
});

// ------------------------------------------------------------
// 🎨 COMPONENT STYLES
// ------------------------------------------------------------

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
});
