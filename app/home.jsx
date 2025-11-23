import React, { useMemo, useState, useRef, useEffect } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Image,
  Platform,
  RefreshControl,
  Animated,
  Modal,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

/*
  Home screen with profile icon that navigates to Settings.
  - Loads persisted profile info (image/displayName) from AsyncStorage key 'profileData'
  - Tapping the profile image navigates to /settings (app/settings.jsx) where it can be changed
  - If no custom profile image is set, falls back to assets/icon.png
  - NOTE: Requires installing:
      expo install expo-image-picker
      npm install @react-native-async-storage/async-storage
*/

const SAMPLE_ROOMS_BASE = [
  {
    id: "1",
    name: "Conference room A",
    floor: "2nd floor",
    capacity: "12",
    status: "Upcoming",
    event: "GROUP STUDY SESSION 11am - 12pm",
    color: "#FF9F43",
  },
  {
    id: "2",
    name: "Collaborative Hub",
    floor: "3rd floor",
    capacity: "8",
    status: "Available",
    event: "Free for bookings",
    color: "#2ECC71",
  },
  {
    id: "3",
    name: "Conference room B",
    floor: "2nd floor",
    capacity: "13",
    status: "Occupied",
    event: "Team Meeting 10:30am - 11:30am",
    color: "#E74C3C",
  },
];

