import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Link } from "expo-router";
import React, { useContext, useRef, useState } from "react";
import {
    ActivityIndicator,
    Image,
    Keyboard,
    Platform,
    Pressable,
    StatusBar,
    Text,
    TextInput,
    View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import { useTheme } from "@/theme/ThemeContext";
import { useThemedStyles } from "@/theme/useThemedStyles";
import type { Theme } from "@/theme/tokens";
import { AuthContext } from "@/utils/authContext";

const LoginScreen = () => {
    const { logIn, googleSignIn } = useContext(AuthContext);
    const { colors, isDark } = useTheme();
    const styles = useThemedStyles(makeStyles);

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
                barStyle={isDark ? "light-content" : "dark-content"}
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
                        <Image
                            source={
                                isDark
                                    ? require("@/assets/images/login-icon-white.png")
                                    : require("@/assets/images/login-icon-dark.png")
                            }
                            style={styles.logoImage}
                            resizeMode="contain"
                        />
                        <Text style={styles.logoText}>
                            Pace<Text style={styles.logoTextAccent}>Up</Text>
                        </Text>
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
                                color={colors.inactive}
                                style={styles.inputIcon}
                            />
                            <TextInput
                                style={styles.input}
                                placeholder="ornek@email.com"
                                placeholderTextColor={colors.inactive}
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
                                cursorColor={colors.accent}
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
                                color={colors.inactive}
                                style={styles.inputIcon}
                            />
                            <TextInput
                                ref={passwordRef}
                                style={styles.input}
                                placeholder="Şifreni gir"
                                placeholderTextColor={colors.inactive}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                                textContentType="password"
                                autoComplete="password"
                                returnKeyType="done"
                                onSubmitEditing={handleLogin}
                                cursorColor={colors.accent}
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
                                    color={colors.inactive}
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
                            colors={[colors.accent, colors.secondary]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.loginBtnGradient}
                        >
                            {isLoading ? (
                                <ActivityIndicator color={colors.text.inverse} />
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
                            color={colors.text.primary}
                        />
                        <Text style={styles.oauthBtnText}>
                            Google ile devam et
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

const makeStyles = (t: Theme) =>
    ({
        container: {
            flex: 1,
            backgroundColor: t.colors.background,
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
            gap: 6,
            marginBottom: 28,
        },
        logoImage: {
            width: 64,
            height: 64,
            marginLeft: -8,
        },
        logoText: {
            fontSize: 30,
            fontWeight: "800",
            color: t.colors.text.primary,
            letterSpacing: 0.3,
            fontStyle: "italic",
        },
        logoTextAccent: {
            color: t.colors.accent,
        },
        title: {
            fontSize: 30,
            fontWeight: "800",
            color: t.colors.text.primary,
            marginBottom: 8,
        },
        subtitle: {
            fontSize: 15,
            color: t.colors.text.secondary,
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
            color: t.colors.text.secondary,
            textTransform: "uppercase",
            letterSpacing: 0.5,
        },
        inputContainer: {
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: t.colors.surface,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: t.colors.border,
            height: 52,
            paddingHorizontal: 14,
        },
        inputIcon: {
            marginRight: 10,
        },
        input: {
            flex: 1,
            color: t.colors.text.primary,
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
            shadowColor: t.colors.shadow,
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
            color: t.colors.text.inverse,
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
            backgroundColor: t.colors.border,
        },
        dividerText: {
            color: t.colors.inactive,
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
            borderColor: t.colors.border,
            backgroundColor: t.colors.surface,
            gap: 10,
        },
        oauthBtnText: {
            color: t.colors.text.primary,
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
            color: t.colors.text.secondary,
            fontSize: 14,
        },
        linkText: {
            color: t.colors.accent,
            fontWeight: "700",
            fontSize: 14,
        },
    }) as const;
