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

// CATAAS Cat Utility Functions
const getRandomCatImage = () => {
  const baseUrl = "https://cataas.com/cat";
  const timestamp = Date.now();
  const tags = ['cute', 'funny', 'sleepy', 'happy', 'curious', 'playful'];
  const randomTag = tags[Math.floor(Math.random() * tags.length)];
  return `${baseUrl}?tag=${randomTag}&${timestamp}`;
};

const getWelcomeCatImage = () => {
  const baseUrl = "https://cataas.com/cat";
  const timestamp = Date.now();
  return `${baseUrl}/says/Welcome!?size=30&color=white&${timestamp}`;
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
  const [welcomeCatImage, setWelcomeCatImage] = useState("");
  const [statusFilter, setStatusFilter] = useState("All"); // "All", "Available", "Occupied", "Upcoming"

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
  
  // Time format state
  const [bookingStartAmPm, setBookingStartAmPm] = useState('AM');
  const [bookingEndAmPm, setBookingEndAmPm] = useState('PM');

  useEffect(() => {
    // Set welcome cat image
    setWelcomeCatImage(getWelcomeCatImage());
    
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
    setBookingStartAmPm('AM');
    setBookingEndAmPm('PM');
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

    // Convert time to 24-hour format for calculation
    const convertTo24Hour = (time, ampm) => {
      const [hours, minutes] = time.split(':').map(part => parseInt(part));
      let finalHours = hours;
      
      if (ampm === 'PM' && hours < 12) {
        finalHours = hours + 12;
      } else if (ampm === 'AM' && hours === 12) {
        finalHours = 0;
      }
      
      return `${finalHours.toString().padStart(2, '0')}:${minutes ? minutes.toString().padStart(2, '0') : '00'}`;
    };

    const startTime24 = convertTo24Hour(bookingStart, bookingStartAmPm);
    const endTime24 = convertTo24Hour(bookingEnd, bookingEndAmPm);

    const startISO = `${bookingDate}T${startTime24}:00`;
    const endISO = `${bookingDate}T${endTime24}:00`;
    const startObj = new Date(startISO);
    const endObj = new Date(endISO);
    
    if (!(startObj instanceof Date) || isNaN(startObj) || !(endObj instanceof Date) || isNaN(endObj)) {
      Alert.alert("Invalid date/time", "Please enter valid date and times (HH:MM AM/PM).");
      return;
    }
    
    if (endObj <= startObj) {
      Alert.alert("Invalid range", "End time must be after start time.");
      return;
    }

    // Check maximum duration (4 hours)
    const durationHours = (endObj - startObj) / (1000 * 60 * 60);
    if (durationHours > 4) {
      Alert.alert(
        "Booking Too Long", 
        `Maximum booking duration is 4 hours. Your booking is ${durationHours.toFixed(1)} hours.`,
        [{ text: "OK" }]
      );
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

  // Admin add room with 4-hour limit check
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

    // Check maximum duration (4 hours) for admin as well
    const durationHours = (endObj - startObj) / (1000 * 60 * 60);
    if (durationHours > 4) {
      Alert.alert(
        "Booking Too Long", 
        `Maximum booking duration is 4 hours. This booking is ${durationHours.toFixed(1)} hours.`,
        [{ text: "OK" }]
      );
      return;
    }

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
    
    // Apply search query filter
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      result = result.filter(r => 
        (r.name || "").toLowerCase().includes(q) || 
        (r.eventTitle || "").toLowerCase().includes(q)
      );
    }
    
    // Apply status filter
    if (statusFilter !== "All") {
      result = result.filter(r => r.status === statusFilter);
    }
    
    return result;
  }, [rooms, query, statusFilter, seed]);

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
      // Refresh welcome cat image
      setWelcomeCatImage(getWelcomeCatImage());
      setTimeout(() => setRefreshing(false), 700);
    })();
  };

  const onProfilePress = () => router.push("/settings");

  const refreshWelcomeCat = () => {
    setWelcomeCatImage(getWelcomeCatImage());
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.welcome}>Welcome back</Text>
            <Text style={styles.title}>Rooms</Text>
          </View>
          
          {/* Welcome Cat Image */}
          <TouchableOpacity onPress={refreshWelcomeCat} style={styles.catContainer}>
            <Image 
              source={{ uri: welcomeCatImage }}
              style={styles.catImage}
              onError={() => {
                // Fallback to random cat
                setWelcomeCatImage(getRandomCatImage());
              }}
            />
          </TouchableOpacity>
          
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

        {/* Room Status Filter */}
        <View style={styles.filterContainer}>
          <TouchableOpacity 
            style={[styles.filterButton, statusFilter === "All" && styles.filterButtonActive]}
            onPress={() => setStatusFilter("All")}
          >
            <Text style={[styles.filterText, statusFilter === "All" && styles.filterTextActive]}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterButton, statusFilter === "Available" && styles.filterButtonActive]}
            onPress={() => setStatusFilter("Available")}
          >
            <View style={[styles.filterDot, { backgroundColor: "#4CAF50" }]} />
            <Text style={[styles.filterText, statusFilter === "Available" && styles.filterTextActive]}>Available</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterButton, statusFilter === "Occupied" && styles.filterButtonActive]}
            onPress={() => setStatusFilter("Occupied")}
          >
            <View style={[styles.filterDot, { backgroundColor: "#F44336" }]} />
            <Text style={[styles.filterText, statusFilter === "Occupied" && styles.filterTextActive]}>Occupied</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterButton, statusFilter === "Upcoming" && styles.filterButtonActive]}
            onPress={() => setStatusFilter("Upcoming")}
          >
            <View style={[styles.filterDot, { backgroundColor: "#FFD166" }]} />
            <Text style={[styles.filterText, statusFilter === "Upcoming" && styles.filterTextActive]}>Upcoming</Text>
          </TouchableOpacity>
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
                <Image 
                  source={{ uri: getRandomCatImage() }}
                  style={styles.emptyStateCat}
                />
                <Text style={styles.emptyTitle}>
                  {statusFilter === "All" ? "No rooms found" : `No ${statusFilter.toLowerCase()} rooms`}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {statusFilter === "All" ? "Try adjusting your search" : `Try a different filter or search term`}
                </Text>
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
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Add New Room / Booking (Admin)</Text>
                  <Image 
                    source={{ uri: getRandomCatImage() }}
                    style={styles.modalCatImage}
                  />
                </View>
                <Text style={styles.modalLabel}>ROOM NAME (e.g. Room 305)</Text>
                <TextInput style={styles.inputPill} value={addRoomName} onChangeText={setAddRoomName} placeholder="e.g. Room 105" placeholderTextColor="#94a3b8" />
                <Text style={styles.modalLabel}>DATE (YYYY-MM-DD)</Text>
                <TextInput style={styles.inputPill} value={addDate} onChangeText={setAddDate} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" />
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalLabel}>START (HH:MM)</Text>
                    <TextInput style={styles.inputPill} value={addStartTime} onChangeText={setAddStartTime} placeholder="14:00 or 2:00 PM" placeholderTextColor="#94a3b8" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalLabel}>END (HH:MM)</Text>
                    <TextInput style={styles.inputPill} value={addEndTime} onChangeText={setAddEndTime} placeholder="15:00 or 3:00 PM" placeholderTextColor="#94a3b8" />
                  </View>
                </View>
                <Text style={styles.modalLabel}>EVENT TITLE</Text>
                <TextInput style={styles.inputPill} value={addEventTitle} onChangeText={setAddEventTitle} placeholder="Meeting Title" placeholderTextColor="#94a3b8" />
                <Text style={styles.modalLabel}>DESCRIPTION (optional)</Text>
                <TextInput style={styles.inputPill} value={addDescription} onChangeText={setAddDescription} placeholder="Short description" placeholderTextColor="#94a3b8" />

                <Text style={styles.maxDurationWarning}>
                  ⚠️ Maximum booking duration is 4 hours
                </Text>

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
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Confirm Booking</Text>
                  <Image 
                    source={{ uri: getRandomCatImage() }}
                    style={styles.modalCatImage}
                  />
                </View>

                <Text style={styles.modalLabel}>ROOM</Text>
                <Text style={{ color: "#fff", fontSize: 16, marginBottom: 8 }}>{bookingRoom?.name}</Text>

                <Text style={styles.modalLabel}>DATE (YYYY-MM-DD)</Text>
                <TextInput style={styles.inputPill} value={bookingDate} onChangeText={setBookingDate} placeholder="2025-11-24" placeholderTextColor="#94a3b8" />

                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalLabel}>START TIME</Text>
                    <View style={styles.timeInputContainer}>
                      <TextInput 
                        style={styles.timeInput} 
                        value={bookingStart} 
                        onChangeText={setBookingStart} 
                        placeholder="2:00" 
                        placeholderTextColor="#94a3b8" 
                      />
                    </View>
                    <View style={styles.ampmContainer}>
                      <TouchableOpacity 
                        style={[styles.ampmButton, bookingStartAmPm === 'AM' && styles.ampmButtonActive]}
                        onPress={() => setBookingStartAmPm('AM')}
                      >
                        <Text style={[styles.ampmText, bookingStartAmPm === 'AM' && styles.ampmTextActive]}>AM</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.ampmButton, bookingStartAmPm === 'PM' && styles.ampmButtonActive]}
                        onPress={() => setBookingStartAmPm('PM')}
                      >
                        <Text style={[styles.ampmText, bookingStartAmPm === 'PM' && styles.ampmTextActive]}>PM</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalLabel}>END TIME</Text>
                    <View style={styles.timeInputContainer}>
                      <TextInput 
                        style={styles.timeInput} 
                        value={bookingEnd} 
                        onChangeText={setBookingEnd} 
                        placeholder="3:00" 
                        placeholderTextColor="#94a3b8" 
                      />
                    </View>
                    <View style={styles.ampmContainer}>
                      <TouchableOpacity 
                        style={[styles.ampmButton, bookingEndAmPm === 'AM' && styles.ampmButtonActive]}
                        onPress={() => setBookingEndAmPm('AM')}
                      >
                        <Text style={[styles.ampmText, bookingEndAmPm === 'AM' && styles.ampmTextActive]}>AM</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.ampmButton, bookingEndAmPm === 'PM' && styles.ampmButtonActive]}
                        onPress={() => setBookingEndAmPm('PM')}
                      >
                        <Text style={[styles.ampmText, bookingEndAmPm === 'PM' && styles.ampmTextActive]}>PM</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                <Text style={styles.modalLabel}>DESCRIPTION (optional)</Text>
                <TextInput style={styles.inputPill} value={bookingDescription} onChangeText={setBookingDescription} placeholder="e.g. Group study" placeholderTextColor="#94a3b8" />

                <Text style={styles.maxDurationWarning}>
                  ⚠️ Maximum booking duration is 4 hours
                </Text>

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

