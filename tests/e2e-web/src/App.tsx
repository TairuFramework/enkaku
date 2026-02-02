import { provideSigningIdentity } from '@enkaku/browser-keystore'
import { type Token, verifyToken } from '@enkaku/token'
import { useState } from 'react'
import { Button, StyleSheet, Text, View } from 'react-native'

const identityPromise = provideSigningIdentity('test')

type Data = {
  test: string
}

export default function App() {
  const [signedToken, setSignedToken] = useState<Token<Data> | null>(null)
  const [verifiedToken, setVerifiedToken] = useState<Token<Data> | null>(null)

  let button = null
  if (signedToken == null) {
    button = (
      <Button
        title="Sign token"
        onPress={() => {
          identityPromise.then((identity) => identity.signToken({ test: 'OK' })).then(setSignedToken)
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
