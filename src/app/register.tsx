import { COLORS } from "@/constants/Colors";
import { AuthContext } from "@/utils/authContext";
import { useRouter } from "expo-router";
import React, { useContext, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

const RegisterScreen = () => {
    const router = useRouter();
    const { register } = useContext(AuthContext); // Context'teki register fonksiyonu

    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleRegister = async () => {
        if (!firstName || !lastName || !email || !password) {
            Alert.alert("Eksik Bilgi", "Lütfen tüm alanları doldurun.");
            return;
        }

        setIsLoading(true);
        // Bu işlem başarılı olursa Context otomatik olarak token'ı kaydedip Home'a atacak
        await register(firstName, lastName, email, password);
        setIsLoading(false);
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.container}
        >
            <StatusBar
                barStyle="light-content"
                backgroundColor={COLORS.background}
            />

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.formContainer}>
                    <Text style={styles.headerText}>KAYIT OL</Text>
                    <Text style={styles.subHeaderText}>
                        Antrenmanlarına başlamak için katıl
                    </Text>

                    <View style={styles.row}>
                        <TextInput
                            style={[styles.input, styles.halfInput]}
                            placeholder="Ad"
                            placeholderTextColor={COLORS.subText}
                            value={firstName}
                            onChangeText={setFirstName}
                            cursorColor={COLORS.accent}
                        />
                        <TextInput
                            style={[styles.input, styles.halfInput]}
                            placeholder="Soyad"
                            placeholderTextColor={COLORS.subText}
                            value={lastName}
                            onChangeText={setLastName}
                            cursorColor={COLORS.accent}
                        />
                    </View>

                    <TextInput
                        style={styles.input}
                        placeholder="E-Posta Adresi"
                        placeholderTextColor={COLORS.subText}
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        cursorColor={COLORS.accent}
                    />

                    <TextInput
                        style={styles.input}
                        placeholder="Şifre"
                        placeholderTextColor={COLORS.subText}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        cursorColor={COLORS.accent}
                    />

                    <Pressable
                        style={({ pressed }) => [
                            styles.button,
                            pressed && { backgroundColor: COLORS.secondary },
                        ]}
                        onPress={handleRegister}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator color={COLORS.text} />
                        ) : (
                            <Text style={styles.buttonText}>Hesap Oluştur</Text>
                        )}
                    </Pressable>

                    <View style={styles.footerContainer}>
                        <Text style={styles.footerText}>
                            Zaten hesabın var mı?{" "}
                        </Text>
                        <Pressable onPress={() => router.back()}>
                            <Text style={styles.linkText}>Giriş Yap</Text>
                        </Pressable>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

export default RegisterScreen;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    scrollContent: { flexGrow: 1, justifyContent: "center", padding: 20 },
    formContainer: { alignItems: "center", width: "100%" },
    headerText: {
        fontSize: 32,
        fontWeight: "bold",
        marginBottom: 5,
        color: COLORS.text,
        letterSpacing: 1,
    },
    subHeaderText: { fontSize: 14, color: COLORS.subText, marginBottom: 40 },
    row: {
        flexDirection: "row",
        justifyContent: "space-between",
        width: "100%",
        gap: 10,
    },
    input: {
        width: "100%",
        height: 55,
        backgroundColor: COLORS.card,
        borderRadius: 12,
        paddingHorizontal: 15,
        marginBottom: 20,
        color: COLORS.text,
        fontSize: 16,
        borderWidth: 1,
        borderColor: COLORS.card,
    },
    halfInput: { flex: 1 },
    button: {
        backgroundColor: COLORS.accent,
        borderRadius: 12,
        marginTop: 10,
        width: "100%",
        height: 55,
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        elevation: 8,
    },
    buttonText: { color: COLORS.text, fontWeight: "bold", fontSize: 18 },
    footerContainer: {
        flexDirection: "row",
        marginTop: 20,
        alignItems: "center",
    },
    footerText: { color: COLORS.subText, fontSize: 14 },
    linkText: { color: COLORS.accent, fontWeight: "bold", fontSize: 14 },
});
