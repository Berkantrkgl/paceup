import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useContext, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
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

const RegisterScreen = () => {
    const router = useRouter();
    const { register, googleSignIn } = useContext(AuthContext);

    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const lastNameRef = useRef<TextInput>(null);
    const emailRef = useRef<TextInput>(null);
    const passwordRef = useRef<TextInput>(null);

    const handleRegister = async () => {
        Keyboard.dismiss();
        if (!firstName || !lastName || !email || !password) {
            Alert.alert("Eksik Bilgi", "Lütfen tüm alanları doldurun.");
            return;
        }

        setIsLoading(true);
        try {
            await register(firstName, lastName, email, password);
        } catch (error) {
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

            <LinearGradient
                colors={["#1A0A00", "#0D0D0D", "#0D0D0D"]}
                style={styles.backgroundGradient}
                start={{ x: 0.8, y: 0 }}
                end={{ x: 0.2, y: 1 }}
            >
                {/* Accent glow */}
                <View style={styles.glowAccent} />

                <KeyboardAwareScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    enableOnAndroid
                    extraScrollHeight={Platform.OS === "ios" ? 30 : 0}
                    bounces={false}
                >
                    {/* HEADER */}
                    <View style={styles.headerContainer}>
                        <View style={styles.logoCircle}>
                            <Ionicons
                                name="flame"
                                size={32}
                                color={COLORS.accent}
                            />
                        </View>
                        <Text style={styles.appName}>PaceUp</Text>
                    </View>

                    {/* GLASS CARD */}
                    <View style={styles.glassCard}>
                        <Text style={styles.cardTitle}>Kayıt Ol</Text>
                        <Text style={styles.cardSubtitle}>
                            Sınırlarını zorlamaya başla
                        </Text>

                        {/* AD & SOYAD */}
                        <View style={styles.row}>
                            <View
                                style={[
                                    styles.inputContainer,
                                    styles.halfInput,
                                ]}
                            >
                                <Ionicons
                                    name="person-outline"
                                    size={20}
                                    color={COLORS.textDim}
                                    style={styles.inputIcon}
                                />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Ad"
                                    placeholderTextColor={COLORS.inactive}
                                    value={firstName}
                                    onChangeText={setFirstName}
                                    textContentType="givenName"
                                    autoComplete="given-name"
                                    returnKeyType="next"
                                    onSubmitEditing={() =>
                                        lastNameRef.current?.focus()
                                    }
                                    cursorColor={COLORS.accent}
                                />
                            </View>
                            <View
                                style={[
                                    styles.inputContainer,
                                    styles.halfInput,
                                ]}
                            >
                                <Ionicons
                                    name="person-outline"
                                    size={20}
                                    color={COLORS.textDim}
                                    style={styles.inputIcon}
                                />
                                <TextInput
                                    ref={lastNameRef}
                                    style={styles.input}
                                    placeholder="Soyad"
                                    placeholderTextColor={COLORS.inactive}
                                    value={lastName}
                                    onChangeText={setLastName}
                                    textContentType="familyName"
                                    autoComplete="family-name"
                                    returnKeyType="next"
                                    onSubmitEditing={() =>
                                        emailRef.current?.focus()
                                    }
                                    cursorColor={COLORS.accent}
                                />
                            </View>
                        </View>

                        {/* EMAIL */}
                        <View style={styles.inputContainer}>
                            <Ionicons
                                name="mail-outline"
                                size={20}
                                color={COLORS.textDim}
                                style={styles.inputIcon}
                            />
                            <TextInput
                                ref={emailRef}
                                style={styles.input}
                                placeholder="E-Posta Adresi"
                                placeholderTextColor={COLORS.inactive}
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                textContentType="emailAddress"
                                autoComplete="email"
                                returnKeyType="next"
                                onSubmitEditing={() =>
                                    passwordRef.current?.focus()
                                }
                                cursorColor={COLORS.accent}
                            />
                        </View>

                        {/* PASSWORD */}
                        <View style={styles.inputContainer}>
                            <Ionicons
                                name="lock-closed-outline"
                                size={20}
                                color={COLORS.textDim}
                                style={styles.inputIcon}
                            />
                            <TextInput
                                ref={passwordRef}
                                style={styles.input}
                                placeholder="Şifre"
                                placeholderTextColor={COLORS.inactive}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                                textContentType="newPassword"
                                autoComplete="new-password"
                                returnKeyType="done"
                                onSubmitEditing={handleRegister}
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
                                    size={20}
                                    color={COLORS.textDim}
                                />
                            </Pressable>
                        </View>

                        {/* REGISTER BUTTON */}
                        <Pressable
                            onPress={handleRegister}
                            disabled={isLoading}
                            style={({ pressed }) => [
                                styles.buttonWrapper,
                                pressed && { opacity: 0.85 },
                            ]}
                        >
                            <LinearGradient
                                colors={[COLORS.accent, COLORS.secondary]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.gradientButton}
                            >
                                {isLoading ? (
                                    <ActivityIndicator
                                        color={COLORS.white}
                                    />
                                ) : (
                                    <>
                                        <Text style={styles.buttonText}>
                                            Hesap Oluştur
                                        </Text>
                                        <Ionicons
                                            name="arrow-forward"
                                            size={18}
                                            color={COLORS.white}
                                            style={{ marginLeft: 8 }}
                                        />
                                    </>
                                )}
                            </LinearGradient>
                        </Pressable>

                        {/* DIVIDER */}
                        <View style={styles.dividerRow}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>veya</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        {/* OAUTH BUTTONS */}
                        <View style={styles.oauthRow}>
                            <Pressable
                                style={({ pressed }) => [
                                    styles.oauthButton,
                                    pressed && { opacity: 0.75 },
                                ]}
                                onPress={googleSignIn}
                            >
                                <Ionicons
                                    name="logo-google"
                                    size={22}
                                    color={COLORS.text}
                                />
                            </Pressable>

                            <Pressable
                                style={({ pressed }) => [
                                    styles.oauthButton,
                                    pressed && { opacity: 0.75 },
                                ]}
                                onPress={() => {
                                    // TODO: Apple Sign In
                                }}
                            >
                                <Ionicons
                                    name="logo-apple"
                                    size={24}
                                    color={COLORS.text}
                                />
                            </Pressable>
                        </View>
                    </View>

                    {/* FOOTER */}
                    <View style={styles.footerContainer}>
                        <Text style={styles.footerText}>
                            Zaten hesabın var mı?{" "}
                        </Text>
                        <Pressable
                            onPress={() => router.back()}
                            hitSlop={8}
                        >
                            <Text style={styles.linkText}>Giriş Yap</Text>
                        </Pressable>
                    </View>
                </KeyboardAwareScrollView>
            </LinearGradient>
        </View>
    );
};

export default RegisterScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    backgroundGradient: {
        flex: 1,
    },
    glowAccent: {
        position: "absolute",
        top: -80,
        right: -80,
        width: 250,
        height: 250,
        borderRadius: 125,
        backgroundColor: COLORS.accent,
        opacity: 0.06,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: "center",
        paddingHorizontal: 24,
        paddingVertical: 60,
    },

    // Header
    headerContainer: {
        alignItems: "center",
        marginBottom: 32,
    },
    logoCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: "rgba(255, 69, 1, 0.1)",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "rgba(255, 69, 1, 0.2)",
    },
    appName: {
        fontSize: 32,
        fontWeight: "800",
        color: COLORS.text,
        letterSpacing: 1,
        fontStyle: "italic",
    },

    // Glass Card
    glassCard: {
        backgroundColor: "rgba(26, 26, 26, 0.7)",
        borderRadius: 24,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.08)",
        padding: 28,
        gap: 16,
    },
    cardTitle: {
        fontSize: 22,
        fontWeight: "700",
        color: COLORS.text,
        textAlign: "center",
    },
    cardSubtitle: {
        fontSize: 14,
        color: COLORS.textDim,
        textAlign: "center",
        marginBottom: 4,
    },

    // Inputs
    row: {
        flexDirection: "row",
        gap: 12,
    },
    inputContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(13, 13, 13, 0.6)",
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.06)",
        height: 56,
        paddingHorizontal: 16,
    },
    halfInput: {
        flex: 1,
    },
    inputIcon: {
        marginRight: 12,
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

    // Button
    buttonWrapper: {
        marginTop: 4,
        shadowColor: COLORS.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    gradientButton: {
        width: "100%",
        height: 56,
        borderRadius: 14,
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
    },
    buttonText: {
        color: COLORS.white,
        fontWeight: "700",
        fontSize: 16,
        letterSpacing: 0.5,
    },

    // Divider
    dividerRow: {
        flexDirection: "row",
        alignItems: "center",
        marginVertical: 4,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: "rgba(255, 255, 255, 0.08)",
    },
    dividerText: {
        color: COLORS.textDim,
        fontSize: 13,
        marginHorizontal: 16,
    },

    // OAuth
    oauthRow: {
        flexDirection: "row",
        justifyContent: "center",
        gap: 16,
    },
    oauthButton: {
        width: 56,
        height: 56,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.1)",
        backgroundColor: "rgba(255, 255, 255, 0.04)",
        alignItems: "center",
        justifyContent: "center",
    },

    // Footer
    footerContainer: {
        flexDirection: "row",
        justifyContent: "center",
        marginTop: 28,
        alignItems: "center",
    },
    footerText: {
        color: COLORS.textDim,
        fontSize: 14,
    },
    linkText: {
        color: COLORS.accent,
        fontWeight: "600",
        fontSize: 14,
    },
});
