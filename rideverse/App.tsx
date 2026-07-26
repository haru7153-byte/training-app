import { StatusBar } from 'expo-status-bar'
import { RootNavigator } from '@/app/RootNavigator'
import { GenerationSessionProvider } from '@/context/GenerationSessionContext'

export default function App() {
  return (
    <GenerationSessionProvider>
      <StatusBar style="dark" />
      <RootNavigator />
    </GenerationSessionProvider>
  )
}
