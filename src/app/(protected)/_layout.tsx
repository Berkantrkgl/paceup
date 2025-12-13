import { COLORS } from '@/constants/Colors'
import { AuthContext } from '@/utils/authContext'
import { Redirect, Stack } from 'expo-router'
import React, { useContext } from 'react'



export default function ProtectedLayout() {
    const authState = useContext(AuthContext)

    if (!authState.isReady) {
        return null
    }

    if (!authState.isLoggedIn) {
        console.log(authState.isLoggedIn)
        return <Redirect href={'/login'}/>
    }

    return (
        <Stack 
        screenOptions={{
            headerStyle: {
                backgroundColor: COLORS.background,
            },
            headerTintColor: COLORS.text,
            headerTitleStyle: {
                color: COLORS.text,
                fontSize: 20,
                fontWeight: '600'
            },
            headerShadowVisible: false,
            }}
        >
            <Stack.Screen name='(tabs)' options={{
                headerShown: false,
            }}/>

            <Stack.Screen name='calendar_modal' options={{
                title: 'Yaklaşan Etkinlik',
                headerStyle: {
                backgroundColor: COLORS.background,
                },
                headerTintColor: COLORS.text,
                headerTitleStyle: {
                color: COLORS.text,
                fontSize: 20,
                fontWeight: '600'
                },
                presentation: 'modal',
                headerShadowVisible: false,
            }}/>

            <Stack.Screen name='chatbot' options={{
                title: 'AI Koşu Koçu',
                headerBackTitle: 'Geri',
            }}/>

            <Stack.Screen name='chatbot_modal' options={{
                title: 'Plan Düzenle',
                headerStyle: {
                backgroundColor: COLORS.background,
                },
                headerTintColor: COLORS.text,
                headerTitleStyle: {
                color: COLORS.text,
                fontSize: 20,
                fontWeight: '600'
                },
                presentation: 'modal',
                headerShadowVisible: false,
            }}/>

        </Stack>
    )
}
