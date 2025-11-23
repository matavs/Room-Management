// app/home.jsx
import React, { useEffect, useMemo, useState } from "react";
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
  Modal,
  ScrollView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import RoomCard from "./components/RoomCard";
import {
  loadRooms,
  saveRooms,
  loadProfile,
  isAdminSession,
  loadCurrentUser,
} from "./utils/storage";

/* Utilities */
const getTodayDateString = () => new Date().toISOString().split("T")[0];
const pickColorForName = (name) => {
  const colors = ["#FF9F43", "#2ECC71", "#E74C3C", "#6C5CE7", "#00B4D8", "#F472B6"];
  let hash = 0;
  if (!name) return colors[0];
  for (let i = 0; i < name.length; i++) hash = (hash << 5) - hash + name.charCodeAt(i);
  return colors[Math.abs(hash) % colors.length];
};
const generateSampleRooms = () => {
  const rooms = [];
  for (let i = 1; i <= 8; i++) {
    const num = i * 100 + 1;
    rooms.push({
      id: i.toString(),
      name: `Room ${num}`,
      floor: `${i}th floor`,
      capacity: String(8 + i),
      status: "Available",
      eventTitle: "Free for bookings",
      date: getTodayDateString(),
      startTime: null,
      endTime: null,
      color: pickColorForName(`Room ${num}`),
      bookings: [], // now use bookings array
      description: "",
      bookedBy: null,
    });
  }
  return rooms;
};

