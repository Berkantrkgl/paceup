import Constants from "expo-constants";
import { Platform } from "react-native";
import Purchases, {
  CustomerInfo,
  LOG_LEVEL,
  PurchasesPackage,
} from "react-native-purchases";

export const PREMIUM_ENTITLEMENT_ID = "premium";

let configured = false;

export function configureRevenueCat() {
  if (configured) return;
  if (Platform.OS !== "ios") return;

  const apiKey = Constants.expoConfig?.extra?.revenueCatIosKey as
    | string
    | undefined;

  if (!apiKey || apiKey.startsWith("REPLACE")) {
    console.log("[RevenueCat] iOS API key eksik — purchases devre dışı");
    return;
  }

  Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.WARN : LOG_LEVEL.ERROR);

  // RC SDK'nın iç log'larını LogBox banner'ı tetiklemeden console'a yönlendir.
  // Default davranışta SDK console.error/warn çağırıyor → RN LogBox dev mod'da
  // sarı/kırmızı banner gösteriyor. Burada hepsini console.log'a düşürüyoruz —
  // mesajlar Metro terminal'inde okunabilir kalır ama UI'ı kirletmez.
  Purchases.setLogHandler((_level, message) => {
    if (__DEV__) console.log(`[RC] ${message}`);
  });

  Purchases.configure({ apiKey });
  configured = true;
}

export async function identifyRevenueCatUser(userId: string) {
  if (!configured) return;
  try {
    await Purchases.logIn(userId);
  } catch (e) {
    console.log("[RevenueCat] logIn hatası:", e);
  }
}

/**
 * Purchase/restore öncesi çağrılır. RC SDK anonymous user'da çalışıyorsa
 * verdiğimiz userId ile identify eder; zaten identified ise no-op.
 *
 * Sebep: AuthContext.identifyRevenueCatUser login akışında await ediliyor ama
 * cold-start init durumunda kullanıcı protected route'a girmeden önce identify
 * tamamlanmamış olabiliyor. Burada defansif olarak doğrularız — satın alma
 * anonymous user'a bağlanmasın, restore yanlış customer'da yapılmasın.
 */
export async function ensureRevenueCatIdentified(userId: string): Promise<void> {
  if (!configured) return;
  try {
    const currentId = await Purchases.getAppUserID();
    console.log("[DEBUG] RC currentId:", currentId, "expected:", userId);
    // Anonymous ID'ler "$RCAnonymousID:..." formatında; identified ID'miz uuid.
    if (currentId === userId) return;
    const result = await Purchases.logIn(userId);
    console.log("[DEBUG] RC logIn result. created:", result.created);
  } catch (e) {
    console.log("[RevenueCat] ensureIdentified hatası:", e);
    // Devam ediyoruz — identify başarısızsa da SDK çağrısı yine de çalışır,
    // kötü senaryoda anonymous id altında satın alma kalır (manuel kurtarılır).
  }
}

export async function logoutRevenueCat() {
  if (!configured) return;
  try {
    await Purchases.logOut();
  } catch {
    // logOut anonim kullanıcıda throw atar, sessizce geç
  }
}

export async function getPremiumPackages(): Promise<{
  monthly: PurchasesPackage | null;
  annual: PurchasesPackage | null;
}> {
  if (!configured) return { monthly: null, annual: null };

  const offerings = await Purchases.getOfferings();
  const current = offerings.current;
  return {
    monthly: current?.monthly ?? null,
    annual: current?.annual ?? null,
  };
}

export async function purchasePackage(
  pkg: PurchasesPackage,
  userId: string,
): Promise<{
  customerInfo: CustomerInfo;
  isPremium: boolean;
}> {
  await ensureRevenueCatIdentified(userId);
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  const isPremium =
    customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID] !== undefined;
  return { customerInfo, isPremium };
}

export async function restorePurchases(userId: string): Promise<{
  customerInfo: CustomerInfo;
  isPremium: boolean;
}> {
  await ensureRevenueCatIdentified(userId);
  const customerInfo = await Purchases.restorePurchases();
  const isPremium =
    customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID] !== undefined;
  return { customerInfo, isPremium };
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!configured) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch {
    return null;
  }
}

export function isPremiumFromCustomerInfo(info: CustomerInfo | null): boolean {
  if (!info) return false;
  return info.entitlements.active[PREMIUM_ENTITLEMENT_ID] !== undefined;
}

/**
 * RC SDK customer info güncellendiğinde callback'i çağırır.
 * Tetikleyiciler: webhook üzerinden push, başka cihazda satın alma, renewal,
 * grace period değişimi vb. Multi-device sync için kritik.
 *
 * Returns: cleanup fonksiyonu (useEffect'ten dönmek için).
 */
export function addCustomerInfoListener(
  callback: (info: CustomerInfo) => void,
): () => void {
  if (!configured) return () => {};
  Purchases.addCustomerInfoUpdateListener(callback);
  return () => {
    Purchases.removeCustomerInfoUpdateListener(callback);
  };
}
