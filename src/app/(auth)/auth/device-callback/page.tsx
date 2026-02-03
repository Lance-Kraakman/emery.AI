import { auth } from '@/lib/auth'
import { cookies } from 'next/headers'
import { storeDeviceSession, isValidDeviceCode } from '@/lib/auth/device-flow'
import { DeviceCallbackClient } from './DeviceCallbackClient'

interface DeviceCallbackPageProps {
  searchParams: Promise<{ device_code?: string }>
}

export default async function DeviceCallbackPage({ searchParams }: DeviceCallbackPageProps) {
  const params = await searchParams
  const deviceCode = params.device_code

  if (!deviceCode || !isValidDeviceCode(deviceCode)) {
    return <DeviceCallbackClient status="error" message="Invalid device code." />
  }

  const session = await auth()
  if (!session?.user) {
    return <DeviceCallbackClient status="error" message="Authentication failed. Please try again from the desktop app." />
  }

  const cookieStore = await cookies()
  const sessionToken = cookieStore.get('next-auth.session-token')?.value

  if (!sessionToken) {
    return <DeviceCallbackClient status="error" message="Session not found. Please try again." />
  }

  const stored = await storeDeviceSession(deviceCode, sessionToken)

  if (!stored) {
    return (
      <DeviceCallbackClient
        status="error"
        message="This sign-in link has already been used. Please try again from the desktop app."
      />
    )
  }

  return <DeviceCallbackClient status="success" />
}
