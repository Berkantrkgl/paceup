import { COLORS } from '@/constants/Colors'
import { Stack } from 'expo-router'
import React from 'react'



const _layout = () => {
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

      <Stack.Screen name='index' options={{
        title: 'Planlarım'
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

export default _layout

