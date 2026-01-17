import { FASTAPI_URL } from "@/constants/Config";
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
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
// 📦 MARKDOWN & SSE
import Markdown from "react-native-markdown-display";
import EventSource from "react-native-sse";

import { COLORS } from "@/constants/Colors";
import { ChatMessage } from "@/types/plans";
import { AuthContext } from "@/utils/authContext";

// 🛠️ WIDGET IMPORTS
import { AvailabilityTool } from "@/components/chat/tools/AvailabilityTool";
import { ProgramSetupTool } from "@/components/chat/tools/ProgramSetupTool";
import { RunnerProfileTool } from "@/components/chat/tools/RunnerProfileTool";

// ============================================================
// 💬 SABİTLER: Bekleme Metinleri (GÜNCELLENDİ)
// ============================================================
const LOADING_TEXTS = [
  "🚀 Koşu verilerin işleniyor...",
  "🔥 Çok az kaldı, beklemene değecek...",
  "🧠 Sana özel programın hazırlanıyor...",
  "👟 Kişisel bilgilerine göre düzenleniyor...",
  "🧬 Zorluk seviyesi ayarlanıyor...",
  "🎯 Hedeflerine en uygun takvim oluşturuluyor...",
];

const SUCCESS_TEXT = "✅ Programın başarıyla oluşturuldu!";
const ERROR_TEXT = "⚠️ Bir sorun oluştu.";

// ============================================================
// ✨ BİLEŞEN: DynamicSystemMessage (GÜNCELLENDİ: Random + No Spinner)
// ============================================================
const DynamicSystemMessage = ({
  isFinished,
  isError,
}: {
  isFinished: boolean;
  isError?: boolean;
}) => {
  // Rastgele bir başlangıç mesajı seç
  const [textIndex, setTextIndex] = useState(() =>
    Math.floor(Math.random() * LOADING_TEXTS.length),
  );

  const fadeAnim = useRef(new Animated.Value(0.6)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // 1. METİN DÖNGÜSÜ (RASTGELE)
  useEffect(() => {
    if (isFinished) return;

    const interval = setInterval(() => {
      // Hafif kayma animasyonu
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

      // Rastgele yeni bir index seç (ama aynısı gelmesin)
      setTextIndex((prev) => {
        let nextIndex;
        do {
          nextIndex = Math.floor(Math.random() * LOADING_TEXTS.length);
        } while (nextIndex === prev && LOADING_TEXTS.length > 1);
        return nextIndex;
      });
    }, 3000); // 3 saniyede bir değişir

    return () => clearInterval(interval);
  }, [isFinished]);

  // 2. NEFES ALMA ANİMASYONU
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

  let currentText = LOADING_TEXTS[textIndex];
  if (isFinished) {
    currentText = isError
      ? "⚠️ Bir sorun oluştu."
      : "✅ Programın başarıyla oluşturuldu!";
  }

  return (
    <Animated.View
      style={[
        styles.modernSystemContainer,
        { opacity: fadeAnim },
        isError && { borderColor: "#FF5252" },
      ]}
    >
      {/* SADECE İŞLEM BİTTİYSE İKON GÖSTER (Loading ikonu kaldırıldı) */}
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
          // İkon yoksa metni ortalamak veya sola yaslamak için margin ayarı
          !isFinished && { textAlign: "center", width: "100%" },
        ]}
      >
        {currentText}
      </Animated.Text>
    </Animated.View>
  );
};

