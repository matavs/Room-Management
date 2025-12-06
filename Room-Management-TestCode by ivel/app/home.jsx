import React, { useEffect, useMemo, useState, useCallback } from "react";
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
  KeyboardAvoidingView,
  ActivityIndicator,
  Keyboard
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router"; 
import AsyncStorage from "@react-native-async-storage/async-storage"; 

// --- IMPORT EXTERNAL COMPONENT ---
import RoomCard from "./components/RoomCard";

// --- IMPORT UTILS ---
import {
  loadRooms,
  saveRooms,
  isAdminSession,
  loadCurrentUser,
  saveCurrentUser, 
  setAdminSession 
} from "./utils/storage";

/* --- HELPER FUNCTIONS --- */
const getTodayDateString = () => new Date().toISOString().split("T")[0];

const pickColorForName = (name) => {
  const colors = ["#FF9F43", "#2ECC71", "#E74C3C", "#6C5CE7", "#00B4D8", "#F472B6"];
  let hash = 0;
  if (!name) return colors[0];
  for (let i = 0; i < name.length; i++) hash = (hash << 5) - hash + name.charCodeAt(i);
  return colors[Math.abs(hash) % colors.length];
};

const getRandomCatImage = () => {
  const baseUrl = "https://cataas.com/cat";
  const timestamp = Date.now();
  return `${baseUrl}?tag=cute&${timestamp}`;
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
      bookings: [],
      description: "",
      bookedBy: null,
    });
  }
  return rooms;
};

