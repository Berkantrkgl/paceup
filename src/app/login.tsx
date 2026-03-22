import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Link } from "expo-router";
import React, { useContext, useRef, useState } from "react";
import {
    ActivityIndicator,
    Keyboard,
    Platform,
    Pressable,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import { COLORS } from "@/constants/Colors";
import { AuthContext } from "@/utils/authContext";

const LoginScreen = () => {
    const { logIn, googleSignIn } = useContext(AuthContext);

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const passwordRef = useRef<TextInput>(null);

    const handleLogin = async () => {
        Keyboard.dismiss();
        if (!email || !password) {
            alert("Lütfen tüm alanları doldurun.");
            return;
        }
        setIsLoading(true);
        try {
            await logIn(email, password);
        } catch (e) {
            alert("Giriş başarısız. Bilgilerini kontrol et.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar
                barStyle="light-content"
                translucent
                backgroundColor="transparent"
            />

            <KeyboardAwareScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                enableOnAndroid
                extraScrollHeight={Platform.OS === "ios" ? 30 : 0}
                bounces={false}
            >
                {/* HEADER */}
                <View style={styles.header}>
                    <View style={styles.logoRow}>
                        <Ionicons name="flame" size={28} color={COLORS.accent} />
                        <Text style={styles.logoText}>PaceUp</Text>
                    </View>
                    <Text style={styles.title}>Hoş Geldin</Text>
                    <Text style={styles.subtitle}>
                        Hedeflerine koşmaya hazır mısın?
                    </Text>
                </View>

                {/* FORM */}
                <View style={styles.form}>
                    {/* EMAIL */}
                    <View style={styles.inputWrapper}>
                        <Text style={styles.inputLabel}>E-Posta</Text>
                        <View style={styles.inputContainer}>
                            <Ionicons
                                name="mail-outline"
                                size={18}
                                color={COLORS.inactive}
                                style={styles.inputIcon}
                            />
                            <TextInput
                                style={styles.input}
                                placeholder="ornek@email.com"
                                placeholderTextColor={COLORS.inactive}
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                textContentType="emailAddress"
                                autoComplete="email"
                                returnKeyType="next"
                                onSubmitEditing={() =>
                                    passwordRef.current?.focus()
                                }
                                cursorColor={COLORS.accent}
                            />
                        </View>
                    </View>

                    {/* PASSWORD */}
                    <View style={styles.inputWrapper}>
                        <Text style={styles.inputLabel}>Şifre</Text>
                        <View style={styles.inputContainer}>
                            <Ionicons
                                name="lock-closed-outline"
                                size={18}
                                color={COLORS.inactive}
                                style={styles.inputIcon}
                            />
                            <TextInput
                                ref={passwordRef}
                                style={styles.input}
                                placeholder="Şifreni gir"
                                placeholderTextColor={COLORS.inactive}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                                textContentType="password"
                                autoComplete="password"
                                returnKeyType="done"
                                onSubmitEditing={handleLogin}
                                cursorColor={COLORS.accent}
                            />
                            <Pressable
                                onPress={() =>
                                    setShowPassword(!showPassword)
                                }
                                hitSlop={8}
                                style={styles.eyeIcon}
                            >
                                <Ionicons
                                    name={
                                        showPassword
                                            ? "eye-off-outline"
                                            : "eye-outline"
                                    }
                                    size={18}
                                    color={COLORS.inactive}
                                />
                            </Pressable>
                        </View>
                    </View>

                    {/* LOGIN BUTTON */}
                    <Pressable
                        onPress={handleLogin}
                        disabled={isLoading}
                        style={({ pressed }) => [
                            styles.loginBtn,
                            pressed && { opacity: 0.85 },
                        ]}
                    >
                        <LinearGradient
                            colors={[COLORS.accent, COLORS.secondary]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.loginBtnGradient}
                        >
                            {isLoading ? (
                                <ActivityIndicator color={COLORS.white} />
                            ) : (
                                <Text style={styles.loginBtnText}>
                                    Giriş Yap
                                </Text>
                            )}
                        </LinearGradient>
                    </Pressable>
                </View>

                {/* DIVIDER */}
                <View style={styles.dividerRow}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>veya</Text>
                    <View style={styles.dividerLine} />
                </View>

                {/* OAUTH */}
                <View style={styles.oauthSection}>
                    <Pressable
                        style={({ pressed }) => [
                            styles.oauthBtn,
                            pressed && { opacity: 0.75 },
                        ]}
                        onPress={googleSignIn}
                    >
                        <Ionicons
                            name="logo-google"
                            size={20}
                            color={COLORS.text}
                        />
                        <Text style={styles.oauthBtnText}>
                            Google ile devam et
                        </Text>
                    </Pressable>

                    <Pressable
                        style={({ pressed }) => [
                            styles.oauthBtn,
                            pressed && { opacity: 0.75 },
                        ]}
                        onPress={() => {
                            // TODO: Apple Sign In
                        }}
                    >
                        <Ionicons
                            name="logo-apple"
                            size={22}
                            color={COLORS.text}
                        />
                        <Text style={styles.oauthBtnText}>
                            Apple ile devam et
                        </Text>
                    </Pressable>
                </View>

                {/* FOOTER */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>
                        Henüz bir hesabın yok mu?{" "}
                    </Text>
                    <Link href="/register" asChild>
                        <Pressable hitSlop={8}>
                            <Text style={styles.linkText}>Kayıt Ol</Text>
                        </Pressable>
                    </Link>
                </View>
            </KeyboardAwareScrollView>
        </View>
    );
};

export default LoginScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: "center",
        paddingHorizontal: 28,
        paddingVertical: 60,
    },

    // Header
    header: {
        marginBottom: 36,
    },
    logoRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginBottom: 28,
    },
    logoText: {
        fontSize: 24,
        fontWeight: "800",
        color: COLORS.text,
        letterSpacing: 0.5,
        fontStyle: "italic",
    },
    title: {
        fontSize: 30,
        fontWeight: "800",
        color: COLORS.text,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 15,
        color: COLORS.textDim,
        lineHeight: 22,
    },

    // Form
    form: {
        gap: 20,
        marginBottom: 28,
    },
    inputWrapper: {
        gap: 8,
    },
    inputLabel: {
        fontSize: 13,
        fontWeight: "600",
        color: COLORS.textDim,
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    inputContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: COLORS.card,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        height: 52,
        paddingHorizontal: 14,
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        color: COLORS.text,
        fontSize: 15,
        height: "100%",
        fontWeight: "500",
    },
    eyeIcon: {
        padding: 8,
    },

    // Login Button
    loginBtn: {
        marginTop: 4,
        shadowColor: COLORS.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 8,
    },
    loginBtnGradient: {
        height: 52,
        borderRadius: 14,
        justifyContent: "center",
        alignItems: "center",
    },
    loginBtnText: {
        color: COLORS.white,
        fontWeight: "700",
        fontSize: 16,
        letterSpacing: 0.3,
    },

    // Divider
    dividerRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 28,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: COLORS.cardBorder,
    },
    dividerText: {
        color: COLORS.inactive,
        fontSize: 13,
        fontWeight: "500",
        marginHorizontal: 16,
    },

    // OAuth
    oauthSection: {
        gap: 12,
        marginBottom: 32,
    },
    oauthBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        height: 52,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        backgroundColor: COLORS.card,
        gap: 10,
    },
    oauthBtnText: {
        color: COLORS.text,
        fontSize: 15,
        fontWeight: "600",
    },

    // Footer
    footer: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
    },
    footerText: {
        color: COLORS.textDim,
        fontSize: 14,
    },
    linkText: {
        color: COLORS.accent,
        fontWeight: "700",
        fontSize: 14,
    },
});
