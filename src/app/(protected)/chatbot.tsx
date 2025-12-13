import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
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

const chatbot = () => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'bot',
      text: 'Merhaba! Ben senin kişisel koşu koçunum 🏃‍♂️\n\nSana özel bir antrenman planı oluşturmak için buradayım. Hedeflerini ve isteklerini benimle paylaşabilirsin.',
      timestamp: new Date(),
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPlanGenerated, setIsPlanGenerated] = useState(false);
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
        text: 'Harika bir hedef! 4 ay sonra maraton için seni hazırlayacağım. Şu anda haftada kaç gün koşu yapabilirsin?',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, botMessage]);
      setIsLoading(false);
    }, 1500);
  };

  const handleGeneratePlan = () => {
    setIsLoading(true);
    
    // Simulate plan generation
    setTimeout(() => {
      const botMessage = {
        id: messages.length + 1,
        type: 'bot',
        text: '✅ Harika! Senin için 16 haftalık maraton hazırlık programını oluşturdum.\n\n📊 Program Özeti:\n• 16 hafta süre\n• Haftada 4-5 antrenman\n• Kademeli mesafe artışı\n• Tempo ve interval çalışmaları\n• Dinlenme günleri\n\nPlanını takvime aktarmak için aşağıdaki butona tıkla!',
        timestamp: new Date(),
        isPlanReady: true,
      };
      setMessages(prev => [...prev, botMessage]);
      setIsLoading(false);
      setIsPlanGenerated(true);
    }, 3000);
  };

  const handleExportToCalendar = () => {
    // Takvime aktar ve ana sayfaya dön
    router.back();
    // Burada takvime veri gönderme işlemi yapılacak
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
            <Ionicons name="flash" size={24} color="white" />
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>AI Koşu Koçu</Text>
            <View style={styles.statusContainer}>
              <View style={styles.onlineIndicator} />
              <Text style={styles.headerSubtitle}>Çevrimiçi</Text>
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
                  
                  {message.isPlanReady && (
                    <Pressable 
                      style={styles.exportButton}
                      onPress={handleExportToCalendar}
                    >
                      <Ionicons name="calendar" size={20} color="white" />
                      <Text style={styles.exportButtonText}>Takvime Aktar</Text>
                      <Ionicons name="arrow-forward" size={18} color="white" />
                    </Pressable>
                  )}
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
                <Text style={styles.loadingText}>Yazıyor...</Text>
              </View>
            </View>
          )}

          <View style={{ height: 20 }} />
        </ScrollView>

        {/* Quick Actions */}
        {!isPlanGenerated && (
          <View style={styles.quickActionsContainer}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickActionsContent}
              keyboardShouldPersistTaps="handled"
            >
              <Pressable 
                style={styles.quickActionChip}
                onPress={() => setInputText('4 ay sonra maraton koşmak istiyorum')}
              >
                <Ionicons name="trophy-outline" size={16} color={COLORS.accent} />
                <Text style={styles.quickActionText}>Maraton Hazırlığı</Text>
              </Pressable>

              <Pressable 
                style={styles.quickActionChip}
                onPress={() => setInputText('10K koşusuna hazırlanmak istiyorum')}
              >
                <Ionicons name="fitness-outline" size={16} color={COLORS.accent} />
                <Text style={styles.quickActionText}>10K Antrenmanı</Text>
              </Pressable>

              <Pressable 
                style={styles.quickActionChip}
                onPress={() => setInputText('Koşu hızımı artırmak istiyorum')}
              >
                <Ionicons name="speedometer-outline" size={16} color={COLORS.accent} />
                <Text style={styles.quickActionText}>Hız Geliştirme</Text>
              </Pressable>

              <Pressable 
                style={styles.quickActionChip}
                onPress={handleGeneratePlan}
              >
                <Ionicons name="create-outline" size={16} color={COLORS.accent} />
                <Text style={styles.quickActionText}>Plan Oluştur</Text>
              </Pressable>
            </ScrollView>
          </View>
        )}

        {/* Input Area */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Mesajını yaz..."
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
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

export default chatbot;

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

  // Export Button
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 12,
    gap: 8,
  },
  exportButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: 'bold',
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
});