/* HomeScreen */
export default function HomeScreen() {
  const router = useRouter();

  const [rooms, setRoomsState] = useState([]);
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [seed, setSeed] = useState(0);
  const [profile, setProfile] = useState({ imageUri: null, displayName: "" });
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // admin add modal
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addRoomName, setAddRoomName] = useState("");
  const [addDate, setAddDate] = useState(getTodayDateString());
  const [addStartTime, setAddStartTime] = useState("");
  const [addEndTime, setAddEndTime] = useState("");
  const [addEventTitle, setAddEventTitle] = useState("");
  const [addDescription, setAddDescription] = useState("");

  // user booking modal (user supplies date, start, end, desc)
  const [userBookingModalVisible, setUserBookingModalVisible] = useState(false);
  const [bookingRoom, setBookingRoom] = useState(null);
  const [bookingDate, setBookingDate] = useState(getTodayDateString());
  const [bookingStart, setBookingStart] = useState("");
  const [bookingEnd, setBookingEnd] = useState("");
  const [bookingDescription, setBookingDescription] = useState("");

  useEffect(() => {
    (async () => {
      const stored = await loadRooms();
      if (stored && Array.isArray(stored) && stored.length > 0) {
        setRoomsState(stored);
      } else {
        const seedData = generateSampleRooms();
        setRoomsState(seedData);
        await saveRooms(seedData);
      }

      const p = await loadProfile();
      if (p) setProfile(p);

      const admin = await isAdminSession();
      setIsAdmin(admin);

      const cu = await loadCurrentUser();
      if (cu) setCurrentUser(cu);
    })();

    const unsub = router.addListener?.("focus", async () => {
      const p = await loadProfile();
      if (p) setProfile(p);
      const admin = await isAdminSession();
      setIsAdmin(admin);
      const cu = await loadCurrentUser();
      if (cu) setCurrentUser(cu);
    });
    return () => unsub?.();
  }, []);

  useEffect(() => {
    saveRooms(rooms);
  }, [rooms]);

  // Auto-release mechanism (keeps using bookings array)
  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date();
      let changed = false;
      const updated = rooms.map((r) => {
        const bookings = Array.isArray(r.bookings) ? r.bookings.slice() : [];
        const active = bookings.find(b => new Date(b.startTime) <= now && now < new Date(b.endTime));
        const next = bookings.filter(b => new Date(b.startTime) > now).sort((a,b)=>new Date(a.startTime)-new Date(b.startTime))[0];
        if (active && r.status !== "Occupied") {
          changed = true;
          return { ...r, status: "Occupied", eventTitle: active.description || (active.bookedBy?.username || "Booked"), startTime: active.startTime, endTime: active.endTime, bookedBy: active.bookedBy || null };
        }
        if (!active && next && r.status !== "Upcoming") {
          changed = true;
          return { ...r, status: "Upcoming", eventTitle: next.description || (next.bookedBy?.username || "Upcoming"), startTime: next.startTime, endTime: next.endTime, bookedBy: next.bookedBy || null };
        }
        if (!active && !next && r.status !== "Available") {
          changed = true;
          return { ...r, status: "Available", eventTitle: "Free for bookings", startTime: null, endTime: null, bookedBy: null };
        }
        return r;
      });
      if (changed) {
        setRoomsState(updated);
        setSeed(s => s + 1);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [rooms]);

  const setRooms = (updater) => {
    setRoomsState(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      return next;
    });
  };

  // Open booking modal for user
  const handleUsePress = (room) => {
    if (isAdmin) {
      router.push(`/room/${room.id}`);
      return;
    }
    setBookingRoom(room);
    setBookingDate(getTodayDateString());
    setBookingStart("");
    setBookingEnd("");
    setBookingDescription("");
    setUserBookingModalVisible(true);
  };

  // Helpers
  const intervalsOverlap = (aStart, aEnd, bStart, bEnd) => {
    return aStart < bEnd && bStart < aEnd;
  };

  // Confirm user booking (date + start + end)
  const confirmUserBooking = () => {
    if (!bookingRoom || !currentUser) {
      Alert.alert("Error", "Missing booking context or user.");
      return;
    }
    if (!bookingDate || !bookingStart || !bookingEnd) {
      Alert.alert("Missing fields", "Please provide date, start and end time.");
      return;
    }
    const startISO = `${bookingDate}T${bookingStart}:00`;
    const endISO = `${bookingDate}T${bookingEnd}:00`;
    const startObj = new Date(startISO);
    const endObj = new Date(endISO);
    if (!(startObj instanceof Date) || isNaN(startObj) || !(endObj instanceof Date) || isNaN(endObj)) {
      Alert.alert("Invalid date/time", "Please enter valid date and times (YYYY-MM-DD, HH:MM).");
      return;
    }
    if (endObj <= startObj) {
      Alert.alert("Invalid range", "End time must be after start time.");
      return;
    }

    // IMPORTANT: use the authoritative current rooms state to check conflicts (avoid stale bookingRoom)
    const roomCurrent = rooms.find(r => String(r.id) === String(bookingRoom.id));
    if (!roomCurrent) {
      Alert.alert("Error", "Room not found or data not loaded. Try again.");
      setUserBookingModalVisible(false);
      return;
    }

    const existing = Array.isArray(roomCurrent.bookings) ? roomCurrent.bookings.slice() : [];
    // include legacy booking if present
    if (roomCurrent.startTime && roomCurrent.endTime && (!existing || existing.length === 0)) {
      existing.push({ id: "__legacy__", startTime: roomCurrent.startTime, endTime: roomCurrent.endTime });
    }

    const hasConflict = existing.some(b => {
      const bStart = new Date(b.startTime);
      const bEnd = new Date(b.endTime);
      return intervalsOverlap(startObj, endObj, bStart, bEnd);
    });

    if (hasConflict) {
      Alert.alert("Time conflict", "This time range conflicts with an existing booking. Choose a different time or date.");
      return;
    }

    // Create booking record (unique id)
    const booking = {
      id: Date.now().toString(),
      startTime: startISO,
      endTime: endISO,
      description: bookingDescription?.trim() || "",
      bookedBy: { id: currentUser.id, username: currentUser.username },
      createdAt: new Date().toISOString(),
    };

    // Append booking immutably using the latest prev state (safe against concurrent updates)
    setRooms(prev => prev.map(r => {
      if (String(r.id) !== String(roomCurrent.id)) return r;
      const nextBookings = Array.isArray(r.bookings) ? [...r.bookings, booking] : [booking];
      // compute new status based on active/next bookings
      const now = new Date();
      const active = nextBookings.find(b => new Date(b.startTime) <= now && now < new Date(b.endTime));
      const next = nextBookings.filter(b => new Date(b.startTime) > now).sort((a,b)=>new Date(a.startTime)-new Date(b.startTime))[0];
      return {
        ...r,
        bookings: nextBookings,
        status: active ? "Occupied" : next ? "Upcoming" : "Available",
        eventTitle: active ? active.description || active.bookedBy.username : next ? next.description || next.bookedBy?.username : r.eventTitle,
        startTime: active ? active.startTime : next ? next.startTime : null,
        endTime: active ? active.endTime : next ? next.endTime : null,
        description: active ? active.description : next ? next.description : r.description,
        bookedBy: active ? active.bookedBy : next ? next.bookedBy : null,
      };
    }));

    setUserBookingModalVisible(false);
    setBookingRoom(null);
    setSeed(s => s + 1);
    Alert.alert("Booked", "Your booking was created.");
  };

  // Cancel a booking: signature (room, bookingId)
  const handleLeavePress = (room, bookingId) => {
    if (!room || !bookingId) return;
    // find booking and check permissions
    const booking = (room.bookings || []).find(b => String(b.id) === String(bookingId));
    const isBookingOwner = booking && currentUser && String(booking.bookedBy?.id) === String(currentUser.id);
    if (!isAdmin && !isBookingOwner) {
      Alert.alert("Not allowed", "Only booking owner can cancel this booking.");
      return;
    }

    setRooms(prev => prev.map(r => {
      if (String(r.id) !== String(room.id)) return r;
      const bookings = Array.isArray(r.bookings) ? r.bookings.slice() : [];
      const filtered = bookings.filter(b => String(b.id) !== String(bookingId));
      // recompute status and display based on remaining bookings
      const now = new Date();
      const active = filtered.find(b => new Date(b.startTime) <= now && now < new Date(b.endTime));
      const next = filtered.filter(b => new Date(b.startTime) > now).sort((a,b)=>new Date(a.startTime)-new Date(b.startTime))[0];
      return {
        ...r,
        bookings: filtered,
        status: active ? "Occupied" : next ? "Upcoming" : "Available",
        eventTitle: active ? active.description || active.bookedBy?.username : next ? next.description || next.bookedBy?.username : "Free for bookings",
        startTime: active ? active.startTime : next ? next.startTime : null,
        endTime: active ? active.endTime : next ? next.endTime : null,
        description: active ? active.description : next ? next.description : "",
        bookedBy: active ? active.bookedBy : next ? next.bookedBy : null,
      };
    }));

    setSeed(s => s + 1);
    Alert.alert("Cancelled", "Booking cancelled.");
  };

  // Admin add room (unchanged)
  const submitAdd = () => {
    if (!isAdmin) {
      Alert.alert("Permission denied", "Only admins can add rooms.");
      return;
    }
    if (!addRoomName.trim() || !addEventTitle.trim() || !addStartTime.trim() || !addEndTime.trim()) {
      Alert.alert("Missing Info", "Please fill in required fields.");
      return;
    }
    const startISO = `${addDate}T${addStartTime}:00`;
    const endISO = `${addDate}T${addEndTime}:00`;
    const startObj = new Date(startISO);
    const endObj = new Date(endISO);
    let status = "Upcoming";
    const now = new Date();
    if (now >= startObj && now <= endObj) status = "Occupied";
    else if (now > endObj) status = "Available";

    const newRoom = {
      id: Date.now().toString(),
      name: addRoomName,
      floor: `${Math.max(1, Math.floor((parseInt(addRoomName.match(/\d+/)?.[0] || "100") / 100)))}th floor`,
      capacity: "N/A",
      status,
      eventTitle: addEventTitle,
      date: addDate,
      startTime: status === "Occupied" ? startISO : null,
      endTime: status === "Occupied" ? endISO : null,
      color: pickColorForName(addRoomName),
      bookings: status === "Occupied" ? [{
        id: Date.now().toString() + "_admin",
        startTime: startISO,
        endTime: endISO,
        description: addEventTitle,
        bookedBy: { id: "admin", username: "admin" },
        createdAt: new Date().toISOString()
      }] : [],
      description: addDescription,
      bookedBy: status === "Occupied" ? { id: "admin", username: "admin" } : null,
    };
    setRooms(prev => [newRoom, ...prev]);
    setAddRoomName(""); setAddDate(getTodayDateString()); setAddStartTime(""); setAddEndTime(""); setAddEventTitle(""); setAddDescription("");
    setAddModalVisible(false);
  };

  const filteredRooms = useMemo(() => {
    let result = rooms;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      result = result.filter(r => (r.name || "").toLowerCase().includes(q) || (r.eventTitle || "").toLowerCase().includes(q));
    }
    return result;
  }, [rooms, query, seed]);

  const onRefresh = () => {
    setRefreshing(true);
    (async () => {
      const stored = await loadRooms();
      if (stored) setRoomsState(stored);
      else {
        const seedData = generateSampleRooms();
        setRoomsState(seedData);
        await saveRooms(seedData);
      }
      setTimeout(() => setRefreshing(false), 700);
    })();
  };

  const onProfilePress = () => router.push("/settings");

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.welcome}>Welcome back</Text>
            <Text style={styles.title}>Rooms</Text>
          </View>
          <TouchableOpacity style={styles.profileBtn} onPress={onProfilePress}>
            {profile?.imageUri ? <Image source={{ uri: profile.imageUri }} style={styles.profileImage} /> : <Image source={require("../assets/icon.png")} style={styles.profileImage} />}
          </TouchableOpacity>
        </View>

        {/* Top bar */}
        <View style={styles.topCard}>
          <View style={styles.topRow}>
            <View style={styles.searchContainer}>
              <TextInput value={query} onChangeText={setQuery} placeholder="Search rooms..." placeholderTextColor="#cbd5e1" style={styles.searchInput} />
              <Ionicons name="search" size={18} color="#fff" />
            </View>
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <FlatList
            data={filteredRooms}
            extraData={seed}
            keyExtractor={(i) => i.id}
            renderItem={({ item }) => (
              <RoomCard
                item={item}
                onPress={(it) => router.push(`/room/${it.id}`)}
                onUsePress={handleUsePress}
                onLeavePress={handleLeavePress}
                isAdmin={isAdmin}
                currentUser={currentUser}
              />
            )}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            contentContainerStyle={{ paddingVertical: 8 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
            ListEmptyComponent={() => (
              <View style={styles.emptyState}>
                <Ionicons name="folder-open-outline" size={36} color="#fff" />
                <Text style={styles.emptyTitle}>No rooms found</Text>
              </View>
            )}
          />
        </View>

        {/* FAB (admin only) */}
        {isAdmin && (
          <TouchableOpacity style={styles.fab} onPress={() => setAddModalVisible(true)}>
            <Ionicons name="add" size={28} color="#fff" />
          </TouchableOpacity>
        )}

        {/* ADD ROOM MODAL (admin) */}
        <Modal visible={addModalVisible} animationType="slide" transparent>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
                <Text style={styles.modalTitle}>Add New Room / Booking (Admin)</Text>
                <Text style={styles.modalLabel}>ROOM NAME (e.g. Room 305)</Text>
                <TextInput style={styles.inputPill} value={addRoomName} onChangeText={setAddRoomName} placeholder="e.g. Room 105" placeholderTextColor="#94a3b8" />
                <Text style={styles.modalLabel}>DATE (YYYY-MM-DD)</Text>
                <TextInput style={styles.inputPill} value={addDate} onChangeText={setAddDate} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" />
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalLabel}>START (HH:MM)</Text>
                    <TextInput style={styles.inputPill} value={addStartTime} onChangeText={setAddStartTime} placeholder="14:00" placeholderTextColor="#94a3b8" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalLabel}>END (HH:MM)</Text>
                    <TextInput style={styles.inputPill} value={addEndTime} onChangeText={setAddEndTime} placeholder="15:00" placeholderTextColor="#94a3b8" />
                  </View>
                </View>
                <Text style={styles.modalLabel}>EVENT TITLE</Text>
                <TextInput style={styles.inputPill} value={addEventTitle} onChangeText={setAddEventTitle} placeholder="Meeting Title" placeholderTextColor="#94a3b8" />
                <Text style={styles.modalLabel}>DESCRIPTION (optional)</Text>
                <TextInput style={styles.inputPill} value={addDescription} onChangeText={setAddDescription} placeholder="Short description" placeholderTextColor="#94a3b8" />

                <TouchableOpacity style={styles.enterBtn} onPress={submitAdd}>
                  <Text style={styles.enterBtnText}>CREATE ROOM</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.cancelBtn} onPress={() => setAddModalVisible(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* USER BOOKING MODAL (non-admin) */}
        <Modal visible={userBookingModalVisible} animationType="slide" transparent>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
                <Text style={styles.modalTitle}>Confirm Booking</Text>

                <Text style={styles.modalLabel}>ROOM</Text>
                <Text style={{ color: "#fff", fontSize: 16, marginBottom: 8 }}>{bookingRoom?.name}</Text>

                <Text style={styles.modalLabel}>DATE (YYYY-MM-DD)</Text>
                <TextInput style={styles.inputPill} value={bookingDate} onChangeText={setBookingDate} placeholder="2025-11-24" placeholderTextColor="#94a3b8" />

                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalLabel}>START (HH:MM)</Text>
                    <TextInput style={styles.inputPill} value={bookingStart} onChangeText={setBookingStart} placeholder="14:00" placeholderTextColor="#94a3b8" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalLabel}>END (HH:MM)</Text>
                    <TextInput style={styles.inputPill} value={bookingEnd} onChangeText={setBookingEnd} placeholder="15:00" placeholderTextColor="#94a3b8" />
                  </View>
                </View>

                <Text style={styles.modalLabel}>DESCRIPTION (optional)</Text>
                <TextInput style={styles.inputPill} value={bookingDescription} onChangeText={setBookingDescription} placeholder="e.g. Group study" placeholderTextColor="#94a3b8" />

                <TouchableOpacity style={styles.enterBtn} onPress={confirmUserBooking}>
                  <Text style={styles.enterBtnText}>CONFIRM BOOKING</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.cancelBtn} onPress={() => setUserBookingModalVisible(false)}>
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

