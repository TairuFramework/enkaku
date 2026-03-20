import { provideFullIdentity } from '@enkaku/expo-keystore'
import {
  commitInvite,
  createGroup,
  createInvite,
  createKeyPackageBundle,
  nobleCryptoProvider,
  processWelcome,
} from '@enkaku/group'
import { randomIdentity, type SignedToken, type Token, verifyToken } from '@enkaku/token'
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
  const [groupResult, setGroupResult] = useState<string | null>(null)

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
      <Button
        title="Group E2EE"
        onPress={async () => {
          try {
            // Use the noble CryptoProvider (pure @noble/* — works on Hermes)
            const options = { cryptoProvider: nobleCryptoProvider }

            // Create two identities
            const alice = randomIdentity()
            const bob = randomIdentity()

            // Alice creates a group
            const { group: aliceGroup } = await createGroup(alice, 'e2e-test', options)

            // Create invite for Bob
            const { invite } = await createInvite(aliceGroup, alice, bob.id, 'member')

            // Bob generates a key package
            const bobKP = await createKeyPackageBundle(bob, options)

            // Alice commits the invite
            const { welcomeMessage, newGroup } = await commitInvite(aliceGroup, bobKP.publicPackage)

            // Bob joins via Welcome
            const { group: bobGroup } = await processWelcome(
              bob,
              invite,
              welcomeMessage,
              bobKP,
              newGroup.state.ratchetTree,
              options,
            )

            // Alice encrypts, Bob decrypts
            const msg = new TextEncoder().encode('hello from expo')
            const { message } = await newGroup.encrypt(msg)
            const decrypted = await bobGroup.decrypt(message)
            const text = new TextDecoder().decode(decrypted)

            setGroupResult(text === 'hello from expo' ? 'OK' : `FAIL: ${text}`)
          } catch (error) {
            setGroupResult(`ERROR: ${error}`)
          }
        }}
      />
      {groupResult ? <Text>Group E2EE: {groupResult}</Text> : null}
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