/* --- MAIN SCREEN --- */
export default function HomeScreen() {
  const router = useRouter();

  const [rooms, setRoomsState] = useState([]);
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [seed, setSeed] = useState(0);
  
  const [user, setUser] = useState(null); 
  const [isAdmin, setIsAdmin] = useState(false);
  const [welcomeCatImage, setWelcomeCatImage] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  // Admin Add Modal State
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addRoomName, setAddRoomName] = useState("");
  const [addDate, setAddDate] = useState(getTodayDateString());
  const [addStartTime, setAddStartTime] = useState("");
  const [addEndTime, setAddEndTime] = useState("");
  const [addEventTitle, setAddEventTitle] = useState("");
  const [addDescription, setAddDescription] = useState("");
  
  // ADDED: AM/PM State for Admin Add Room
  const [addStartAmPm, setAddStartAmPm] = useState('AM');
  const [addEndAmPm, setAddEndAmPm] = useState('PM');

  // User Booking Modal State
  const [userBookingModalVisible, setUserBookingModalVisible] = useState(false);
  const [bookingRoom, setBookingRoom] = useState(null);
  const [bookingDate, setBookingDate] = useState(getTodayDateString());
  const [bookingStart, setBookingStart] = useState("");
  const [bookingEnd, setBookingEnd] = useState("");
  const [bookingDescription, setBookingDescription] = useState("");
  
  const [bookingStartAmPm, setBookingStartAmPm] = useState('AM');
  const [bookingEndAmPm, setBookingEndAmPm] = useState('PM');

  // --- INIT & DATA LOADING ---
  useFocusEffect(
    useCallback(() => {
      setWelcomeCatImage(getWelcomeCatImage());
      loadData();
    }, [])
  );

  const loadData = async () => {
    setLoading(true); 
    try {
        const storedRooms = await loadRooms();
        if (storedRooms && Array.isArray(storedRooms) && storedRooms.length > 0) {
          setRoomsState(storedRooms);
        } else {
          const seedData = generateSampleRooms();
          setRoomsState(seedData);
          await saveRooms(seedData);
        }
    
        const adminSession = await isAdminSession();
        setIsAdmin(adminSession);
    
        const currentUser = await loadCurrentUser();
        const rawProfile = await AsyncStorage.getItem("profileData");
        let profileSettings = {};
        if (rawProfile) {
            try { profileSettings = JSON.parse(rawProfile); } catch(e){}
        }
    
        if (currentUser) {
          setUser({ 
              ...currentUser, 
              display_name: profileSettings.displayName || currentUser.first_name || "User",
              profile_image: profileSettings.imageUri || null
          });
        }
    } catch (error) {
        console.error("Failed to load data", error);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    if (rooms.length > 0) {
        saveRooms(rooms);
    }
  }, [rooms]);

  // --- AUTO-RELEASE TIMER ---
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

  const handleLogout = async () => {
    // --- REMOVED Alert.alert wrapper so it runs immediately ---
    try {
        await saveCurrentUser(null);
        await setAdminSession(false);
    } catch (e) {
        console.log("Error clearing session:", e);
    }

    // Force navigation back to login
    router.replace("/"); 
  };
  const performInstantBooking = (room) => {
    const now = new Date();
    let endTime = new Date(now.getTime() + 60 * 60 * 1000); 

    const bookings = Array.isArray(room.bookings) ? room.bookings : [];
    const upcoming = bookings
        .filter(b => new Date(b.startTime) > now)
        .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))[0];

    if (upcoming) {
        const nextStart = new Date(upcoming.startTime);
        if (endTime > nextStart) {
            endTime = nextStart; 
            Alert.alert("Time Adjusted", "Booking shortened to fit before the next meeting.");
        }
    }

    const booking = {
        id: Date.now().toString(),
        startTime: now.toISOString(),
        endTime: endTime.toISOString(),
        description: "Instant Booking",
        bookedBy: { 
            id: user?.uuid || user?.id_number || "unknown", 
            username: user?.display_name || user?.first_name || "User" 
        },
        createdAt: new Date().toISOString(),
    };

    setRooms(prev => prev.map(r => {
        if (String(r.id) !== String(room.id)) return r;
        const nextBookings = Array.isArray(r.bookings) ? [...r.bookings, booking] : [booking];
        return { ...r, bookings: nextBookings }; 
    }));

    setSeed(s => s + 1);
  };

  const handleUsePress = (room) => {
    if (Platform.OS === 'web') {
        const choice = window.confirm(`Use ${room.name}?\nOK for Instant (1 Hour). Cancel to Schedule.`);
        if (choice) performInstantBooking(room);
        else {
            setBookingRoom(room);
            setBookingDate(getTodayDateString());
            setUserBookingModalVisible(true);
        }
        return;
    }

    Alert.alert(
        `Use ${room.name}`,
        "Do you want to use the room now or schedule for later?",
        [
            { text: "Cancel", style: "cancel" },
            {
                text: "Schedule Later",
                onPress: () => {
                    setBookingRoom(room);
                    setBookingDate(getTodayDateString());
                    setBookingStart("");
                    setBookingEnd("");
                    setBookingDescription("");
                    setBookingStartAmPm('AM');
                    setBookingEndAmPm('PM');
                    setUserBookingModalVisible(true);
                }
            },
            {
                text: "Instant (1 Hour)",
                onPress: () => performInstantBooking(room),
                style: "default"
            }
        ]
    );
  };

  const confirmUserBooking = () => {
    if (!bookingRoom || !user) {
      Alert.alert("Error", "Missing booking context or user session.");
      return;
    }
    
    const convertTo24Hour = (time, ampm) => {
      if (!time) return null;
      let cleanTime = time.includes(':') ? time : `${time}:00`;
      const [hoursStr, minutesStr] = cleanTime.split(':');
      let hours = parseInt(hoursStr);
      const minutes = parseInt(minutesStr || '0');

      if (isNaN(hours) || isNaN(minutes)) return null;

      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;

      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    };

    if (!bookingStart || !bookingEnd) { 
        Alert.alert("Missing Time", "Please enter start and end time"); return; 
    }

    const startTime24 = convertTo24Hour(bookingStart, bookingStartAmPm);
    const endTime24 = convertTo24Hour(bookingEnd, bookingEndAmPm);

    if (!startTime24 || !endTime24) {
         Alert.alert("Invalid Time", "Please use format HH:MM (e.g. 2:30)"); return;
    }

    const startISO = `${bookingDate}T${startTime24}:00`;
    const endISO = `${bookingDate}T${endTime24}:00`;
    const startObj = new Date(startISO);
    const endObj = new Date(endISO);
    
    if (isNaN(startObj.getTime()) || isNaN(endObj.getTime())) {
        Alert.alert("Invalid Date/Time", "Please check your inputs."); return;
    }
    
    if (startObj >= endObj) {
        Alert.alert("Invalid Range", "End time must be after start time."); return;
    }

    const roomCurrent = rooms.find(r => String(r.id) === String(bookingRoom.id));
    if (!roomCurrent) { Alert.alert("Error", "Room not found"); return; }
    
    const existing = Array.isArray(roomCurrent.bookings) ? roomCurrent.bookings.slice() : [];
    if (roomCurrent.startTime && roomCurrent.endTime && (!existing || existing.length === 0)) {
       existing.push({ id: "__legacy__", startTime: roomCurrent.startTime, endTime: roomCurrent.endTime });
    }

    const intervalsOverlap = (aStart, aEnd, bStart, bEnd) => {
        return aStart < bEnd && bStart < aEnd;
    };

    const hasConflict = existing.some(b => {
      const bStart = new Date(b.startTime);
      const bEnd = new Date(b.endTime);
      return intervalsOverlap(startObj, endObj, bStart, bEnd);
    });

    if (hasConflict) {
      Alert.alert("Conflict", "Time conflicts with existing booking.");
      return;
    }
    
    const durationHours = (endObj - startObj) / (1000 * 60 * 60);
    if (durationHours > 4) {
      Alert.alert("Too Long", "Max duration is 4 hours.");
      return;
    }

    const booking = {
      id: Date.now().toString(),
      startTime: startISO,
      endTime: endISO,
      description: bookingDescription?.trim() || "",
      bookedBy: { 
        id: user.uuid || user.id_number || "unknown", 
        username: user.display_name || user.first_name || "User" 
      },
      createdAt: new Date().toISOString(),
    };

    setRooms(prev => prev.map(r => {
      if (String(r.id) !== String(roomCurrent.id)) return r;
      const nextBookings = Array.isArray(r.bookings) ? [...r.bookings, booking] : [booking];
      return { ...r, bookings: nextBookings }; 
    }));

    setUserBookingModalVisible(false);
    setBookingRoom(null);
    setSeed(s => s + 1);
    Alert.alert("Booked", "Booking confirmed!");
  };

  const handleDeleteRoom = (room) => {
    if (!isAdmin) {
        Alert.alert("Denied", "You must be an Admin to delete rooms.");
        return;
    }

    const performDelete = () => {
        setRoomsState(prev => {
            const newRooms = prev.filter(r => String(r.id) !== String(room.id));
            return newRooms;
        });
        setSeed(prev => prev + 1); 
    };

    if (Platform.OS === 'web') {
        if(window.confirm(`Delete ${room.name} permanently?`)) performDelete();
    } else {
        Alert.alert(
            "Delete Room",
            `Are you sure you want to delete ${room.name}?`,
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Delete", 
                    style: "destructive", 
                    onPress: performDelete 
                }
            ]
        );
    }
  };


  const handleLeavePress = (room, bookingId) => {
    const booking = (room.bookings || []).find(b => String(b.id) === String(bookingId));
    
    const isOwner = booking && user && String(booking.bookedBy?.id) === String(user.uuid || user.id_number);
    
    if (!isAdmin && !isOwner) {
       Alert.alert("Not allowed", "Only booking owner can cancel this booking.");
       return;
    }
    
    setRooms(prev => {
        // Create a new array to force state update
        return prev.map(r => {
            if (String(r.id) !== String(room.id)) return r;
            
            // 1. Remove the booking
            const bookings = Array.isArray(r.bookings) ? r.bookings.slice() : [];
            const updatedBookings = bookings.filter(b => b.id !== bookingId);

            // 2. Recalculate status immediately
            const now = new Date();
            const active = updatedBookings.find(b => new Date(b.startTime) <= now && now < new Date(b.endTime));
            const next = updatedBookings.filter(b => new Date(b.startTime) > now).sort((a,b)=>new Date(a.startTime)-new Date(b.startTime))[0];

            let newStatus = "Available";
            let newTitle = "Free for bookings";
            let newStart = null;
            let newEnd = null;
            let newBookedBy = null;

            if (active) {
                newStatus = "Occupied";
                newTitle = active.description || "Booked";
                newStart = active.startTime;
                newEnd = active.endTime;
                newBookedBy = active.bookedBy;
            } else if (next) {
                newStatus = "Upcoming";
                newTitle = next.description || "Upcoming";
                newStart = next.startTime;
                newEnd = next.endTime;
                newBookedBy = next.bookedBy;
            } 
            // Force reset if nothing is left
            else {
                newStatus = "Available";
                newTitle = "Free for bookings";
                newStart = null;
                newEnd = null;
                newBookedBy = null;
            }

            return { 
                ...r, 
                bookings: updatedBookings,
                status: newStatus,
                eventTitle: newTitle,
                startTime: newStart,
                endTime: newEnd,
                bookedBy: newBookedBy,
                lastUpdated: Date.now() // <--- THIS FORCES THE UI TO REFRESH
            };
        });
    });
    
    setSeed(s => s + 1); 
    Alert.alert("Cancelled", "Booking removed.");
  };
  // --- REVISED SUBMIT ADD FUNCTION ---
  const submitAdd = () => {
    if (!isAdmin) {
      Alert.alert("Permission denied", "Only admins can add rooms.");
      return;
    }
    
    // --- CHANGE 1: REMOVED the long validation check ---
    // We only require the Room Name now.
    if (!addRoomName) {
        Alert.alert("Missing Name", "Please enter a Room Name.");
        return;
    }

    const convertTo24Hour = (time, ampm) => {
        if (!time) return null;
        let cleanTime = time.includes(':') ? time : `${time}:00`;
        const [hoursStr, minutesStr] = cleanTime.split(':');
        let hours = parseInt(hoursStr);
        const minutes = parseInt(minutesStr || '0');
        if (isNaN(hours) || isNaN(minutes)) return null;
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    };

    // Try to convert times (if the user typed them)
    const startTime24 = convertTo24Hour(addStartTime, addStartAmPm);
    const endTime24 = convertTo24Hour(addEndTime, addEndAmPm);

    let startISO = null;
    let endISO = null;
    let status = "Available"; // Default to Available if no time provided
    let initialBookings = [];
    let initialBookedBy = null;
    let finalEventTitle = addEventTitle || "Free for bookings";

    // --- CHANGE 2: Only calculate time logic IF the user provided time ---
    if (addDate && startTime24 && endTime24) {
        startISO = `${addDate}T${startTime24}:00`;
        endISO = `${addDate}T${endTime24}:00`;
        const startObj = new Date(startISO);
        const endObj = new Date(endISO);

        if (!isNaN(startObj.getTime()) && !isNaN(endObj.getTime()) && startObj < endObj) {
            // Valid time provided, so calculate status
            const now = new Date();
            if (now >= startObj && now <= endObj) status = "Occupied";
            else if (now > endObj) status = "Available";
            else status = "Upcoming";

            finalEventTitle = addEventTitle || "Reserved";

            // Add the admin booking
            initialBookings = [{
                id: Date.now().toString() + "_admin",
                startTime: startISO,
                endTime: endISO,
                description: finalEventTitle,
                bookedBy: { id: "admin", username: "Admin" },
                createdAt: new Date().toISOString()
            }];

            if (status === "Occupied") {
                initialBookedBy = { id: "admin", username: "Admin" };
            }
        }
    }

    const newRoom = {
      id: Date.now().toString(),
      name: addRoomName,
      floor: "1st Floor", 
      capacity: "10",
      status: status,
      eventTitle: finalEventTitle,
      date: addDate || getTodayDateString(), // Use provided date or today
      startTime: startISO, // Will be null if you didn't type a time
      endTime: endISO,     // Will be null if you didn't type a time
      color: pickColorForName(addRoomName),
      bookings: initialBookings,
      description: addDescription,
      bookedBy: initialBookedBy,
    };
    
    setRooms(prev => [newRoom, ...prev]);
    
    // Reset inputs
    setAddRoomName(""); setAddDate(getTodayDateString()); 
    setAddStartTime(""); setAddEndTime(""); 
    setAddEventTitle(""); setAddDescription("");
    setAddStartAmPm("AM"); setAddEndAmPm("PM");

    setAddModalVisible(false);
    Alert.alert("Success", "Room added.");
  };
  
  const filteredRooms = useMemo(() => {
    let result = rooms;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      result = result.filter(r => 
        (r.name || "").toLowerCase().includes(q) || 
        (r.eventTitle || "").toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "All") {
      result = result.filter(r => r.status === statusFilter);
    }
    return result;
  }, [rooms, query, statusFilter, seed]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData().then(() => setTimeout(() => setRefreshing(false), 700));
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity 
            style={styles.headerTextContainer} 
            onPress={() => router.push("/settings")} 
            activeOpacity={0.7}
          >
            <Text style={styles.welcome}>Welcome back,</Text>
            <Text style={styles.title} numberOfLines={1}>
              {user ? user.display_name : "Guest"}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
             <Ionicons name="log-out-outline" size={26} color="#FF5252" />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push("/settings")} style={styles.catContainer}>
            {user && user.profile_image ? (
                <Image source={{ uri: user.profile_image }} style={styles.catImage} />
            ) : (
                <Image 
                    source={{ uri: welcomeCatImage }}
                    style={styles.catImage}
                    onError={() => setWelcomeCatImage(getRandomCatImage())}
                />
            )}
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

        <View style={styles.filterContainer}>
            {["All", "Available", "Occupied", "Upcoming"].map(f => (
                <TouchableOpacity 
                    key={f} 
                    style={[styles.filterButton, statusFilter === f && styles.filterButtonActive]}
                    onPress={() => setStatusFilter(f)}
                >
                    <Text style={[styles.filterText, statusFilter === f && styles.filterTextActive]}>{f}</Text>
                </TouchableOpacity>
            ))}
        </View>

        <View style={styles.content}>
          {loading ? (
             <View style={styles.loadingContainer}>
                 <ActivityIndicator size="large" color="#1F6FEB" />
             </View>
          ) : (
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
                    onDeletePress={handleDeleteRoom} 
                    isAdmin={isAdmin}
                    currentUser={user}
                />
                )}
                ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
                contentContainerStyle={{ paddingVertical: 8 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
                ListEmptyComponent={() => <Text style={styles.emptyTitle}>No rooms found</Text>}
            />
          )}
        </View>

        {isAdmin && (
          <TouchableOpacity style={styles.fab} onPress={() => setAddModalVisible(true)}>
            <Ionicons name="add" size={28} color="#fff" />
          </TouchableOpacity>
        )}

        {/* ADMIN ADD ROOM MODAL */}
        <Modal visible={addModalVisible} animationType="slide" transparent>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{flex: 1}}>
              <View style={styles.modalBackdrop}>
                <View style={styles.modalCard}>
                  <ScrollView 
                    contentContainerStyle={{ paddingBottom: 20 }}
                    keyboardShouldPersistTaps="handled" // Allows clicking inputs
                  >
                    <View style={styles.modalHeader}>
                      <Text style={styles.modalTitle}>Add New Room (Admin)</Text>
                    </View>
                    <Text style={styles.modalLabel}>ROOM NAME</Text>
                    <TextInput style={styles.inputPill} value={addRoomName} onChangeText={setAddRoomName} placeholder="e.g. Room 105" placeholderTextColor="#94a3b8" />
                    <Text style={styles.modalLabel}>DATE</Text>
                    <TextInput style={styles.inputPill} value={addDate} onChangeText={setAddDate} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" />
                    
                    {/* NEW TIME SELECTORS WITH AM/PM */}
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.modalLabel}>START TIME</Text>
                        <View style={styles.timeInputContainer}>
                          <TextInput 
                            style={styles.timeInput} 
                            value={addStartTime} 
                            onChangeText={setAddStartTime} 
                            placeholder="2:00" 
                            placeholderTextColor="#94a3b8" 
                            keyboardType="numbers-and-punctuation"
                          />
                        </View>
                        <View style={styles.ampmContainer}>
                          <TouchableOpacity 
                            style={[styles.ampmButton, addStartAmPm === 'AM' && styles.ampmButtonActive]}
                            onPress={() => setAddStartAmPm('AM')}
                          >
                            <Text style={[styles.ampmText, addStartAmPm === 'AM' && styles.ampmTextActive]}>AM</Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={[styles.ampmButton, addStartAmPm === 'PM' && styles.ampmButtonActive]}
                            onPress={() => setAddStartAmPm('PM')}
                          >
                            <Text style={[styles.ampmText, addStartAmPm === 'PM' && styles.ampmTextActive]}>PM</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      
                      <View style={{ flex: 1 }}>
                        <Text style={styles.modalLabel}>END TIME</Text>
                        <View style={styles.timeInputContainer}>
                          <TextInput 
                            style={styles.timeInput} 
                            value={addEndTime} 
                            onChangeText={setAddEndTime} 
                            placeholder="3:00" 
                            placeholderTextColor="#94a3b8" 
                            keyboardType="numbers-and-punctuation"
                          />
                        </View>
                        <View style={styles.ampmContainer}>
                          <TouchableOpacity 
                            style={[styles.ampmButton, addEndAmPm === 'AM' && styles.ampmButtonActive]}
                            onPress={() => setAddEndAmPm('AM')}
                          >
                            <Text style={[styles.ampmText, addEndAmPm === 'AM' && styles.ampmTextActive]}>AM</Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={[styles.ampmButton, addEndAmPm === 'PM' && styles.ampmButtonActive]}
                            onPress={() => setAddEndAmPm('PM')}
                          >
                            <Text style={[styles.ampmText, addEndAmPm === 'PM' && styles.ampmTextActive]}>PM</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>

                    <Text style={styles.modalLabel}>EVENT TITLE</Text>
                    <TextInput style={styles.inputPill} value={addEventTitle} onChangeText={setAddEventTitle} placeholder="Title" placeholderTextColor="#94a3b8" />
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
          </KeyboardAvoidingView>
        </Modal>

        {/* USER BOOKING MODAL */}
        <Modal visible={userBookingModalVisible} animationType="slide" transparent>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{flex: 1}}>
              <View style={styles.modalBackdrop}>
                <View style={styles.modalCard}>
                  <ScrollView 
                    contentContainerStyle={{ paddingBottom: 20 }}
                    keyboardShouldPersistTaps="handled" // Allows clicking inputs
                  >
                    <View style={styles.modalHeader}>
                      <Text style={styles.modalTitle}>Confirm Booking</Text>
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
                            keyboardType="numbers-and-punctuation"
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
                            keyboardType="numbers-and-punctuation"
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
          </KeyboardAvoidingView>
        </Modal>

      </View>
    </SafeAreaView>
  );
}

