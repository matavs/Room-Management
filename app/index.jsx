import React, { useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

/*
  Login screen redesigned to match the Rooms home screen styling:
  - Dark background (#0F1724) and card with the same visual language as HomeScreen.
  - Inputs use the pill style from the Home modal (inputPill / selectInput).
  - Primary action uses the enterBtn style (blue pill). Secondary actions match cancelBtn.
  - Small logo/avatar at the top right (same asset used in HomeScreen).
*/

export default function LoginScreen() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const onLogin = () => {
    if (!username.trim() || !password) {
      Alert.alert("Missing credentials", "Please enter username and password.");
      return;
    }
    // Replace with real auth later
    router.push("/home");
  };

  const onSignUp = () => {
    Alert.alert("Sign up", "Sign up flow not implemented yet.");
  };

  const onForgot = () => {
    Alert.alert("Forgot password", "Password recovery not implemented yet.");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.welcome}>Welcome</Text>
            <Text style={styles.title}>ROOM MANAGER</Text>
          </View>

          <TouchableOpacity style={styles.profileBtn} activeOpacity={0.8}>
            <Image source={require("../assets/icon.png")} style={styles.profileImage} />
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign in to continue</Text>

          <Text style={styles.label}>Username</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="person" size={16} color="#0f1724" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.inputPill}
              placeholder="Enter username"
              placeholderTextColor="#94a3b8"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <Text style={styles.label}>Password</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed" size={16} color="#0f1724" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.inputPill}
              placeholder="Enter password"
              placeholderTextColor="#94a3b8"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <TouchableOpacity style={styles.enterBtn} onPress={onLogin} activeOpacity={0.9}>
            <Text style={styles.enterBtnText}>Log In</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={onSignUp} activeOpacity={0.9}>
            <Text style={styles.secondaryBtnText}>Sign Up</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onForgot} style={styles.forgotRow}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>By continuing you agree to our Terms & Privacy.</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

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

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0F1724",
  },
  container: {
    flex: 1,
    padding: 16,
    justifyContent: "center",
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  welcome: {
    color: "#9FB4C8",
    fontSize: 12,
  },
  title: {
    color: "#E6F2FA",
    fontSize: 22,
    fontWeight: "700",
  },
  profileBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#23303A",
    alignItems: "center",
    justifyContent: "center",
  },
  profileImage: {
    width: 44,
    height: 44,
  },

  card: {
    backgroundColor: "#263238",
    borderRadius: 14,
    padding: 18,
    ...SHADOW,
  },
  cardTitle: {
    color: "#EAF6FF",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },

  label: {
    color: "#E6EEF8",
    fontSize: 11,
    marginBottom: 6,
    marginTop: 8,
    letterSpacing: 0.6,
  },

  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF2F6",
    borderRadius: 18,
    paddingHorizontal: 10,
    marginBottom: 6,
  },

  // Reusing the Home modal input pill look
  inputPill: {
    flex: 1,
    color: "#0f1724",
    paddingVertical: 10,
  },

  enterBtn: {
    marginTop: 14,
    backgroundColor: "#1F6FEB",
    paddingVertical: 12,
    borderRadius: 22,
    alignItems: "center",
    ...SHADOW,
  },
  enterBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
  },

  secondaryBtn: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "transparent",
  },
  secondaryBtnText: {
    color: "#EAF6FF",
    fontWeight: "700",
  },

  forgotRow: {
    marginTop: 12,
    alignItems: "center",
  },
  forgotText: {
    color: "#9FB4C8",
    fontSize: 13,
    textDecorationLine: "underline",
  },

  footer: {
    marginTop: 18,
    alignItems: "center",
  },
  footerText: {
    color: "#94a3b8",
    fontSize: 12,
  },
});