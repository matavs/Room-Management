import React, { useState } from "react";
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

// IMPORTS
import api from './room/http'; 
import { saveCurrentUser, setAdminSession } from "./utils/storage";

const SHADOW = Platform.select({
  ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.16, shadowRadius: 12 },
  android: { elevation: 6 },
});

export default function LoginScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  
  // State to toggle between Login and Sign Up view
  const [isRegistering, setIsRegistering] = useState(false);

  // State for toggling password visibility
  const [showPassword, setShowPassword] = useState(false);

  const [data, setData] = useState({ 
      id_number: '', 
      password: '',
      first_name: '',
      last_name: '',
      email: '' 
  });

  const onPressLogin = async () => {
    // 1. Validation
    if (!data.id_number || !data.password) {
      Alert.alert("Missing credentials", "Please enter ID Number and Password.");
      return;
    }

    // ============================================================
    // ⚡️ SUPER ADMIN BYPASS ⚡️
    // ============================================================
    if (data.id_number.toLowerCase() === 'admin' && data.password === 'admin') {
        console.log("⚡️ Admin Bypass Activated");
        
        // Define the admin user ONLY inside this block
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

        // Save and Redirect
        await saveCurrentUser(fakeAdmin);
        await setAdminSession(true); 

        Alert.alert("God Mode", "Logged in as Super Admin");
        router.replace("/home");
        return; 
    }
    // ============================================================

    // 2. NORMAL USER LOGIN (Real API)
    setIsLoading(true);

    try {
      console.log("Attempting login...");
      const loginResponse = await api.post('auth/token/login/', {
        id_number: data.id_number,
        password: data.password
      });
      const authToken = loginResponse.data.auth_token;
      
      console.log("Token received:", authToken);

      const profileResponse = await api.get('auth/users/me/', {
        headers: {
          'Authorization': 'Token ' + authToken
        }
      });

      const userProfile = profileResponse.data;
      console.log("Profile loaded:", userProfile);

      // Determine Admin Status from the REAL data
      const isAdmin = userProfile.is_staff === true || userProfile.is_superuser === true;

      // Save the REAL user data
      await saveCurrentUser({ ...userProfile, token: authToken });
      await setAdminSession(isAdmin); 

      Alert.alert("Success", `Welcome, ${userProfile.first_name} ${userProfile.last_name}`);
      router.replace("/home"); 

    } catch (error) {
      console.error("Login Process Error:", error);
      
      let errorMessage = "Invalid credentials or server error.";
      
      if (error.response) {
        console.log("Data:", error.response.data);
        if (error.response.data && error.response.data.non_field_errors) {
            errorMessage = error.response.data.non_field_errors[0];
        }
      } else if (error.request) {
        errorMessage = "Network error. Please check your connection.";
      }

      Alert.alert("Login Failed", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Handle Registration ---
  const onPressRegister = async () => {
    // Basic Validation
    if (!data.first_name || !data.last_name || !data.id_number || !data.password) {
        Alert.alert("Missing Fields", "Please fill in all required fields.");
        return;
    }

    setIsLoading(true);

    try {
        console.log("Attempting Registration...");
        const response = await api.post('auth/users/', data);
        
        console.log("Registration Success:", response.data);
        Alert.alert("Success", "Account created successfully! Please log in.");
        
        setIsRegistering(false);
        setData({ ...data, password: '' });

    } catch (error) {
        console.error("Registration Error:", error);
        let errorMessage = "Could not create account.";

        if (error.response && error.response.data) {
            const keys = Object.keys(error.response.data);
            if (keys.length > 0) {
                errorMessage = `${keys[0]}: ${error.response.data[keys[0]]}`;
            }
        }
        Alert.alert("Registration Failed", errorMessage);
    } finally {
        setIsLoading(false);
    }
  };

  const onPressSignUp = () => {
    setIsRegistering(!isRegistering);
  };

  const onPressForgot = () => {
    Alert.alert("Reset Password", "Please contact admin to reset credentials.");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <Text style={styles.welcome}>{isRegistering ? "Create Account" : "Welcome back"}</Text>
            <Ionicons name="log-in-outline" size={28} color="#1F6FEB" />
          </View>
          <Text style={styles.title}>Room Manager</Text>

          <View style={styles.card}>
            <Text style={styles.modalTitle}>{isRegistering ? "Register" : "Sign In"}</Text>

            {/* --- REGISTRATION FIELDS --- */}
            {isRegistering && (
                <>
                    <Text style={styles.modalLabel}>FIRST NAME</Text>
                    <TextInput
                        style={styles.inputPill}
                        placeholder="First Name"
                        placeholderTextColor="#94a3b8"
                        value={data.first_name}
                        onChangeText={(text) => setData({ ...data, first_name: text })}
                        editable={!isLoading}
                    />

                    <Text style={styles.modalLabel}>LAST NAME</Text>
                    <TextInput
                        style={styles.inputPill}
                        placeholder="Last Name"
                        placeholderTextColor="#94a3b8"
                        value={data.last_name}
                        onChangeText={(text) => setData({ ...data, last_name: text })}
                        editable={!isLoading}
                    />

                    <Text style={styles.modalLabel}>EMAIL (Optional)</Text>
                    <TextInput
                        style={styles.inputPill}
                        placeholder="Email Address"
                        placeholderTextColor="#94a3b8"
                        value={data.email}
                        onChangeText={(text) => setData({ ...data, email: text })}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        editable={!isLoading}
                    />
                </>
            )}
            
            <Text style={styles.modalLabel}>ID NUMBER</Text>
            <TextInput
              style={styles.inputPill}
              placeholder="Enter ID Number"
              placeholderTextColor="#94a3b8"
              value={data.id_number}
              onChangeText={(text) => setData({ ...data, id_number: text })}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />

            <Text style={styles.modalLabel}>PASSWORD</Text>
            
            {/* Password Field with Toggle Eye Icon */}
            <View style={{ position: 'relative', marginBottom: 6 }}>
                <TextInput
                  style={[styles.inputPill, { marginBottom: 0, paddingRight: 50 }]}
                  placeholder="Password"
                  placeholderTextColor="#94a3b8"
                  secureTextEntry={!showPassword}
                  value={data.password}
                  onChangeText={(text) => setData({ ...data, password: text })}
                  editable={!isLoading}
                />
                <TouchableOpacity 
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeIcon}
                >
                    <Ionicons 
                        name={showPassword ? "eye-off" : "eye"} 
                        size={20} 
                        color="#94a3b8" 
                    />
                </TouchableOpacity>
            </View>

            {/* MAIN ACTION BUTTON */}
            <TouchableOpacity 
              style={[styles.enterBtn, isLoading && { opacity: 0.7 }]} 
              onPress={isRegistering ? onPressRegister : onPressLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.enterBtnText}>
                    {isRegistering ? "Create Account" : "Log In"}
                </Text>
              )}
            </TouchableOpacity>

            {/* SECONDARY ACTION BUTTON (TOGGLE) */}
            <TouchableOpacity style={styles.cancelBtn} onPress={onPressSignUp} disabled={isLoading}>
              <Text style={styles.cancelBtnText}>
                {isRegistering ? "Back to Login" : "Sign Up"}
              </Text>
            </TouchableOpacity>

            {!isRegistering && (
                <TouchableOpacity onPress={onPressForgot} disabled={isLoading}>
                <Text style={styles.forgotText}>Forgot password?</Text>
                </TouchableOpacity>
            )}
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
  // UPDATED: Style for the eye icon to center it vertically
  eyeIcon: {
    position: 'absolute',
    right: 15,
    top: 0,       // Changed from 10
    bottom: 0,    // Added to make it stretch from top to bottom
    justifyContent: 'center', // Centers content vertically within the stretched container
    alignItems: 'center',
    zIndex: 1,
  },
  enterBtn: {
    marginTop: 18,
    backgroundColor: "#1F6FEB",
    paddingVertical: 12,
    borderRadius: 22,
    alignItems: "center",
    minHeight: 48,
    justifyContent: 'center',
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