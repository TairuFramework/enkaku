import { provideFullIdentity } from '@kokuin/expo'
import { type SignedToken, type Token, verifyToken } from '@kokuin/token'
import { useState } from 'react'
import { Button, Text } from 'react-native'

type Data = {
  test: string
}

export default function SignVerify() {
  const [identity] = useState(() => provideFullIdentity('test'))
  const [signedToken, setSignedToken] = useState<SignedToken<Data> | null>(null)
  const [verifiedToken, setVerifiedToken] = useState<Token<Data> | null>(null)

  return verifiedToken ? (
    <Text>Verified token: {verifiedToken.payload.test}</Text>
  ) : signedToken ? (
    <Button
      title="Verify token"
      onPress={() => {
        verifyToken(signedToken).then(setVerifiedToken)
      }}
    />
  ) : (
    <Button
      title="Sign token"
      onPress={() => {
        identity.signToken({ test: 'OK' }).then(setSignedToken)
      }}
    />
  )
}
