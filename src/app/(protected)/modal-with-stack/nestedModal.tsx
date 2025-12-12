import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

const nestedModal = () => {
  return (
    <View style={styles.container}>
        <Text style={styles.text}>CALENDAR</Text>  
    </View>
  )
}

export default nestedModal

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