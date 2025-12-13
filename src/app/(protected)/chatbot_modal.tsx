import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { COLORS } from '@/constants/Colors';

const chatbot_modal = () => {
  const params = useLocalSearchParams();
  const { planId, planTitle } = params;

  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'bot',
      text: `Merhaba! "${planTitle}" planını düzenlemek için buradayım 🏃‍♂️\n\nBu planda ne gibi değişiklikler yapmak istersin? Örneğin:\n• Antrenman yoğunluğunu artır/azalt\n• Haftalık antrenman sayısını değiştir\n• Hedef tarihi ertele\n• Dinlenme günlerini ayarla\n\nİstediğin değişikliği bana söyleyebilirsin!`,
      timestamp: new Date(),
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isModified, setIsModified] = useState(false);
  const scrollViewRef = useRef(null);

  // Scroll to bottom when new message arrives
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  const handleSend = () => {
    if (inputText.trim() === '') return;

    // Add user message
    const userMessage = {
      id: messages.length + 1,
      type: 'user',
      text: inputText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    // Simulate bot response (ileride FastAPI stream olacak)
    setTimeout(() => {
      const botMessage = {
        id: messages.length + 2,
        type: 'bot',
        text: 'Anladım! Programı biraz hafifletiyorum. Haftalık antrenman sayısını 5\'ten 4\'e düşürdüm ve koşu mesafelerini %15 azalttım. Tempo çalışmalarını da daha rahat tempolara çektim.\n\nBaşka bir değişiklik yapmak ister misin?',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, botMessage]);
      setIsLoading(false);
      setIsModified(true);
    }, 1500);
  };

  const handleApplyChanges = () => {
    // Değişiklikleri kaydet ve geri dön
    router.back();
    // Burada API'ye güncelleme isteği gönderilecek
  };

  const handleDiscardChanges = () => {
    // Değişiklikleri iptal et ve geri dön
    router.back();
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={styles.container}>
      {/* Header Info */}
      <View style={styles.headerInfo}>
        <View style={styles.headerIconContainer}>
          <View style={styles.aiIconCircle}>
            <Ionicons name="create" size={24} color="white" />
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Plan Düzenleyici</Text>
            <View style={styles.statusContainer}>
              <View style={styles.onlineIndicator} />
              <Text style={styles.headerSubtitle}>{planTitle}</Text>
            </View>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView 
        style={styles.keyboardAvoidingContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((message) => (
            <View key={message.id}>
              <View
                style={[
                  styles.messageBubble,
                  message.type === 'user' ? styles.userBubble : styles.botBubble,
                ]}
              >
                {message.type === 'bot' && (
                  <View style={styles.botAvatarSmall}>
                    <Ionicons name="flash" size={16} color="white" />
                  </View>
                )}
                
                <View style={[
                  styles.messageContent,
                  message.type === 'user' ? styles.userContent : styles.botContent,
                ]}>
                  <Text style={[
                    styles.messageText,
                    message.type === 'user' ? styles.userText : styles.botText,
                  ]}>
                    {message.text}
                  </Text>
                </View>
              </View>
              
              <Text style={[
                styles.timestamp,
                message.type === 'user' ? styles.userTimestamp : styles.botTimestamp,
              ]}>
                {formatTime(message.timestamp)}
              </Text>
            </View>
          ))}

          {isLoading && (
            <View style={styles.loadingContainer}>
              <View style={styles.botAvatarSmall}>
                <Ionicons name="flash" size={16} color="white" />
              </View>
              <View style={styles.loadingBubble}>
                <ActivityIndicator size="small" color={COLORS.accent} />
                <Text style={styles.loadingText}>Düzenliyor...</Text>
              </View>
            </View>
          )}

          <View style={{ height: 20 }} />
        </ScrollView>

        {/* Modified Badge */}
        {isModified && (
          <View style={styles.modifiedBadge}>
            <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
            <Text style={styles.modifiedText}>Değişiklikler uygulandı</Text>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActionsContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickActionsContent}
            keyboardShouldPersistTaps="handled"
          >
            <Pressable 
              style={styles.quickActionChip}
              onPress={() => setInputText('Program çok ağır geldi, biraz hafiflet')}
            >
              <Ionicons name="trending-down" size={16} color={COLORS.accent} />
              <Text style={styles.quickActionText}>Hafiflet</Text>
            </Pressable>

            <Pressable 
              style={styles.quickActionChip}
              onPress={() => setInputText('Daha fazla zorluk istiyorum, yoğunluğu artır')}
            >
              <Ionicons name="trending-up" size={16} color={COLORS.accent} />
              <Text style={styles.quickActionText}>Zorlaştır</Text>
            </Pressable>

            <Pressable 
              style={styles.quickActionChip}
              onPress={() => setInputText('Haftalık antrenman sayısını azalt')}
            >
              <Ionicons name="calendar-outline" size={16} color={COLORS.accent} />
              <Text style={styles.quickActionText}>Daha Az Antrenman</Text>
            </Pressable>

            <Pressable 
              style={styles.quickActionChip}
              onPress={() => setInputText('Daha fazla dinlenme günü ekle')}
            >
              <Ionicons name="moon-outline" size={16} color={COLORS.accent} />
              <Text style={styles.quickActionText}>Daha Fazla Dinlenme</Text>
            </Pressable>

            <Pressable 
              style={styles.quickActionChip}
              onPress={() => setInputText('Hedef tarihimi 2 hafta ertele')}
            >
              <Ionicons name="time-outline" size={16} color={COLORS.accent} />
              <Text style={styles.quickActionText}>Tarihi Ertele</Text>
            </Pressable>
          </ScrollView>
        </View>

        {/* Input Area */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Değişiklikleri yaz..."
              placeholderTextColor="#666"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
              returnKeyType="default"
              blurOnSubmit={false}
              textAlignVertical="center"
            />
            
            <Pressable 
              style={[
                styles.sendButton,
                inputText.trim() === '' && styles.sendButtonDisabled
              ]}
              onPress={handleSend}
              disabled={inputText.trim() === ''}
            >
              <Ionicons 
                name="send" 
                size={20} 
                color={inputText.trim() === '' ? '#666' : 'white'} 
              />
            </Pressable>
          </View>

          {/* Action Buttons */}
          {isModified && (
            <View style={styles.actionButtonsContainer}>
              <Pressable 
                style={styles.discardButton}
                onPress={handleDiscardChanges}
              >
                <Ionicons name="close-circle-outline" size={20} color="#FF6B6B" />
                <Text style={styles.discardButtonText}>İptal</Text>
              </Pressable>

              <Pressable 
                style={styles.applyButton}
                onPress={handleApplyChanges}
              >
                <Ionicons name="checkmark-circle" size={20} color="white" />
                <Text style={styles.applyButtonText}>Değişiklikleri Kaydet</Text>
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

export default chatbot_modal;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Header
  headerInfo: {
    backgroundColor: COLORS.card,
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiIconCircle: {
    backgroundColor: COLORS.accent,
    width: 45,
    height: 45,
    borderRadius: 22.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  onlineIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginRight: 6,
  },
  headerSubtitle: {
    color: '#B0B0B0',
    fontSize: 13,
  },

  // Keyboard Avoiding
  keyboardAvoidingContainer: {
    flex: 1,
  },

  // Messages
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 20,
  },
  messageBubble: {
    flexDirection: 'row',
    marginBottom: 4,
    alignItems: 'flex-end',
  },
  userBubble: {
    justifyContent: 'flex-end',
  },
  botBubble: {
    justifyContent: 'flex-start',
  },
  botAvatarSmall: {
    backgroundColor: COLORS.accent,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  messageContent: {
    maxWidth: '75%',
    borderRadius: 18,
    padding: 14,
  },
  userContent: {
    backgroundColor: COLORS.accent,
    borderBottomRightRadius: 4,
  },
  botContent: {
    backgroundColor: COLORS.card,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: 'white',
  },
  botText: {
    color: COLORS.text,
  },
  timestamp: {
    fontSize: 11,
    color: '#666',
    marginBottom: 12,
  },
  userTimestamp: {
    textAlign: 'right',
    marginRight: 8,
  },
  botTimestamp: {
    textAlign: 'left',
    marginLeft: 36,
  },

  // Loading
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  loadingText: {
    color: '#B0B0B0',
    fontSize: 14,
  },

  // Modified Badge
  modifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    paddingVertical: 10,
    gap: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  modifiedText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
  },

  // Quick Actions
  quickActionsContainer: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: COLORS.background,
  },
  quickActionsContent: {
    paddingHorizontal: 20,
    gap: 10,
  },
  quickActionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.accent,
    gap: 6,
  },
  quickActionText: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: '600',
  },

  // Input
  inputContainer: {
    backgroundColor: COLORS.card,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    minHeight: 50,
  },
  input: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    maxHeight: 100,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    paddingHorizontal: 0,
  },
  sendButton: {
    backgroundColor: COLORS.accent,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },

  // Action Buttons
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  discardButton: {
    flex: 1,
    backgroundColor: COLORS.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF6B6B',
    gap: 8,
  },
  discardButtonText: {
    color: '#FF6B6B',
    fontSize: 15,
    fontWeight: 'bold',
  },
  applyButton: {
    flex: 2,
    backgroundColor: COLORS.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  applyButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: 'bold',
  },
});