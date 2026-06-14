import React, { useState, ReactNode } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { logger } from "@/backend/utils/logger";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    logger.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <ScrollView style={styles.content} contentContainerStyle={styles.contentCenter}>
            <Text style={styles.title}>Oops! Something went wrong</Text>
            <Text style={styles.message}>
              The app encountered an unexpected error. Please try restarting the app.
            </Text>

            {__DEV__ && this.state.error && (
              <>
                <Text style={styles.errorTitle}>Error Details:</Text>
                <Text style={styles.errorText}>{this.state.error.toString()}</Text>

                {this.state.errorInfo && (
                  <Text style={styles.errorStack}>{this.state.errorInfo.componentStack}</Text>
                )}
              </>
            )}
          </ScrollView>

          <TouchableOpacity style={styles.button} onPress={this.handleReset}>
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
    justifyContent: "space-between",
  },
  content: {
    flex: 1,
    padding: 20,
  },
  contentCenter: {
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 12,
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    color: "#6B7280",
    lineHeight: 24,
    marginBottom: 20,
    textAlign: "center",
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#DC2626",
    marginTop: 20,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 12,
    color: "#7F1D1D",
    backgroundColor: "#FEE2E2",
    padding: 12,
    borderRadius: 8,
    fontFamily: "monospace",
    marginBottom: 12,
  },
  errorStack: {
    fontSize: 11,
    color: "#7F1D1D",
    backgroundColor: "#FEE2E2",
    padding: 12,
    borderRadius: 8,
    fontFamily: "monospace",
  },
  button: {
    backgroundColor: "#FF6B35",
    marginHorizontal: 20,
    marginBottom: 30,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
