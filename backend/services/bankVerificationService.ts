// backend/services/bankVerificationService.ts
import { supabase } from "@/backend/supabase";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

const BUCKET_NAME = "bank-verification-documents";

export type BankVerificationStatus = "pending" | "approved" | "rejected";

export interface BankAccountWithVerification {
  id: string;
  user_id: string;
  bank_name: string;
  account_holder_name: string;
  account_number_masked: string;
  routing_number_masked?: string;
  is_default: boolean;
  is_active: boolean;
  verification_status: BankVerificationStatus;
  verification_reason?: string;
  id_document_url?: string;
  bank_proof_url?: string;
  verified_at?: string;
  verified_by?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Upload a document to bank verification bucket
 */
export const uploadBankDocument = async (
  userId: string,
  documentType: "id" | "bank_proof",
  imageUri: string,
  fileName: string
): Promise<string> => {
  try {
    const fileExtension = fileName.split(".").pop() || "jpg";
    const uniquePath = `${userId}/${documentType}/${Date.now()}.${fileExtension}`;

    // Convert URI to blob if needed
    let fileData;
    if (Platform.OS === "web") {
      const response = await fetch(imageUri);
      fileData = await response.blob();
    } else {
      const response = await fetch(imageUri);
      fileData = await response.blob();
    }

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(uniquePath, fileData, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (error) throw error;

    // Get signed URL for the document
    const { data: signedUrlData } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(data.path, 365 * 24 * 60 * 60); // 1 year

    return signedUrlData?.signedUrl || data.path;
  } catch (error: any) {
    console.error("Error uploading bank document:", error);
    throw new Error(`Failed to upload ${documentType} document: ${error.message}`);
  }
};

/**
 * Pick an image from camera or gallery
 */
export const pickBankDocument = async (type: "camera" | "gallery" = "gallery") => {
  try {
    const result =
      type === "camera"
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
            aspect: [4, 3],
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
            aspect: [4, 3],
          });

    if (!result.canceled && result.assets[0]) {
      return result.assets[0];
    }
    return null;
  } catch (error: any) {
    console.error("Error picking document:", error);
    throw error;
  }
};

/**
 * Get bank account with verification status
 */
export const getBankAccountWithVerification = async (
  userId: string
): Promise<BankAccountWithVerification | null> => {
  try {
    const { data, error } = await supabase
      .from("bank_accounts")
      .select("*")
      .eq("user_id", userId)
      .eq("user_type", "driver")
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .maybeSingle();

    if (error) throw error;
    return (data as BankAccountWithVerification) || null;
  } catch (error: any) {
    console.error("Error fetching bank account:", error);
    throw error;
  }
};

/**
 * Update bank account with verification documents
 */
export const updateBankAccountDocuments = async (
  bankAccountId: string,
  userId: string,
  documents: {
    idDocumentUrl?: string;
    bankProofUrl?: string;
  }
): Promise<BankAccountWithVerification> => {
  try {
    const { data, error } = await supabase
      .from("bank_accounts")
      .update({
        id_document_url: documents.idDocumentUrl,
        bank_proof_url: documents.bankProofUrl,
        verification_status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", bankAccountId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw error;
    return data as BankAccountWithVerification;
  } catch (error: any) {
    console.error("Error updating bank account documents:", error);
    throw error;
  }
};

/**
 * Create a new bank account with documents
 */
export const createBankAccountWithDocuments = async (
  userId: string,
  accountData: {
    bank_name: string;
    account_holder_name: string;
    account_number_masked: string;
    routing_number_masked?: string;
  },
  documents: {
    idDocumentUrl?: string;
    bankProofUrl?: string;
  }
): Promise<BankAccountWithVerification> => {
  try {
    const now = new Date().toISOString();

    // Set all others to not default
    await supabase
      .from("bank_accounts")
      .update({ is_default: false, updated_at: now })
      .eq("user_id", userId)
      .eq("user_type", "driver");

    const { data, error } = await supabase
      .from("bank_accounts")
      .insert({
        user_id: userId,
        user_type: "driver",
        ...accountData,
        id_document_url: documents.idDocumentUrl,
        bank_proof_url: documents.bankProofUrl,
        is_default: true,
        is_active: true,
        verification_status: "pending",
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) throw error;
    return data as BankAccountWithVerification;
  } catch (error: any) {
    console.error("Error creating bank account:", error);
    throw error;
  }
};

/**
 * Check if bank account is verified
 */
export const isBankAccountVerified = async (userId: string): Promise<boolean> => {
  try {
    const account = await getBankAccountWithVerification(userId);
    return account?.verification_status === "approved";
  } catch (error) {
    console.error("Error checking bank verification:", error);
    return false;
  }
};

/**
 * Get verification status details
 */
export const getVerificationStatusDetails = (
  status: BankVerificationStatus,
  reason?: string
): {
  icon: string;
  color: string;
  label: string;
  description: string;
  actionable: boolean;
} => {
  const details = {
    pending: {
      icon: "hourglass",
      color: "#F59E0B",
      label: "Pending Review",
      description: "Your documents are being reviewed by our team. This typically takes 24-48 hours.",
      actionable: true,
    },
    approved: {
      icon: "checkmark-circle",
      color: "#10B981",
      label: "Verified",
      description: "Your bank account is verified. You can now withdraw your earnings.",
      actionable: false,
    },
    rejected: {
      icon: "close-circle",
      color: "#EF4444",
      label: "Rejected",
      description: reason || "Your verification was rejected. Please resubmit with valid documents.",
      actionable: true,
    },
  };

  return details[status];
};

/**
 * Delete a bank verification document from storage
 */
export const deleteBankDocument = async (
  userId: string,
  documentType: "id" | "bank_proof",
  pathToDelete: string
) => {
  try {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([pathToDelete]);

    if (error) throw error;
  } catch (error: any) {
    console.error("Error deleting bank document:", error);
    // Don't throw, just log the error
  }
};

/**
 * Validate bank account data
 */
export const validateBankAccountData = (data: {
  accountName?: string;
  bankName?: string;
  accountNumber?: string;
}): string | null => {
  if (!data.accountName?.trim()) return "Please enter the account holder name";
  if (!data.bankName?.trim()) return "Please enter the bank name";

  const cleanedAccount = data.accountNumber?.replace(/\D/g, "") || "";
  if (cleanedAccount.length < 7) return "Please enter a valid account number (minimum 7 digits)";

  return null;
};

/**
 * Validate verification documents
 */
export const validateVerificationDocuments = (
  idDocumentUrl?: string,
  bankProofUrl?: string
): string | null => {
  if (!idDocumentUrl) return "ID document is required for verification";
  if (!bankProofUrl) return "Bank proof document is required for verification";
  return null;
};
