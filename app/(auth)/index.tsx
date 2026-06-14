// app/(auth)/index.tsx
import { useAuth } from "@/backend/AuthContext";
import { images } from "@/constent/images";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, BackHandler, Easing, Image, StatusBar, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";


const APP_ICON = require("../../assets/icons/ic_launcher.png");


const carouselImages = [
  images.BurgerImage,
  images.PizzaImage,
  images.SushiImage,
  images.PastaImage,
  images.SaladImage,
  images.DessertImage,
  images.DrinkImage,
  images.BreakfastImage,
];

export default function AuthOptionsScreen() {
  const router = useRouter();
  const { user, isLoading, signInAsGuest } = useAuth();
  const { width, height } = useWindowDimensions();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const appNameAnim = useRef(new Animated.Value(0)).current;
  const letterAnimations = useRef(Array(6).fill(0).map(() => ({ scale: new Animated.Value(0.5), opacity: new Animated.Value(0), translateY: new Animated.Value(10) }))).current;
  const backButtonPressed = useRef(0);
  const [showExitMessage, setShowExitMessage] = useState(false);
  const exitMessageOpacity = useRef(new Animated.Value(0)).current;

  const responsiveSize = (size: number) => (size * width) / 375;
  const responsiveHeight = (size: number) => (size * height) / 667;

  const startAppNameAnimation = useCallback(() => {
    letterAnimations.forEach((letter) => { letter.scale.setValue(0.5); letter.opacity.setValue(0); letter.translateY.setValue(10); });
    const letterAnimationsSequence = letterAnimations.map((letter, index) => Animated.sequence([Animated.delay(index * 100), Animated.parallel([Animated.timing(letter.scale, { toValue: 1, duration: 600, useNativeDriver: true, easing: Easing.out(Easing.back(1.2)) }), Animated.timing(letter.opacity, { toValue: 1, duration: 500, useNativeDriver: true, easing: Easing.out(Easing.cubic) }), Animated.timing(letter.translateY, { toValue: 0, duration: 600, useNativeDriver: true, easing: Easing.out(Easing.cubic) })])]));
    Animated.stagger(80, letterAnimationsSequence).start(() => {
      Animated.loop(Animated.sequence([Animated.timing(appNameAnim, { toValue: 1, duration: 1500, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }), Animated.timing(appNameAnim, { toValue: 0, duration: 1500, useNativeDriver: true, easing: Easing.inOut(Easing.sin) })])).start();
    });
  }, [appNameAnim, letterAnimations]);

  const startCarouselAnimation = useCallback(() => {
    Animated.sequence([Animated.timing(slideAnim, { toValue: -width * 0.8, duration: 400, useNativeDriver: true, easing: Easing.out(Easing.cubic) }), Animated.timing(slideAnim, { toValue: width * 0.8, duration: 0, useNativeDriver: true }), Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true, easing: Easing.out(Easing.cubic) })]).start(() => {
      setCurrentImageIndex((index) => (index + 1) % carouselImages.length);
    });
  }, [slideAnim, width]);

  const handleGuestContinue = async () => { await signInAsGuest(); router.replace("/(tabs)"); };

  const handleBackPress = useCallback(() => {
    if (router.canGoBack()) return false;
    if (backButtonPressed.current > 0) { BackHandler.exitApp(); return true; }
    backButtonPressed.current++;
    setShowExitMessage(true);
    Animated.sequence([Animated.timing(exitMessageOpacity, { toValue: 1, duration: 200, useNativeDriver: true }), Animated.delay(800), Animated.timing(exitMessageOpacity, { toValue: 0, duration: 200, useNativeDriver: true })]).start(() => setShowExitMessage(false));
    setTimeout(() => { backButtonPressed.current = 0; }, 1500);
    return true;
  }, [exitMessageOpacity, router]);

  useEffect(() => {
    startAppNameAnimation();
    Animated.parallel([Animated.timing(scaleAnim, { toValue: 1.02, duration: 800, useNativeDriver: true })]).start();
    Animated.loop(Animated.sequence([Animated.timing(pulseAnim, { toValue: 1.03, duration: 1000, useNativeDriver: true }), Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true })])).start();
    const carouselInterval = setInterval(() => startCarouselAnimation(), 2000);
    const backHandler = BackHandler.addEventListener("hardwareBackPress", handleBackPress);
    return () => { backHandler.remove(); clearInterval(carouselInterval); backButtonPressed.current = 0; };
  }, [handleBackPress, pulseAnim, scaleAnim, startAppNameAnimation, startCarouselAnimation]);

  const combinedScale = Animated.multiply(scaleAnim, pulseAnim);
  const text = "Mataim";
  const letters = text.split("");

  if (isLoading) return null;
  if (user) {
    switch (user.user_type) {
      case "restaurant": return <Redirect href="/(auth)/signin" />;
      case "driver": return <Redirect href="/(driver)/dashboard" />;
      default: return <Redirect href="/(tabs)" />;
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#fa311e" />
      {showExitMessage && (<Animated.View style={[styles.exitMessage, { opacity: exitMessageOpacity, top: responsiveHeight(60) }]}><View style={[styles.exitMessageContent, { paddingHorizontal: responsiveSize(14), paddingVertical: responsiveSize(6), borderRadius: responsiveSize(16) }]}><Ionicons name="exit-outline" size={responsiveSize(18)} color="#FFF" /><Text style={[styles.exitMessageText, { fontSize: responsiveSize(13) }]}>Press back again to exit</Text></View></Animated.View>)}
      <View style={[styles.logoContainer, { paddingHorizontal: responsiveSize(40), paddingTop: responsiveHeight(40), paddingBottom: responsiveHeight(10) }]}>
        <View style={[styles.logoCircle, { width: responsiveSize(70), height: responsiveSize(70), borderRadius: responsiveSize(40), marginBottom: responsiveHeight(16) }]}><Image source={APP_ICON} resizeMode="contain" style={styles.logo} /></View>
        {/* <View style={styles.appNameContainer}>{letters.map((letter, index) => { const { scale, opacity, translateY } = letterAnimations[index]; return (<Animated.Text key={index} style={[styles.appName, { fontSize: responsiveSize(36), opacity, transform: [{ scale }, { translateY }] }]}>{letter}</Animated.Text>); })}</View> */}
        <Text style={[styles.tagline, { fontSize: responsiveSize(16), lineHeight: responsiveSize(22), marginBottom: responsiveHeight(8) }]}>Delicious Food Delivered Fast</Text>
      </View>
      {/* <View style={[styles.animationContainer, { height: responsiveHeight(150), marginVertical: responsiveHeight(5) }]}>
        <Animated.View style={[styles.carouselItem, { width: responsiveSize(220), height: "100%", transform: [{ scale: combinedScale }, { translateX: slideAnim }] }]}><Animated.Image source={carouselImages[currentImageIndex]} style={styles.animation} resizeMode="contain" /></Animated.View>
        <View style={[styles.indicators, { bottom: responsiveHeight(-22), gap: responsiveSize(6) }]}>{carouselImages.map((_, index) => (<View key={index} style={[styles.indicator, { width: responsiveSize(6), height: responsiveSize(6), borderRadius: responsiveSize(3) }, index === currentImageIndex && [styles.indicatorActive, { width: responsiveSize(16) }]]} />))}</View>
      </View>
      <View style={[styles.features, { paddingHorizontal: responsiveSize(32), marginBottom: responsiveHeight(20), gap: responsiveSize(15), marginTop: responsiveHeight(48) }]}>
        <View style={[styles.featureItem, { gap: responsiveSize(5) }]}>
          <View style={[styles.featureIcon, { width: responsiveSize(36), height: responsiveSize(36), borderRadius: responsiveSize(0) }]}>
            <Image source={images.FeatureRestaurants} style={styles.featureImage} />
          </View>
          <Text style={[styles.featureText, { fontSize: responsiveSize(10.8) }]}>100+ Restaurants</Text>
        </View>
        <View style={[styles.featureItem, { gap: responsiveSize(5) }]}>
          <View style={[styles.featureIcon, { width: responsiveSize(36), height: responsiveSize(36), borderRadius: responsiveSize(0) }]}>
            <Image source={images.FeatureDelivery} style={styles.featureImage} />
          </View>
          <Text style={[styles.featureText, { fontSize: responsiveSize(10.8) }]}>Fast Delivery</Text>
        </View>
        <View style={[styles.featureItem, { gap: responsiveSize(5) }]}>
          <View style={[styles.featureIcon, { width: responsiveSize(36), height: responsiveSize(36), borderRadius: responsiveSize(0) }]}>
            <Image source={images.FeaturePayment} style={styles.featureImage} />
          </View>
          <Text style={[styles.featureText, { fontSize: responsiveSize(10.8) }]}>Secure Payment</Text>
        </View>
      </View> */}
      <View style={[styles.authContainer, { paddingHorizontal: responsiveSize(16), gap: responsiveHeight(12), marginTop: responsiveHeight(20) }]}>
        <TouchableOpacity style={[styles.signUpButton, { padding: responsiveSize(16), borderRadius: responsiveSize(12), gap: responsiveSize(12) }]} onPress={() => router.push("/(auth)/user-type")}><Ionicons name="person-add-outline" size={responsiveSize(18)} color="#D62400" /><Text style={[styles.signUpButtonText, { fontSize: responsiveSize(14.5) }]}>Create Account</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.signInButton, { padding: responsiveSize(15), borderRadius: responsiveSize(12), gap: responsiveSize(12) }]} onPress={() => router.push("/(auth)/signin")}><Ionicons name="log-in-outline" size={responsiveSize(18)} color="#FFF" /><Text style={[styles.signInButtonText, { fontSize: responsiveSize(14.5) }]}>Sign In</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.guestButton, { marginTop: responsiveHeight(6), paddingVertical: responsiveHeight(2) }]} onPress={handleGuestContinue}><Text style={[styles.guestButtonText, { fontSize: responsiveSize(14) }]}>Continue as Guest</Text><Ionicons name="arrow-forward" size={responsiveSize(15)} color="#FFF" left={responsiveSize(10)} top={responsiveSize(2)} /></TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fa311e" },
  exitMessage: { position: "absolute", left: 0, right: 0, alignItems: "center", zIndex: 100 },
  exitMessageContent: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0, 0, 0, 0.6)", width: "auto", height: "auto" },
  exitMessageText: { color: "#FFF", fontFamily: "Inter", fontWeight: "500", marginLeft: 8 },
  logoContainer: { alignItems: "center", marginBottom: 16, marginTop: 40 },
  logoCircle: {
    backgroundColor: "#FFF", justifyContent: "center",
    alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
  },
  logo: { width: 100, height: 100, borderRadius: 999 },
  appNameContainer: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  appName: { fontFamily: "Inter", fontWeight: "800", color: "#FFF", textAlign: "center", textShadowColor: "rgba(0, 0, 0, 0.3)", textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3 },
  tagline: { fontFamily: "Inter", fontWeight: "600", color: "rgba(255, 255, 255, 0.8)", textAlign: "center", marginTop: 8 },
  animationContainer: { justifyContent: "center", alignItems: "center", position: "relative" },
  carouselItem: { justifyContent: "center", alignItems: "center" },
  animation: { width: "100%", height: "100%" },
  indicators: { flexDirection: "row", position: "absolute" },
  indicator: { backgroundColor: "rgba(255, 255, 255, 0.4)" },
  indicatorActive: { backgroundColor: "#FFF" },
  features: { flexDirection: "row", justifyContent: "space-around" },
  featureItem: { alignItems: "center" },
  featureIcon: { justifyContent: "center", alignItems: "center" },
  featureText: { fontFamily: "Inter", fontWeight: "500", color: "#ffffffe9", textAlign: "center" },
  authContainer: {},
  signUpButton: { backgroundColor: "#F9F9F9", flexDirection: "row", alignItems: "center", justifyContent: "center", elevation: 2 },
  signUpButtonText: { color: "#D62400", fontFamily: "Inter", fontWeight: "700", letterSpacing: 0.5, textShadowColor: "rgba(0, 0, 0, 0.1)", textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  signInButton: { backgroundColor: "transparent", flexDirection: "row", alignItems: "center", justifyContent: "center", borderWidth: 0.5, borderColor: "#FFF" },
  signInButtonText: { color: "#FFF", fontFamily: "Inter", fontWeight: "700", letterSpacing: 0.5 },
  guestButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", top: -6 },
  guestButtonText: { color: "#F9F9F9", fontFamily: "Inter", fontWeight: "500", opacity: 0.9 },

  featureImage: {
    width: '80%',
    height: '80%',
    borderRadius: 0,
  },
});