// ============================================================
// 📱 ANA EKRAN BİLEŞENİ
// ============================================================
const ChatbotScreen = () => {
  const { getValidToken, user } = useContext(AuthContext);
  const flatListRef = useRef<FlatList>(null);

  const [threadId, setThreadId] = useState(
    `thread-${Math.random().toString(36).substring(7)}`,
  );

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  // Scroll Helpers
  const [userScrolling, setUserScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUserInteracting = useRef(false);

  // Widget Durumu
  const activeToolId = messages.find(
    (m) => m.sender === "tool_widget" && !m.toolData?.submitted,
  )?.id;

  // 🚀 BAŞLANGIÇ
  useEffect(() => {
    if (messages.length > 0) return;

    const initChat = async () => {
      console.log("💬 Chat başlatılıyor...");
      const hiddenTriggerMessage = "Selam!";

      await connectAndStream([
        {
          role: "user",
          content: [{ type: "text", text: hiddenTriggerMessage }],
        },
      ]);
    };

    initChat();
  }, [threadId]);

  // 🌊 STREAMING CONNECTION
  const connectAndStream = async (payloadMessages: any[]) => {
    const validToken = await getValidToken();
    if (!validToken) return;

    setIsTyping(true);

    // Aktif AI Balonunun ID'sini takip etmek için bir değişken (Ref yerine local variable yeterli çünkü closure içinde)
    let activeAiMsgId = Date.now().toString();

    // İlk AI balonunu başlat
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

    try {
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

      // 1. TOKEN EVENT (Yazı Akışı)
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
          console.error("Token error:", e);
        }
      });

      // 2. NOTIFICATION EVENT (Backend İşlem Bilgisi)
      eventSource.addEventListener("tool_notification", (event) => {
        if (!event.data) return;
        try {
          // const info = JSON.parse(event.data); // İstersen mesajı buradan alabilirsin ama biz dinamik gösteriyoruz

          setMessages((prev) => {
            // A) Mevcut akmakta olan AI balonunu durdur
            // Eğer içi boşsa silebilirdik ama genelde "Düşünüyorum..." gibi kalması yerine,
            // içi boşsa tamamen kaldırıp yerine bildirimi koymak daha temiz.
            const cleanHistory = prev
              .filter((m) => !(m.id === activeAiMsgId && m.text.trim() === ""))
              .map((m) =>
                m.id === activeAiMsgId ? { ...m, isStreaming: false } : m,
              );

            // B) Bildirim Mesajı (sender: system_info)
            const notificationMsg: ChatMessage = {
              id: `notify-${Date.now()}`,
              sender: "system_info",
              text: "", // Metin artık DynamicSystemMessage içinde yönetiliyor
              timestamp: new Date(),
              isStreaming: false,
            };

            // C) Bildirimden sonrası için YENİ bir AI balonu
            const newAiMsgId = `ai-${Date.now()}`;
            activeAiMsgId = newAiMsgId; // Closure içindeki ID'yi güncelle

            const newAiMsg: ChatMessage = {
              id: newAiMsgId,
              sender: "ai",
              text: "",
              timestamp: new Date(),
              isStreaming: true,
            };

            return [...cleanHistory, notificationMsg, newAiMsg];
          });
        } catch (e) {
          console.error("Notify error:", e);
        }
      });

      // 3. TOOL USE EVENT
      eventSource.addEventListener("tool_use", (event) => {
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
          console.error("Tool error:", e);
        }
      });

      const finalizeStream = () => {
        setIsTyping(false);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === activeAiMsgId ? { ...msg, isStreaming: false } : msg,
          ),
        );
        eventSource.close();
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

  // 📤 MESAJ GÖNDERME
  const handleUserSend = () => {
    if (!inputText.trim()) return;
    const text = inputText.trim();
    setInputText("");
    Keyboard.dismiss();

    setUserScrolling(false);
    isUserInteracting.current = false;
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);

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

  const handleToolSubmit = (toolId: string, responseJson: object) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === toolId && msg.toolData
          ? { ...msg, toolData: { ...msg.toolData, submitted: true } }
          : msg,
      ),
    );
    setUserScrolling(false);
    connectAndStream([
      {
        role: "tool",
        tool_call_id: toolId,
        content: JSON.stringify(responseJson),
      },
    ]);
  };

  // 🎨 RENDER ITEM (Burada düzeltme yapıldı)
  // 'item' ve 'index' parametrelerini alıyoruz
  const renderItem = ({ item, index }: ListRenderItemInfo<ChatMessage>) => {
    // 1. SİSTEM BİLDİRİMİ (FİXLENDİ 🛠️)
    if (item.sender === "system_info") {
      // ✅ YENİ MANTIK:
      // 1. Benden sonra bir mesaj var mı? (messages[index + 1])
      // 2. O mesajın içinde EN AZ 2 harf var mı? (text.length > 2)
      // Bu sayede boş balon eklendiğinde değil, yazı yazılmaya başlandığında "Bitti" der.

      const nextMsg = messages[index + 1];
      const hasContentStarted =
        nextMsg && nextMsg.text && nextMsg.text.length > 2;
      const isProcessFinished =
        index < messages.length - 1 && !!hasContentStarted;

      // Hata kontrolü (Opsiyonel): Eğer cevap "Üzgünüm" veya "Hata" ile başlıyorsa başarı gösterme
      const isError =
        nextMsg &&
        (nextMsg.text.startsWith("Üzgünüm") ||
          nextMsg.text.includes("hata oluştu"));

      return (
        <View
          style={{ width: "100%", alignItems: "center", marginVertical: 10 }}
        >
          <DynamicSystemMessage
            isFinished={isProcessFinished}
            isError={!!isError} // Hata durumunu bileşene gönderelim
          />
        </View>
      );
    }

    // 2. WIDGETLAR
    if (item.sender === "tool_widget" && item.toolData) {
      const { name, id, submitted, input } = item.toolData;
      const toolName = name.toLowerCase();
      let ToolComponent = null;

      if (toolName === "request_runner_profile") {
        ToolComponent = (
          <RunnerProfileTool
            onSubmit={(data) => handleToolSubmit(id, data)}
            submitted={submitted}
            requestedFields={input?.fields_to_collect || input?.missing_fields}
            initialData={{
              weight: user?.weight ? String(user.weight) : "70",
              height: user?.height ? String(user.height) : "175",
              gender: (user as any)?.gender || "male",
              pace: (user as any)?.pace_display || "6:00",
              experience: (user as any)?.experience_level || "beginner",
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
      }
      return ToolComponent ? (
        <View style={styles.toolContainer}>{ToolComponent}</View>
      ) : null;
    }

    // 3. NORMAL MESAJLAR
    const isUser = item.sender === "user";

    // Boş streaming mesajı (henüz token gelmediyse) loading göster
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
    // Boş ve streaming değilse gösterme
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

  // Scroll Handler
  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 20) {
      setUserScrolling(false);
      isUserInteracting.current = false;
    }
  };

  const isInputDisabled = isTyping || !!activeToolId;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem} // Artık index parametresini alıyor
        contentContainerStyle={{ padding: 15, paddingBottom: 60 }}
        onContentSizeChange={() => {
          if (!userScrolling && !isUserInteracting.current) {
            flatListRef.current?.scrollToEnd({ animated: true });
          }
        }}
        onScroll={handleScroll}
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

  // 🔥 MODERN SİSTEM BİLDİRİMİ STİLİ
  modernSystemContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A1A", // Çok koyu gri
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 30, // Tam hap şekli
    borderWidth: 1,
    borderColor: "rgba(255, 165, 0, 0.2)", // Çok hafif turuncu çerçeve
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
});

// Markdown Styles
const markdownStylesAi = StyleSheet.create({
  body: {
    color: "#E0E0E0",
    fontSize: 14,
    lineHeight: 20,
  },
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
