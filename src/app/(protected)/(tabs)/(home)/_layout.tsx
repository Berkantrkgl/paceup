import { Stack } from 'expo-router'
import React from 'react'


const _layout = () => {
  return (
    <Stack>
        <Stack.Screen name='index' options={{
            title: 'Home'
        }}/>

        <Stack.Screen name='progress' options={{
            title: 'Progress'
        }}/>
    </Stack>
  )
}

export default _layout
