import { AuthContext } from '@/utils/authContext'
import React, { useContext } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

const login = () => {

    const authState = useContext(AuthContext)

  return (
    <View style={styles.container}>
        <Text style={styles.text}>LOGIN</Text>
        <Pressable style={styles.button} onPress={authState.logIn}>
            <Text style={styles.buttonText}>Log in!</Text>
        </Pressable>          
    </View>
  )
}

export default login

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
    button: {
      padding: 10,
      backgroundColor: '#ca8b8bff',
      textAlign: 'center',
      borderRadius: 5,
      marginTop: 20,
      width: 150,
      height: 50,
      justifyContent: 'center',

    },
    buttons: {
      position: 'absolute',
      bottom: 30,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 10
    },
    buttonText: {
      color: 'white',
      fontWeight: 'bold',
      textAlign: 'center'
    }
})