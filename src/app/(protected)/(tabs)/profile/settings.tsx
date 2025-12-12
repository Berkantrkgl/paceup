import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

const settings = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>settings</Text>
    </View>
  )
}

export default settings

const styles = StyleSheet.create({
  container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    text: {
      fontSize: 30,
      fontWeight: 'bold'
    },
})