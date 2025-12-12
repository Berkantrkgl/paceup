import { Link } from 'expo-router'
import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

const index = () => {

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Modal With Stack Index</Text>
      
      <View style={styles.buttons}>
        <Link href={'/modal-with-stack/nestedModal'} asChild push>
          <Pressable style={styles.button}>
            <Text style={styles.buttonText}>Go to Nested Modal</Text>
          </Pressable>
        </Link>

      </View>

    </View>
  )
}

export default index

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
    buttons: {
      position: 'absolute',
      bottom: 30,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 10
    },
    button: {
      padding: 10,
      backgroundColor: '#ca8b8bff',
      textAlign: 'center',
      borderRadius: 5,
      width: 150,
      height: 50,
      justifyContent: 'center',
    },
    buttonText: {
      color: 'white',
      fontWeight: 'bold',
      textAlign: 'center'
    }
})