import { logger } from "@/backend/utils/logger";
// app/(auth)/signup.tsx
import {
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { useLocalSearchParams, useRouter } from "expo-router";
import LottieView from "lottie-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../../backend/AuthContext";
import { NotificationService } from "../../backend/services/notificationService";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const MOBILE_USER_TYPES = ["customer", "driver"];
const RESTAURANT_WEB_MESSAGE =
  "Restaurant accounts are managed on the website. Please use the restaurant website to create or manage your restaurant account.";

// Options for dropdowns

// Country codes with flags - Uganda only
const COUNTRY_CODES = [
  { code: "+256", flag: "🇺🇬", name: "Uganda" },
];

export default function SignUpScreen() {
  const { userType } = useLocalSearchParams();
  const selectedUserType = Array.isArray(userType) ? userType[0] : userType;
  const router = useRouter();
  const { signUp } = useAuth();

  // Load your Google Fonts
  const [fontsLoaded] = useFonts({
    "Caprasimo-Bold": require("../../assets/fonts/Alan_Sans,Caprasimo/Caprasimo/Caprasimo-Regular.ttf"),
    "Poppins-SemiBold": require("../../assets/fonts/Alan_Sans,Caprasimo,Work_Sans/Alan_Sans/static/AlanSans-Medium.ttf"),
  });

  const [formData, setFormData] = useState({
    // Basic Info
    fullName: "",
    email: "",
    phone: "",
    countryCode: "+256",
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Modal States
  const [dropdownModal, setDropdownModal] = useState({
    visible: false,
    type: "",
    options: [],
    multiSelect: false,
  });
  useEffect(() => {
    if (!selectedUserType) {
      router.back();
      return;
    }

    if (!selectedUserType || !MOBILE_USER_TYPES.includes(selectedUserType)) {
      Alert.alert("Website Only", RESTAURANT_WEB_MESSAGE, [
        {
          text: "OK",
          onPress: () => router.replace("/(auth)/user-type"),
        },
      ]);
    }
  }, [selectedUserType, router]);

  // Enhanced email validation
  const validateEmail = (email) => {
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return re.test(email);
  };

  // Enhanced phone validation for Uganda
  const validatePhone = (phone) => {
    // Remove any non-digit characters
    const cleanPhone = phone.replace(/\D/g, "");

    // Uganda phone validation
    const length = 9;
    const pattern = /^[0-9]{9}$/;

    return cleanPhone.length === length && pattern.test(cleanPhone);
  };

  // Format phone number as user types (Uganda format)
  const formatPhoneNumber = (text) => {
    // Remove all non-digit characters
    const cleanText = text.replace(/\D/g, "");

    // Uganda format: XXX XXX XXX
    let formatted = cleanText;
    if (cleanText.length > 6) {
      formatted = `${cleanText.slice(0, 3)} ${cleanText.slice(
        3,
        6,
      )} ${cleanText.slice(6, 9)}`;
    } else if (cleanText.length > 3) {
      formatted = `${cleanText.slice(0, 3)} ${cleanText.slice(3)}`;
    }

    return formatted;
  };

  // Real-time validations
  useEffect(() => {
    const newErrors = { ...errors };

    // Email validation
    if (formData.email.trim() && !validateEmail(formData.email)) {
      newErrors.email =
        "Please enter a valid email address (e.g., name@domain.com)";
    } else if (formData.email.trim()) {
      delete newErrors.email;
    }

    // Password validation
    if (formData.password.trim() && formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    } else if (
      formData.password.trim() &&
      !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)
    ) {
      newErrors.password =
        "Password must contain uppercase, lowercase letters and numbers";
    } else if (formData.password.trim()) {
      delete newErrors.password;
    }

    // Confirm password validation
    if (
      formData.confirmPassword.trim() &&
      formData.password !== formData.confirmPassword
    ) {
      newErrors.confirmPassword = "Passwords do not match";
    } else if (formData.confirmPassword.trim()) {
      delete newErrors.confirmPassword;
    }

    // Phone validation
    if (
      formData.phone.trim() &&
      !validatePhone(formData.phone)
    ) {
      newErrors.phone = "Phone number must be 9 digits (e.g., 712345678)";
    } else if (formData.phone.trim()) {
      delete newErrors.phone;
    }

    setErrors(newErrors);
  }, [
    formData.email,
    formData.password,
    formData.confirmPassword,
    formData.phone,
  ]);

  // Handle phone input change with formatting
  const handlePhoneChange = (text) => {
    const formattedPhone = formatPhoneNumber(text);
    setFormData({ ...formData, phone: formattedPhone });
  };

  // Dropdown handlers
  const openDropdown = (type, options, multiSelect = false) => {
    setDropdownModal({ visible: true, type, options, multiSelect });
  };

  const closeDropdown = () => {
    setDropdownModal({
      visible: false,
      type: "",
      options: [],
      multiSelect: false,
    });
  };

  // Format selected options with icons
  const formatSelectedOptions = (options) => {
    if (!options || (Array.isArray(options) && options.length === 0)) return "";

    if (Array.isArray(options)) {
      return options
        .map((option) => {
          const optionObj = findOptionByValue(option);
          return optionObj ? `${optionObj.icon} ${optionObj.label}` : option;
        })
        .join(", ");
    }

    const optionObj = findOptionByValue(options);
    return optionObj
      ? `${optionObj.icon} ${optionObj.label}`
      : options.toString();
  };

  // Helper function to find option by value
  const findOptionByValue = (value) => {
    return null;
  };

  // Handle select option with object support
  const handleSelectOption = (option) => {
    const { type, multiSelect } = dropdownModal;

    if (multiSelect) {
      const currentValues = formData[type] || [];
      const optionValue = option.value || option;
      const newValues = currentValues.includes(optionValue)
        ? currentValues.filter((item) => item !== optionValue)
        : [...currentValues, optionValue];

      setFormData((prev) => ({ ...prev, [type]: newValues }));
    } else {
      const optionValue = option.value || option;
      setFormData((prev) => ({ ...prev, [type]: optionValue }));
      setDropdownModal({
        visible: false,
        type: "",
        options: [],
        multiSelect: false,
      });
    }
  };

  const getAnimationSource = () => {
    return require("../../assets/animations/sign up animation.json");
  };

  const getTitle = () => {
    switch (selectedUserType) {
      case "customer":
        return "Customer Sign Up";
      case "driver":
        return "Driver Sign Up";
      default:
        return "Sign Up";
    }
  };

  const validateForm = () => {
    let isValid = true;
    const newErrors = {};

    // Basic validations for all users
    if (!formData.fullName.trim()) {
      newErrors.fullName = "Full name is required";
      isValid = false;
    } else if (formData.fullName.trim().length < 2) {
      newErrors.fullName = "Full name must be at least 2 characters";
      isValid = false;
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
      isValid = false;
    } else if (!validateEmail(formData.email)) {
      newErrors.email =
        "Please enter a valid email address (e.g., name@domain.com)";
      isValid = false;
    }

    if (!formData.phone.trim()) {
      newErrors.phone = "Phone number is required";
      isValid = false;
    } else if (!validatePhone(formData.phone, formData.countryCode)) {
      const country = COUNTRY_CODES.find(
        (c) => c.code === formData.countryCode,
      );
      const rule =
        country?.code === "+971"
          ? "Phone number must be 9 digits starting with 5 (e.g., 501234567)"
          : "Phone number must be 9 digits (e.g., 712345678)";
      newErrors.phone = rule;
      isValid = false;
    }

    if (!formData.password.trim()) {
      newErrors.password = "Password is required";
      isValid = false;
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
      isValid = false;
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password =
        "Password must contain uppercase, lowercase letters and numbers";
      isValid = false;
    }

    if (!formData.confirmPassword.trim()) {
      newErrors.confirmPassword = "Please confirm your password";
      isValid = false;
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
      isValid = false;
    }


    // Enhanced type-specific validations
    // No driver-specific fields required during sign-up

    setErrors(newErrors);

    // Log validation result for debugging
    logger.debug("Form validation result:", { isValid, errors: newErrors });

    return isValid;
  };

  const handleSignUp = async () => {
    if (!selectedUserType || !MOBILE_USER_TYPES.includes(selectedUserType)) {
      Alert.alert("Website Only", RESTAURANT_WEB_MESSAGE, [
        { text: "OK", onPress: () => router.replace("/(auth)/user-type") },
      ]);
      return;
    }

    if (!validateForm()) {
      Alert.alert(
        "Validation Error",
        "Please fix the errors in the form before submitting.",
      );
      return;
    }

    setIsLoading(true);
    try {
      const fullPhoneNumber = `${formData.countryCode}${formData.phone.replace(
        /\D/g,
        "",
      )}`;

      const userData = {
        userType: selectedUserType,
        fullName: formData.fullName.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: fullPhoneNumber,
        countryCode: formData.countryCode,
        address: "",
        latitude: null,
        longitude: null,
        locationCode: null,

        ...(selectedUserType === "customer" && {
          dateOfBirth: null,
          gender: null,
        }),

        ...(selectedUserType === "driver" && {
          yearsOfExperience: null,
          availability: null,
          insuranceNumber: null,
        }),
      };

      logger.debug("🚀 Starting signup process...");
      const { error, data } = await signUp(
        formData.email.trim().toLowerCase(),
        formData.password,
        userData,
      );

      if (error) {
        console.error("❌ Sign up error:", error);
        Alert.alert(
          "Sign Up Error",
          error.message || "Something went wrong. Please try again.",
        );
        return;
      }

      logger.debug("✅ Auth account created successfully!");

      // Send welcome notification
      try {
        const userId = data?.user?.id;
        if (userId) {
          await NotificationService.sendWelcomeNotification(
            userId,
            formData.fullName,
          );
        }
      } catch (notifError) {
        logger.debug("Notification error (non-critical):", notifError);
      }

      // Check if user data is complete before navigation
      if (data?.user) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        Alert.alert(
          "Account Created Successfully! 🎉",
          `Welcome to Mataim, ${formData.fullName}! Your account has been created.`,
          [
            {
              text: "Get Started",
              onPress: () => {
                // Redirect based on mobile user type
                if (selectedUserType === "driver") {
                  router.replace("/(driver)/dashboard");
                } else {
                  router.replace("/(tabs)");
                }
              },
            },
          ],
        );
      } else {
        Alert.alert(
          "Account Created!",
          "Your account has been created. Please sign in to continue.",
          [
            {
              text: "Sign In",
              onPress: () => router.replace("/(auth)/signin"),
            },
          ],
        );
      }
    } catch (error: any) {
      console.error("💥 Unexpected error in handleSignUp:", error);
      Alert.alert(
        "Error",
        error.message || "Something went wrong. Please try again.",
        [{ text: "OK" }],
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Render Select Input Component
  const renderSelectInput = (
    label,
    fieldName,
    options,
    multiSelect = false,
    error = null,
  ) => (
    <>
      <Text style={styles.inputLabel}>{label}</Text>
      <TouchableOpacity
        style={[
          styles.inputContainer,
          styles.selectInput,
          error && styles.inputError,
        ]}
        onPress={() => openDropdown(fieldName, options, multiSelect)}
      >
        <Ionicons
          name="chevron-down-outline"
          size={20}
          color="#666"
          style={styles.inputIcon}
        />
        <Text
          style={[styles.input, !formData[fieldName] && styles.placeholderText]}
        >
          {formatSelectedOptions(formData[fieldName]) ||
            `Select ${label.toLowerCase()}`}
        </Text>
        <Ionicons name="list-outline" size={20} color="#666" />
      </TouchableOpacity>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </>
  );

  // Render Phone Input (Uganda only)
  const renderPhoneInput = () => {
    return (
      <>
        <Text style={styles.inputLabel}>Phone Number</Text>
        <View
          style={[styles.inputContainer, errors.phone && styles.inputError]}
        >
          <View style={styles.countrySelector}>
            <Text style={styles.flagText}>🇺🇬</Text>
          </View>

          <Text style={styles.countryCodeText}>+256</Text>

          <TextInput
            style={[styles.input, styles.phoneInput]}
            placeholder="712345678"
            value={formData.phone}
            onChangeText={handlePhoneChange}
            keyboardType="phone-pad"
            placeholderTextColor="#999"
            maxLength={11} // Including spaces
          />
        </View>
        {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
        <Text style={styles.phoneHint}>
          Enter 9-digit Uganda number
        </Text>
      </>
    );
  };

  const renderCustomerFields = () => null;

  const renderDriverFields = () => null;


  // Dropdown Modal Component
  const DropdownModal = () => (
    <Modal
      visible={dropdownModal.visible}
      animationType="slide"
      transparent={true}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.dropdownModalContainer}>
          <View style={styles.dropdownHeader}>
            <Text style={styles.dropdownTitle}>
              Select {dropdownModal.type}
              {dropdownModal.multiSelect && " (Multiple)"}
            </Text>
            <TouchableOpacity onPress={closeDropdown}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.dropdownList}>
            {dropdownModal.options.map((option, index) => {
              const optionValue = option.value || option;
              const optionLabel = option.label || option;
              const optionIcon = option.icon || "";
              const optionColor = option.color || "#666";

              const isSelected = dropdownModal.multiSelect
                ? formData[dropdownModal.type]?.includes(optionValue)
                : formData[dropdownModal.type] === optionValue;

              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.dropdownItem,
                    isSelected && styles.selectedItem,
                  ]}
                  onPress={() => handleSelectOption(option)}
                >
                  <View style={styles.optionContent}>
                    <Text style={[styles.optionIcon, { color: optionColor }]}>
                      {optionIcon}
                    </Text>
                    <Text
                      style={[
                        styles.dropdownItemText,
                        isSelected && styles.selectedItemText,
                      ]}
                    >
                      {optionLabel}
                    </Text>
                  </View>
                  {isSelected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color="#FF6B35"
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {dropdownModal.multiSelect && (
            <View style={styles.dropdownFooter}>
              <TouchableOpacity
                style={styles.doneButton}
                onPress={closeDropdown}
              >
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

  // Wait for fonts to load before rendering
  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Animation */}
        <View style={styles.animationContainer}>
          <LottieView
            source={getAnimationSource()}
            autoPlay
            loop
            style={styles.animation}
          />
        </View>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{getTitle()}</Text>
          <Text style={styles.subtitle}>
            Create your {selectedUserType} account to get started
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Basic Information */}
          {/* <Text style={styles.sectionTitle}>Basic Information</Text> */}

          <Text style={styles.inputLabel}>Full Name</Text>
          <View
            style={[
              styles.inputContainer,
              errors.fullName && styles.inputError,
            ]}
          >
            <Ionicons
              name="person-outline"
              size={20}
              color={errors.fullName ? "#FF3B30" : "#000000a6"}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Your full name"
              value={formData.fullName}
              onChangeText={(text) =>
                setFormData({ ...formData, fullName: text })
              }
              placeholderTextColor="#999"
              autoCapitalize="words"
            />
          </View>
          {errors.fullName && (
            <Text style={styles.errorText}>{errors.fullName}</Text>
          )}

          <Text style={styles.inputLabel}>Email</Text>
          <View
            style={[styles.inputContainer, errors.email && styles.inputError]}
          >
            <Ionicons
              name="mail-outline"
              size={20}
              color={errors.email ? "#FF3B30" : "#000000a6"}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Your email address"
              value={formData.email}
              onChangeText={(text) => setFormData({ ...formData, email: text })}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor="#999"
            />
          </View>
          {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

          {/* Phone Input with Country Code */}
          {renderPhoneInput()}

          <Text style={styles.inputLabel}>Password</Text>
          <View
            style={[
              styles.inputContainer,
              errors.password && styles.inputError,
            ]}
          >
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color={errors.password ? "#FF3B30" : "#000000a6"}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Minimum 8 characters with uppercase, lowercase and numbers"
              value={formData.password}
              onChangeText={(text) =>
                setFormData({ ...formData, password: text })
              }
              secureTextEntry={!showPassword}
              placeholderTextColor="#999"
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.passwordToggle}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={errors.password ? "#FF3B30" : "#000000a6"}
              />
            </TouchableOpacity>
          </View>
          {errors.password && (
            <Text style={styles.errorText}>{errors.password}</Text>
          )}

          <Text style={styles.inputLabel}>Confirm Password</Text>
          <View
            style={[
              styles.inputContainer,
              errors.confirmPassword && styles.inputError,
            ]}
          >
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color={errors.confirmPassword ? "#FF3B30" : "#000000a6"}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Confirm your password"
              value={formData.confirmPassword}
              onChangeText={(text) =>
                setFormData({ ...formData, confirmPassword: text })
              }
              secureTextEntry={!showConfirmPassword}
              placeholderTextColor="#999"
            />
            <TouchableOpacity
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              style={styles.passwordToggle}
            >
              <Ionicons
                name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={errors.confirmPassword ? "#FF3B30" : "#000000a6"}
              />
            </TouchableOpacity>
          </View>
          {errors.confirmPassword && (
            <Text style={styles.errorText}>{errors.confirmPassword}</Text>
          )}

          {/* Type-specific Fields */}
          {/* {selectedUserType === "customer" && renderCustomerFields()}
          {selectedUserType === "driver" && (
            <>
              <Text style={styles.sectionTitle}>Driver Information</Text>
              {renderDriverFields()}
            </>
          )} */}

          <View style={{ height: 20 }} />

          {/* Sign Up Button */}
          <TouchableOpacity
            style={[styles.signUpButton, isLoading && styles.disabledButton]}
            onPress={handleSignUp}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="person-add-outline" size={20} color="#fff" />
                <Text style={styles.signUpButtonText}>
                  {isLoading
                    ? "Creating Account..."
                    : `Create ${selectedUserType} Account`}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Sign In Link */}
          <View style={styles.signInContainer}>
            <Text style={styles.signInText}>Already have an account? </Text>
            <TouchableOpacity
              onPress={() => router.push("/(auth)/signin")}
              disabled={isLoading}
            >
              <Text style={styles.signInLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Modals */}
      <DropdownModal />
    </KeyboardAvoidingView>
  );
}

// app/(auth)/signup.tsx (Partial - showing key styles)
// I'll provide the styles part - the component logic remains the same

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 0, margin: 0 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
  loadingText: { marginTop: 10, fontSize: 16, color: "#666", fontFamily: "Inter", fontWeight: "500" },
  scrollContainer: { paddingVertical: 20, paddingBottom: 40, paddingHorizontal: 0 },
  animationContainer: { width: "100%", height: 180, marginBottom: 10, justifyContent: "center", alignItems: "center" },
  animation: { width: 150, height: 150 },
  header: { alignItems: "center", marginBottom: 20 },
  title: { fontSize: 28, fontFamily: "Inter", fontWeight: "700", color: "#1A1A1A", marginBottom: 8, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: "#6B7280", fontFamily: "Inter", fontWeight: "400" },
  form: { paddingHorizontal: 16 },
  sectionTitle: { color: "#1A1A1A", fontSize: 18, fontFamily: "Inter", fontWeight: "700", marginBottom: 16, marginTop: 20, borderBottomWidth: 2, borderBottomColor: "#1A1A1A", paddingBottom: 8 },
  inputLabel: { fontSize: 15.2, color: "#1A1A1A", fontFamily: "Inter", fontWeight: "600", marginBottom: 8 },
  inputContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "#f8f8f8", borderWidth: 0.55, borderColor: "#0000008b", borderRadius: 8, marginBottom: 4, paddingHorizontal: 14, paddingVertical: 4.5 },
  selectInput: { paddingVertical: 12 },
  inputError: { borderColor: "#FF3B30" },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 16, color: "#1A1A1A", fontFamily: "Inter", fontWeight: "600" },
  phoneInput: { flex: 1, fontSize: 16, color: "#1A1A1A", fontFamily: "Inter", fontWeight: "600", letterSpacing: 1 },
  placeholderText: { color: "#999" },
  passwordToggle: { padding: 4 },
  errorText: { color: "#FF3B30", fontSize: 12, fontFamily: "Inter", fontWeight: "500", marginBottom: 12, marginLeft: 4 },
  phoneHint: { fontSize: 13, color: "#6B7280", fontFamily: "Inter", fontWeight: "400", marginBottom: 12, marginLeft: 4 },
  countrySelector: { flexDirection: "row", alignItems: "center", marginRight: 8 },
  flagText: { fontSize: 20, marginRight: 4 },
  countryCodeText: { fontSize: 16, color: "#1A1A1A", fontFamily: "Inter", fontWeight: "600", marginRight: 8 },
  countryModalContainer: { backgroundColor: "#fff", overflow: "hidden", maxHeight: "30%", width: "100%", borderTopRightRadius: 16, borderTopLeftRadius: 16, justifyContent: "flex-end" },
  countryList: { maxHeight: 400 },
  countryItem: { flexDirection: "row", alignItems: "center", padding: 12, borderBottomWidth: 1, borderBottomColor: "#e1e1e1" },
  selectedCountryItem: { backgroundColor: "#FFF0E6" },
  countryFlag: { fontSize: 24, marginRight: 12 },
  countryInfo: { flex: 1 },
  countryName: { fontSize: 16, color: "#1A1A1A", fontFamily: "Inter", fontWeight: "600", marginBottom: 4 },
  countryDetails: { fontSize: 13, color: "#6B7280", fontFamily: "Inter", fontWeight: "400" },
  signUpButton: { flexDirection: "row", justifyContent: "center", alignItems: "center", backgroundColor: "#1A1A1A", borderRadius: 16, paddingVertical: 16, gap: 8, marginTop: 20, marginBottom: 14 },
  disabledButton: { backgroundColor: "#6B7280" },
  signUpButtonText: { color: "#FFFFFF", fontSize: 16, fontFamily: "Inter", fontWeight: "600" },
  signInContainer: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 8 },
  signInText: { fontSize: 14, color: "#6B7280", fontFamily: "Inter", fontWeight: "400" },
  signInLink: { fontSize: 14, color: "#1A1A1A", fontFamily: "Inter", fontWeight: "600" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end", maxHeight: "auto", width: "100%" },
  dropdownModalContainer: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "50%" },
  dropdownHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#e1e1e1" },
  dropdownTitle: { fontSize: 18, fontFamily: "Inter", fontWeight: "600", color: "#1A1A1A" },
  dropdownList: { maxHeight: "70%" },
  dropdownItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: "#e1e1e1" },
  optionContent: { flexDirection: "row", alignItems: "center", flex: 1 },
  optionIcon: { fontSize: 20, marginRight: 12, width: 30, textAlign: "center" },
  dropdownItemText: { fontSize: 16, color: "#1A1A1A", fontFamily: "Inter", fontWeight: "500", flex: 1 },
  selectedItem: { backgroundColor: "#FFF0E6" },
  selectedItemText: { color: "#1A1A1A" },
  dropdownFooter: { padding: 16, borderTopWidth: 1, borderTopColor: "#e1e1e1" },
  doneButton: { backgroundColor: "#1A1A1A", borderRadius: 12, padding: 16, alignItems: "center" },
  doneButtonText: { color: "#FFFFFF", fontSize: 16, fontFamily: "Inter", fontWeight: "600" },
});
