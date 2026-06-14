import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "../supabase";

const CHAT_IMAGE_BUCKET = "chat-images";
const MAX_UPLOAD_ATTEMPTS = 3;

type UploadChatImageParams = {
  conversationId: string;
  senderId: string;
  uri: string;
  mimeType?: string | null;
  onProgress?: (progress: number) => void;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const extensionFromMime = (mimeType?: string | null) => {
  if (!mimeType) return "jpg";
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("heic")) return "heic";
  return "jpg";
};

const errorMessage = (error: any) =>
  String(error?.message || error?.error_description || error?.name || error || "Unknown upload error");

const isRetryableUploadError = (error: any) => {
  const message = errorMessage(error).toLowerCase();
  return (
    message.includes("network request failed") ||
    message.includes("storageunknownerror") ||
    message.includes("timeout") ||
    message.includes("failed to fetch") ||
    message.includes("abort")
  );
};

const friendlyUploadError = (error: any) => {
  const message = errorMessage(error);
  const lower = message.toLowerCase();

  if (lower.includes("bucket") || lower.includes("permission") || lower.includes("policy") || lower.includes("row-level")) {
    return `Supabase Storage rejected the upload. Check that the "${CHAT_IMAGE_BUCKET}" bucket exists and allows authenticated inserts.`;
  }

  if (lower.includes("network request failed") || lower.includes("storageunknownerror")) {
    return "The network request failed while uploading the photo. Check your connection and Supabase Storage.";
  }

  return message;
};

async function readLocalImage(uri: string, onProgress?: (progress: number) => void) {
  onProgress?.(10);
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) {
    throw new Error("Selected image is no longer available on this device.");
  }

  onProgress?.(20);
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  onProgress?.(34);
  return decode(base64);
}

export async function uploadChatImage({
  conversationId,
  senderId,
  uri,
  mimeType,
  onProgress,
}: UploadChatImageParams): Promise<string> {
  const contentType = mimeType || "image/jpeg";
  const extension = extensionFromMime(contentType);
  const fileBody = await readLocalImage(uri, onProgress);
  let lastError: any = null;

  for (let attempt = 1; attempt <= MAX_UPLOAD_ATTEMPTS; attempt += 1) {
    const path = `${conversationId}/${senderId}-${Date.now()}-${attempt}.${extension}`;

    try {
      onProgress?.(Math.min(84, 42 + attempt * 12));
      const { error } = await supabase.storage.from(CHAT_IMAGE_BUCKET).upload(path, fileBody, {
        contentType,
        cacheControl: "3600",
        upsert: false,
      });

      if (error) throw error;

      onProgress?.(92);
      const { data } = supabase.storage.from(CHAT_IMAGE_BUCKET).getPublicUrl(path);
      if (!data.publicUrl) {
        throw new Error(`Could not create public URL for ${CHAT_IMAGE_BUCKET}/${path}`);
      }

      onProgress?.(100);
      return data.publicUrl;
    } catch (error) {
      lastError = error;
      if (attempt >= MAX_UPLOAD_ATTEMPTS || !isRetryableUploadError(error)) break;
      onProgress?.(Math.min(88, 52 + attempt * 12));
      await wait(650 * attempt);
    }
  }

  throw new Error(friendlyUploadError(lastError));
}
