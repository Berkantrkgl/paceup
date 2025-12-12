import { Stack } from 'expo-router'
import React from 'react'

const _layout = () => {
  return (
    <Stack 
        screenOptions={{
            headerBackButtonDisplayMode: 'minimal',
        }}
    >
      <Stack.Screen name='index' options={{
        title: 'Profile'
      }}/>
      <Stack.Screen name='settings' options={{
        title: 'Settings'
      }}/>
    </Stack>
  )
}

export default _layout

