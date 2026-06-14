// app/(auth)/signin.tsx
import { useAuth } from "@/backend/AuthContext";
import { GoogleSignInService } from "@/backend/services/GoogleSignInService";
import { supabase } from "@/backend/supabase";
import { animations } from "@/constent/animations";
import { icons } from "@/constent/icons";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import LottieView from "lottie-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const db = supabase as any;

function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const params = useLocalSearchParams();
  const [resetSuccess, setResetSuccess] = useState(false);
  const router = useRouter();
  const { signIn, signOut } = useAuth();

  useEffect(() => {
    AsyncStorage.setItem("is_password_reset_session", "false");
  }, []);

  useEffect(() => {
    if (params.resetSuccess === "true") setResetSuccess(true);
  }, [params]);

  const validateEmail = (email: string) => /\S+@\S+\.\S+/.test(email);

  const handleSignIn = async () => {
    if (!email || !password) { Alert.alert("Error", "Please fill in all fields"); return; }
    if (!validateEmail(email)) { Alert.alert("Error", "Please enter a valid email"); return; }

    setIsLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (error) { Alert.alert("Error", error.message); return; }
      const { data: userData } = await db.from("users").select("user_type").eq("email", email.toLowerCase()).single();
      if (userData?.user_type === "restaurant") { await signOut(); Alert.alert("Restaurant login moved to web", "Restaurant accounts are managed on the website."); return; }
      if (userData?.user_type === "driver") router.replace("/(driver)/dashboard");
      else router.replace("/(tabs)");
    } catch { Alert.alert("Error", "An unexpected error occurred"); }
    finally { setIsLoading(false); }
  };

  const handleGoogleSignIn = () => {
    Alert.alert("Select Account Type", "What type of account would you like to use?", [
      { text: "Customer", onPress: () => startGoogleSignIn("customer") },
      { text: "Driver", onPress: () => startGoogleSignIn("driver") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const startGoogleSignIn = async (type: "customer" | "driver") => {
    setGoogleLoading(true);
    try {
      const result = await GoogleSignInService.signInWithGoogle(type);
      if (result.success) {
        if (result.isNewUser) Alert.alert("Welcome! 🎉", "Your account has been created successfully.");
        if (type === "driver") router.replace("/(driver)/dashboard");
        else router.replace("/(tabs)");
      } else Alert.alert("Error", result.error || "Failed to sign in with Google");
    } catch { Alert.alert("Error", "Google sign-in failed"); }
    finally { setGoogleLoading(false); }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.animationContainer}><LottieView source={animations.discover_anmazing_food} autoPlay loop style={styles.animation} /></View>
          <View style={styles.header}><Text style={styles.title}>Welcome to Mataim</Text><Text style={styles.subtitle}>Sign in to continue</Text></View>
          {resetSuccess && (<View style={styles.successContainer}><Ionicons name="checkmark-circle" size={20} color="#4CAF50" /><Text style={styles.successText}>Password reset successful! Please sign in.</Text></View>)}
          <View style={styles.form}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputContainer}><Ionicons name="mail-outline" size={20} color="#0000008b" style={styles.inputIcon} /><TextInput style={styles.input} placeholder="Enter your email" placeholderTextColor="#999" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" /></View>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputContainer}><Ionicons name="lock-closed-outline" size={20} color="#0000008b" style={styles.inputIcon} /><TextInput style={styles.input} placeholder="Enter your password" placeholderTextColor="#999" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} /><TouchableOpacity onPress={() => setShowPassword(!showPassword)}><Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#0000008b" /></TouchableOpacity></View>
            <TouchableOpacity style={styles.forgotPassword} onPress={() => router.push("/(auth)/forgot-password")}><Text style={styles.forgotPasswordText}>Forgot Password?</Text></TouchableOpacity>
            <TouchableOpacity style={styles.signInButton} onPress={handleSignIn} disabled={isLoading || googleLoading}>{isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.signInButtonText}>Sign In</Text>}</TouchableOpacity>
            <View style={styles.divider}><View style={styles.dividerLine} /><Text style={styles.dividerText}>OR</Text><View style={styles.dividerLine} /></View>
            <TouchableOpacity style={styles.googleButton} onPress={handleGoogleSignIn} disabled={isLoading || googleLoading}>{googleLoading ? <ActivityIndicator color="#FF6B35" /> : <><Image source={icons.google} style={styles.googleIcon} /><Text style={styles.googleButtonText}>Continue with Google</Text></>}</TouchableOpacity>
            <View style={styles.signUpContainer}><Text style={styles.signUpText}>No account yet? </Text><TouchableOpacity onPress={() => router.push("/(auth)/user-type")}><Text style={styles.signUpLink}>Sign Up</Text></TouchableOpacity></View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scrollContainer: { flexGrow: 1, paddingBottom: 50 },
  animationContainer: { height: 200, marginTop: 14, alignItems: "center" },
  animation: { width: "100%", height: "100%" },
  header: { alignItems: "center", marginBottom: 28 },
  title: { fontSize: 28, fontFamily: "Inter", fontWeight: "700", color: "#1A1A1A", marginBottom: 8, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, fontFamily: "Inter", fontWeight: "400", color: "#6B7280" },
  successContainer: { flexDirection: "row", backgroundColor: "#E8F5E8", borderWidth: 1, borderColor: "#4CAF50", borderRadius: 8, padding: 12, marginHorizontal: 16, marginBottom: 16 },
  successText: { flex: 1, color: "#2E7D32", fontSize: 14, marginLeft: 8, fontFamily: "Inter", fontWeight: "500" },
  form: { paddingHorizontal: 15.5 },
  label: { fontSize: 15.2, fontWeight: "600", color: "#1A1A1A", marginBottom: 8, marginLeft: 4, fontFamily: "Inter" },
  inputContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "#f8f8f8", borderWidth: 0.55, borderColor: "#0000008b", borderRadius: 8, marginBottom: 16, paddingHorizontal: 12 },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, paddingVertical: 15.5, fontSize: 16, color: "#1A1A1A", fontFamily: "Inter", fontWeight: "600" },
  forgotPassword: { alignSelf: "flex-end", marginBottom: 24 },
  forgotPasswordText: { color: "#FF6B35", fontSize: 14, fontWeight: "600", fontFamily: "Inter" },
  signInButton: { backgroundColor: "#1A1A1A", borderRadius: 17, paddingVertical: 16, alignItems: "center", marginBottom: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  signInButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600", fontFamily: "Inter" },
  divider: { flexDirection: "row", alignItems: "center", marginVertical: 20 },
  dividerLine: { flex: 1, height: 0.5, backgroundColor: "#e1e1e187" },
  dividerText: { color: "#9ca3afdc", paddingHorizontal: 14, fontFamily: "Inter", fontWeight: "500" },
  googleButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderWidth: 0.2, borderColor: "#000000ca", borderRadius: 30, padding: 14, marginBottom: 14 },
  googleIcon: { width: 19, height: 19, marginRight: 8 },
  googleButtonText: { color: "#1A1A1A", fontSize: 16, fontWeight: "600", fontFamily: "Inter" },
  signUpContainer: { flexDirection: "row", justifyContent: "center", marginTop: 10 },
  signUpText: { color: "#6B7280", fontFamily: "Inter", fontWeight: "400" },
  signUpLink: { color: "#1A1A1A", fontWeight: "600", fontFamily: "Inter" },
});

export default SignInScreen;
