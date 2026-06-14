// app/(driver)/bank-account.tsx
import { DriverTouchable as TouchableOpacity } from "@/components/driver/DriverMotion";
import {
  useAuth
} from "@/backend/AuthContext";
import { supabase } from "@/backend/supabase";
import { goBackOrDriverFallback } from "@/components/driver/driverNavigation";
import { Ionicons } from "@expo/vector-icons";
import {
  useRouter
} from "expo-router";
import React,
{
  useCallback,
  useState,
  useRef,
  useEffect
} from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  View,
  Image,
  Modal,
} from "react-native";
import AppText from "../components/common/AppText";
import { SafeAreaView } from "react-native-safe-area-context";
import * as bankVerificationService from "@/backend/services/bankVerificationService";
import { ImagePickerAsset } from "expo-image-picker";

const db = supabase as any;

type SavedBank = {
  id: string;
  bank_name?: string | null;
  account_holder_name?: string | null;
  account_number_masked?: string | null;
  routing_number_masked?: string | null;
  verification_status?: string | null;
  verification_reason?: string | null;
  id_document_url?: string | null;
  bank_proof_url?: string | null;
  verified_at?: string | null;
};

const maskAccount = (value: string) => {
  const cleaned = value.replace(/\D/g, "");
  if (!cleaned) return "";
  return `****${cleaned.slice(-4)}`;
};

