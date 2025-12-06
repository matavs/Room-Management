import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  TextInput,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

export default function SettingsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [imageUri, setImageUri] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem("profileData");
        if (raw) {
          const parsed = JSON.parse(raw);
          setImageUri(parsed.imageUri || null);
          setDisplayName(parsed.displayName || "");
          setEmail(parsed.email || "");
        }
      } catch (e) {
        console.warn("Failed to load profile data", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const pickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permissions required", "Please grant photo permissions to change profile picture.");
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
      const payload = { imageUri, displayName, email };
      await AsyncStorage.setItem("profileData", JSON.stringify(payload));
      Alert.alert("Saved", "Profile settings saved.");
      router.back(); // Go back to Home
    } catch (e) {
      console.warn("Save failed", e);
      Alert.alert("Error", "Failed to save settings.");
    }
  };

  const resetSettings = async () => {
    try {
      await AsyncStorage.removeItem("profileData");
      setImageUri(null);
      setDisplayName("");
      setEmail("");
      Alert.alert("Reset", "Profile settings reset.");
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
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.section}>
          <TouchableOpacity style={styles.avatarWrap} onPress={pickImage} activeOpacity={0.8}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.avatar} />
            ) : (
              <Image source={require("../assets/icon.png")} style={styles.avatar} />
            )}
            <View style={styles.cameraBadge}>
              <Ionicons name="camera" size={16} color="#fff" />
            </View>
          </TouchableOpacity>

          <Text style={styles.label}>DISPLAY NAME</Text>
          <TextInput
            style={styles.input}
            placeholder="Your name"
            placeholderTextColor="#9ca3b8"
            value={displayName}
            onChangeText={setDisplayName}
          />

          <Text style={styles.label}>EMAIL</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor="#9ca3b8"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <TouchableOpacity style={styles.saveBtn} onPress={saveSettings}>
            <Text style={styles.saveText}>Save Changes</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.resetBtn} onPress={resetSettings}>
            <Text style={styles.resetText}>Reset to Default</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0F1724" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: { flex: 1, padding: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  headerTitle: { color: "#EAF6FF", fontWeight: "700", fontSize: 18 },
  section: {
    backgroundColor: "#1B2430",
    borderRadius: 16,
    padding: 20,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  avatarWrap: { alignSelf: "center", marginBottom: 20 },
  avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#333' },
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
  label: { color: "#9FB4C8", fontSize: 11, marginTop: 12, marginBottom: 6, fontWeight: '600' },
  input: {
    backgroundColor: "#0F1724",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#fff",
    borderWidth: 1,
    borderColor: "#2C3A4A"
  },
  saveBtn: { marginTop: 24, backgroundColor: "#1F6FEB", paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  saveText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  resetBtn: { marginTop: 12, paddingVertical: 12, alignItems: "center" },
  resetText: { color: "#FF5252", opacity: 0.9 },
});