/* Styles */
const SHADOW = Platform.select({ 
  ios: { 
    shadowColor: "#000", 
    shadowOffset: { width: 0, height: 6 }, 
    shadowOpacity: 0.16, 
    shadowRadius: 12 
  }, 
  android: { 
    elevation: 6 
  } 
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0F1724" },
  container: { flex: 1, padding: 16 },
  headerRow: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center", 
    marginBottom: 12 
  },
  headerTextContainer: {
    flex: 1,
  },
  welcome: { color: "#9FB4C8", fontSize: 12 },
  title: { color: "#E6F2FA", fontSize: 22, fontWeight: "700" },
  catContainer: {
    width: 60,
    height: 60,
    borderRadius: 12,
    overflow: "hidden",
    marginHorizontal: 12,
  },
  catImage: {
    width: "100%",
    height: "100%",
  },
  profileBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#23303A", alignItems: "center", justifyContent: "center" },
  profileImage: { width: 44, height: 44, borderRadius: 12 },
  topCard: { backgroundColor: "#263238", borderRadius: 14, padding: 12, ...SHADOW },
  topRow: { flexDirection: "row", alignItems: "center" },
  searchContainer: { flex: 1, height: 46, borderRadius: 22, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#3B444A" },
  searchInput: { flex: 1, color: "#fff", fontSize: 14, paddingVertical: 6 },
  // Filter styles
  filterContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#263238",
    borderRadius: 14,
    padding: 8,
    marginVertical: 12,
    ...SHADOW,
  },
  filterButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    marginHorizontal: 2,
  },
  filterButtonActive: {
    backgroundColor: "#1F6FEB",
  },
  filterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  filterText: {
    color: "#9FB4C8",
    fontSize: 12,
    fontWeight: "600",
  },
  filterTextActive: {
    color: "#fff",
  },
  content: { marginTop: 12, flex: 1, backgroundColor: "#0F1724", borderRadius: 8 },
  emptyState: { 
    alignItems: "center", 
    paddingTop: 28,
    paddingHorizontal: 20,
  },
  emptyStateCat: {
    width: 120,
    height: 120,
    borderRadius: 16,
    marginBottom: 16,
  },
  emptyTitle: { 
    color: "#fff", 
    fontSize: 18, 
    marginBottom: 8, 
    fontWeight: "700" 
  },
  emptySubtitle: {
    color: "#9FB4C8",
    fontSize: 14,
    textAlign: "center",
  },
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
    ...SHADOW 
  },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(5,10,15,0.8)", justifyContent: "center", padding: 18 },
  modalCard: { backgroundColor: "#39404A", borderRadius: 16, padding: 20, maxHeight: "80%" },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  modalTitle: { 
    color: "#EAF6FF", 
    fontSize: 18, 
    fontWeight: "800", 
    flex: 1,
    marginRight: 12,
  },
  modalCatImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  modalLabel: { color: "#9fb4c8", fontSize: 11, marginBottom: 8, marginTop: 12, letterSpacing: 1 },
  inputPill: { backgroundColor: "#EEF2F6", borderRadius: 18, paddingVertical: 10, paddingHorizontal: 12, color: "#0f1724" },
  // Time input styles
  timeInputContainer: {
    backgroundColor: "#EEF2F6",
    borderRadius: 18,
    overflow: "hidden",
  },
  timeInput: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    color: "#0f1724",
  },
  ampmContainer: {
    flexDirection: "row",
    marginTop: 8,
    backgroundColor: "#E8ECF0",
    borderRadius: 12,
    padding: 4,
  },
  ampmButton: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: "center",
  },
  ampmButtonActive: {
    backgroundColor: "#1F6FEB",
  },
  ampmText: {
    color: "#666",
    fontWeight: "600",
    fontSize: 12,
  },
  ampmTextActive: {
    color: "#fff",
  },
  maxDurationWarning: {
    color: "#FFD166",
    fontSize: 12,
    textAlign: "center",
    marginTop: 16,
    fontStyle: "italic",
  },
  enterBtn: { marginTop: 24, backgroundColor: "#1F6FEB", paddingVertical: 14, borderRadius: 22, alignItems: "center", ...SHADOW },
  enterBtnText: { color: "#fff", fontWeight: "800" },
  cancelBtn: { marginTop: 12, alignItems: "center", padding: 10 },
  cancelBtnText: { color: "#ccc" },
});