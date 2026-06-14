// app/components/GuestConversionModal.tsx
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface GuestConversionModalProps {
  visible: boolean;
  onClose: () => void;
  onSignIn: () => void;
  onSignUp: () => void;
}

export const GuestConversionModal = ({
  visible,
  onClose,
  onSignIn,
  onSignUp,
}: GuestConversionModalProps) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>

          <View style={styles.iconContainer}>
            <Ionicons name="person-circle" size={80} color="#FF6B35" />
          </View>

          <Text style={styles.title}>Save Your Progress</Text>
          <Text style={styles.subtitle}>
            Sign in to save your cart, favorites, and order history
          </Text>

          <TouchableOpacity style={styles.signInButton} onPress={onSignIn}>
            <Text style={styles.signInButtonText}>Sign In</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.signUpButton} onPress={onSignUp}>
            <Text style={styles.signUpButtonText}>Create Account</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.continueButton} onPress={onClose}>
            <Text style={styles.continueButtonText}>Continue as Guest</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    width: "90%",
    maxWidth: 400,
    alignItems: "center",
  },
  closeButton: {
    position: "absolute",
    top: 16,
    right: 16,
    padding: 4,
  },
  iconContainer: {
    marginBottom: 16,
    marginTop: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
    textAlign: "center",
        fontFamily: "Inter",

  },
  subtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
        fontFamily: "Inter",

  },
  signInButton: {
    backgroundColor: "#FF6B35",
    borderRadius: 12,
    padding: 16,
    width: "100%",
    alignItems: "center",
    marginBottom: 12,
  },
  signInButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
        fontFamily: "Inter",

  },
  signUpButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    width: "100%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 16,
  },
  signUpButtonText: {
    color: "#374151",
    fontSize: 16,
    fontWeight: "600",
        fontFamily: "Inter",

  },
  continueButton: {
    padding: 12,
  },
  continueButtonText: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "Inter",
  },
});

export default GuestConversionModal;
