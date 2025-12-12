import { Stack } from 'expo-router'
import React from 'react'

const _layout = () => {
  return (
    <Stack 
        screenOptions={{
            
        }}
    >
      <Stack.Screen name='index' options={{
        title: 'Modal With Stack'
      }}/>
      <Stack.Screen name='nestedModal' options={{
        title: 'Nested Modal'
      }}/>
    </Stack>
  )
}

export default _layout

