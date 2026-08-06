// @kingstinct/react-native-healthkit はNitro Modulesを使っており、importされた時点で
// ネイティブバインディングを読み込もうとする。まだそれが組み込まれていないビルドで
// アプリ全体がクラッシュしないよう、静的importではなく遅延requireにしてtry/catchで囲む。
let cachedModule: any = undefined

function getHealthKit(): any {
  if (cachedModule !== undefined) return cachedModule
  try {
    cachedModule = require('@kingstinct/react-native-healthkit')
  } catch {
    cachedModule = null
  }
  return cachedModule
}

export function isHealthKitAvailable(): boolean {
  return getHealthKit() !== null
}

export async function requestHealthKitAuthorization(options: { toRead: string[]; toShare: string[] }): Promise<boolean> {
  const HealthKit = getHealthKit()
  if (!HealthKit) return false
  await HealthKit.requestAuthorization(options)
  return true
}

export async function getMostRecentWeightSample(): Promise<{ quantity: number; endDate: Date } | null> {
  const HealthKit = getHealthKit()
  if (!HealthKit) return null
  return HealthKit.getMostRecentQuantitySample('HKQuantityTypeIdentifierBodyMass', 'kg')
}

export async function saveWeightSample(value: number, date: Date): Promise<void> {
  const HealthKit = getHealthKit()
  if (!HealthKit) return
  await HealthKit.saveQuantitySample('HKQuantityTypeIdentifierBodyMass', 'kg', value, date, date)
}
