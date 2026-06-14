import { logger } from "@/backend/utils/logger";
// app/(auth)/forgot-password.tsx
import { passwordResetManager } from "@/backend/PasswordResetManager";
import { animations } from "@/constent/animations";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import LottieView from "lottie-react-native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { supabase } from "../../backend/supabase";

const { width } = Dimensions.get("window");

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<"email" | "code" | "newPassword" | "success">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [errors, setErrors] = useState({
    email: "",
    code: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [touched, setTouched] = useState({
    email: false,
    code: false,
    newPassword: false,
    confirmPassword: false,
  });

  const codeInputs = useRef<(TextInput | null)[]>([]);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const [isComponentMounted, setIsComponentMounted] = useState(true);

  const router = useRouter();

  useEffect(() => {
    setIsComponentMounted(true);
    return () => {
      setIsComponentMounted(false);
    };
  }, []);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [step]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    const handleAppStateChange = async (nextAppState: string) => {
      if (nextAppState === "background" || nextAppState === "inactive") {
        const hasValidSession = await AsyncStorage.getItem("has_valid_reset_session");
        const isResetInProgress = await passwordResetManager.isResetInProgress();

        if ((hasValidSession === "true" || isResetInProgress) && step !== "success") {
          logger.debug("🚫 App going to background with incomplete reset - cleaning up");
          setTimeout(async () => {
            await supabase.auth.signOut();
            await passwordResetManager.clearSession();
            await AsyncStorage.multiRemove([
              "has_valid_reset_session",
              "recovery_session_active",
            ]);
          }, 1000);
        }
      }
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();
  }, [step]);

  useEffect(() => {
    return () => {
      if (!isComponentMounted) {
        const cleanupIncompleteReset = async () => {
          const hasValidSession = await AsyncStorage.getItem("has_valid_reset_session");
          const isResetInProgress = await passwordResetManager.isResetInProgress();

          if ((hasValidSession === "true" || isResetInProgress) && step !== "success") {
            await supabase.auth.signOut();
            await passwordResetManager.clearSession();
            await AsyncStorage.multiRemove([
              "has_valid_reset_session",
              "reset_session_timestamp",
              "reset_email",
              "recovery_session_active",
            ]);
          }
        };
        cleanupIncompleteReset();
      }
    };
  }, [step, isComponentMounted]);

  const validateEmail = (email: string) => {
    const re = /\S+@\S+\.\S+/;
    return re.test(email);
  };

  const validatePassword = (password: string) => password.length >= 8;

  const validateEmailRealTime = (email: string) => {
    if (!email.trim()) return { isValid: false, message: "Email address is required" };
    if (!validateEmail(email)) return { isValid: false, message: "Please enter a valid email address" };
    return { isValid: true, message: "" };
  };

  const validatePasswordRealTime = (password: string) => {
    if (!password.trim()) return { isValid: false, message: "Password is required" };
    if (password.length < 8) return { isValid: false, message: "Password must be at least 8 characters" };
    return { isValid: true, message: "" };
  };

  const validateConfirmPassword = (confirm: string, password: string) => {
    if (!confirm.trim()) return { isValid: false, message: "Please confirm your password" };
    if (confirm !== password) return { isValid: false, message: "Passwords do not match" };
    return { isValid: true, message: "" };
  };

  useEffect(() => {
    if (touched.email || email) {
      const validation = validateEmailRealTime(email);
      setErrors((prev) => ({ ...prev, email: validation.message }));
    }
  }, [email, touched.email]);

  useEffect(() => {
    if (touched.newPassword || newPassword) {
      const validation = validatePasswordRealTime(newPassword);
      setErrors((prev) => ({ ...prev, newPassword: validation.message }));
    }
  }, [newPassword, touched.newPassword]);

  useEffect(() => {
    if (touched.confirmPassword || confirmPassword) {
      const validation = validateConfirmPassword(confirmPassword, newPassword);
      setErrors((prev) => ({ ...prev, confirmPassword: validation.message }));
    }
  }, [confirmPassword, newPassword, touched.confirmPassword]);

  const handleFieldFocus = (field: keyof typeof touched) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const checkEmailExists = async (email: string) => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const { data } = await supabase.from("users").select("id").eq("email", cleanEmail).maybeSingle();
      return !!data;
    } catch (error) {
      console.error("Email check error:", error);
      return false;
    }
  };

  const handleCodeChange = (text: string, index: number) => {
    const numericText = text.replace(/[^0-9]/g, "");
    const newCode = [...code];
    newCode[index] = numericText;
    setCode(newCode);
    if (numericText && errors.code) setErrors((prev) => ({ ...prev, code: "" }));
    if (numericText && index < 5) codeInputs.current[index + 1]?.focus();
  };

  const handleCodeKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && !code[index] && index > 0) {
      codeInputs.current[index - 1]?.focus();
    }
  };

  const handleSendCode = async () => {
    setTouched({ email: true, code: false, newPassword: false, confirmPassword: false });
    const emailValidation = validateEmailRealTime(email);
    if (!emailValidation.isValid) {
      setErrors((prev) => ({ ...prev, email: emailValidation.message }));
      return;
    }

    setIsLoading(true);
    try {
      const emailExists = await checkEmailExists(email);
      if (!emailExists) {
        setErrors({ email: "No account found with this email address.", code: "", newPassword: "", confirmPassword: "" });
        setIsLoading(false);
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: "mataim://reset-password" });

      if (error && !(error.status === 200 || error.message?.includes("OK"))) {
        let errorMessage = "Failed to send verification code. Please try again.";
        if (error.message?.includes("rate limit")) errorMessage = "Too many attempts. Please wait 5 minutes.";
        else if (error.message?.includes("user not found")) errorMessage = "No account found with this email address.";
        setErrors({ email: errorMessage, code: "", newPassword: "", confirmPassword: "" });
      } else {
        setStep("code");
        setCountdown(60);
        Alert.alert("Verification Code Sent!", `We've sent a 6-digit code to ${email}.`);
      }
    } catch (error: any) {
      setErrors({ email: "Unable to connect. Please check your internet connection.", code: "", newPassword: "", confirmPassword: "" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    setTouched((prev) => ({ ...prev, code: true }));
    const fullCode = code.join("");
    if (!fullCode.trim()) {
      setErrors((prev) => ({ ...prev, code: "Please enter the 6-digit verification code" }));
      return;
    }
    if (fullCode.length < 6) {
      setErrors((prev) => ({ ...prev, code: "Please enter all 6 digits" }));
      return;
    }

    setIsLoading(true);
    try {
      await passwordResetManager.startResetSession();
      const { error: verifyError } = await supabase.auth.verifyOtp({ email: email.trim(), token: fullCode.trim(), type: "recovery" });

      if (verifyError) {
        await passwordResetManager.endResetSession();
        setErrors((prev) => ({ ...prev, code: "This verification code is invalid or has expired." }));
        setIsLoading(false);
        return;
      }

      await AsyncStorage.multiSet([
        ["reset_email", email.trim()],
        ["has_valid_reset_session", "true"],
        ["reset_session_timestamp", Date.now().toString()],
        ["recovery_session_active", "true"],
      ]);

      setStep("newPassword");
    } catch (error: any) {
      await passwordResetManager.endResetSession();
      setErrors((prev) => ({ ...prev, code: "Unable to verify code. Please try again." }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setTouched({ email: true, code: true, newPassword: true, confirmPassword: true });
    const passwordValidation = validatePasswordRealTime(newPassword);
    const confirmValidation = validateConfirmPassword(confirmPassword, newPassword);

    if (!passwordValidation.isValid) {
      setErrors((prev) => ({ ...prev, newPassword: passwordValidation.message }));
      return;
    }
    if (!confirmValidation.isValid) {
      setErrors((prev) => ({ ...prev, confirmPassword: confirmValidation.message }));
      return;
    }

    setIsLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword.trim() });
      if (updateError) throw new Error(updateError.message);

      await supabase.auth.signOut();
      await AsyncStorage.multiRemove(["reset_email", "has_valid_reset_session", "reset_session_timestamp", "recovery_session_active"]);
      await passwordResetManager.completeResetProcess();

      router.replace("/(auth)/signin");
      setTimeout(() => Alert.alert("Password Reset Successfully!", "You can now sign in with your new password."), 500);
    } catch (error: any) {
      Alert.alert("Reset Failed", error.message || "Please start the process again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = async () => {
    if (step === "code" || step === "newPassword") {
      await supabase.auth.signOut();
      await passwordResetManager.endResetSession();
      await AsyncStorage.multiRemove(["reset_email", "has_valid_reset_session", "reset_session_timestamp", "recovery_session_active"]);
    }
    if (step === "code") setStep("email");
    else if (step === "newPassword") setStep("code");
  };

  const handleBackToSignIn = async () => {
    await supabase.auth.signOut();
    await passwordResetManager.clearSession();
    await AsyncStorage.multiRemove(["has_valid_reset_session", "recovery_session_active"]);
    router.replace("/(auth)/signin");
  };

  const handleResendCode = async () => {
    if (countdown > 0) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
      setCountdown(60);
      setCode(["", "", "", "", "", ""]);
      Alert.alert("New Code Sent", "A new 6-digit verification code has been sent.");
    } catch (error) {
      Alert.alert("Resend Failed", "Unable to send new code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const isCodeComplete = code.every((digit) => digit !== "");
  const getEmailInputStatus = () => {
    if (errors.email) return "error";
    if (email && validateEmail(email)) return "success";
    return "neutral";
  };
  const getPasswordInputStatus = () => {
    if (errors.newPassword) return "error";
    if (newPassword && validatePasswordRealTime(newPassword).isValid) return "success";
    return "neutral";
  };
  const getConfirmPasswordInputStatus = () => {
    if (errors.confirmPassword) return "error";
    if (confirmPassword && confirmPassword === newPassword) return "success";
    return "neutral";
  };

  const renderEmailStep = () => (
    <Animated.View style={{ opacity: fadeAnim }}>
      <View style={styles.animationContainer}>
        <LottieView source={animations.emailAnimation} autoPlay loop style={styles.animation} />
      </View>
      <View style={styles.header}>
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>Enter your email address and we'll send you a verification code</Text>
      </View>
      <View style={styles.form}>
        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Email Address</Text>
          <View style={[styles.inputContainer, getEmailInputStatus() === "error" ? styles.inputError : getEmailInputStatus() === "success" ? styles.inputSuccess : null]}>
            <Ionicons name="mail-outline" size={20} color={errors.email ? "#FF3B30" : "#8E8E93"} style={styles.inputIcon} />
            <TextInput style={styles.input} placeholder="your.email@example.com" value={email} onChangeText={setEmail} onFocus={() => handleFieldFocus("email")} autoCapitalize="none" keyboardType="email-address" placeholderTextColor="#8E8E93" editable={!isLoading} />
            {getEmailInputStatus() === "success" && <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />}
          </View>
          {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : <Text style={styles.helperText}>We'll send a verification code to this email</Text>}
        </View>
        <TouchableOpacity style={[styles.primaryButton, isLoading && styles.disabledButton, (!email.trim() || !validateEmail(email)) && styles.disabledButton]} onPress={handleSendCode} disabled={isLoading || !email.trim() || !validateEmail(email)}>
          {isLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryButtonText}>Send Verification Code</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.backButton} onPress={handleBackToSignIn} disabled={isLoading}>
          <Ionicons name="arrow-back" size={16} color="#6B7280" />
          <Text style={styles.backButtonText}>Back to Sign In</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const renderCodeStep = () => (
    <Animated.View style={{ opacity: fadeAnim }}>
      <View style={styles.animationContainer}>
        <LottieView source={animations.codeVerificationAnimation} autoPlay loop style={styles.animation} />
      </View>
      <View style={styles.header}>
        <Text style={styles.title}>Enter Verification Code</Text>
        <Text style={styles.subtitle}>We sent a 6-digit code to</Text>
        <Text style={styles.emailHighlight}>{email}</Text>
      </View>
      <View style={styles.form}>
        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Verification Code</Text>
          <View style={styles.codeContainer}>
            {code.map((digit, index) => (
              <TextInput key={index} ref={(ref) => (codeInputs.current[index] = ref)} style={[styles.codeInput, code[index] && styles.codeInputFilled, errors.code && styles.codeInputError, isCodeComplete && !errors.code && styles.codeInputComplete]} value={digit} onChangeText={(text) => handleCodeChange(text, index)} onKeyPress={(e) => handleCodeKeyPress(e, index)} onFocus={() => handleFieldFocus("code")} keyboardType="number-pad" maxLength={1} selectTextOnFocus editable={!isLoading} />
            ))}
          </View>
          {errors.code ? <Text style={styles.errorText}>{errors.code}</Text> : <Text style={styles.helperText}>Enter all 6 digits from your email</Text>}
        </View>
        <TouchableOpacity style={[styles.primaryButton, (isLoading || code.join("").length < 6) && styles.disabledButton]} onPress={handleVerifyCode} disabled={isLoading || code.join("").length < 6}>
          {isLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryButtonText}>Verify Code</Text>}
        </TouchableOpacity>
        <View style={styles.resendContainer}>
          <Text style={styles.resendText}>Didn't receive the code? </Text>
          <TouchableOpacity onPress={handleResendCode} disabled={isLoading || countdown > 0}>
            <Text style={[styles.resendLink, (isLoading || countdown > 0) && styles.resendLinkDisabled]}>{countdown > 0 ? `Resend in ${formatCountdown(countdown)}` : "Resend Code"}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.backButton} onPress={handleBack} disabled={isLoading}>
          <Ionicons name="arrow-back" size={16} color="#6B7280" />
          <Text style={styles.backButtonText}>Back to Email</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const renderNewPasswordStep = () => (
    <Animated.View style={{ opacity: fadeAnim }}>
      <View style={styles.animationContainer}>
        <LottieView source={animations.passwordResetAnimation} autoPlay loop style={styles.animation} />
      </View>
      <View style={styles.header}>
        <Text style={styles.title}>Create New Password</Text>
        <Text style={styles.subtitle}>Create a strong, secure password for your account</Text>
      </View>
      <View style={styles.form}>
        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>New Password</Text>
          <View style={[styles.inputContainer, getPasswordInputStatus() === "error" ? styles.inputError : getPasswordInputStatus() === "success" ? styles.inputSuccess : null]}>
            <Ionicons name="lock-closed-outline" size={20} color={errors.newPassword ? "#FF3B30" : "#8E8E93"} style={styles.inputIcon} />
            <TextInput style={styles.input} placeholder="Create a strong password" value={newPassword} onChangeText={setNewPassword} onFocus={() => handleFieldFocus("newPassword")} secureTextEntry={!showPassword} placeholderTextColor="#8E8E93" editable={!isLoading} />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}><Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color={errors.newPassword ? "#FF3B30" : "#8E8E93"} /></TouchableOpacity>
          </View>
          {errors.newPassword ? <Text style={styles.errorText}>{errors.newPassword}</Text> : <Text style={styles.helperText}>Use at least 8 characters with letters and numbers</Text>}
        </View>
        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Confirm Password</Text>
          <View style={[styles.inputContainer, getConfirmPasswordInputStatus() === "error" ? styles.inputError : getConfirmPasswordInputStatus() === "success" ? styles.inputSuccess : null]}>
            <Ionicons name="lock-closed-outline" size={20} color={errors.confirmPassword ? "#FF3B30" : "#8E8E93"} style={styles.inputIcon} />
            <TextInput style={styles.input} placeholder="Re-enter your password" value={confirmPassword} onChangeText={setConfirmPassword} onFocus={() => handleFieldFocus("confirmPassword")} secureTextEntry={!showConfirmPassword} placeholderTextColor="#8E8E93" editable={!isLoading} />
            <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}><Ionicons name={showConfirmPassword ? "eye-off" : "eye"} size={20} color={errors.confirmPassword ? "#FF3B30" : "#8E8E93"} /></TouchableOpacity>
          </View>
          {errors.confirmPassword ? <Text style={styles.errorText}>{errors.confirmPassword}</Text> : <Text style={styles.helperText}>Re-enter your password to confirm</Text>}
        </View>
        <TouchableOpacity style={[styles.primaryButton, isLoading && styles.disabledButton, (!newPassword.trim() || !confirmPassword.trim() || newPassword !== confirmPassword) && styles.disabledButton]} onPress={handleResetPassword} disabled={isLoading || !newPassword.trim() || !confirmPassword.trim() || newPassword !== confirmPassword}>
          {isLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.primaryButtonText}>Reset Password</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.backButton} onPress={handleBack} disabled={isLoading}>
          <Ionicons name="arrow-back" size={16} color="#6B7280" />
          <Text style={styles.backButtonText}>Back to Code Verification</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {step === "email" && renderEmailStep()}
        {step === "code" && renderCodeStep()}
        {step === "newPassword" && renderNewPasswordStep()}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scrollContainer: { flexGrow: 1, paddingBottom: 20 },
  animationContainer: { height: 200, marginTop: 40, alignItems: "center" },
  animation: { width: "100%", height: "100%" },
  header: { alignItems: "center", paddingHorizontal: 20, marginBottom: 24 },
  title: { fontSize: 28, fontFamily: "Inter", fontWeight: "700", color: "#1A1A1A", marginBottom: 8, textAlign: "center", letterSpacing: 0.15 },
  subtitle: { fontSize: 16, fontFamily: "Inter", fontWeight: "500", color: "#6B7280", textAlign: "center", lineHeight: 22 },
  emailHighlight: { fontSize: 16, fontFamily: "Inter", fontWeight: "600", color: "#1A1A1A", marginTop: 4 },
  form: { paddingHorizontal: 16 },
  inputWrapper: { marginBottom: 20 },
  inputLabel: { color: "#1A1A1A", fontSize: 15.2, fontFamily: "Inter", fontWeight: "600", marginBottom: 8, marginLeft: 4 },
  inputContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "#F8F8F8", borderWidth: 0.55, borderColor: "#0000008b", borderRadius: 8, paddingHorizontal: 12, height: 56 },
  inputError: { borderColor: "#FF3B30", backgroundColor: "#FFF5F5" },
  inputSuccess: { borderColor: "#4CAF50", backgroundColor: "#F5FFF5" },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 16, color: "#1A1A1A", fontFamily: "Inter", fontWeight: "500", paddingVertical: 0 },
  codeContainer: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  codeInput: { width: (width - 104) / 6, height: 56, borderWidth: 0.8, borderColor: "#0000008b", borderRadius: 8, backgroundColor: "#F8F8F8", textAlign: "center", fontSize: 18, fontFamily: "Inter", fontWeight: "600", color: "#1A1A1A" },
  codeInputFilled: { borderColor: "#FF6B35", backgroundColor: "#FFF5F0" },
  codeInputError: { borderColor: "#FF3B30", backgroundColor: "#FFF5F5" },
  codeInputComplete: { borderColor: "#4CAF50", backgroundColor: "#F0F9F0" },
  errorText: { color: "#FF3B30", fontSize: 13, fontFamily: "Inter", fontWeight: "500", marginTop: 6, marginLeft: 4 },
  helperText: { color: "#6B7280", fontSize: 13, fontFamily: "Inter", fontWeight: "400", marginTop: 4 },
  primaryButton: { backgroundColor: "#1A1A1A", borderRadius: 12, paddingVertical: 16, alignItems: "center", marginBottom: 16 },
  disabledButton: { opacity: 0.5 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 16, fontFamily: "Inter", fontWeight: "600" },
  resendContainer: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginBottom: 20, flexWrap: "wrap" },
  resendText: { color: "#6B7280", fontSize: 14, fontFamily: "Inter", fontWeight: "400", textAlign: "center" },
  resendLink: { color: "#1A1A1A", fontFamily: "Inter", fontSize: 14, fontWeight: "600" },
  resendLinkDisabled: { color: "#9CA3AF" },
  backButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 14, gap: 6, borderRadius: 8, borderWidth: 0.8, borderColor: "#0000000a", backgroundColor: "#FAFAFA", marginTop: 8 },
  backButtonText: { color: "#6B7280", fontSize: 14, fontFamily: "Inter", fontWeight: "400" },
});