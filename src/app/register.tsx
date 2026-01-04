import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useContext, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    ImageBackground,
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

import { COLORS } from "@/constants/Colors";
import { AuthContext } from "@/utils/authContext";

const { width, height } = Dimensions.get("window");

const RegisterScreen = () => {
    const router = useRouter();
    const { register } = useContext(AuthContext);

    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleRegister = async () => {
        if (!firstName || !lastName || !email || !password) {
            Alert.alert("Eksik Bilgi", "Lütfen tüm alanları doldurun.");
            return;
        }

        setIsLoading(true);
        try {
            await register(firstName, lastName, email, password);
            // Başarılı olursa context otomatik yönlendirir
        } catch (error) {
            // Hata yönetimi authContext içinde yapılabilir veya burada catch edilebilir
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
                source={require("@/assets/images/home/banner-image.jpeg")}
                style={styles.backgroundImage}
                resizeMode="cover"
            >
                <LinearGradient
                    colors={[
                        "transparent",
                        "rgba(0,0,0,0.85)",
                        COLORS.background,
                    ]}
                    style={styles.gradientOverlay}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 0.9 }}
                >
                    <KeyboardAvoidingView
                        behavior={Platform.OS === "ios" ? "padding" : "height"}
                        style={styles.keyboardView}
                    >
                        <ScrollView
                            contentContainerStyle={styles.scrollContent}
                            showsVerticalScrollIndicator={false}
                        >
                            {/* HEADER */}
                            <View style={styles.headerContainer}>
                                <View style={styles.logoCircle}>
                                    <Ionicons
                                        name="flame"
                                        size={36}
                                        color={COLORS.accent}
                                    />
                                </View>
                                <Text style={styles.appName}>PaceUp</Text>
                                <Text style={styles.headerText}>KAYIT OL</Text>
                                <Text style={styles.subHeaderText}>
                                    Sınırlarını zorlamaya başla
                                </Text>
                            </View>

                            {/* FORM */}
                            <View style={styles.formContainer}>
                                {/* AD & SOYAD ROW */}
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
                                            color="#CCCCCC"
                                            style={styles.inputIcon}
                                        />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Ad"
                                            placeholderTextColor="#AAAAAA"
                                            value={firstName}
                                            onChangeText={setFirstName}
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
                                            color="#CCCCCC"
                                            style={styles.inputIcon}
                                        />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Soyad"
                                            placeholderTextColor="#AAAAAA"
                                            value={lastName}
                                            onChangeText={setLastName}
                                            cursorColor={COLORS.accent}
                                        />
                                    </View>
                                </View>

                                {/* EMAIL */}
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
                                        placeholderTextColor="#AAAAAA"
                                        value={email}
                                        onChangeText={setEmail}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        cursorColor={COLORS.accent}
                                    />
                                </View>

                                {/* PASSWORD */}
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
                                        placeholderTextColor="#AAAAAA"
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

                                {/* REGISTER BUTTON */}
                                <Pressable
                                    onPress={handleRegister}
                                    disabled={isLoading}
                                    style={styles.buttonWrapper}
                                >
                                    <LinearGradient
                                        colors={[
                                            COLORS.accent,
                                            COLORS.secondary,
                                        ]}
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
                                                Hesap Oluştur
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
                                        Zaten hesabın var mı?{" "}
                                    </Text>
                                    <Pressable onPress={() => router.back()}>
                                        <Text style={styles.linkText}>
                                            Giriş Yap
                                        </Text>
                                    </Pressable>
                                </View>
                            </View>
                        </ScrollView>
                    </KeyboardAvoidingView>
                </LinearGradient>
            </ImageBackground>
        </View>
    );
};

export default RegisterScreen;

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
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: "center",
        paddingHorizontal: 24,
        paddingBottom: 40,
        paddingTop: 60, // Header için üstten boşluk
    },

    // Header
    headerContainer: {
        alignItems: "center",
        marginBottom: 30,
    },
    logoCircle: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: "rgba(47, 38, 29, 0.9)",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 10,
        borderWidth: 1,
        borderColor: COLORS.accent,
        shadowColor: COLORS.accent,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 10,
    },
    appName: {
        fontSize: 36,
        fontWeight: "900",
        color: COLORS.text,
        letterSpacing: 2,
        marginBottom: 5,
        textShadowColor: "rgba(0, 0, 0, 0.7)",
        textShadowOffset: { width: 0, height: 3 },
        textShadowRadius: 6,
        fontStyle: "italic",
    },
    headerText: {
        fontSize: 16,
        fontWeight: "700",
        color: COLORS.textDim || "#E0E0E0",
        letterSpacing: 3,
        marginTop: 5,
    },
    subHeaderText: {
        fontSize: 14,
        color: "#BBBBBB",
        marginTop: 5,
        fontWeight: "500",
    },

    // Form
    formContainer: {
        width: "100%",
        gap: 16,
    },
    row: {
        flexDirection: "row",
        justifyContent: "space-between",
        width: "100%",
        gap: 12,
    },
    inputContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(47, 38, 29, 0.85)",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.15)",
        height: 60,
        paddingHorizontal: 15,
    },
    halfInput: {
        flex: 1, // Yan yana eşit paylaşsınlar
    },
    inputIcon: {
        marginRight: 10,
        opacity: 0.8,
    },
    input: {
        flex: 1,
        color: COLORS.white,
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
