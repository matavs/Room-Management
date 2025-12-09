import React, { useState, useEffect } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setAdminSession, saveCurrentUser } from "./utils/storage";
import api from "./utils/http";

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

// --- NEW LOGO COMPONENT ---
const ThemeLogo = () => (
  <View style={styles.logoContainer}>
    <View style={styles.logoCircle}>
      <Ionicons name="home" size={24} color="#1F6FEB" style={styles.logoIcon} />
      <View style={styles.checkmarkContainer}>
        <Ionicons name="checkmark-circle" size={16} color="#1F6FEB" />
      </View>
    </View>
    <View>
      <Text style={styles.logoTextPrimary}>ROOM</Text>
      <Text style={styles.logoTextSecondary}>MANAGEMENT</Text>
    </View>
  </View>
);
// --------------------------

export default function LoginScreen() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadSavedUsername = async () => {
      try {
        const savedUsername = await AsyncStorage.getItem('saved_username');
        if (savedUsername) {
          setUsername(savedUsername);
          setRememberMe(true);
        }
      } catch (error) {
        console.log("Error loading username", error);
      }
    };
    loadSavedUsername();
  }, []);

  const handleRememberMe = async () => {
    try {
      if (rememberMe) {
        await AsyncStorage.setItem('saved_username', username);
      } else {
        await AsyncStorage.removeItem('saved_username');
      }
    } catch (error) {
      console.log("Error saving username", error);
    }
  };

  const onLogin = async () => {
    if (!username || !password) {
      Alert.alert("Missing credentials", "Please enter ID Number and Password.");
      return;
    }
  
    // Super Admin Bypass
    if (username.toLowerCase() === 'admin' && password === 'admin') {
      const fakeAdmin = {
        first_name: "Super Admin",
        last_name: "Admin",
        id_number: "admin",
        uuid: "super_admin_uuid",
        email: "admin@system.com",
        is_superuser: true, 
        is_staff: true,
        department: { name: "IT Department" }
      };
  
      await saveCurrentUser(fakeAdmin);
      await setAdminSession(true); 
      await handleRememberMe();
  
      Alert.alert("God Mode", "Logged in as Super Admin");
      router.replace("/home");
      return; 
    }
  
    setLoading(true);
  
    try {
      const loginResponse = await api.post('auth/token/login/', {
        id_number: username,
        password: password
      });
  
      const authToken = loginResponse.data.auth_token;
  
      const profileResponse = await api.get('auth/users/me/', {
        headers: {
          'Authorization': 'Token ' + authToken
        }
      });
  
      const userProfile = profileResponse.data;
      const isAdmin = userProfile.is_staff || userProfile.is_superuser;
  
      await saveCurrentUser({ ...userProfile, token: authToken });
      await setAdminSession(isAdmin);
      await handleRememberMe();
  
      Alert.alert("Success", `Welcome, ${userProfile.first_name} ${userProfile.last_name}`);
      router.replace("/home"); 
  
    } catch (error) {
      let errorMessage = "Invalid credentials or server error.";
      if (error.response?.data?.non_field_errors) {
        errorMessage = error.response.data.non_field_errors[0];
      } else if (error.request) {
        errorMessage = "Network error. Please check your connection.";
      }
      Alert.alert("Login Failed", errorMessage);
    } finally {
      setLoading(false);
    }
  };
    
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={styles.container}>
          
          {/* Header Row */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.welcome}>Welcome back</Text>
              <Text style={styles.subWelcome}>Sign in to continue</Text>
            </View>
            
            {/* Placed the new Logo Component here */}
            <ThemeLogo />
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
              editable={!loading}
            />

            <Text style={styles.modalLabel}>PASSWORD</Text>
            <TextInput
              style={styles.inputPill}
              placeholder="Password"
              placeholderTextColor="#94a3b8"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              editable={!loading}
            />

            <TouchableOpacity 
              style={styles.rememberRow} 
              onPress={() => setRememberMe(!rememberMe)}
              activeOpacity={0.8}
            >
              <Ionicons 
                name={rememberMe ? "checkbox" : "square-outline"} 
                size={20} 
                color={rememberMe ? "#1F6FEB" : "#94a3b8"} 
              />
              <Text style={styles.rememberText}>Remember username</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.enterBtn, loading && styles.enterBtnDisabled]} 
              onPress={onLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.enterBtnText}>Log In</Text>
              )}
            </TouchableOpacity>

            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={16} color="#1F6FEB" />
              <Text style={styles.infoText}>
                Use your CITC credentials to login
              </Text>
            </View>

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
  subWelcome: {
    color: "#586A7A",
    fontSize: 11,
    marginTop: 2,
  },

  // --- New Logo Styles ---
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(31, 111, 235, 0.15)',
    borderWidth: 2,
    borderColor: '#1F6FEB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  logoIcon: {
    marginLeft: -2, // Adjust icon centering
  },
  checkmarkContainer: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#0F1724', // Match background to create a border effect
    borderRadius: 8,
  },
  logoTextPrimary: {
    color: '#EAF6FF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
    lineHeight: 14,
  },
  logoTextSecondary: {
    color: '#9FB4C8',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    lineHeight: 10,
  },
  // -----------------------

  title: {
    color: "#E6F2FA",
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 30,
    marginTop: 10,
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
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 5,
  },
  rememberText: {
    color: "#9FB4C8",
    fontSize: 13,
    marginLeft: 8,
    fontWeight: "500",
  },
  enterBtn: {
    marginTop: 18,
    backgroundColor: "#1F6FEB",
    paddingVertical: 12,
    borderRadius: 22,
    alignItems: "center",
    ...SHADOW,
  },
  enterBtnDisabled: {
    opacity: 0.6,
  },
  enterBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1F2937",
    padding: 12,
    borderRadius: 10,
    marginTop: 16,
    gap: 8,
  },
  infoText: {
    color: "#9FB4C8",
    fontSize: 12,
    flex: 1,
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