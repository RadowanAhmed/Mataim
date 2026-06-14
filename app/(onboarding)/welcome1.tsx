// app/(onboarding)/welcome1.tsx
import { animations } from "@/constent/animations";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import LottieView from "lottie-react-native";
import React from "react";
import {
  Dimensions,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width, height } = Dimensions.get("window");

export default function WelcomeScreen1() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Animation with Gradient that extends to content */}
      <View style={styles.animationContainer}>
        <LottieView
          source={animations.discover_anmazing_food}
          autoPlay
          loop
          style={styles.animation}
        />
        <LinearGradient
          colors={["transparent", "rgba(255, 107, 53, 0.08)", "#FFFFFF"]}
          style={styles.visibleGradient}
          locations={[0, 0.5, 1]}
        />
      </View>

      {/* Content (no background color) */}
      <View style={styles.content}>
        <Text style={styles.title}>Discover Amazing Food</Text>
        <Text style={styles.subtitle}>
          Explore thousands of restaurants and discover your favorite dishes
          from local cuisine
        </Text>

        {/* Progress Dots */}
        <View style={styles.progressContainer}>
          <View style={[styles.dot, styles.activeDot]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>

        {/* Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.nextButton}
            onPress={() => router.push("/(onboarding)/welcome2")}
          >
            <Text style={styles.nextButtonText}>Next</Text>
            <Ionicons name="arrow-forward" size={19} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => router.replace("/(auth)")}
          >
            <Text style={styles.skipButtonText}>Skip</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  loadingText: {
    fontSize: 16,
    color: "#666",
    fontFamily: "Inter",
    fontWeight: "400",
  },
  animationContainer: {
    height: height * 0.55,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    backgroundColor: "#fff",
  },
  visibleGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  animation: {
    width: width * 0.9,
    height: "100%",
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: "#FFFFFF",
  },
  title: {
    fontSize: 24,
    fontFamily: "Inter",
    fontWeight: "800",
    color: "#1A1A1A",
    textAlign: "center",
    marginBottom: 14,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: "Inter",
    fontWeight: "400",
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  progressContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginBottom: 40,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#e1e1e1",
  },
  activeDot: {
    backgroundColor: "#FF6B35",
    width: 24,
  },
  buttonContainer: {
    gap: 16,
  },
  nextButton: {
    backgroundColor: "#FF6B35",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 17,
    gap: 8,
    shadowColor: "#FF6B35",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  nextButtonText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter",
    fontWeight: "600",
  },
  skipButton: {
    padding: 16,
    alignItems: "center",
  },
  skipButtonText: {
    color: "#666",
    fontSize: 16,
    fontFamily: "Inter",
    fontWeight: "400",
  },
});