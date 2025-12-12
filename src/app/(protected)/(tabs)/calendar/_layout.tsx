import { Stack } from 'expo-router'
import React from 'react'

const _layout = () => {
  return (
    <Stack 
        screenOptions={{
            headerBackButtonDisplayMode: 'minimal',
            title: 'Calendar'
        }}
    >
    </Stack>
  )
}

export default _layout

