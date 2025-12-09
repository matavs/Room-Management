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
import DateTimePicker from '@react-native-community/datetimepicker'; 
import * as ImagePicker from 'expo-image-picker';
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
      image: null, 
      bookings: [], 
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

  // Status Filter State
  const [statusFilter, setStatusFilter] = useState("All");

  // --- ADMIN ADD/EDIT MODAL STATE ---
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editRoomId, setEditRoomId] = useState(null);

  const [roomName, setRoomName] = useState("");
  const [roomFloor, setRoomFloor] = useState(""); // NEW: Manual Floor State
  const [roomImage, setRoomImage] = useState(null);
  const [roomDate, setRoomDate] = useState(getTodayDateString());
  const [roomStartTime, setRoomStartTime] = useState("");
  const [roomStartPeriod, setRoomStartPeriod] = useState("AM"); 
  const [roomEndTime, setRoomEndTime] = useState("");
  const [roomEndPeriod, setRoomEndPeriod] = useState("PM");    
  const [roomEventTitle, setRoomEventTitle] = useState("");
  const [roomDescription, setRoomDescription] = useState("");
  const [showAdminDatePicker, setShowAdminDatePicker] = useState(false);

  // --- USER BOOKING MODAL STATE ---
  const [userBookingModalVisible, setUserBookingModalVisible] = useState(false);
  const [bookingRoom, setBookingRoom] = useState(null);
  const [bookingDate, setBookingDate] = useState(new Date()); 
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [bookingStart, setBookingStart] = useState("");
  const [bookingStartPeriod, setBookingStartPeriod] = useState("AM"); 
  const [bookingEnd, setBookingEnd] = useState("");
  const [bookingEndPeriod, setBookingEndPeriod] = useState("PM");
  const [bookingDescription, setBookingDescription] = useState("");

  // --- ADMIN MANAGE BOOKINGS MODAL STATE ---
  const [manageModalVisible, setManageModalVisible] = useState(false);
  const [manageRoom, setManageRoom] = useState(null);

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

  // Auto-release mechanism
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

  // --- HANDLERS ---

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setRoomImage(result.assets[0].uri);
    }
  };

  const handleUsePress = (room) => {
    setBookingRoom(room);
    setBookingDate(new Date()); 
    setShowDatePicker(false);
    setBookingStart("");
    setBookingStartPeriod("AM");
    setBookingEnd("");
    setBookingEndPeriod("PM");
    setBookingDescription("");
    setUserBookingModalVisible(true);
  };

  const handleManagePress = (room) => {
    setManageRoom(room);
    setManageModalVisible(true);
  };

  const handleDeleteSpecificBooking = (room, bookingId) => {
    Alert.alert("Confirm Delete", "Remove this booking?", [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Delete", 
        style: "destructive", 
        onPress: () => {
          setRooms(prev => prev.map(r => {
            if (String(r.id) !== String(room.id)) return r;
            const updatedBookings = r.bookings.filter(b => b.id !== bookingId);
            setManageRoom({...r, bookings: updatedBookings});
            
            const now = new Date();
            const active = updatedBookings.find(b => new Date(b.startTime) <= now && now < new Date(b.endTime));
            const next = updatedBookings.filter(b => new Date(b.startTime) > now).sort((a,b)=>new Date(a.startTime)-new Date(b.startTime))[0];

            return {
              ...r,
              bookings: updatedBookings,
              status: active ? "Occupied" : next ? "Upcoming" : "Available",
              eventTitle: active ? active.description : next ? next.description : "Free for bookings",
              startTime: active ? active.startTime : next ? next.startTime : null,
              endTime: active ? active.endTime : next ? next.endTime : null,
              bookedBy: active ? active.bookedBy : next ? next.bookedBy : null,
            };
          }));
          setSeed(s => s + 1);
        }
      }
    ]);
  };

  const handleDeletePress = (room) => {
    Alert.alert("Delete Room", `Delete ${room.name}?`, [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: () => {
            setRooms(prev => prev.filter(r => r.id !== room.id));
            setSeed(s => s + 1);
          }
        }
      ]
    );
  };

  const handleLeavePress = (room, bookingId) => {
    if (!room || !bookingId) return;
    const booking = (room.bookings || []).find(b => String(b.id) === String(bookingId));
    const isBookingOwner = booking && currentUser && String(booking.bookedBy?.id) === String(currentUser.id);

    if (!isAdmin && !isBookingOwner) {
      Alert.alert("Not allowed", "Only booking owner can cancel this booking.");
      return;
    }

    Alert.alert("Cancel Booking", "Are you sure?", [
        { text: "No", style: "cancel" },
        { 
          text: "Yes, Cancel", 
          style: "destructive",
          onPress: () => {
             setRooms(prev => prev.map(r => {
              if (String(r.id) !== String(room.id)) return r;
              const filtered = (r.bookings || []).filter(b => String(b.id) !== String(bookingId));
              const now = new Date();
              const active = filtered.find(b => new Date(b.startTime) <= now && now < new Date(b.endTime));
              const next = filtered.filter(b => new Date(b.startTime) > now).sort((a,b)=>new Date(a.startTime)-new Date(b.startTime))[0];
              return {
                ...r,
                bookings: filtered,
                status: active ? "Occupied" : next ? "Upcoming" : "Available",
                eventTitle: active ? active.description : next ? next.description : "Free for bookings",
                startTime: active ? active.startTime : next ? next.startTime : null,
                endTime: active ? active.endTime : next ? next.endTime : null,
                bookedBy: active ? active.bookedBy : next ? next.bookedBy : null,
              };
            }));
            setSeed(s => s + 1);
          }
        }
      ]
    );
  };

  // --- ADD / EDIT HANDLERS ---

  const handleAdminAddPress = () => {
    setIsEditing(false);
    setEditRoomId(null);
    setRoomName("");
    setRoomFloor(""); // Reset Floor
    setRoomImage(null);
    setRoomDate(getTodayDateString());
    setRoomStartTime("");
    setRoomStartPeriod("AM");
    setRoomEndTime("");
    setRoomEndPeriod("PM");
    setRoomEventTitle("");
    setRoomDescription("");
    setShowAdminDatePicker(false);
    setModalVisible(true);
  };

  const handleEditPress = (room) => {
    setIsEditing(true);
    setEditRoomId(room.id);
    setRoomName(room.name);
    setRoomFloor(room.floor || ""); // Load Floor
    setRoomImage(room.image || null);
    
    setRoomDate(room.date || getTodayDateString());
    setRoomEventTitle(room.eventTitle === "Free for bookings" ? "" : room.eventTitle);
    setRoomDescription(room.description || "");

    const parseTime = (iso) => {
      if (!iso) return { time: "", period: "AM" };
      const d = new Date(iso);
      let h = d.getHours();
      const m = d.getMinutes().toString().padStart(2, '0');
      const period = h >= 12 ? "PM" : "AM";
      h = h % 12;
      h = h ? h : 12;
      return { time: `${h.toString().padStart(2, '0')}:${m}`, period };
    };

    const s = parseTime(room.startTime);
    setRoomStartTime(s.time);
    setRoomStartPeriod(s.period);

    const e = parseTime(room.endTime);
    setRoomEndTime(e.time);
    setRoomEndPeriod(e.period);

    setShowAdminDatePicker(false);
    setModalVisible(true);
  };

  const handleTimeInput = (text, setter) => {
    let cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned.length > 4) cleaned = cleaned.slice(0, 4);
    let hours = cleaned.substring(0, 2);
    let minutes = cleaned.substring(2, 4);
    if (hours.length === 2) {
      const hVal = parseInt(hours, 10);
      if (hVal > 12) hours = "12";
      if (hVal === 0) hours = "12"; 
    }
    if (minutes.length === 2) {
      const mVal = parseInt(minutes, 10);
      if (mVal > 59) minutes = "59";
    }
    if (cleaned.length > 2) {
      setter(`${hours}:${minutes}`);
    } else {
      setter(hours);
    }
  };

  const onDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (selectedDate) setBookingDate(selectedDate);
  };

  const onAdminDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') setShowAdminDatePicker(false);
    if (selectedDate) setRoomDate(selectedDate.toISOString().split("T")[0]);
  };

  const toggleDatePicker = () => setShowDatePicker(prev => !prev);
  const toggleAdminDatePicker = () => setShowAdminDatePicker(prev => !prev);

  const formatDateDisplay = (dateObjOrStr) => {
    if (typeof dateObjOrStr === 'string') return dateObjOrStr;
    return dateObjOrStr.toISOString().split('T')[0];
  };

  const convertTo24Hour = (timeStr, period) => {
    if (!timeStr) return null;
    let [hStr, mStr] = timeStr.split(":");
    if (!mStr && timeStr.length === 4) {
       hStr = timeStr.slice(0,2);
       mStr = timeStr.slice(2);
    }
    if (!mStr) return null; 
    let h = parseInt(hStr, 10);
    let m = parseInt(mStr, 10);
    if (isNaN(h) || isNaN(m)) return null;
    if (period === "PM" && h < 12) h += 12;
    if (period === "AM" && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  // --- CONFIRM USER BOOKING (WITH OVERNIGHT & NAME FIX) ---
  const confirmUserBooking = () => {
    if (!bookingRoom || !currentUser) {
      Alert.alert("Error", "Missing booking context or user.");
      return;
    }
    const dateStr = formatDateDisplay(bookingDate);
    if (!dateStr || !bookingStart || !bookingEnd) {
      Alert.alert("Missing fields", "Please provide date, start and end time.");
      return;
    }
    const start24 = convertTo24Hour(bookingStart, bookingStartPeriod);
    const end24 = convertTo24Hour(bookingEnd, bookingEndPeriod);
    if (!start24 || !end24) {
      Alert.alert("Invalid Time", "Please enter time in HH:MM format (e.g. 02:30).");
      return;
    }

    const startISO = `${dateStr}T${start24}:00`;
    let endISO = `${dateStr}T${end24}:00`;
    
    const newStartObj = new Date(startISO);
    let newEndObj = new Date(endISO);

    // Overnight Logic
    if (newEndObj <= newStartObj) {
      newEndObj.setDate(newEndObj.getDate() + 1);
      endISO = newEndObj.toISOString();
    }
    
    const newStartTime = newStartObj.getTime();
    const newEndTime = newEndObj.getTime();

    if (newEndTime === newStartTime) {
       Alert.alert("Invalid Duration", "Start and End time cannot be exactly the same.");
       return;
    }

    const roomCurrent = rooms.find(r => String(r.id) === String(bookingRoom.id));

    // Conflict Check
    const hasConflict = (roomCurrent.bookings || []).some(existingBooking => {
      const existingStart = new Date(existingBooking.startTime).getTime();
      const existingEnd = new Date(existingBooking.endTime).getTime();
      return newStartTime < existingEnd && existingStart < newEndTime;
    });

    if (hasConflict) {
      Alert.alert("Unavailable", "This time slot overlaps with an existing booking.");
      return; 
    }

    // Name Fix
    const fullName = `${currentUser.first_name || ""} ${currentUser.last_name || ""}`.trim();
    const displayName = fullName || currentUser.username || "User";

    const booking = {
      id: Date.now().toString(),
      startTime: startISO,
      endTime: endISO,
      description: bookingDescription?.trim() || "",
      bookedBy: { 
        id: currentUser.id, 
        username: displayName 
      },
      createdAt: new Date().toISOString(),
    };

    setRooms(prev => prev.map(r => {
      if (String(r.id) !== String(roomCurrent.id)) return r;
      const nextBookings = Array.isArray(r.bookings) ? [...r.bookings, booking] : [booking];
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

  // --- SUBMIT ROOM FORM (ADD OR EDIT) ---
  const submitRoomForm = () => {
    if (!isAdmin) return;
    if (!roomName.trim()) {
      Alert.alert("Missing Info", "Room Name is required.");
      return;
    }

    let startISO = null;
    let endISO = null;
    let newStatus = "Available";

    if (roomStartTime && roomEndTime) {
      const start24 = convertTo24Hour(roomStartTime, roomStartPeriod);
      const end24 = convertTo24Hour(roomEndTime, roomEndPeriod);
      if (!start24 || !end24) {
        Alert.alert("Invalid Time", "Please check time format.");
        return;
      }
      startISO = `${roomDate}T${start24}:00`;
      endISO = `${roomDate}T${end24}:00`;
      const startObj = new Date(startISO);
      const endObj = new Date(endISO);
      
      // Admin overnight check
      if (endObj <= startObj) {
         endObj.setDate(endObj.getDate() + 1);
         endISO = endObj.toISOString();
      }

      const now = new Date();
      if (now >= startObj && now <= endObj) newStatus = "Occupied";
      else if (now < startObj) newStatus = "Upcoming";
    }

    // Determine Floor Name: Use Manual input OR Fallback
    const finalFloor = roomFloor.trim() || `${Math.max(1, Math.floor((parseInt(roomName.match(/\d+/)?.[0] || "100") / 100)))}th floor`;

    if (isEditing && editRoomId) {
      setRooms(prev => prev.map(r => {
        if (r.id !== editRoomId) return r;
        
        let updatedBookings = r.bookings || [];
        if (startISO && endISO) {
           const adminBooking = {
             id: Date.now().toString() + "_admin_edit",
             startTime: startISO,
             endTime: endISO,
             description: roomEventTitle || "Admin Event",
             bookedBy: { id: "admin", username: "admin" },
             createdAt: new Date().toISOString()
           };
           updatedBookings = [...updatedBookings, adminBooking];
        }

        return {
          ...r,
          name: roomName,
          floor: finalFloor, // Save Manual Floor
          image: roomImage || r.image,
          color: pickColorForName(roomName),
          bookings: updatedBookings,
          description: roomDescription || r.description,
        };
      }));
      Alert.alert("Success", "Room updated.");
    } else {
      const newRoom = {
        id: Date.now().toString(),
        name: roomName,
        floor: finalFloor, // Save Manual Floor
        capacity: "N/A",
        status: newStatus,
        eventTitle: roomEventTitle || "Free for bookings",
        date: roomDate,
        startTime: startISO,
        endTime: endISO,
        color: pickColorForName(roomName),
        image: roomImage,
        bookings: (startISO && endISO) ? [{
          id: Date.now().toString() + "_admin",
          startTime: startISO,
          endTime: endISO,
          description: roomEventTitle || "Admin Event",
          bookedBy: { id: "admin", username: "admin" },
          createdAt: new Date().toISOString()
        }] : [],
        description: roomDescription,
        bookedBy: (newStatus === "Occupied") ? { id: "admin", username: "admin" } : null,
      };
      setRooms(prev => [newRoom, ...prev]);
      Alert.alert("Success", "Room created.");
    }

    setRoomName(""); 
    setRoomFloor("");
    setRoomImage(null);
    setRoomDate(getTodayDateString()); 
    setRoomStartTime(""); setRoomStartPeriod("AM"); 
    setRoomEndTime(""); setRoomEndPeriod("PM");
    setRoomEventTitle(""); setRoomDescription("");
    setModalVisible(false);
  };

  const filteredRooms = useMemo(() => {
    let result = rooms;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      result = result.filter(r => (r.name || "").toLowerCase().includes(q) || (r.eventTitle || "").toLowerCase().includes(q));
    }
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
      setTimeout(() => setRefreshing(false), 700);
    })();
  };

  const onProfilePress = () => router.push("/settings");

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.welcome}>Welcome to</Text>
            <Text style={styles.title}>Room Manager</Text>
          </View>
          <TouchableOpacity style={styles.profileBtn} onPress={onProfilePress}>
            {profile?.imageUri ? <Image source={{ uri: profile.imageUri }} style={styles.profileImage} /> : <Image source={require("../assets/icon.png")} style={styles.profileImage} />}
          </TouchableOpacity>
        </View>

        <View style={styles.topCard}>
          <View style={styles.topRow}>
            <View style={styles.searchContainer}>
              <TextInput value={query} onChangeText={setQuery} placeholder="Search rooms..." placeholderTextColor="#cbd5e1" style={styles.searchInput} />
              <Ionicons name="search" size={18} color="#fff" />
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {["All", "Available", "Occupied", "Upcoming"].map((status) => (
              <TouchableOpacity 
                key={status} 
                style={[styles.filterChip, statusFilter === status && styles.activeFilterChip]} 
                onPress={() => setStatusFilter(status)}
              >
                <Text style={[styles.filterText, statusFilter === status && styles.activeFilterText]}>{status}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.content}>
          <FlatList
            data={filteredRooms}
            extraData={seed}
            keyExtractor={(i) => i.id}
            renderItem={({ item }) => (
              <RoomCard
                item={item}
                onPress={isAdmin ? undefined : (it) => router.push(`/room/${it.id}`)}
                onUsePress={handleUsePress}
                onLeavePress={handleLeavePress}
                onDeletePress={isAdmin ? handleDeletePress : undefined}
                onManagePress={isAdmin ? handleManagePress : undefined}
                onEditPress={isAdmin ? handleEditPress : undefined}
                isAdmin={isAdmin}
                currentUser={currentUser}
              />
            )}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            contentContainerStyle={{ paddingVertical: 8 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
            ListEmptyComponent={() => (
              <View style={styles.emptyState}>
                <Ionicons name="filter-outline" size={36} color="#fff" />
                <Text style={styles.emptyTitle}>No rooms match filter</Text>
              </View>
            )}
          />
        </View>

        {isAdmin && (
          <TouchableOpacity style={styles.fab} onPress={handleAdminAddPress}>
            <Ionicons name="add" size={28} color="#fff" />
          </TouchableOpacity>
        )}

        {/* --- ADMIN MANAGE BOOKINGS MODAL --- */}
        <Modal visible={manageModalVisible} animationType="slide" transparent>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15}}>
                <Text style={styles.modalTitle}>Manage Bookings</Text>
                <TouchableOpacity onPress={() => setManageModalVisible(false)}>
                  <Ionicons name="close" size={24} color="#fff"/>
                </TouchableOpacity>
              </View>
              <Text style={{color: '#9FB4C8', marginBottom: 10}}>Room: {manageRoom?.name}</Text>
              <FlatList 
                data={manageRoom?.bookings?.sort((a,b) => new Date(a.startTime) - new Date(b.startTime)) || []}
                keyExtractor={(item) => item.id}
                style={{maxHeight: 400}}
                renderItem={({item}) => (
                  <View style={styles.manageRow}>
                    <View style={{flex: 1}}>
                      <Text style={styles.manageDate}>{new Date(item.startTime).toLocaleDateString()}</Text>
                      <Text style={styles.manageTime}>
                        {new Date(item.startTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - {new Date(item.endTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                      </Text>
                      <Text style={styles.manageUser}>User: {item.bookedBy?.username || "Admin"}</Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.deleteBookingBtn} 
                      onPress={() => handleDeleteSpecificBooking(manageRoom, item.id)}
                    >
                      <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
                    </TouchableOpacity>
                  </View>
                )}
                ListEmptyComponent={() => <Text style={{color: '#999', textAlign: 'center', marginVertical: 20}}>No active bookings.</Text>}
              />
            </View>
          </View>
        </Modal>

        {/* --- ADMIN ADD/EDIT ROOM MODAL --- */}
        <Modal visible={modalVisible} animationType="slide" transparent>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
                <Text style={styles.modalTitle}>{isEditing ? "Edit Room" : "Add New Room"}</Text>
                
                <Text style={styles.modalLabel}>ROOM NAME</Text>
                <TextInput style={styles.inputPill} value={roomName} onChangeText={setRoomName} placeholder="e.g. Room 105" placeholderTextColor="#94a3b8" />
                
                {/* NEW: Floor Input */}
                <Text style={styles.modalLabel}>FLOOR</Text>
                <TextInput style={styles.inputPill} value={roomFloor} onChangeText={setRoomFloor} placeholder="e.g. 1st Floor" placeholderTextColor="#94a3b8" />

                <Text style={styles.modalLabel}>ROOM IMAGE</Text>
                <TouchableOpacity style={styles.imagePickerBtn} onPress={pickImage}>
                  {roomImage ? (
                    <Image source={{ uri: roomImage }} style={{ width: '100%', height: '100%', borderRadius: 12 }} />
                  ) : (
                    <View style={{alignItems: 'center'}}>
                      <Ionicons name="camera-outline" size={24} color="#94a3b8" />
                      <Text style={{color: '#94a3b8', fontSize: 12}}>Select Image</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Optional Schedule Fields */}
                <Text style={[styles.modalLabel, {marginTop: 20}]}>OPTIONAL: INITIAL SCHEDULE</Text>
                
                <Text style={styles.modalLabel}>DATE</Text>
                <TouchableOpacity style={styles.inputPill} onPress={toggleAdminDatePicker}>
                  <Text style={{ color: roomDate ? "#0f1724" : "#94a3b8", fontSize: 14 }}>{roomDate || "Select Date"}</Text>
                  <Ionicons name="calendar-outline" size={18} color="#0f1724" style={{position:'absolute', right:12, top:12}}/>
                </TouchableOpacity>
                {showAdminDatePicker && (
                  <View style={Platform.OS === 'ios' ? styles.iosDatePickerContainer : null}>
                    <DateTimePicker value={new Date(roomDate)} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} onChange={onAdminDateChange} minimumDate={new Date()} themeVariant="dark" />
                  </View>
                )}
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalLabel}>START (HH:MM)</Text>
                    <View style={styles.responsiveTimeRow}>
                      <TextInput style={styles.timeInput} value={roomStartTime} onChangeText={(t) => handleTimeInput(t, setRoomStartTime)} placeholder="02:00" placeholderTextColor="#94a3b8" keyboardType="number-pad" maxLength={5} />
                      <TouchableOpacity style={[styles.amPmBtn, roomStartPeriod === "PM" && styles.amPmBtnActive]} onPress={() => setRoomStartPeriod(prev => prev === "AM" ? "PM" : "AM")}>
                        <Text style={[styles.amPmText, roomStartPeriod === "PM" && styles.amPmTextActive]}>{roomStartPeriod}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalLabel}>END (HH:MM)</Text>
                    <View style={styles.responsiveTimeRow}>
                      <TextInput style={styles.timeInput} value={roomEndTime} onChangeText={(t) => handleTimeInput(t, setRoomEndTime)} placeholder="03:00" placeholderTextColor="#94a3b8" keyboardType="number-pad" maxLength={5} />
                      <TouchableOpacity style={[styles.amPmBtn, roomEndPeriod === "PM" && styles.amPmBtnActive]} onPress={() => setRoomEndPeriod(prev => prev === "AM" ? "PM" : "AM")}>
                        <Text style={[styles.amPmText, roomEndPeriod === "PM" && styles.amPmTextActive]}>{roomEndPeriod}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
                <Text style={styles.modalLabel}>EVENT TITLE</Text>
                <TextInput style={styles.inputPill} value={roomEventTitle} onChangeText={setRoomEventTitle} placeholder="Meeting Title" placeholderTextColor="#94a3b8" />
                <Text style={styles.modalLabel}>DESCRIPTION (optional)</Text>
                <TextInput style={styles.inputPill} value={roomDescription} onChangeText={setRoomDescription} placeholder="Short description" placeholderTextColor="#94a3b8" />
                
                <TouchableOpacity style={styles.enterBtn} onPress={submitRoomForm}>
                  <Text style={styles.enterBtnText}>{isEditing ? "UPDATE ROOM" : "CREATE ROOM"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* --- USER BOOKING MODAL --- */}
        <Modal visible={userBookingModalVisible} animationType="slide" transparent>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
                <Text style={styles.modalTitle}>Confirm Booking</Text>
                <Text style={styles.modalLabel}>ROOM</Text>
                <Text style={{ color: "#fff", fontSize: 16, marginBottom: 8 }}>{bookingRoom?.name}</Text>
                <Text style={styles.modalLabel}>DATE</Text>
                <TouchableOpacity style={styles.inputPill} onPress={toggleDatePicker}>
                  <Text style={{ color: "#0f1724", fontSize: 14 }}>{formatDateDisplay(bookingDate)}</Text>
                  <Ionicons name="calendar-outline" size={18} color="#0f1724" style={{position:'absolute', right:12, top:12}}/>
                </TouchableOpacity>
                {showDatePicker && (
                  <View style={Platform.OS === 'ios' ? styles.iosDatePickerContainer : null}>
                    <DateTimePicker value={bookingDate} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} onChange={onDateChange} minimumDate={new Date()} themeVariant="dark" />
                  </View>
                )}
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalLabel}>START (HH:MM)</Text>
                    <View style={styles.responsiveTimeRow}>
                      <TextInput style={styles.timeInput} value={bookingStart} onChangeText={(t) => handleTimeInput(t, setBookingStart)} placeholder="02:00" placeholderTextColor="#94a3b8" keyboardType="number-pad" maxLength={5} />
                      <TouchableOpacity style={[styles.amPmBtn, bookingStartPeriod === "PM" && styles.amPmBtnActive]} onPress={() => setBookingStartPeriod(prev => prev === "AM" ? "PM" : "AM")}>
                        <Text style={[styles.amPmText, bookingStartPeriod === "PM" && styles.amPmTextActive]}>{bookingStartPeriod}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalLabel}>END (HH:MM)</Text>
                    <View style={styles.responsiveTimeRow}>
                      <TextInput style={styles.timeInput} value={bookingEnd} onChangeText={(t) => handleTimeInput(t, setBookingEnd)} placeholder="03:00" placeholderTextColor="#94a3b8" keyboardType="number-pad" maxLength={5} />
                      <TouchableOpacity style={[styles.amPmBtn, bookingEndPeriod === "PM" && styles.amPmBtnActive]} onPress={() => setBookingEndPeriod(prev => prev === "AM" ? "PM" : "AM")}>
                        <Text style={[styles.amPmText, bookingEndPeriod === "PM" && styles.amPmTextActive]}>{bookingEndPeriod}</Text>
                      </TouchableOpacity>
                    </View>
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

/* Styles */
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
  
  filterRow: { marginTop: 12, paddingHorizontal: 0, gap: 8 },
  filterChip: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#3B444A', marginRight: 8 },
  activeFilterChip: { backgroundColor: '#1F6FEB' },
  filterText: { color: '#9FB4C8', fontSize: 12, fontWeight: '600' },
  activeFilterText: { color: '#FFF' },

  content: { marginTop: 12, flex: 1, backgroundColor: "#0F1724", borderRadius: 8 },
  emptyState: { alignItems: "center", paddingTop: 28 },
  emptyTitle: { color: "#fff", fontSize: 16, marginTop: 8, fontWeight: "700" },
  fab: { position: "absolute", right: 18, bottom: 22, backgroundColor: "#1F6FEB", width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", ...SHADOW },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(5,10,15,0.8)", justifyContent: "center", padding: 18 },
  modalCard: { backgroundColor: "#39404A", borderRadius: 16, padding: 20, maxHeight: "80%" },
  modalTitle: { color: "#EAF6FF", fontSize: 18, fontWeight: "800", marginBottom: 15 },
  modalLabel: { color: "#9fb4c8", fontSize: 11, marginBottom: 8, marginTop: 12, letterSpacing: 1 },
  inputPill: { backgroundColor: "#EEF2F6", borderRadius: 18, paddingVertical: 10, paddingHorizontal: 12, color: "#0f1724", justifyContent:'center', height: 44 },
  
  // Image Picker Style
  imagePickerBtn: { height: 120, backgroundColor: '#2C353F', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginVertical: 8, borderStyle: 'dashed', borderWidth: 1, borderColor: '#586A7A' },

  iosDatePickerContainer: { backgroundColor: '#39404A', marginTop: 8, borderRadius: 12 },
  responsiveTimeRow: { flexDirection: "row", alignItems: 'center', gap: 6 },
  timeInput: { flex: 1, backgroundColor: "#EEF2F6", borderRadius: 18, paddingVertical: 10, paddingHorizontal: 12, color: "#0f1724" },
  amPmBtn: { backgroundColor: "#23303A", width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#555" },
  amPmBtnActive: { backgroundColor: "#1F6FEB", borderColor: "#1F6FEB" },
  amPmText: { color: "#9fb4c8", fontSize: 12, fontWeight: "bold" },
  amPmTextActive: { color: "#fff" },

  enterBtn: { marginTop: 24, backgroundColor: "#1F6FEB", paddingVertical: 14, borderRadius: 22, alignItems: "center", ...SHADOW },
  enterBtnText: { color: "#fff", fontWeight: "800" },
  cancelBtn: { marginTop: 12, alignItems: "center", padding: 10 },
  cancelBtnText: { color: "#ccc" },

  manageRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2C353F', padding: 12, borderRadius: 10, marginBottom: 10 },
  manageDate: { color: '#EAF6FF', fontWeight: '700', fontSize: 14 },
  manageTime: { color: '#9FB4C8', fontSize: 12, marginTop: 2 },
  manageUser: { color: '#1F6FEB', fontSize: 12, marginTop: 2, fontWeight: '600' },
  deleteBookingBtn: { padding: 8, backgroundColor: '#3A2E2E', borderRadius: 8 },
});