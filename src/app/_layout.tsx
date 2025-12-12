import { AuthProvider } from "@/utils/authContext";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar"; // Import kaynağını değiştirdik

export default function RootLayout() {

    return (
        <AuthProvider>
            <StatusBar 
                style="inverted" // 'light', 'dark', 'auto' veya 'inverted'
                translucent={false} // İçeriğin status bar altına girmesini engeller (Android)
            />
            
            <Stack>
                <Stack.Screen name="(protected)" options={{
                    headerShown: false,
                    animation: "none"
                }}/>
                <Stack.Screen name="login" options={{
                    headerShown: false,
                    animation: "none",
                }}/>
            </Stack>
        </AuthProvider>
    );
}