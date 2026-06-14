// app/(tabs)/profiles/edit.tsx
import { useAuth } from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  TouchableOpacity,
  View,
} from "react-native";
import { LazyMapView, LazyMarker, PROVIDER_GOOGLE } from "@/components/maps/LazyMapView";
import type { LatLng } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";

const CLOUDINARY_CLOUD_NAME = "dz1arsa91";
const CLOUDINARY_UPLOAD_PRESET = "mataim_profile_preset";
const db = supabase as any;

const DEFAULT_REGION = {
  latitude: 0.3476,
  longitude: 32.5825,
  latitudeDelta: 0.045,
  longitudeDelta: 0.045,
};

const COUNTRY_CODES = ["+256", "+971", "+1"];

type CustomerAddress = {
  id?: string;
  label?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

function initials(name?: string | null) {
  return (
    name
      ?.split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "CU"
  );
}

function splitPhone(phone?: string | null) {
  const raw = String(phone || "").trim();
  const matchedCode = COUNTRY_CODES.find((code) => raw.startsWith(code));
  if (matchedCode) return { code: matchedCode, number: raw.slice(matchedCode.length).replace(/\D/g, "") };
  return { code: "+256", number: raw.replace(/\D/g, "") };
}

function addressText(address: CustomerAddress) {
  return [address.address_line1, address.address_line2, address.city, address.country]
    .filter(Boolean)
    .join(", ");
}

export default function CustomerEditProfileScreen() {
  const router = useRouter();
  const { user, refreshUserData } = useAuth() as any;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+256");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [address, setAddress] = useState<CustomerAddress>({
    label: "Home",
    address_line1: "",
    city: "Kampala",
    country: "Uganda",
    latitude: DEFAULT_REGION.latitude,
    longitude: DEFAULT_REGION.longitude,
  });

  const mapPoint = useMemo<LatLng>(() => {
    const latitude = Number(address.latitude || DEFAULT_REGION.latitude);
    const longitude = Number(address.longitude || DEFAULT_REGION.longitude);
    return { latitude, longitude };
  }, [address.latitude, address.longitude]);

  const loadProfile = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const [{ data: userRow }, { data: profileRow }, { data: addressRow }] = await Promise.all([
        db.from("users").select("full_name,email,phone,country_code,profile_image_url").eq("id", user.id).maybeSingle(),
        db.from("user_profiles").select("bio").eq("user_id", user.id).maybeSingle(),
        db
          .from("addresses")
          .select("id,label,address_line1,address_line2,city,state,country,postal_code,latitude,longitude,is_default")
          .eq("user_id", user.id)
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const phoneParts = splitPhone(userRow?.phone || user?.phone);
      setFullName(userRow?.full_name || user?.full_name || "");
      setEmail(userRow?.email || user?.email || "");
      setCountryCode(userRow?.country_code || phoneParts.code || "+256");
      setPhone(phoneParts.number);
      setAvatarUrl(userRow?.profile_image_url || user?.profile_image_url || null);
      setBio(profileRow?.bio || "");

      if (addressRow) {
        setAddress({
          ...addressRow,
          latitude: Number(addressRow.latitude || DEFAULT_REGION.latitude),
          longitude: Number(addressRow.longitude || DEFAULT_REGION.longitude),
        });
      }
    } catch (error) {
      console.error("Customer profile load failed:", error);
      Alert.alert("Could not load profile", "Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  }, [user?.email, user?.full_name, user?.id, user?.phone, user?.profile_image_url]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleGoBack = useCallback(() => {
    router.back();
  }, [router]);

  const updateAddress = (patch: Partial<CustomerAddress>) => {
    setAddress((current) => ({ ...current, ...patch }));
  };

  const uploadAvatar = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!asset.base64) return;

    const formData = new FormData();
    formData.append("file", `data:${asset.mimeType || "image/jpeg"};base64,${asset.base64}` as any);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    formData.append("folder", "mataim/profiles");

    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
      method: "POST",
      body: formData,
    });
    const result = await response.json();
    if (!response.ok || !result.secure_url) throw new Error(result.error?.message || "Avatar upload failed");
    setAvatarUrl(result.secure_url);
  };

  const pickAvatar = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Allow photo access to update your avatar.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"] as any,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.78,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        setUploading(true);
        await uploadAvatar(result.assets[0]);
      }
    } catch (error: any) {
      Alert.alert("Avatar not updated", error?.message || "Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const useCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Location permission", "Allow location to pick your delivery address on the map.");
        return;
      }

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const point = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      updateAddress(point);

      const [place] = await Location.reverseGeocodeAsync(point);
      if (place) {
        updateAddress({
          address_line1: [place.streetNumber, place.street].filter(Boolean).join(" ") || place.name || address.address_line1,
          city: place.city || place.district || address.city,
          state: place.region || address.state,
          country: place.country || address.country,
          postal_code: place.postalCode || address.postal_code,
        });
      }
    } catch (error) {
      console.error("Location picker failed:", error);
      Alert.alert("Location unavailable", "Move the map pin manually or try again.");
    }
  };

  const saveProfile = async () => {
    if (!user?.id || saving) return;
    if (!fullName.trim()) {
      Alert.alert("Name required", "Enter your full name.");
      return;
    }

    try {
      setSaving(true);
      const now = new Date().toISOString();
      const normalizedPhone = phone.trim() ? `${countryCode}${phone.replace(/\D/g, "")}` : null;

      const { error: userError } = await db
        .from("users")
        .update({
          full_name: fullName.trim(),
          phone: normalizedPhone,
          country_code: countryCode,
          profile_image_url: avatarUrl,
          updated_at: now,
        })
        .eq("id", user.id);

      if (userError) throw userError;

      await db.from("user_profiles").upsert(
        {
          user_id: user.id,
          bio: bio.trim() || null,
          updated_at: now,
        },
        { onConflict: "user_id" },
      );

      const addressPayload = {
        user_id: user.id,
        label: address.label || "Home",
        address_line1: address.address_line1?.trim() || "Pinned location",
        address_line2: address.address_line2?.trim() || null,
        city: address.city?.trim() || "Kampala",
        state: address.state?.trim() || null,
        country: address.country?.trim() || "Uganda",
        postal_code: address.postal_code?.trim() || null,
        latitude: mapPoint.latitude,
        longitude: mapPoint.longitude,
        is_default: true,
        updated_at: now,
      };

      if (address.id) {
        const { error } = await db.from("addresses").update(addressPayload).eq("id", address.id).eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await db.from("addresses").insert({ ...addressPayload, created_at: now });
        if (error) throw error;
      }

      await refreshUserData?.();
      Alert.alert("Profile saved", "Your account details are up to date.", [{ text: "Done", onPress: handleGoBack }]);
    } catch (error: any) {
      Alert.alert("Could not save", error?.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.centerScreen}>
        <Ionicons name="person-circle-outline" size={54} color="#9CA3AF" />
        <Text style={styles.centerTitle}>Sign in required</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace("/(auth)/signin" as any)}>
          <Text style={styles.primaryText}>Sign in</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.centerScreen}>
        <ActivityIndicator color="#111827" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={handleGoBack}>
            <Ionicons name="chevron-back" size={22} color="#111827" />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.headerEyebrow}>Account</Text>
            <Text style={styles.headerTitle}>Edit profile</Text>
          </View>
          <TouchableOpacity style={[styles.saveTopButton, saving && styles.disabledButton]} onPress={saveProfile} disabled={saving}>
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="checkmark" size={21} color="#FFFFFF" />}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.heroPanel}>
            <TouchableOpacity style={styles.avatarButton} onPress={pickAvatar} activeOpacity={0.85}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarText}>{initials(fullName)}</Text>
                </View>
              )}
              <View style={styles.avatarEdit}>
                {uploading ? <ActivityIndicator size="small" color="#111827" /> : <Ionicons name="camera" size={16} color="#111827" />}
              </View>
            </TouchableOpacity>
            <View style={styles.heroCopy}>
              <Text style={styles.heroName} numberOfLines={1}>{fullName || "Customer"}</Text>
              <Text style={styles.heroMeta} numberOfLines={1}>{email || "Email unavailable"}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personal details</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="person-outline" size={18} color="#6B7280" />
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="Full name"
                placeholderTextColor="#9CA3AF"
                style={styles.input}
              />
            </View>

            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={18} color="#6B7280" />
              <TextInput
                value={email}
                editable={false}
                placeholder="Email"
                placeholderTextColor="#9CA3AF"
                style={[styles.input, styles.disabledInput]}
              />
            </View>

            <View style={styles.phoneRow}>
              <View style={styles.countryWrap}>
                {COUNTRY_CODES.map((code) => (
                  <TouchableOpacity
                    key={code}
                    style={[styles.countryChip, countryCode === code && styles.countryChipActive]}
                    onPress={() => setCountryCode(code)}
                  >
                    <Text style={[styles.countryText, countryCode === code && styles.countryTextActive]}>{code}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={[styles.inputWrap, styles.phoneInputWrap]}>
                <Ionicons name="call-outline" size={18} color="#6B7280" />
                <TextInput
                  value={phone}
                  onChangeText={(value) => setPhone(value.replace(/[^\d]/g, ""))}
                  placeholder="Phone number"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad"
                  style={styles.input}
                />
              </View>
            </View>

            <View style={[styles.inputWrap, styles.bioWrap]}>
              <Ionicons name="reader-outline" size={18} color="#6B7280" />
              <TextInput
                value={bio}
                onChangeText={setBio}
                placeholder="Short note for restaurants and support"
                placeholderTextColor="#9CA3AF"
                style={[styles.input, styles.bioInput]}
                multiline
              />
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Delivery address</Text>
                <Text style={styles.sectionSubtitle}>Tap the map to move your default delivery pin.</Text>
              </View>
              <TouchableOpacity style={styles.locationButton} onPress={useCurrentLocation}>
                <Ionicons name="locate-outline" size={17} color="#111827" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputWrap}>
              <Ionicons name="home-outline" size={18} color="#6B7280" />
              <TextInput
                value={address.label || ""}
                onChangeText={(value) => updateAddress({ label: value })}
                placeholder="Label, e.g. Home"
                placeholderTextColor="#9CA3AF"
                style={styles.input}
              />
            </View>

            <View style={styles.inputWrap}>
              <Ionicons name="location-outline" size={18} color="#6B7280" />
              <TextInput
                value={address.address_line1 || ""}
                onChangeText={(value) => updateAddress({ address_line1: value })}
                placeholder="Street or building"
                placeholderTextColor="#9CA3AF"
                style={styles.input}
              />
            </View>

            <View style={styles.splitRow}>
              <View style={[styles.inputWrap, styles.splitInput]}>
                <TextInput
                  value={address.city || ""}
                  onChangeText={(value) => updateAddress({ city: value })}
                  placeholder="City"
                  placeholderTextColor="#9CA3AF"
                  style={styles.input}
                />
              </View>
              <View style={[styles.inputWrap, styles.splitInput]}>
                <TextInput
                  value={address.country || ""}
                  onChangeText={(value) => updateAddress({ country: value })}
                  placeholder="Country"
                  placeholderTextColor="#9CA3AF"
                  style={styles.input}
                />
              </View>
            </View>

            <View style={styles.mapShell}>
              <LazyMapView
                provider={PROVIDER_GOOGLE}
                style={styles.map}
                initialRegion={{ ...DEFAULT_REGION, ...mapPoint }}
                region={{ ...DEFAULT_REGION, ...mapPoint }}
                onPress={(event) => updateAddress(event.nativeEvent.coordinate)}
              >
                <LazyMarker coordinate={mapPoint}>
                  <View style={styles.mapMarker}>
                    <Ionicons name="home" size={18} color="#FFFFFF" />
                  </View>
                </LazyMarker>
              </LazyMapView>
            </View>

            <View style={styles.addressPreview}>
              <Ionicons name="navigate-outline" size={16} color="#10B981" />
              <Text style={styles.addressPreviewText} numberOfLines={2}>
                {addressText(address) || "Pinned delivery location"}
              </Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleGoBack} disabled={saving}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.primaryButton, styles.actionPrimaryButton, saving && styles.disabledButton]} onPress={saveProfile} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryText}>Save profile</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
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
  centerScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#F8FAFC",
  },
  centerTitle: {
    color: "#111827",
    fontFamily: "Inter",
    fontSize: 18,
    fontWeight: "500",
    marginTop: 12,
  },
  loadingText: {
    color: "#6B7280",
    fontFamily: "Inter",
    fontSize: 12,
    fontWeight: "400",
    marginTop: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  headerCopy: {
    flex: 1,
  },
  headerEyebrow: {
    color: "#FF6B35",
    fontFamily: "Inter",
    fontSize: 11,
    fontWeight: "500",
    textTransform: "uppercase",
  },
  headerTitle: {
    color: "#111827",
    fontFamily: "AlanSans",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 2,
    letterSpacing: 0.3,
  },
  saveTopButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
  },
  content: {
    padding: 14,
    paddingBottom: 116,
  },
  heroPanel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
    backgroundColor: "#111827",
    borderRadius: 8,
    padding: 12,
  },
  avatarButton: {
    position: "relative",
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#374151",
  },
  avatarFallback: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF6B35",
  },
  avatarText: {
    color: "#FFFFFF",
    fontFamily: "Inter",
    fontSize: 18,
    fontWeight: "500",
    letterSpacing: 0.3,
  },
  avatarEdit: {
    position: "absolute",
    right: -6,
    bottom: -6,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  heroCopy: {
    flex: 1,
  },
  heroName: {
    color: "#FFFFFF",
    fontFamily: "Inter",
    fontSize: 19,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  heroMeta: {
    color: "#D1D5DB",
    fontFamily: "Inter",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },
  section: {
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 10,
    marginTop: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10,
  },
  sectionTitle: {
    color: "#111827",
    fontFamily: "AlanSans",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  sectionSubtitle: {
    color: "#6B7280",
    fontFamily: "Inter",
    fontSize: 12.8,
    fontWeight: "400",
    letterSpacing: 0.3,
    marginTop: -4,
    marginBottom: 6,
  },
  inputWrap: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderRadius: 8,
    backgroundColor: "#F9FAFB",
    borderWidth: 1.2,
    borderColor: "#E5E7EB",
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  input: {
    flex: 1,
    color: "#111827",
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: "400",
    paddingVertical: 0,
    letterSpacing: 0.3,
  },
  disabledInput: {
    color: "#6B7280",
  },
  phoneRow: {
    gap: 10,
  },
  countryWrap: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  countryChip: {
    minHeight: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    backgroundColor: "#F3F4F6",
  },
  countryChipActive: {
    backgroundColor: "#111827",
  },
  countryText: {
    color: "#374151",
    fontFamily: "Inter",
    fontSize: 12,
    fontWeight: "500",
  },
  countryTextActive: {
    color: "#FFFFFF",
  },
  phoneInputWrap: {
    flex: 1,
  },
  bioWrap: {
    alignItems: "flex-start",
    paddingTop: 12,
  },
  bioInput: {
    minHeight: 74,
    textAlignVertical: "top",
  },
  locationButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
  },
  splitRow: {
    flexDirection: "row",
    gap: 10,
  },
  splitInput: {
    flex: 1,
  },
  mapShell: {
    height: 210,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#E5E7EB",
  },
  map: {
    flex: 1,
  },
  mapMarker: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  addressPreview: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 8,
    backgroundColor: "#ECFDF5",
    padding: 11,
    marginTop: 10,
  },
  addressPreviewText: {
    flex: 1,
    color: "#047857",
    fontFamily: "Inter",
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 17,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  cancelButton: {
    flex: 0.8,
    minHeight: 52,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 16,
  },
  cancelText: {
    color: "#111827",
    fontFamily: "Inter",
    fontSize: 15,
    fontWeight: "500",
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#FF6B35",
    paddingHorizontal: 16,
  },
  actionPrimaryButton: {
    flex: 1.2,
  },
  disabledButton: {
    opacity: 0.65,
  },
  primaryText: {
    color: "#FFFFFF",
    fontFamily: "Inter",
    fontSize: 15,
    fontWeight: "500",
  },
});
