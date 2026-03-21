import {
  commitInvite,
  createGroup,
  createInvite,
  createKeyPackageBundle,
  nobleCryptoProvider,
  processWelcome,
} from '@enkaku/group'
import { randomIdentity } from '@enkaku/token'
import { useState } from 'react'
import { Button, Text } from 'react-native'

async function createGroupMessage(): Promise<string> {
  // Use the noble CryptoProvider (pure @noble/* — works on Hermes)
  const options = { cryptoProvider: nobleCryptoProvider }

  // Create two identities
  const alice = randomIdentity()
  const bob = randomIdentity()

  // Alice creates a group
  const { group: aliceGroup } = await createGroup(alice, 'e2e-test', options)

  // Create invite for Bob
  const { invite } = await createInvite({
    group: aliceGroup,
    identity: alice,
    recipientDID: bob.id,
    permission: 'member',
  })

  // Bob generates a key package
  const bobKP = await createKeyPackageBundle(bob, options)

  // Alice commits the invite
  const { welcomeMessage, newGroup } = await commitInvite(aliceGroup, bobKP.publicPackage)

  // Bob joins via Welcome
  const { group: bobGroup } = await processWelcome({
    identity: bob,
    invite,
    welcome: welcomeMessage,
    keyPackageBundle: bobKP,
    ratchetTree: newGroup.state.ratchetTree,
    options,
  })

  // Alice encrypts, Bob decrypts
  const msg = new TextEncoder().encode('hello from expo')
  const { message } = await newGroup.encrypt(msg)
  const decrypted = await bobGroup.decrypt(message)
  return new TextDecoder().decode(decrypted)
}

export default function GroupEncryption() {
  const [groupResult, setGroupResult] = useState<string | null>(null)

  return groupResult ? (
    <Text>Group E2EE: {groupResult}</Text>
  ) : (
    <Button
      title="Group E2EE"
      onPress={() => {
        createGroupMessage().then(
          (text) => {
            setGroupResult(text === 'hello from expo' ? 'OK' : `FAIL: ${text}`)
          },
          (error) => {
            setGroupResult(`ERROR: ${error}`)
          },
        )
      }}
    />
  )
}
