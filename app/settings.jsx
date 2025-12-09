import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
  Platform,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadCurrentUser, saveCurrentUser, setAdminSession } from "./utils/storage";

export default function UserDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const currentUser = await loadCurrentUser();
        setUser(currentUser);
      } catch (e) {
        console.warn("Failed to load user data", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onSignOut = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            try {
              // 1. Clear active session data
              await saveCurrentUser(null);
              await setAdminSession(false);
              
              // 2. Optional: Remove full credentials if you want to force re-entry
              // We do NOT remove 'saved_username' here so the "Remember Username" feature persists
              
              // 3. Navigate back to Login
              router.replace("/"); 
            } catch (error) {
              console.error("Error signing out", error);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1F6FEB" />
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={{ color: "#fff" }}>No user data found.</Text>
          <TouchableOpacity style={styles.signOutBtn} onPress={() => router.replace("/")}>
             <Text style={styles.signOutText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerBackground} />
          
          {/* Back button */}
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.replace("/home")} 
            >
                <Ionicons name="chevron-back" size={28} color="#fff" />
              </TouchableOpacity>

          <View style={styles.avatarContainer}>
            {user.imageUri ? (
              <Image source={{ uri: user.imageUri }} style={styles.avatar} />
            ) : (
              <Image source={require("../assets/icon.png")} style={styles.avatar} />
            )}
          </View>
          <Text style={styles.fullName}>{`${user.first_name} ${user.last_name}`}</Text>
          <Text style={styles.role}>
            {user.is_superuser ? "Super Admin" : user.is_staff ? "Staff" : "User"}
          </Text>
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <InfoRow icon="mail-outline" label="Email" value={user.email || "-"} />
          <InfoRow icon="id-card-outline" label="ID Number" value={user.id_number} />
          <InfoRow icon="business-outline" label="Department" value={user.department?.name || "-"} />
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity style={styles.signOutBtn} onPress={onSignOut}>
          <Ionicons name="log-out-outline" size={20} color="#FFD1D1" style={{ marginRight: 8 }} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const InfoRow = ({ icon, label, value }) => (
  <View style={styles.infoRow}>
    <Ionicons name={icon} size={22} color="#1F6FEB" style={{ width: 30 }} />
    <View style={styles.infoTextWrapper}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0F1724" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: { padding: 16, paddingBottom: 40 },
  header: { alignItems: "center", marginBottom: 24 },
  headerBackground: {
    backgroundColor: "#1F6FEB",
    height: 140,
    width: "100%",
    position: "absolute",
    top: 0,
    left: 0,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  backButton: {
    position: "absolute",
    top: 12,
    left: 16,
    zIndex: 10,
    padding: 6,
  },
  avatarContainer: {
    marginTop: 60,
    borderWidth: 4,
    borderColor: "#0F1724",
    borderRadius: 60,
    overflow: "hidden",
  },
  avatar: { width: 120, height: 120, borderRadius: 60 },
  fullName: { color: "#EAF6FF", fontSize: 22, fontWeight: "700", marginTop: 12 },
  role: { color: "#9FB4C8", fontSize: 14, marginTop: 2 },
  infoCard: {
    backgroundColor: "#1B2430",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24, // Added margin for spacing above button
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.12, shadowOffset: { width: 0, height: 8 }, shadowRadius: 12 },
      android: { elevation: 4 },
    }),
  },
  infoRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  infoTextWrapper: { marginLeft: 8 },
  infoLabel: { color: "#9FB4C8", fontSize: 12 },
  infoValue: { color: "#EAF6FF", fontSize: 16, fontWeight: "500", marginTop: 2 },
  
  // Sign Out Button Styles
  signOutBtn: {
    flexDirection: "row",
    backgroundColor: "#3A1C1C", // Dark red background
    borderRadius: 16,
    paddingVertical: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#5C2B2B",
  },
  signOutText: {
    color: "#FFD1D1", // Light red text
    fontSize: 16,
    fontWeight: "700",
  },
});