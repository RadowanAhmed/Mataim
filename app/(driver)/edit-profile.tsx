// app/(driver)/edit-profile.tsx
import { DriverTouchable as TouchableOpacity } from "@/components/driver/DriverMotion";
import {
  useAuth
} from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import { goBackOrDriverFallback } from "@/components/driver/driverNavigation";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import React,
{
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity as RNTouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const db = supabase as any;

type DriverForm = {
  fullName: string;
  phone: string;
  vehicleType: string;
  vehiclePlate: string;
  licenseNumber: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleColor: string;
  vehicleYear: string;
  address: string;
};

const emptyForm: DriverForm = {
  fullName: "",
  phone: "",
  vehicleType: "",
  vehiclePlate: "",
  licenseNumber: "",
  vehicleMake: "",
  vehicleModel: "",
  vehicleColor: "",
  vehicleYear: "",
  address: "",
};

function FieldInput({
  icon,
  style,
  ...props
}: React.ComponentProps<typeof TextInput> & {
  icon: React.ComponentProps<typeof Ionicons>["name"];
}) {
  return (
    <View style={styles.fieldRow}>
      <Ionicons name={icon} size={18} color="#6B7280" />
      <TextInput {...props} placeholderTextColor="#9CA3AF" style={[styles.fieldInput, style]} />
    </View>
  );
}

function initials(name?: string | null) {
  return (
    name
      ?.split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "DR"
  );
}

export default function DriverEditProfileScreen() {
  const router = useRouter();
  const { user, refreshUserData } = useAuth() as any;
  const [form, setForm] = useState<DriverForm>(emptyForm);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [driverRecord, setDriverRecord] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);

  const displayName = form.fullName.trim() || user?.full_name || "Driver";
  const vehicleTitle = useMemo(() => {
    const parts = [form.vehicleMake, form.vehicleModel, form.vehicleColor].map((item) => item.trim()).filter(Boolean);
    return parts.length ? parts.join(" ") : form.vehicleType.trim() || "Vehicle details";
  }, [form.vehicleColor, form.vehicleMake, form.vehicleModel, form.vehicleType]);

  const setField = (key: keyof DriverForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const loadProfile = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const [{ data: baseUser }, { data: driver }] = await Promise.all([
        db.from("users").select("full_name, phone, email, profile_image_url").eq("id", user.id).maybeSingle(),
        db.from("delivery_users").select("*").eq("id", user.id).maybeSingle(),
      ]);

      const driverData = (driver || {}) as Record<string, any>;
      setDriverRecord(driverData);
      setProfileImage(baseUser?.profile_image_url || user?.profile_image_url || null);
      setForm({
        fullName: baseUser?.full_name || user?.full_name || "",
        phone: (baseUser?.phone || user?.phone || "").replace(/^\+?256/, ""),
        vehicleType: driverData.vehicle_type || "",
        vehiclePlate: driverData.vehicle_plate || "",
        licenseNumber: driverData.license_number || "",
        vehicleMake: driverData.vehicle_make || "",
        vehicleModel: driverData.vehicle_model || "",
        vehicleColor: driverData.vehicle_color || "",
        vehicleYear: driverData.vehicle_year ? String(driverData.vehicle_year) : "",
        address: driverData.address || "",
      });
    } catch (error) {
      console.error("Failed to load driver edit profile:", error);
      Alert.alert("Could not load profile", "Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  }, [user?.full_name, user?.id, user?.phone, user?.profile_image_url]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleGoBack = useCallback(() => {
    goBackOrDriverFallback(router, "/(driver)/profile", navigation);
  }, [navigation, router]);

  const saveProfile = async () => {
    if (!user?.id || saving) return;
    if (!form.fullName.trim()) {
      Alert.alert("Name required", "Enter the name customers and restaurants should see.");
      return;
    }

    try {
      setSaving(true);
      const now = new Date().toISOString();
      const year = Number(form.vehicleYear);
      const driverUpdates: Record<string, any> = {
        vehicle_type: form.vehicleType.trim(),
        vehicle_plate: form.vehiclePlate.trim(),
        license_number: form.licenseNumber.trim(),
        address: form.address.trim() || null,
        updated_at: now,
      };

      if ("vehicle_make" in driverRecord) driverUpdates.vehicle_make = form.vehicleMake.trim() || null;
      if ("vehicle_model" in driverRecord) driverUpdates.vehicle_model = form.vehicleModel.trim() || null;
      if ("vehicle_color" in driverRecord) driverUpdates.vehicle_color = form.vehicleColor.trim() || null;
      if ("vehicle_year" in driverRecord) driverUpdates.vehicle_year = Number.isFinite(year) && year > 0 ? year : null;

      const [{ error: userError }, { error: driverError }] = await Promise.all([
        db
          .from("users")
          .update({
            full_name: form.fullName.trim(),
            phone: form.phone.trim() ? `+256${form.phone.trim().replace(/^\+?256/, "")}` : null,
            updated_at: now,
          })
          .eq("id", user.id),
        db.from("delivery_users").update(driverUpdates).eq("id", user.id),
      ]);

      if (userError) throw userError;
      if (driverError) throw driverError;

      await refreshUserData?.();
      Alert.alert("Profile updated", "Your driver profile is ready.", [{ text: "Done", onPress: handleGoBack }]);
    } catch (error: any) {
      Alert.alert("Could not save", error?.message || "Please try again in a moment.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#111827" />
        <Text style={styles.loadingText}>Loading driver profile...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={handleGoBack}>
            <Ionicons name="chevron-back" size={23} color="#111827" />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.headerEyebrow}>Driver profile</Text>
            <Text style={styles.headerTitle}>Edit details</Text>
          </View>
          <TouchableOpacity style={[styles.saveTopButton, saving && styles.disabledButton]} onPress={saveProfile} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Ionicons name="checkmark" size={21} color="#fff" />}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.identityPanel}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarText}>{initials(displayName)}</Text>
              </View>
            )}
            <View style={styles.identityCopy}>
              <Text style={styles.identityName} numberOfLines={1}>{displayName}</Text>
              <Text style={styles.identityMeta} numberOfLines={1}>{vehicleTitle}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personal</Text>
            <FieldInput
              icon="person-outline"
              value={form.fullName}
              onChangeText={(value) => setField("fullName", value)}
              placeholder="Full name"
            />
            <View style={styles.fieldRow}>
              <View style={styles.phonePrefix}>
                <Text style={styles.phonePrefixFlag}>🇺🇬</Text>
                <Text style={styles.phonePrefixCode}>+256</Text>
              </View>
              <TextInput
                value={form.phone}
                onChangeText={(value) => setField("phone", value.replace(/[^\d]/g, "").slice(0, 9))}
                placeholder="7XXXXXXXX"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
                style={styles.fieldInput}
              />
            </View>
            <Text style={styles.hintText}>Email changes stay managed by account security.</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vehicle</Text>
            <View style={styles.splitRow}>
              <FieldInput
                icon="bicycle-outline"
                value={form.vehicleType}
                onChangeText={(value) => setField("vehicleType", value)}
                placeholder="Type"
                style={styles.splitInput}
              />
              <FieldInput
                icon="card-outline"
                value={form.vehiclePlate}
                onChangeText={(value) => setField("vehiclePlate", value)}
                placeholder="Plate"
                autoCapitalize="characters"
                style={styles.splitInput}
              />
            </View>
            <FieldInput
              icon="document-text-outline"
              value={form.licenseNumber}
              onChangeText={(value) => setField("licenseNumber", value)}
              placeholder="Driver license number"
              autoCapitalize="characters"
            />
            <View style={styles.splitRow}>
              <FieldInput
                icon="construct-outline"
                value={form.vehicleMake}
                onChangeText={(value) => setField("vehicleMake", value)}
                placeholder="Make"
                style={styles.splitInput}
              />
              <FieldInput
                icon="car-outline"
                value={form.vehicleModel}
                onChangeText={(value) => setField("vehicleModel", value)}
                placeholder="Model"
                style={styles.splitInput}
              />
            </View>
            <FieldInput
              icon="color-palette-outline"
              value={form.vehicleColor}
              onChangeText={(value) => setField("vehicleColor", value)}
              placeholder="Color"
            />
            <RNTouchableOpacity style={styles.yearButton} onPress={() => setShowYearPicker(true)} activeOpacity={0.85}>
              <Ionicons name="calendar-outline" size={18} color="#6B7280" />
              <Text style={styles.yearButtonText}>{form.vehicleYear || "Select vehicle year"}</Text>
            </RNTouchableOpacity>
            {showYearPicker ? (
              <DateTimePicker
                value={new Date(form.vehicleYear ? `${form.vehicleYear}-06-01` : "2020-06-01")}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                maximumDate={new Date()}
                minimumDate={new Date(1990, 0, 1)}
                onChange={(_event, date) => {
                  setShowYearPicker(Platform.OS === "ios");
                  if (date) setField("vehicleYear", String(date.getFullYear()));
                }}
              />
            ) : null}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Base area</Text>
            <FieldInput
              icon="location-outline"
              value={form.address}
              onChangeText={(value) => setField("address", value)}
              placeholder="Pickup city or operating area"
              style={styles.textArea}
              multiline
            />
          </View>

          <TouchableOpacity style={[styles.primaryButton, saving && styles.disabledButton]} onPress={saveProfile} disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color="#fff" />
                <Text style={styles.primaryText}>Save changes</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  keyboard: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  loadingText: {
    marginTop: 10,
    color: "#6B7280",
    fontFamily: "Inter",
    fontSize: 15,
    fontWeight: "500",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 13,
    paddingVertical: 14,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
  },
  headerEyebrow: {
    color: "#FF6B35",
    fontFamily: "Inter",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  headerTitle: {
    color: "#111827",
    fontFamily: "Inter",
    fontSize: 22,
    fontWeight: "700",
    marginTop: 2,
    letterSpacing: 0.2,
  },
  saveTopButton: {
    width: 40,
    height: 40,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
  },
  content: {
    padding: 13,
    paddingBottom: 112,
  },
  identityPanel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#111827",
    borderRadius: 8,
    padding: 14,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 8,
    backgroundColor: "#374151",
  },
  avatarFallback: {
    width: 58,
    height: 58,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF6B35",
  },
  avatarText: {
    color: "#FFFFFF",
    fontFamily: "Inter",
    fontSize: 18,
    fontWeight: "600",
  },
  identityCopy: {
    flex: 1,
  },
  identityName: {
    color: "#FFFFFF",
    fontFamily: "Inter",
    fontSize: 18,
    fontWeight: "600",
  },
  identityMeta: {
    color: "#D1D5DB",
    fontFamily: "Inter",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },
  section: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 0.8,
    borderColor: "#e5e7ebcb",
    padding: 12,
    marginTop: 14,
  },
  sectionTitle: {
    color: "#111827",
    fontFamily: "Inter",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
  },
  fieldRow: {
    minHeight: 52,
    borderRadius: 8,
    backgroundColor: "#F9FAFB",
    borderWidth: 0.4,
    borderColor: "#00000088",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 10,
    marginBottom: 10,
  },
  fieldInput: {
    flex: 1,
    color: "#111827",
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: "600",
    paddingVertical: 12,
  },
  phonePrefix: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingRight: 8,
    borderRightWidth: 0.8,
    borderRightColor: "#e5e7ebe2",
  },
  phonePrefixFlag: { fontSize: 18 },
  phonePrefixCode: { color: "#111827", fontFamily: "Inter", fontSize: 15, fontWeight: "700" },
  yearButton: {
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: "#000000",
    borderWidth: 0.8,
    borderColor: "#00000033",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  yearButtonText: { color: "#f1f1f1", fontFamily: "Inter", fontSize: 15, fontWeight: "600" },
  splitRow: {
    flexDirection: "row",
    gap: 10,
  },
  splitInput: {
    flex: 1,
  },
  textArea: {
    minHeight: 82,
    textAlignVertical: "top",
    paddingTop: 12,
  },
  hintText: {
    color: "#6B7280",
    fontFamily: "Inter",
    fontSize: 12,
    fontWeight: "600",
  },
  primaryButton: {
    height: 52,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#111827",
    marginTop: 16,
  },
  disabledButton: {
    opacity: 0.65,
  },
  primaryText: {
    color: "#FFFFFF",
    fontFamily: "Inter",
    fontSize: 15,
    fontWeight: "700",
  },
});