export default function DriverBankAccountScreen() {
  const router = useRouter();
  const { user } = useAuth() as any;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState<"id" | "bank_proof" | null>(null);
  const [savedBank, setSavedBank] = useState<SavedBank | null>(null);
  const [accountName, setAccountName] = useState(user?.full_name || "");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [branchName, setBranchName] = useState("");
  const [idDocument, setIdDocument] = useState<ImagePickerAsset | null>(null);
  const [bankProofDocument, setBankProofDocument] = useState<ImagePickerAsset | null>(null);
  const [showDocumentMenu, setShowDocumentMenu] = useState<"id" | "bank_proof" | null>(null);
  const [previewingDoc, setPreviewingDoc] = useState<{ type: "id" | "bank_proof", uri: string } | null>(null);

  const loadBank = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const { data } = await db
        .from("bank_accounts")
        .select("*")
        .eq("user_id", user.id)
        .eq("user_type", "driver")
        .eq("is_active", true)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const bank = (data as SavedBank | null) || null;
      setSavedBank(bank);
      setAccountName(bank?.account_holder_name || user?.full_name || "");
      setBankName(bank?.bank_name || "");
      setBranchName(bank?.routing_number_masked || "");

      // Reset documents since we're loading saved account
      setIdDocument(null);
      setBankProofDocument(null);
    } finally {
      setLoading(false);
    }
  }, [user?.full_name, user?.id]);

  useEffect(() => {
    loadBank();
  }, [loadBank]);

  const handlePickDocument = async (type: "camera" | "gallery", docType: "id" | "bank_proof") => {
    try {
      setShowDocumentMenu(null);
      const result = await bankVerificationService.pickBankDocument(type);

      if (result) {
        if (docType === "id") {
          setIdDocument(result);
        } else {
          setBankProofDocument(result);
        }
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to pick document");
    }
  };

  const validate = () => {
    const cleanedAccount = accountNumber.replace(/\D/g, "");

    if (!accountName.trim()) return "Enter the account holder name.";
    if (!bankName.trim()) return "Enter the bank name.";
    if (cleanedAccount.length < 7) return "Enter the full bank account number.";
    if (!idDocument && !savedBank?.id_document_url) return "ID document is required.";
    if (!bankProofDocument && !savedBank?.bank_proof_url) return "Bank proof document is required.";
    return null;
  };

  const saveBankAccount = async () => {
    if (!user?.id || saving) return;

    const problem = validate();
    if (problem) {
      Alert.alert("Check bank details", problem);
      return;
    }

    try {
      setSaving(true);
      const now = new Date().toISOString();
      const cleanedAccount = accountNumber.replace(/\D/g, "");

      // Upload documents if new ones are selected
      let idDocUrl = savedBank?.id_document_url || null;
      let bankProofUrl = savedBank?.bank_proof_url || null;

      if (idDocument) {
        setUploadingDocument("id");
        idDocUrl = await bankVerificationService.uploadBankDocument(
          user.id,
          "id",
          idDocument.uri,
          idDocument.fileName || "id-document.jpg"
        );
      }

      if (bankProofDocument) {
        setUploadingDocument("bank_proof");
        bankProofUrl = await bankVerificationService.uploadBankDocument(
          user.id,
          "bank_proof",
          bankProofDocument.uri,
          bankProofDocument.fileName || "bank-proof.jpg"
        );
      }

      setUploadingDocument(null);

      const bankData = {
        bank_name: bankName.trim(),
        account_holder_name: accountName.trim(),
        account_number_masked: maskAccount(cleanedAccount),
        routing_number_masked: branchName.trim() || null,
        id_document_url: idDocUrl,
        bank_proof_url: bankProofUrl,
        verification_status: "pending",
      };

      if (savedBank?.id) {
        // Update existing bank account
        const { error } = await db
          .from("bank_accounts")
          .update({ ...bankData, updated_at: now })
          .eq("id", savedBank.id)
          .eq("user_id", user.id);

        if (error) throw error;
      } else {
        // Create new bank account
        await db
          .from("bank_accounts")
          .update({ is_default: false, updated_at: now })
          .eq("user_id", user.id)
          .eq("user_type", "driver");

        const { error } = await db.from("bank_accounts").insert({
          user_id: user.id,
          user_type: "driver",
          ...bankData,
          is_default: true,
          is_active: true,
          created_at: now,
          updated_at: now,
        });

        if (error) throw error;
      }

      // Reset form
      setIdDocument(null);
      setBankProofDocument(null);

      Alert.alert(
        "Bank account submitted",
        "Your bank account documents have been submitted for verification. You'll receive a notification once they're reviewed.",
        [
          { text: "Done", onPress: () => goBackOrDriverFallback(router, "/(driver)/withdraw", navigation) },
        ]
      );
    } catch (error: any) {
      Alert.alert("Could not save", error?.message || "Try again in a moment.");
    } finally {
      setSaving(false);
      setUploadingDocument(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton} onPress={() => goBackOrDriverFallback(router, "/(driver)/withdraw", navigation)}>
            <Ionicons name="chevron-back" size={22} color="#111827" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <AppText style={styles.headerEyebrow} weight="medium">Verification</AppText>
            <AppText style={styles.headerTitle} weight="medium">Bank account</AppText>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Verification Status Card */}
          {savedBank && savedBank.verification_status && (
            <VerificationStatusCard
              status={savedBank.verification_status as any}
              reason={savedBank.verification_reason}
              verifiedAt={savedBank.verified_at}
            />
          )}

          <View style={styles.infoCard}>
            <View style={styles.infoIcon}>
              <Ionicons name="shield-checkmark-outline" size={22} color="#111827" />
            </View>
            <View style={{ flex: 1 }}>
              <AppText style={styles.infoTitle} weight="medium">Secure verification</AppText>
              <AppText style={styles.infoText} weight="regular">
                Upload your ID and bank proof for verification. We keep your information encrypted and secure.
              </AppText>
            </View>
          </View>

          {savedBank && savedBank.verification_status === "approved" ? (
            <View style={styles.approvedCard}>
              <View style={styles.approvedIcon}>
                <Ionicons name="checkmark-circle" size={24} color="#10B981" />
              </View>
              <View style={{ flex: 1 }}>
                <AppText style={styles.approvedTitle} weight="medium">Account verified!</AppText>
                <AppText style={styles.approvedMeta} weight="regular">
                  {savedBank.bank_name} • {savedBank.account_number_masked}
                </AppText>
              </View>
            </View>
          ) : savedBank ? (
            <View style={styles.savedCard}>
              <AppText style={styles.savedLabel} weight="regular">Current account</AppText>
              <AppText style={styles.savedTitle} weight="medium">{savedBank.bank_name || "Bank account"}</AppText>
              <AppText style={styles.savedMeta} weight="regular">
                {savedBank.account_holder_name || "Account holder"} - {savedBank.account_number_masked || "Saved"}
              </AppText>
            </View>
          ) : null}

          <View style={styles.formCard}>
            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color="#FF6B35" />
                <AppText style={styles.loadingText} weight="regular">Loading bank details</AppText>
              </View>
            ) : (
              <>
                <AppText style={styles.sectionTitle} weight="medium">{savedBank ? "Update account" : "Add account"}</AppText>
                <AppText style={styles.sectionSubtitle} weight="regular">
                  Enter your bank details and upload verification documents.
                </AppText>

                <TextInput
                  value={accountName}
                  onChangeText={setAccountName}
                  placeholder="Account holder name"
                  placeholderTextColor="#9CA3AF"
                  style={styles.input}
                />

                <View style={styles.inputIconWrap}>
                  <Ionicons name="business-outline" size={17} color="#6B7280" />
                  <TextInput
                    value={bankName}
                    onChangeText={setBankName}
                    placeholder="Bank name"
                    placeholderTextColor="#9CA3AF"
                    style={styles.inputWithIcon}
                  />
                </View>

                <View style={styles.inputIconWrap}>
                  <Ionicons name="card-outline" size={17} color="#6B7280" />
                  <TextInput
                    value={accountNumber}
                    onChangeText={setAccountNumber}
                    placeholder={savedBank?.account_number_masked || "Account number"}
                    placeholderTextColor="#9CA3AF"
                    keyboardType="number-pad"
                    style={styles.inputWithIcon}
                  />
                </View>

                <View style={styles.inputIconWrap}>
                  <Ionicons name="location-outline" size={17} color="#6B7280" />
                  <TextInput
                    value={branchName}
                    onChangeText={setBranchName}
                    placeholder="Branch or routing code (optional)"
                    placeholderTextColor="#9CA3AF"
                    style={styles.inputWithIcon}
                  />
                </View>

                {/* Document Upload Section */}
                <View style={styles.documentsSection}>
                  <AppText style={styles.documentSectionTitle} weight="medium">Verification documents</AppText>
                  <AppText style={styles.documentSectionSubtitle} weight="regular">
                    Upload clear photos of your ID and bank proof to verify your account.
                  </AppText>

                  {/* ID Document Upload */}
                  <DocumentUploadCard
                    type="id"
                    title="National ID"
                    description="Upload a clear photo of your national ID"
                    document={idDocument}
                    savedUrl={savedBank?.id_document_url}
                    onPress={() => setShowDocumentMenu("id")}
                    onPreview={() => {
                      if (idDocument?.uri) setPreviewingDoc({ type: "id", uri: idDocument.uri });
                      else if (savedBank?.id_document_url) setPreviewingDoc({ type: "id", uri: savedBank.id_document_url });
                    }}
                    onRemove={() => setIdDocument(null)}
                    isUploading={uploadingDocument === "id"}
                  />

                  {/* Bank Proof Document Upload */}
                  <DocumentUploadCard
                    type="bank_proof"
                    title="Bank Account Proof"
                    description="Upload a bank statement or passbook showing your account"
                    document={bankProofDocument}
                    savedUrl={savedBank?.bank_proof_url}
                    onPress={() => setShowDocumentMenu("bank_proof")}
                    onPreview={() => {
                      if (bankProofDocument?.uri) setPreviewingDoc({ type: "bank_proof", uri: bankProofDocument.uri });
                      else if (savedBank?.bank_proof_url) setPreviewingDoc({ type: "bank_proof", uri: savedBank.bank_proof_url });
                    }}
                    onRemove={() => setBankProofDocument(null)}
                    isUploading={uploadingDocument === "bank_proof"}
                  />
                </View>
              </>
            )}
          </View>

          <TouchableOpacity
            style={[styles.saveButton, (saving || uploadingDocument) && styles.saveButtonDisabled]}
            onPress={saveBankAccount}
            disabled={saving || loading || !!uploadingDocument}
          >
            {saving || uploadingDocument ? (
              <>
                <ActivityIndicator color="#fff" />
                <AppText style={styles.saveText} weight="medium">
                  {uploadingDocument ? "Uploading documents..." : "Saving account..."}
                </AppText>
              </>
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={19} color="#fff" />
                <AppText style={styles.saveText} weight="medium">Submit for verification</AppText>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>

        {/* Document Upload Menu */}
        <DocumentPickerMenu
          visible={!!showDocumentMenu}
          docType={showDocumentMenu}
          onCamera={() => handlePickDocument("camera", showDocumentMenu!)}
          onGallery={() => handlePickDocument("gallery", showDocumentMenu!)}
          onClose={() => setShowDocumentMenu(null)}
        />

        {/* Document Preview Modal */}
        <DocumentPreviewModal
          visible={!!previewingDoc}
          document={previewingDoc}
          onClose={() => setPreviewingDoc(null)}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Helper Components

const VerificationStatusCard = ({ status, reason, verifiedAt }: any) => {
  const statusDetails = bankVerificationService.getVerificationStatusDetails(status, reason);

  return (
    <View style={[styles.statusCard, { backgroundColor: statusDetails.color + "15", borderColor: statusDetails.color + "30" }]}>
      <View style={[styles.statusIconBox, { backgroundColor: statusDetails.color + "20" }]}>
        <Ionicons name={statusDetails.icon as any} size={24} color={statusDetails.color} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText style={[styles.statusTitle, { color: statusDetails.color }]} weight="semibold">
          {statusDetails.label}
        </AppText>
        <AppText style={styles.statusDescription} weight="regular">
          {statusDetails.description}
        </AppText>
        {verifiedAt && (
          <AppText style={styles.statusDate} weight="regular">
            Verified on {new Date(verifiedAt).toLocaleDateString()}
          </AppText>
        )}
      </View>
    </View>
  );
};

const DocumentUploadCard = ({
  type,
  title,
  description,
  document,
  savedUrl,
  onPress,
  onPreview,
  onRemove,
  isUploading,
}: any) => {
  const isUploaded = !!(document || savedUrl);

  return (
    <View style={styles.documentCard}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <View>
          <AppText style={styles.documentTitle} weight="medium">{title}</AppText>
          <AppText style={styles.documentDescription} weight="regular">{description}</AppText>
        </View>
      </View>

      {isUploaded ? (
        <View style={styles.documentPreviewBox}>
          {document?.uri || savedUrl ? (
            <Image
              source={{ uri: document?.uri || savedUrl }}
              style={styles.documentPreviewImage}
            />
          ) : null}
          <View style={styles.documentPreviewOverlay}>
            <TouchableOpacity style={styles.previewButton} onPress={onPreview}>
              <Ionicons name="eye-outline" size={18} color="#fff" />
              <AppText style={styles.previewButtonText} weight="medium">Preview</AppText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.removeButton, isUploading && { opacity: 0.5 }]}
              onPress={onRemove}
              disabled={isUploading}
            >
              <Ionicons name="trash-outline" size={18} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.uploadButton, isUploading && { opacity: 0.6 }]}
          onPress={onPress}
          disabled={isUploading}
        >
          {isUploading ? (
            <>
              <ActivityIndicator color="#FF6B35" size="small" />
              <AppText style={styles.uploadButtonText} weight="medium">Uploading...</AppText>
            </>
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={22} color="#FF6B35" />
              <AppText style={styles.uploadButtonText} weight="medium">Tap to upload</AppText>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};

const DocumentPickerMenu = ({ visible, docType, onCamera, onGallery, onClose }: any) => {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity
        style={styles.menuOverlay}
        onPress={onClose}
        activeOpacity={1}
      >
        <View style={styles.menuBottom}>
          <View style={styles.menuHandle} />
          <AppText style={styles.menuTitle} weight="semibold">
            Choose upload method
          </AppText>

          <TouchableOpacity style={styles.menuOption} onPress={onCamera}>
            <View style={styles.menuOptionIcon}>
              <Ionicons name="camera-outline" size={22} color="#FF6B35" />
            </View>
            <AppText style={styles.menuOptionText} weight="medium">Take a photo</AppText>
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuOption} onPress={onGallery}>
            <View style={styles.menuOptionIcon}>
              <Ionicons name="image-outline" size={22} color="#FF6B35" />
            </View>
            <AppText style={styles.menuOptionText} weight="medium">Choose from gallery</AppText>
            <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuCancel} onPress={onClose}>
            <AppText style={styles.menuCancelText} weight="medium">Cancel</AppText>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const DocumentPreviewModal = ({ visible, document, onClose }: any) => {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.previewOverlay}>
        <TouchableOpacity style={styles.previewClose} onPress={onClose}>
          <Ionicons name="close-circle" size={32} color="#fff" />
        </TouchableOpacity>
        {document?.uri && (
          <Image
            source={{ uri: document.uri }}
            style={styles.previewFullImage}
            resizeMode="contain"
          />
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    marginBottom: -50
  },
  keyboard: {
    flex: 1,
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
  headerEyebrow: {
    color: "#FF6B35",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inter",
    textTransform: "uppercase",
  },
  headerTitle: {
    color: "#111827",
    fontSize: 23,
    fontWeight: "700",
    fontFamily: "Inter",
    marginTop: 0,
  },
  content: {
    padding: 14,
    paddingBottom: 110,
    gap: 12,
  },
  infoCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#111827",
    borderRadius: 8,
    padding: 14,
  },
  infoIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: "#A7F3D0",
    alignItems: "center",
    justifyContent: "center",
  },
  infoTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter",
  },
  infoText: {
    marginTop: 5,
    color: "#D1D5DB",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
    fontFamily: "Inter",
  },
  savedCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 0.6,
    borderColor: "#e5e7ebeb",
    padding: 14,
  },
  savedLabel: {
    color: "#6B7280",
    fontSize: 11,
    fontWeight: "600",
    fontFamily: "Inter",
  },
  savedTitle: {
    marginTop: 5,
    color: "#111827",
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter",
  },
  savedMeta: {
    marginTop: 3,
    color: "#6B7280",
    fontSize: 12.2,
    fontWeight: "600",
    fontFamily: "Inter",
  },
  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 0.4,
    borderColor: "#e5e7ebdc",
    padding: 12,
    gap: 11,
  },
  loadingBox: {
    minHeight: 160,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter",
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 15.5,
    fontWeight: "700",
    fontFamily: "Inter",
  },
  sectionSubtitle: {
    color: "#6B7280",
    fontSize: 11.8,
    lineHeight: 15,
    fontWeight: "500",
    fontFamily: "Inter",
    marginTop: -6,
  },
  input: {
    minHeight: 54,
    borderRadius: 8,
    backgroundColor: "#F9FAFB",
    borderWidth: 0.8,
    borderColor: "#00000088",
    paddingHorizontal: 12,
    fontSize: 14,
    color: "#111827",
    fontWeight: "600",
    fontFamily: "Inter",
  },
  inputIconWrap: {
    minHeight: 54,
    borderRadius: 8,
    backgroundColor: "#F9FAFB",
    borderWidth: 0.6,
    borderColor: "#00000088",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inputWithIcon: {
    flex: 1,
    minHeight: 50,
    fontSize: 13,
    color: "#111827",
    fontWeight: "600",
    fontFamily: "Inter",
  },
  saveButton: {
    minHeight: 54,
    borderRadius: 8,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.55,
  },
  saveText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter",
  },

  // Verification Status Styles
  statusCard: {
    flexDirection: "row",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    alignItems: "flex-start",
  },
  statusIconBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "Inter",
  },
  statusDescription: {
    color: "#6B7280",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
    fontFamily: "Inter",
    marginTop: 4,
  },
  statusDate: {
    color: "#9CA3AF",
    fontSize: 11,
    fontWeight: "500",
    fontFamily: "Inter",
    marginTop: 4,
  },

  // Approved Card Styles
  approvedCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#ECFDF5",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    padding: 14,
    alignItems: "center",
  },
  approvedIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: "#D1FAE5",
    alignItems: "center",
    justifyContent: "center",
  },
  approvedTitle: {
    color: "#10B981",
    fontSize: 15,
    fontWeight: "700",
    fontFamily: "Inter",
  },
  approvedMeta: {
    color: "#059669",
    fontSize: 12,
    fontWeight: "500",
    fontFamily: "Inter",
    marginTop: 3,
  },

  // Document Upload Styles
  documentsSection: {
    gap: 12,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 0.8,
    borderTopColor: "#e5e7ebdf",
  },
  documentSectionTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Inter",
  },
  documentSectionSubtitle: {
    color: "#6B7280",
    fontSize: 12,
    lineHeight: 15,
    fontWeight: "500",
    fontFamily: "Inter",
    marginTop: -8,
  },
  documentCard: {
    backgroundColor: "#f9fafbf5",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#00000015",
    padding: 12,
  },
  documentTitle: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter",
  },
  documentDescription: {
    color: "#6B7280",
    fontSize: 11.4,
    fontWeight: "500",
    fontFamily: "Inter",
    marginTop: 2,
  },
  uploadButton: {
    minHeight: 120,
    borderRadius: 8,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#FF6B35",
    backgroundColor: "#FFF5F0",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  uploadButtonText: {
    color: "#FF6B35",
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter",
  },
  documentPreviewBox: {
    minHeight: 120,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
    position: "relative",
  },
  documentPreviewImage: {
    width: "100%",
    height: 120,
    resizeMode: "cover",
  },
  documentPreviewOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  previewButton: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  previewButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inter",
  },
  removeButton: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Menu Styles
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  menuBottom: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 24,
  },
  menuHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
    marginBottom: 12,
  },
  menuTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Inter",
    marginBottom: 12,
  },
  menuOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginVertical: 4,
    borderRadius: 8,
    backgroundColor: "#F9FAFB",
  },
  menuOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#FFF5F0",
    alignItems: "center",
    justifyContent: "center",
  },
  menuOptionText: {
    flex: 1,
    color: "#111827",
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "Inter",
  },
  menuCancel: {
    minHeight: 50,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  menuCancelText: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "Inter",
  },

  // Preview Modal Styles
  previewOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  previewClose: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 10,
  },
  previewFullImage: {
    width: "90%",
    height: "80%",
  },
});
