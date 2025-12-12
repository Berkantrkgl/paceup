import { AuthContext } from '@/utils/authContext'
import { Link } from 'expo-router'
import React, { useContext } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'

const index = () => {

  const handleAlert = () => {
    Alert.alert("Uyarı!", "Kullanıcıyı silmek üzeresiniz. Bu işleme devam etmek istiyor musunuz?", 
    [{text: "İptal et", style: 'cancel'}, {text: "Devam et", style: 'destructive'}]
    )
  }

  const authState = useContext(AuthContext)

  return (
    <View style={styles.container}>
      <Text style={styles.text}>PROFILE</Text>
      <Link href={'/profile/settings'} asChild push>
        <Pressable style={styles.button}>
          <Text style={styles.buttonText}>Settings</Text>
        </Pressable>
      </Link>

      
      <View style={styles.buttons}>

        <Pressable style={styles.button} onPress={handleAlert}>
            <Text style={styles.buttonText}>Delete User</Text>
        </Pressable>

        <Pressable style={styles.button} onPress={authState.logOut}>
              <Text style={styles.buttonText}>Log Out</Text>
        </Pressable>

        
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