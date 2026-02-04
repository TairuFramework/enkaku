import { provideFullIdentity } from '@enkaku/expo-keystore'
import { type SignedToken, type Token, verifyToken } from '@enkaku/token'
import { StatusBar } from 'expo-status-bar'
import { useState } from 'react'
import { Button, StyleSheet, Text, View } from 'react-native'

type Data = {
  test: string
}

export default function App() {
  const [identity] = useState(() => provideFullIdentity('test'))
  const [signedToken, setSignedToken] = useState<SignedToken<Data> | null>(null)
  const [verifiedToken, setVerifiedToken] = useState<Token<Data> | null>(null)

  let button = null
  if (signedToken == null) {
    button = (
      <Button
        title="Sign token"
        onPress={() => {
          identity.signToken({ test: 'OK' }).then(setSignedToken)
        }}
      />
    )
  } else if (verifiedToken == null) {
    button = (
      <Button
        title="Verify token"
        onPress={() => {
          verifyToken(signedToken).then(setVerifiedToken)
        }}
      />
    )
  }

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      {button}
      {verifiedToken ? <Text>Verified token: {verifiedToken.payload.test}</Text> : null}
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