/* Styles (unchanged) */
const SHADOW = Platform.select({ ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.16, shadowRadius: 12 }, android: { elevation: 6 } });

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0F1724" },
  container: { flex: 1, padding: 16 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  welcome: { color: "#9FB4C8", fontSize: 12 },
  title: { color: "#E6F2FA", fontSize: 22, fontWeight: "700" },
  profileBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#23303A", alignItems: "center", justifyContent: "center" },
  profileImage: { width: 44, height: 44, borderRadius: 12 },
  topCard: { backgroundColor: "#263238", borderRadius: 14, padding: 12, ...SHADOW },
  topRow: { flexDirection: "row", alignItems: "center" },
  searchContainer: { flex: 1, height: 46, borderRadius: 22, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#3B444A" },
  searchInput: { flex: 1, color: "#fff", fontSize: 14, paddingVertical: 6 },
  content: { marginTop: 12, flex: 1, backgroundColor: "#0F1724", borderRadius: 8 },
  emptyState: { alignItems: "center", paddingTop: 28 },
  emptyTitle: { color: "#fff", fontSize: 16, marginTop: 8, fontWeight: "700" },
  fab: { position: "absolute", right: 18, bottom: 22, backgroundColor: "#1F6FEB", width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", ...SHADOW },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(5,10,15,0.8)", justifyContent: "center", padding: 18 },
  modalCard: { backgroundColor: "#39404A", borderRadius: 16, padding: 20, maxHeight: "80%" },
  modalTitle: { color: "#EAF6FF", fontSize: 18, fontWeight: "800", marginBottom: 15 },
  modalLabel: { color: "#9fb4c8", fontSize: 11, marginBottom: 8, marginTop: 12, letterSpacing: 1 },
  inputPill: { backgroundColor: "#EEF2F6", borderRadius: 18, paddingVertical: 10, paddingHorizontal: 12, color: "#0f1724" },
  enterBtn: { marginTop: 24, backgroundColor: "#1F6FEB", paddingVertical: 14, borderRadius: 22, alignItems: "center", ...SHADOW },
  enterBtnText: { color: "#fff", fontWeight: "800" },
  cancelBtn: { marginTop: 12, alignItems: "center", padding: 10 },
  cancelBtnText: { color: "#ccc" },
});