import { COLORS } from "@/constants/Colors";
import { AuthContext } from "@/utils/authContext";
import { Link } from "expo-router";
import React, { useContext, useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

const LoginScreen = () => {
    const { logIn } = useContext(AuthContext);

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            alert("Lütfen tüm alanları doldurun.");
            return;
        }
        setIsLoading(true);
        await logIn(email, password);
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

            <View style={styles.formContainer}>
                <Text style={styles.headerText}>GİRİŞ YAP</Text>
                <Text style={styles.subHeaderText}>
                    Antrenmanlarına devam etmek için
                </Text>

                <TextInput
                    style={styles.input}
                    placeholder="E-Posta Adresi"
                    placeholderTextColor={COLORS.subText}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
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
                    onPress={handleLogin}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color={COLORS.text} />
                    ) : (
                        <Text style={styles.buttonText}>Giriş Yap</Text>
                    )}
                </Pressable>

                <View style={styles.footerContainer}>
                    <Text style={styles.footerText}>Hesabın yok mu? </Text>
                    <Link href="/register" asChild>
                        <Pressable>
                            <Text style={styles.linkText}>Kayıt Ol</Text>
                        </Pressable>
                    </Link>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
};
export default LoginScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        backgroundColor: COLORS.background,
        padding: 20,
    },
    formContainer: { alignItems: "center", width: "100%" },
    headerText: {
        fontSize: 32,
        fontWeight: "bold",
        marginBottom: 5,
        color: COLORS.text,
        letterSpacing: 1,
    },
    subHeaderText: { fontSize: 14, color: COLORS.subText, marginBottom: 40 },
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
