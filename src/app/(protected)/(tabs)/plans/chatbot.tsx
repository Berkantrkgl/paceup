import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useContext, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
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

import { COLORS } from "@/constants/Colors";
import { AuthContext } from "@/utils/authContext";

type Message = {
    id: string;
    text: string;
    sender: "user" | "ai";
    timestamp: Date;
    isStreaming?: boolean; // Mesajın hala yazılıyor olduğunu anlamak için
};

const ChatbotScreen = () => {
    const { token } = useContext(AuthContext);
    const flatListRef = useRef<FlatList>(null);

    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState("");
    const [isTyping, setIsTyping] = useState(false);

    useEffect(() => {
        setMessages([
            {
                id: "welcome",
                text: "Merhaba! 👋 Ben senin AI Koşu Koçunum. Hedefin nedir? (Örn: 'Maratona hazırlanmak istiyorum' veya 'Kilo vermek için koşmak istiyorum')",
                sender: "ai",
                timestamp: new Date(),
            },
        ]);
    }, []);

    // --- STREAMING PROCESSOR (Token'ları birleştirip ekrana basan fonksiyon) ---
    const processStream = async (streamTokens: string[], messageId: string) => {
        setIsTyping(true);

        // Simülasyon: Her token arasında ufak bir gecikme (Stream akış hızı)
        for (const tokenChunk of streamTokens) {
            await new Promise((resolve) => setTimeout(resolve, 50)); // 50ms gecikme (network simülasyonu)

            setMessages((currentMessages) => {
                return currentMessages.map((msg) => {
                    if (msg.id === messageId) {
                        return {
                            ...msg,
                            text: msg.text + tokenChunk + " ", // Mevcut metne yeni token'ı ekle
                        };
                    }
                    return msg;
                });
            });
        }

        // Stream bittiğinde
        setIsTyping(false);
        setMessages((currentMessages) =>
            currentMessages.map((msg) =>
                msg.id === messageId ? { ...msg, isStreaming: false } : msg
            )
        );
    };

    const handleSendMessage = async () => {
        if (!inputText.trim()) return;

        // 1. KULLANICI MESAJINI EKLE
        const userMsg: Message = {
            id: Date.now().toString(),
            text: inputText,
            sender: "user",
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMsg]);
        const userInput = inputText; // Inputu sakla (API'ye göndermek için)
        setInputText("");
        Keyboard.dismiss();

        // 2. BOŞ AI MESAJI EKLE (PLACEHOLDER)
        // Stream başladığında bu mesajın içi dolacak.
        const aiMsgId = (Date.now() + 1).toString();
        const initialAiMsg: Message = {
            id: aiMsgId,
            text: "", // Başlangıçta boş
            sender: "ai",
            timestamp: new Date(),
            isStreaming: true,
        };

        setMessages((prev) => [...prev, initialAiMsg]);
        setIsTyping(true);

        try {
            // --- BURASI İLERİDE GERÇEK API STREAMING OLACAK ---
            /* const response = await fetch(`${API_URL}/ai/chat_stream`, { ... });
            const reader = response.body.getReader();
            while(true) {
               const { done, value } = await reader.read();
               if (done) break;
               // Gelen value'yu decode et ve state'e append et
            }
            */

            // --- ŞİMDİLİK: MOCK DATA & TOKEN ARRAY SİMÜLASYONU ---
            // Backend'den parça parça geldiğini varsaydığımız cevap:
            const mockFullResponse =
                "Harika bir hedef! Senin için haftada 3 gün sürecek, interval ağırlıklı ve dayanıklılık odaklı bir program oluşturabilirim. İlk hafta hafif tempo ile başlayacağız, hazır mısın?";

            // Cevabı kelimelere (tokenlara) bölüyoruz
            const tokens = mockFullResponse.split(" ");

            // Stream işleyiciye gönderiyoruz
            await processStream(tokens, aiMsgId);
        } catch (error) {
            console.log("Chat error:", error);
            setIsTyping(false);
            // Hata durumunda AI mesajına hata metni basılabilir
        }
    };

    // --- AUTO SCROLL ---
    // Mesajlar her güncellendiğinde (her token geldiğinde) aşağı kaydır
    useEffect(() => {
        if (flatListRef.current && messages.length > 0) {
            flatListRef.current.scrollToEnd({ animated: true });
        }
    }, [messages]); // messages dependency'si her harf/kelime eklendiğinde tetikler

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
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.aiAvatar}
                    >
                        <Ionicons
                            name="git-network-outline"
                            size={18}
                            color="white"
                        />
                    </LinearGradient>
                )}

                {isUser ? (
                    <View style={styles.userBubble}>
                        <Text style={styles.userText}>{item.text}</Text>
                        <Text style={styles.timestampUser}>
                            {item.timestamp.toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                            })}
                        </Text>
                    </View>
                ) : (
                    <LinearGradient
                        colors={[COLORS.accent, COLORS.secondary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.aiBubble}
                    >
                        {/* Stream sırasında metin boşsa loading gösterilebilir veya boş bırakılabilir */}
                        {item.text === "" && item.isStreaming ? (
                            <ActivityIndicator
                                size="small"
                                color="white"
                                style={{ margin: 5 }}
                            />
                        ) : (
                            <Text style={styles.aiText}>{item.text}</Text>
                        )}

                        <Text style={styles.timestampAi}>
                            {item.timestamp.toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                            })}
                        </Text>
                    </LinearGradient>
                )}
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
                showsVerticalScrollIndicator={false}
                // Typing footer artık gerekli değil çünkü balonun içinde dönüyor,
                // ama isteğe bağlı olarak "AI yazıyor..." gibi dışarıda da tutabilirsin.
                // ListFooterComponent={...}
                onContentSizeChange={() =>
                    flatListRef.current?.scrollToEnd({ animated: true })
                }
                layoutProvider={null} // Bazen titremeyi önler
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
                style={styles.inputWrapper}
            >
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.textInput}
                        placeholder="Mesajını yaz..."
                        placeholderTextColor={COLORS.textDim}
                        value={inputText}
                        onChangeText={setInputText}
                        multiline
                    />
                    <Pressable
                        style={[
                            styles.sendButton,
                            !inputText.trim() && styles.sendButtonDisabled,
                        ]}
                        onPress={handleSendMessage}
                        disabled={!inputText.trim() || isTyping} // Yazarken göndermeyi engelle
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
    listContent: {
        paddingHorizontal: 15,
        paddingVertical: 20,
        paddingBottom: 40,
    },
    messageRow: {
        marginBottom: 15,
        flexDirection: "row",
        alignItems: "flex-end",
        maxWidth: "85%",
    },
    messageRowUser: { alignSelf: "flex-end", justifyContent: "flex-end" },
    messageRowAi: { alignSelf: "flex-start" },
    aiAvatar: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: "center",
        justifyContent: "center",
        marginRight: 8,
        marginBottom: 4,
    },
    userBubble: {
        backgroundColor: COLORS.card,
        borderRadius: 20,
        borderBottomRightRadius: 4,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    aiBubble: {
        borderRadius: 20,
        borderBottomLeftRadius: 4,
        paddingHorizontal: 16,
        paddingVertical: 12,
        minHeight: 40,
        justifyContent: "center",
    },

    // Texts
    userText: { color: COLORS.text, fontSize: 15, lineHeight: 22 },
    aiText: { color: "white", fontSize: 15, lineHeight: 22, fontWeight: "500" },
    timestampUser: {
        color: COLORS.textDim,
        fontSize: 10,
        marginTop: 4,
        alignSelf: "flex-end",
    },
    timestampAi: {
        color: "rgba(255,255,255,0.7)",
        fontSize: 10,
        marginTop: 4,
        alignSelf: "flex-start",
    },

    // Input Area
    inputWrapper: {
        backgroundColor: COLORS.background,
        borderTopWidth: 1,
        borderTopColor: COLORS.cardBorder,
        paddingBottom: 20,
    },
    inputContainer: {
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 15,
        paddingVertical: 12,
        gap: 10,
    },
    textInput: {
        flex: 1,
        backgroundColor: COLORS.card,
        borderRadius: 25,
        paddingHorizontal: 20,
        paddingVertical: 12,
        maxHeight: 100,
        color: COLORS.text,
        fontSize: 15,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    sendButton: {
        borderRadius: 25,
        overflow: "hidden",
        shadowColor: COLORS.accent,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 4,
    },
    sendButtonDisabled: { opacity: 0.5, shadowOpacity: 0 },
    sendButtonGradient: {
        width: 50,
        height: 50,
        alignItems: "center",
        justifyContent: "center",
    },
});
