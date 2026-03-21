import { StatusBar } from 'expo-status-bar'
import { StyleSheet, View } from 'react-native'

import GroupEncryption from './components/GroupEncryption'
import SignVerify from './components/SignVerify'

export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <GroupEncryption />
      <SignVerify />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
})