function RoomCard({ item }) {
  return (
    <TouchableOpacity activeOpacity={0.9} style={styles.card}>
      <View style={styles.cardLeft}>
        <View style={[styles.roomAvatar, { backgroundColor: item.color || "#4C6EF5" }]}>
          <Text style={styles.roomAvatarText}>
            {item.name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
          </Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.roomTitle}>{item.name}</Text>
          <View style={styles.capacityChip}>
            <Ionicons name="people" size={12} color="#fff" />
            <Text style={styles.capacityText}>{item.capacity}</Text>
          </View>
        </View>

        <Text style={styles.roomMeta}>{`${item.floor || ""}`}</Text>

        <View style={styles.eventBox}>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    item.status === "Upcoming"
                      ? "#FFD166"
                      : item.status === "Available"
                      ? "#4CAF50"
                      : "#F44336",
                },
              ]}
            />
            <Text style={styles.statusText}>{item.status}</Text>
          </View>

          <Text numberOfLines={2} style={styles.eventText}>
            {item.event}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const router = useRouter();

  // List of rooms (can be pulled from backend later)
  const [rooms, setRooms] = useState(SAMPLE_ROOMS_BASE);

  // Search
  const [query, setQuery] = useState("");

  // Modal/form state (Add Room)
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [expectedAttendees, setExpectedAttendees] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Profile: image & displayName loaded from AsyncStorage
  const [profile, setProfile] = useState({ imageUri: null, displayName: "" });

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem("profileData");
        if (raw) {
          const parsed = JSON.parse(raw);
          setProfile({
            imageUri: parsed.imageUri || null,
            displayName: parsed.displayName || "",
          });
        }
      } catch (e) {
        console.warn("Failed to load profile data", e);
      }
    })();
  }, []);

  // Save profile data helper — used by settings screen when it navigates back
  // We'll re-load profile when returning from settings by listening to router events.
  useEffect(() => {
    const unsubscribe = router.addListener?.("focus", () => {
      (async () => {
        try {
          const raw = await AsyncStorage.getItem("profileData");
          if (raw) {
            const parsed = JSON.parse(raw);
            setProfile({
              imageUri: parsed.imageUri || null,
              displayName: parsed.displayName || "",
            });
          }
        } catch (e) {
          // ignore
        }
      })();
    });
    return () => unsubscribe?.();
  }, [router]);

  const roomNames = useMemo(() => {
    const names = Array.from(new Set(SAMPLE_ROOMS_BASE.map((r) => r.name)));
    return names;
  }, []);

  const filteredRooms = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter(
      (r) =>
        (r.name || "").toLowerCase().includes(q) ||
        (r.floor || "").toLowerCase().includes(q) ||
        (r.event || "").toLowerCase().includes(q)
    );
  }, [rooms, query]);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 700);
  };

  const resetForm = () => {
    setSelectedRoom("");
    setDate("");
    setStartTime("");
    setEndTime("");
    setEventTitle("");
    setExpectedAttendees("");
  };

  const submitForm = () => {
    if (!selectedRoom.trim()) {
      return alert("Please select or enter a room name.");
    }
    if (!eventTitle.trim()) {
      return alert("Please enter an event title.");
    }
    const newRoom = {
      id: Date.now().toString(),
      name: selectedRoom,
      floor: "",
      capacity: expectedAttendees || "N/A",
      status: "Upcoming",
      event:
        eventTitle +
        (date ? ` • ${date}` : "") +
        (startTime || endTime ? ` (${startTime || ""}${endTime ? " - " + endTime : ""})` : ""),
      color: pickColorForName(selectedRoom),
    };

    setRooms((p) => [newRoom, ...p]);
    resetForm();
    setModalVisible(false);
  };

  const pickColorForName = (name) => {
    const colors = ["#FF9F43", "#2ECC71", "#E74C3C", "#6C5CE7", "#00B4D8", "#F472B6"];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash << 5) - hash + name.charCodeAt(i);
    const idx = Math.abs(hash) % colors.length;
    return colors[idx];
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.welcome}>Welcome back</Text>
            <Text style={styles.title}>Rooms</Text>
          </View>

          <TouchableOpacity
            style={styles.profileBtn}
            activeOpacity={0.8}
            onPress={() => router.push("/settings")}
          >
            {profile.imageUri ? (
              <Image source={{ uri: profile.imageUri }} style={styles.profileImage} />
            ) : (
              <Image source={require("../assets/icon.png")} style={styles.profileImage} />
            )}
          </TouchableOpacity>
        </View>

        {/* Top card (search + menu + date) */}
        <View style={styles.topCard}>
          <View style={styles.topRow}>
            <TouchableOpacity style={styles.menuBtn} activeOpacity={0.7}>
              <Ionicons name="menu" size={20} color="#fff" />
            </TouchableOpacity>

            <View style={styles.searchContainer}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search rooms, events, floors"
                placeholderTextColor="#cbd5e1"
                style={styles.searchInput}
              />
              <Ionicons name="search" size={18} color="#fff" />
            </View>
          </View>

          <View style={styles.dateRow}>
            <View style={styles.datePill}>
              <Text style={styles.dateText}>10/09/25</Text>
            </View>

            <TouchableOpacity style={styles.filterBtn} activeOpacity={0.8}>
              <Ionicons name="funnel" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <FlatList
            data={filteredRooms}
            keyExtractor={(i) => i.id}
            renderItem={({ item }) => <RoomCard item={item} />}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            contentContainerStyle={{ paddingVertical: 8 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
            ListEmptyComponent={() => (
              <View style={styles.emptyState}>
                <Ionicons name="folder-open" size={36} color="#fff" />
                <Text style={styles.emptyTitle}>No rooms found</Text>
                <Text style={styles.emptySubtitle}>Try changing your search or add a new room.</Text>
              </View>
            )}
          />
        </View>

        {/* Floating action button */}
        <TouchableOpacity style={styles.fab} activeOpacity={0.9} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>

        {/* Add Room Modal */}
        <Modal visible={modalVisible} animationType="slide" transparent>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <ScrollView contentContainerStyle={{ padding: 18 }}>
                <Text style={styles.modalTitle}>Add Room / Event</Text>

                <Text style={styles.modalLabel}>SELECT ROOM</Text>
                <TouchableOpacity style={styles.selectInput} activeOpacity={0.9}>
                  <TextInput
                    placeholder="Choose or type room name"
                    placeholderTextColor="#94a3b8"
                    style={styles.selectTextInput}
                    value={selectedRoom}
                    onChangeText={setSelectedRoom}
                  />
                </TouchableOpacity>

                <Text style={styles.modalLabel}>DATE</Text>
                <TextInput
                  style={styles.inputPill}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#94a3b8"
                  value={date}
                  onChangeText={setDate}
                />

                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalLabel}>START TIME</Text>
                    <TextInput
                      style={styles.inputPill}
                      placeholder="HH:MM"
                      placeholderTextColor="#94a3b8"
                      value={startTime}
                      onChangeText={setStartTime}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalLabel}>END TIME</Text>
                    <TextInput
                      style={styles.inputPill}
                      placeholder="HH:MM"
                      placeholderTextColor="#94a3b8"
                      value={endTime}
                      onChangeText={setEndTime}
                    />
                  </View>
                </View>

                <Text style={styles.modalLabel}>EVENT TITLE</Text>
                <TextInput
                  style={styles.inputPill}
                  placeholder="Event title"
                  placeholderTextColor="#94a3b8"
                  value={eventTitle}
                  onChangeText={setEventTitle}
                />

                <Text style={styles.modalLabel}>EXPECTED ATTENDEES</Text>
                <TextInput
                  style={styles.inputPill}
                  placeholder="Number of attendees"
                  placeholderTextColor="#94a3b8"
                  value={expectedAttendees}
                  onChangeText={setExpectedAttendees}
                  keyboardType="numeric"
                />

                <View style={{ height: 12 }} />

                <TouchableOpacity style={styles.enterBtn} onPress={submitForm}>
                  <Text style={styles.enterBtnText}>ENTER</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    resetForm();
                    setModalVisible(false);
                  }}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
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
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
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

  topCard: {
    backgroundColor: "#263238",
    borderRadius: 14,
    padding: 12,
    ...SHADOW,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  menuBtn: {
    padding: 8,
    marginRight: 10,
  },
  searchContainer: {
    flex: 1,
    height: 46,
    borderRadius: 22,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#3B444A",
  },
  searchInput: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
    paddingVertical: 6,
  },

  dateRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  datePill: {
    backgroundColor: "#ECEFF1",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  dateText: {
    color: "#000",
    fontWeight: "600",
  },
  filterBtn: {
    marginLeft: 12,
    backgroundColor: "#2E3B44",
    padding: 8,
    borderRadius: 10,
  },

  content: {
    marginTop: 12,
    flex: 1,
    backgroundColor: "#0F1724",
    borderRadius: 8,
  },

  // Card
  card: {
    flexDirection: "row",
    backgroundColor: "#172028",
    borderRadius: 12,
    padding: 14,
    alignItems: "flex-start",
    ...SHADOW,
  },
  cardLeft: {
    marginRight: 12,
  },
  roomAvatar: {
    width: 52,
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  roomAvatarText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  cardBody: {
    flex: 1,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  roomTitle: {
    color: "#EAF6FF",
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
    marginRight: 8,
  },
  capacityChip: {
    backgroundColor: "#2E3B44",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  capacityText: {
    color: "#fff",
    marginLeft: 6,
    fontSize: 12,
    fontWeight: "600",
  },
  roomMeta: {
    color: "#9fb4c8",
    fontSize: 12,
    marginTop: 6,
  },
  eventBox: {
    marginTop: 10,
    backgroundColor: "#0E1418",
    borderRadius: 10,
    padding: 10,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 10,
    marginRight: 8,
  },
  statusText: {
    color: "#DDEEF8",
    fontSize: 12,
    fontWeight: "700",
  },
  eventText: {
    color: "#EAF6FF",
    marginTop: 8,
    fontSize: 13,
    fontWeight: "700",
  },

  // Empty
  emptyState: {
    alignItems: "center",
    paddingTop: 28,
  },
  emptyTitle: {
    color: "#fff",
    fontSize: 16,
    marginTop: 8,
    fontWeight: "700",
  },
  emptySubtitle: {
    color: "#9fb4c8",
    fontSize: 13,
    marginTop: 6,
    textAlign: "center",
    paddingHorizontal: 20,
  },

  // FAB
  fab: {
    position: "absolute",
    right: 18,
    bottom: 22,
    backgroundColor: "#1F6FEB",
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOW,
  },

  // Modal / form styles (blueprint-inspired)
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(5,10,15,0.6)",
    justifyContent: "center",
    padding: 18,
  },
  modalCard: {
    backgroundColor: "#39404A",
    borderRadius: 10,
    padding: 0,
    maxHeight: "88%",
    overflow: "hidden",
  },
  modalTitle: {
    color: "#EAF6FF",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 12,
  },
  modalLabel: {
    color: "#E6EEF8",
    fontSize: 11,
    marginBottom: 6,
    marginTop: 8,
    letterSpacing: 0.8,
  },
  selectInput: {
    backgroundColor: "#EEF2F6",
    borderRadius: 18,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  selectTextInput: {
    color: "#0f1724",
    paddingVertical: 6,
  },
  inputPill: {
    backgroundColor: "#EEF2F6",
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 12,
    color: "#0f1724",
  },
  enterBtn: {
    marginTop: 16,
    backgroundColor: "#1F6FEB",
    paddingVertical: 12,
    borderRadius: 22,
    alignItems: "center",
    ...SHADOW,
  },
  enterBtnText: {
    color: "#fff",
    fontWeight: "800",
  },
  cancelBtn: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 18,
    alignItems: "center",
  },
  cancelBtnText: {
    color: "#EAF6FF",
    opacity: 0.9,
  },
});