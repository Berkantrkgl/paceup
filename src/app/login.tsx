import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Link, useRouter } from "expo-router";
import React, { useContext, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    ImageBackground,
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

const { width, height } = Dimensions.get("window");

const LoginScreen = () => {
    const { logIn } = useContext(AuthContext);
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async () => {
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

            <ImageBackground
                // Resmi @ alias'ı ile çekiyoruz
                source={require("@/assets/images/home/banner-image.jpeg")}
                style={styles.backgroundImage}
                resizeMode="cover"
            >
                {/* Karartma katmanını biraz daha koyulaştırdım ki yazılar net okunsun */}
                <LinearGradient
                    colors={[
                        "transparent",
                        "rgba(0,0,0,0.8)",
                        COLORS.background,
                    ]}
                    style={styles.gradientOverlay}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 0.85 }}
                >
                    <KeyboardAvoidingView
                        behavior={Platform.OS === "ios" ? "padding" : "height"}
                        style={styles.keyboardView}
                    >
                        {/* HEADER: LOGO & APP NAME */}
                        <View style={styles.headerContainer}>
                            <View style={styles.logoCircle}>
                                <Ionicons
                                    name="flame"
                                    size={42}
                                    color={COLORS.accent}
                                />
                            </View>

                            {/* APP NAME */}
                            <Text style={styles.appName}>PaceUp</Text>

                            <Text style={styles.headerText}>HOŞ GELDİN</Text>
                            <Text style={styles.subHeaderText}>
                                Hedeflerine koşmaya hazır mısın?
                            </Text>
                        </View>

                        {/* FORM ALANI */}
                        <View style={styles.formContainer}>
                            {/* EMAIL INPUT */}
                            <View style={styles.inputContainer}>
                                <Ionicons
                                    name="mail-outline"
                                    size={22}
                                    color="#CCCCCC"
                                    style={styles.inputIcon}
                                />
                                <TextInput
                                    style={styles.input}
                                    placeholder="E-Posta Adresi"
                                    placeholderTextColor="#AAAAAA" // Daha açık gri
                                    value={email}
                                    onChangeText={setEmail}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                    cursorColor={COLORS.accent}
                                />
                            </View>

                            {/* PASSWORD INPUT */}
                            <View style={styles.inputContainer}>
                                <Ionicons
                                    name="lock-closed-outline"
                                    size={22}
                                    color="#CCCCCC"
                                    style={styles.inputIcon}
                                />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Şifre"
                                    placeholderTextColor="#AAAAAA" // Daha açık gri
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry={!showPassword}
                                    cursorColor={COLORS.accent}
                                />
                                <Pressable
                                    onPress={() =>
                                        setShowPassword(!showPassword)
                                    }
                                    style={styles.eyeIcon}
                                >
                                    <Ionicons
                                        name={
                                            showPassword
                                                ? "eye-off-outline"
                                                : "eye-outline"
                                        }
                                        size={22}
                                        color="#CCCCCC"
                                    />
                                </Pressable>
                            </View>

                            {/* LOGIN BUTTON */}
                            <Pressable
                                onPress={handleLogin}
                                disabled={isLoading}
                                style={styles.buttonWrapper}
                            >
                                <LinearGradient
                                    colors={[COLORS.accent, COLORS.secondary]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.gradientButton}
                                >
                                    {isLoading ? (
                                        <ActivityIndicator
                                            color={COLORS.text}
                                        />
                                    ) : (
                                        <Text style={styles.buttonText}>
                                            Giriş Yap
                                        </Text>
                                    )}
                                    {!isLoading && (
                                        <Ionicons
                                            name="arrow-forward"
                                            size={20}
                                            color={COLORS.text}
                                            style={{ marginLeft: 8 }}
                                        />
                                    )}
                                </LinearGradient>
                            </Pressable>

                            {/* FOOTER */}
                            <View style={styles.footerContainer}>
                                <Text style={styles.footerText}>
                                    Henüz bir hesabın yok mu?{" "}
                                </Text>
                                <Link href="/register" asChild>
                                    <Pressable>
                                        <Text style={styles.linkText}>
                                            Kayıt Ol
                                        </Text>
                                    </Pressable>
                                </Link>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </LinearGradient>
            </ImageBackground>
        </View>
    );
};

export default LoginScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    backgroundImage: {
        flex: 1,
        width: width,
        height: height,
    },
    gradientOverlay: {
        flex: 1,
        justifyContent: "flex-end",
        paddingBottom: 40,
    },
    keyboardView: {
        flex: 1,
        justifyContent: "flex-end",
        paddingHorizontal: 24,
        paddingBottom: 40, // Klavye açılınca mesafe
    },

    // Header
    headerContainer: {
        alignItems: "center",
        marginBottom: 35,
    },
    logoCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: "rgba(47, 38, 29, 0.9)", // COLORS.card ama opaklığı yüksek
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 15,
        borderWidth: 1,
        borderColor: COLORS.accent, // Alevi vurgulamak için turuncu çerçeve
        shadowColor: COLORS.accent,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 15,
        elevation: 10,
    },
    appName: {
        fontSize: 42,
        fontWeight: "900",
        color: COLORS.text,
        letterSpacing: 2,
        marginBottom: 5,
        textShadowColor: "rgba(0, 0, 0, 0.7)",
        textShadowOffset: { width: 0, height: 3 },
        textShadowRadius: 6,
        fontStyle: "italic", // Hafif eğik, spor havası katar
    },
    headerText: {
        fontSize: 18,
        fontWeight: "700",
        color: COLORS.textDim || "#E0E0E0",
        letterSpacing: 4, // Harf aralığını açtık
        marginTop: 5,
    },
    subHeaderText: {
        fontSize: 14,
        color: "#BBBBBB",
        marginTop: 8,
        fontWeight: "500",
    },

    // Form
    formContainer: {
        width: "100%",
        gap: 16,
    },
    inputContainer: {
        flexDirection: "row",
        alignItems: "center",
        // Arkaplanı biraz daha opak yaptık
        backgroundColor: "rgba(47, 38, 29, 0.85)",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.15)", // Hafif beyaz çerçeve
        height: 60,
        paddingHorizontal: 15,
    },
    inputIcon: {
        marginRight: 12,
        opacity: 0.8,
    },
    input: {
        flex: 1,
        color: COLORS.white, // Yazılan yazı kesinlikle beyaz
        fontSize: 16,
        height: "100%",
        fontWeight: "500",
    },
    eyeIcon: {
        padding: 8,
    },

    // Button
    buttonWrapper: {
        marginTop: 15,
        shadowColor: COLORS.accent,
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 8,
    },
    gradientButton: {
        width: "100%",
        height: 60,
        borderRadius: 16,
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
    },
    buttonText: {
        color: COLORS.white,
        fontWeight: "bold",
        fontSize: 18,
        letterSpacing: 1,
    },

    // Footer
    footerContainer: {
        flexDirection: "row",
        justifyContent: "center",
        marginTop: 25,
        alignItems: "center",
        paddingBottom: 10,
    },
    footerText: {
        color: "#CCCCCC",
        fontSize: 14,
    },
    linkText: {
        color: COLORS.accent,
        fontWeight: "bold",
        fontSize: 14,
        textDecorationLine: "underline",
    },
});
