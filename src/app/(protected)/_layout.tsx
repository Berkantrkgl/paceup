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
        <Stack>
            <Stack.Screen name='(tabs)' options={{
                headerShown: false,
            }}/>

            <Stack.Screen name='modal' options={{
                headerShown: false,
                presentation: 'modal',

            }}/>

            <Stack.Screen name='modal-with-stack' options={{
                headerShown: false,
                presentation: 'modal',
            }}/>

        </Stack>
    )
}
