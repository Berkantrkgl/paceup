import React from 'react'
import { StyleSheet, Text, View } from 'react-native'

const modal = () => {
  return (
    <View style={styles.container}>
        <Text style={styles.text}>SINGLE MODAL</Text>  
    </View>
  )
}

export default modal

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