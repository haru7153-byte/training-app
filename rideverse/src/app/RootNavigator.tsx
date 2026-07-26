import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { SplashScreen } from '@/features/splash/SplashScreen'
import { WelcomeScreen } from '@/features/welcome/WelcomeScreen'
import { BikeRegistrationScreen } from '@/features/bike/BikeRegistrationScreen'
import { QuestionsScreen } from '@/features/questions/QuestionsScreen'
import { GenerationScreen } from '@/features/generation/GenerationScreen'
import { NamingScreen } from '@/features/naming/NamingScreen'
import { ProfileScreen } from '@/features/profile/ProfileScreen'

export type RootStackParamList = {
  Splash: undefined
  Welcome: undefined
  BikeRegistration: undefined
  Questions: undefined
  Generation: undefined
  Naming: undefined
  Profile: undefined
}

const Stack = createNativeStackNavigator<RootStackParamList>()

export function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Splash">
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="BikeRegistration" component={BikeRegistrationScreen} />
        <Stack.Screen name="Questions" component={QuestionsScreen} />
        <Stack.Screen name="Generation" component={GenerationScreen} options={{ gestureEnabled: false }} />
        <Stack.Screen name="Naming" component={NamingScreen} options={{ gestureEnabled: false }} />
        <Stack.Screen name="Profile" component={ProfileScreen} options={{ gestureEnabled: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}
