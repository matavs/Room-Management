import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Platform,
  Alert,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useNavigation } from "expo-router"; // <--- Added useNavigation

// --- IMPORTS ---
import api from './room/http'; 
import { loadCurrentUser } from "./utils/storage";

export default function SettingsScreen() {
  const router = useRouter();
  const navigation = useNavigation(); // <--- Hook to check history
  const [loading, setLoading] = useState(true);
  
  // State for Local Image
  const [imageUri, setImageUri] = useState(null);
  
  // State for API Profile Data
  const [profile, setProfile] = useState({
    first_name: "Loading...",
    last_name: "",
    id_number: "...",
    email: "...",
    uuid: "...",
    department: { name: "..." }
  });

  useEffect(() => {
    loadSettingsData();
  }, []);

  const loadSettingsData = async () => {
    setLoading(true);
    try {
      // 1. Load Local Image
      const rawLocal = await AsyncStorage.getItem("profileData");
      if (rawLocal) {
        const parsed = JSON.parse(rawLocal);
        if (parsed.imageUri) setImageUri(parsed.imageUri);
      }

      // 2. Load API Data
      const userData = await loadCurrentUser();
      const token = userData?.token;

      if (token) {
        const response = await api.get('auth/users/me/', {
          headers: { 'Authorization': 'Token ' + token }
        });
        setProfile(response.data);
      }
    } catch (e) {
      console.warn("Failed to load settings", e);
    } finally {
      setLoading(false);
    }
  };

  // --- NEW: SAFE BACK NAVIGATION ---
  const handleBack = () => {
    if (navigation.canGoBack()) {
      router.back();
    } else {
      router.replace("/home"); // Fallback to Home if no history
    }
  };

  const pickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permissions required", "Please grant photo permissions.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImageUri(result.assets[0].uri);
      }
    } catch (e) {
      console.warn("Image pick error", e);
    }
  };

  const saveSettings = async () => {
    try {
      const payload = { 
        imageUri, 
        displayName: `${profile.first_name} ${profile.last_name}` 
      };
      await AsyncStorage.setItem("profileData", JSON.stringify(payload));
      Alert.alert("Saved", "Profile picture updated.");
      handleBack(); // <--- Use safe back here
    } catch (e) {
      console.warn("Save failed", e);
      Alert.alert("Error", "Failed to save settings.");
    }
  };

  const resetSettings = async () => {
    try {
      await AsyncStorage.removeItem("profileData");
      setImageUri(null);
      Alert.alert("Reset", "Profile picture reset.");
    } catch (e) {
      console.warn("Reset failed", e);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color="#1F6FEB" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          {/* UPDATED BACK BUTTON */}
          <TouchableOpacity onPress={handleBack} style={{ padding: 8 }}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Profile</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.section}>
          
          {/* AVATAR PICKER */}
          <TouchableOpacity style={styles.avatarWrap} onPress={pickImage} activeOpacity={0.8}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { alignItems:'center', justifyContent:'center', backgroundColor:'#333' }]}>
                 <Text style={{color:'#fff', fontSize:32, fontWeight:'bold'}}>
                    {profile.first_name ? profile.first_name[0] : "?"}
                 </Text>
              </View>
            )}
            <View style={styles.cameraBadge}>
              <Ionicons name="camera" size={16} color="#fff" />
            </View>
          </TouchableOpacity>

          {/* DATA FIELDS */}
          
          <View style={styles.infoRow}>
            <Text style={styles.label}>FULL NAME</Text>
            <Text style={styles.value}>
              {profile.first_name} {profile.last_name}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.label}>ID NUMBER</Text>
            <Text style={styles.value}>{profile.id_number}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.label}>EMAIL ADDRESS</Text>
            <Text style={styles.value}>{profile.email}</Text>
          </View>


          {/* ACTIONS */}
          <TouchableOpacity style={styles.saveBtn} onPress={saveSettings}>
            <Text style={styles.saveText}>Save Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.resetBtn} onPress={resetSettings}>
            <Text style={styles.resetText}>Remove Photo</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0F1724" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { padding: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  headerTitle: { color: "#E6F2FA", fontWeight: "700", fontSize: 18 },
  
  section: {
    backgroundColor: "#1B2430",
    borderRadius: 16,
    padding: 20,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  
  avatarWrap: { alignSelf: "center", marginBottom: 30 },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  cameraBadge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    backgroundColor: "#1F6FEB",
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#1B2430",
  },

  infoRow: { marginBottom: 4 },
  label: { 
    color: "#5f748d", 
    fontSize: 11, 
    fontWeight: "700", 
    marginBottom: 6, 
    letterSpacing: 1, 
    marginTop: 8 
  },
  value: { 
    color: "#fff", 
    fontSize: 16, 
    fontWeight: "500" 
  },
  valueUUID: {
    color: "#64748b",
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  divider: {
    height: 1,
    backgroundColor: "#2A3642",
    marginVertical: 12,
  },

  saveBtn: { marginTop: 24, backgroundColor: "#1F6FEB", paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  saveText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  resetBtn: { marginTop: 12, paddingVertical: 12, alignItems: "center" },
  resetText: { color: "#FF5252", opacity: 0.9 },
});