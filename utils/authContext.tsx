import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from "expo-router";
import { createContext, PropsWithChildren, useEffect, useState } from "react";

type AuthState = {
    isLoggedIn: boolean,
    isReady: boolean,
    logIn: () => void,
    logOut: () => void
};

const authStorageKey = 'auth-key'

export const AuthContext = createContext<AuthState>({
    isLoggedIn: false,
    isReady: false,
    logIn: () => {},
    logOut: () => {},
})


export function AuthProvider({children}: PropsWithChildren) {
    const [isReady, setIsReady] = useState(false)
    const [isLoggedIn, setIsLoggedIn] = useState(false)
    const router = useRouter()


    const storeAuthState = async (newState: { isLoggedIn: boolean }) => {
        try {
            const jsonValue = JSON.stringify(newState)
            await AsyncStorage.setItem(authStorageKey, jsonValue)
        } catch (error) {
            console.log("Error saving auth state: ", error)
        }
    }
    const getAuthFromStorage = async () => {
        try {
            const value  = await AsyncStorage.getItem(authStorageKey)
            if (value !== null) {
                const auth = JSON.parse(value)
                setIsLoggedIn(auth.isLoggedIn)
            }
        } catch (error) {
            console.log("Error fetchin from storage", error)
        }
        setIsReady(true)
    }


    const logIn = () => {
        setIsLoggedIn(true)
        storeAuthState({isLoggedIn: true})
        router.replace('/')
    }

    const logOut = () => {
        setIsLoggedIn(false)
        storeAuthState({isLoggedIn: false})
        router.replace('/login')
    }

    useEffect(() => {
        getAuthFromStorage()
    }, [])

    return (
        <AuthContext.Provider value={{isReady, isLoggedIn, logIn, logOut}}>
            {children}
        </AuthContext.Provider>
    )
}