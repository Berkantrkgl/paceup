import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useContext, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import EventSource, { EventSourceListener } from "react-native-sse";

import { COLORS } from "@/constants/Colors";
import { FASTAPI_URL } from "@/constants/Config";
import { AuthContext } from "@/utils/authContext";

type Message = {
    id: string;
    text: string;
    sender: "user" | "ai";
    timestamp: Date;
    isStreaming?: boolean;
};

const ChatbotScreen = () => {
    const { getValidToken } = useContext(AuthContext);
    const flatListRef = useRef<FlatList>(null);

    // --- DEĞİŞİKLİK BURADA ---
    // Thread ID'yi component içinde useRef ile oluşturuyoruz.
    // Bu sayede ekran her açıldığında (mount olduğunda) yeni bir ID üretilir
    // ama state değişimlerinde (yazı yazarken) ID sabit kalır.
    const threadIdRef = useRef(
        `thread-${Math.random().toString(36).substring(7)}`
    );

    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState("");
    const [isTyping, setIsTyping] = useState(false);

    useEffect(() => {
        setMessages([
            {
                id: "welcome",
                text: "Selam! 👋 Ben Pace. Bugün antrenmanında sana nasıl yardımcı olabilirim?",
                sender: "ai",
                timestamp: new Date(),
            },
        ]);

        // Debug için konsola yeni ID'yi yazdıralım
        console.log("Yeni Sohbet Başladı, Thread ID:", threadIdRef.current);
    }, []);

    const handleSendMessage = async () => {
        if (!inputText.trim()) return;

        // 1. Token Kontrolü
        const validToken = await getValidToken();

        if (!validToken) {
            Alert.alert("Oturum Hatası", "Lütfen tekrar giriş yapın.");
            return;
        }

        // 2. Kullanıcı mesajını ekle
        const userText = inputText.trim();
        const userMsgId = Date.now().toString();

        const userMsg: Message = {
            id: userMsgId,
            text: userText,
            sender: "user",
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMsg]);
        setInputText("");
        Keyboard.dismiss();

        // 3. AI Placeholder ekle
        const aiMsgId = (Date.now() + 1).toString();
        const initialAiMsg: Message = {
            id: aiMsgId,
            text: "",
            sender: "ai",
            timestamp: new Date(),
            isStreaming: true,
        };

        setMessages((prev) => [...prev, initialAiMsg]);
        setIsTyping(true);

        // 4. SSE Bağlantısı Başlat
        const eventSource = new EventSource(`${FASTAPI_URL}/chat-stream`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${validToken}`,
            },
            body: JSON.stringify({
                // Global değişken yerine ref.current kullanıyoruz
                thread_id: threadIdRef.current,
                messages: [
                    {
                        role: "user",
                        content: [{ type: "text", text: userText }],
                    },
                ],
            }),
            pollingInterval: 0,
        });

        eventSource.addEventListener("open", () => {
            console.log("SSE Bağlantısı açıldı.");
        });

        const handleMessage: EventSourceListener = (event) => {
            if (event.type === "message" && event.data) {
                try {
                    const data = JSON.parse(event.data);

                    if (data.type === "token" && data.content) {
                        setMessages((currentMessages) => {
                            return currentMessages.map((msg) => {
                                if (msg.id === aiMsgId) {
                                    return {
                                        ...msg,
                                        text: msg.text + data.content,
                                    };
                                }
                                return msg;
                            });
                        });
                    } else if (data.type === "complete") {
                        setIsTyping(false);
                        eventSource.close();
                    } else if (data.type === "error") {
                        console.error("AI Error:", data.content);
                        setIsTyping(false);
                        eventSource.close();
                    }
                } catch (e) {
                    console.log("JSON Parse Hatası:", e);
                }
            }
        };

        eventSource.addEventListener("message", handleMessage);

        eventSource.addEventListener("error", (err) => {
            console.error("SSE Connection Error:", err);
            setIsTyping(false);
            eventSource.close();

            setMessages((prev) =>
                prev.map((msg) =>
                    msg.id === aiMsgId && msg.text === ""
                        ? {
                              ...msg,
                              text: "Bağlantı hatası oluştu.",
                              isStreaming: false,
                          }
                        : msg
                )
            );
        });
    };

    // Auto Scroll
    useEffect(() => {
        if (flatListRef.current && messages.length > 0) {
            setTimeout(
                () => flatListRef.current?.scrollToEnd({ animated: true }),
                100
            );
        }
    }, [messages.length, messages[messages.length - 1]?.text?.length]);

    const renderMessageItem = ({ item }: { item: Message }) => {
        const isUser = item.sender === "user";
        return (
            <View
                style={[
                    styles.messageRow,
                    isUser ? styles.messageRowUser : styles.messageRowAi,
                ]}
            >
                {!isUser && (
                    <LinearGradient
                        colors={[COLORS.accent, COLORS.secondary]}
                        style={styles.aiAvatar}
                    >
                        <Ionicons
                            name="git-network-outline"
                            size={18}
                            color="white"
                        />
                    </LinearGradient>
                )}
                <View style={isUser ? styles.userBubble : styles.aiBubble}>
                    {item.text === "" && item.isStreaming ? (
                        <ActivityIndicator
                            size="small"
                            color={isUser ? "white" : COLORS.accent}
                        />
                    ) : (
                        <Text style={isUser ? styles.userText : styles.aiText}>
                            {item.text}
                        </Text>
                    )}
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={renderMessageItem}
                contentContainerStyle={styles.listContent}
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
                style={styles.inputWrapper}
            >
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.textInput}
                        value={inputText}
                        onChangeText={setInputText}
                        placeholder="Mesajını yaz..."
                        placeholderTextColor={COLORS.textDim}
                    />
                    <Pressable
                        onPress={handleSendMessage}
                        disabled={isTyping || !inputText.trim()}
                    >
                        <LinearGradient
                            colors={
                                inputText.trim()
                                    ? [COLORS.accent, COLORS.secondary]
                                    : [COLORS.cardBorder, COLORS.cardBorder]
                            }
                            style={styles.sendButtonGradient}
                        >
                            <Ionicons name="send" size={20} color="white" />
                        </LinearGradient>
                    </Pressable>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
};

export default ChatbotScreen;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    listContent: { padding: 15, paddingBottom: 40 },
    messageRow: { flexDirection: "row", marginBottom: 15, maxWidth: "85%" },
    messageRowUser: { alignSelf: "flex-end", justifyContent: "flex-end" },
    messageRowAi: { alignSelf: "flex-start" },
    aiAvatar: {
        width: 34,
        height: 34,
        borderRadius: 17,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 8,
    },
    userBubble: {
        backgroundColor: COLORS.card,
        borderRadius: 20,
        borderBottomRightRadius: 4,
        padding: 12,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    aiBubble: {
        backgroundColor: "#2A2A2A",
        borderRadius: 20,
        borderBottomLeftRadius: 4,
        padding: 12,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    userText: { color: COLORS.text, fontSize: 15 },
    aiText: { color: "white", fontSize: 15 },
    inputWrapper: {
        borderTopWidth: 1,
        borderColor: COLORS.cardBorder,
        paddingBottom: 20,
        backgroundColor: COLORS.background,
    },
    inputContainer: { flexDirection: "row", padding: 10, alignItems: "center" },
    textInput: {
        flex: 1,
        backgroundColor: COLORS.card,
        borderRadius: 20,
        padding: 10,
        color: "white",
        marginRight: 10,
    },
    sendButtonGradient: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: "center",
        alignItems: "center",
    },
});
