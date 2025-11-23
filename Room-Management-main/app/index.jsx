import React, { useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Platform,
  Alert,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const SHADOW = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
  },
  android: {
    elevation: 6,
  },
});

export default function LoginScreen() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const onLogin = () => {
    // Simple validation; replace with real auth
    if (!username.trim() || !password) {
      Alert.alert("Missing credentials", "Please enter username and password.");
      return;
    }
    router.push("/home");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={styles.container}>

          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={styles.welcome}>Welcome back</Text>
            <Ionicons name="log-in-outline" size={28} color="#1F6FEB" />
          </View>
          <Text style={styles.title}>Room Manager</Text>

          {/* Card (login form) */}
          <View style={styles.card}>
            <Text style={styles.modalTitle}>Sign In</Text>

            <Text style={styles.modalLabel}>USERNAME</Text>
            <TextInput
              style={styles.inputPill}
              placeholder="Username"
              placeholderTextColor="#94a3b8"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.modalLabel}>PASSWORD</Text>
            <TextInput
              style={styles.inputPill}
              placeholder="Password"
              placeholderTextColor="#94a3b8"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <TouchableOpacity style={styles.enterBtn} onPress={onLogin}>
              <Text style={styles.enterBtnText}>Log In</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Sign Up</Text>
            </TouchableOpacity>

            <TouchableOpacity>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0F1724",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  welcome: {
    color: "#9FB4C8",
    fontSize: 13,
    fontWeight: "500",
  },
  title: {
    color: "#E6F2FA",
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 30,
    letterSpacing: 1,
  },
  card: {
    backgroundColor: "#172028",
    borderRadius: 12,
    paddingVertical: 30,
    paddingHorizontal: 24,
    ...SHADOW,
  },
  modalTitle: {
    color: "#EAF6FF",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 12,
    textAlign: "center",
    letterSpacing: 1,
  },
  modalLabel: {
    color: "#E6EEF8",
    fontSize: 11,
    marginBottom: 6,
    marginTop: 8,
    letterSpacing: 0.8,
  },
  inputPill: {
    backgroundColor: "#EEF2F6",
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 12,
    color: "#0f1724",
    fontWeight: "600",
    fontSize: 15,
    marginBottom: 6,
  },
  enterBtn: {
    marginTop: 18,
    backgroundColor: "#1F6FEB",
    paddingVertical: 12,
    borderRadius: 22,
    alignItems: "center",
    ...SHADOW,
  },
  enterBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },
  cancelBtn: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 18,
    alignItems: "center",
    backgroundColor: "#263238",
    ...SHADOW,
  },
  cancelBtnText: {
    color: "#EAF6FF",
    opacity: 0.9,
    fontWeight: "700",
    fontSize: 16,
  },
  forgotText: {
    color: "#1F6FEB",
    fontSize: 14,
    textAlign: "center",
    marginTop: 15,
    textDecorationLine: "underline",
    fontWeight: "500",
    letterSpacing: 0.3,
  },
});