// --- SHADOW DEFINITION ---
const SHADOW = Platform.select({ 
  ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.16, shadowRadius: 12 }, 
  android: { elevation: 6 } 
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0F1724" },
  container: { flex: 1, padding: 16 },
  headerRow: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center", 
    marginBottom: 12,
    zIndex: 10,
  },
  headerTextContainer: {
    flex: 1,
    marginRight: 10,
  },
  welcome: { color: "#9FB4C8", fontSize: 12 },
  title: { color: "#E6F2FA", fontSize: 18, fontWeight: "700" },
  catContainer: { width: 50, height: 50, borderRadius: 25, overflow: "hidden", marginLeft: 10, borderWidth: 1, borderColor: '#fff' },
  catImage: { width: "100%", height: "100%" },
  
  logoutBtn: {
    marginRight: 12,
    padding: 8,
    backgroundColor: 'rgba(255, 82, 82, 0.1)',
    borderRadius: 12,
    zIndex: 999,
    elevation: 5,
  },
  
  topCard: { backgroundColor: "#263238", borderRadius: 14, padding: 12, ...SHADOW },
  topRow: { flexDirection: "row", alignItems: "center" },
  searchContainer: { flex: 1, height: 46, borderRadius: 22, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#3B444A" },
  searchInput: { flex: 1, color: "#fff", fontSize: 14, paddingVertical: 6 },
  filterContainer: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#263238", borderRadius: 14, padding: 8, marginVertical: 12, ...SHADOW },
  filterButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 8, borderRadius: 8 },
  filterButtonActive: { backgroundColor: "#1F6FEB" },
  filterText: { color: "#9FB4C8", fontSize: 12, fontWeight: "600" },
  filterTextActive: { color: "#fff" },
  content: { marginTop: 12, flex: 1, backgroundColor: "#0F1724", borderRadius: 8 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  fab: { position: "absolute", right: 18, bottom: 22, backgroundColor: "#1F6FEB", width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", ...SHADOW },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(5,10,15,0.8)", justifyContent: "center", padding: 18 },
  modalCard: { backgroundColor: "#39404A", borderRadius: 16, padding: 20 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 15 },
  modalTitle: { color: "#EAF6FF", fontSize: 18, fontWeight: "800", flex: 1, marginRight: 12 },
  modalCatImage: { width: 50, height: 50, borderRadius: 8 },
  modalLabel: { color: "#9fb4c8", fontSize: 11, marginBottom: 8, marginTop: 12, letterSpacing: 1 },
  inputPill: { backgroundColor: "#EEF2F6", borderRadius: 18, paddingVertical: 10, paddingHorizontal: 12, color: "#0f1724" },
  timeInputContainer: { backgroundColor: "#EEF2F6", borderRadius: 18, overflow: "hidden" },
  timeInput: { paddingVertical: 10, paddingHorizontal: 12, color: "#0f1724" },
  ampmContainer: { flexDirection: "row", marginTop: 8, backgroundColor: "#E8ECF0", borderRadius: 12, padding: 4 },
  ampmButton: { flex: 1, paddingVertical: 6, borderRadius: 8, alignItems: "center" },
  ampmButtonActive: { backgroundColor: "#1F6FEB" },
  ampmText: { color: "#666", fontWeight: "600", fontSize: 12 },
  ampmTextActive: { color: "#fff" },
  maxDurationWarning: { color: "#FFD166", fontSize: 12, textAlign: "center", marginTop: 16, fontStyle: "italic" },
  enterBtn: { marginTop: 24, backgroundColor: "#1F6FEB", paddingVertical: 14, borderRadius: 22, alignItems: "center", ...SHADOW },
  enterBtnText: { color: "#fff", fontWeight: "800" },
  cancelBtn: { marginTop: 12, alignItems: "center", padding: 10 },
  cancelBtnText: { color: "#ccc" },
  emptyTitle: { color: "#fff", fontSize: 18, marginBottom: 8, fontWeight: "700", textAlign: 'center', marginTop: 20 },
});