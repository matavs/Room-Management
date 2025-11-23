import React, { useMemo, useState, useEffect } from "react";
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
import AsyncStorage from "@react-native-async-storage/async-storage";

// --- HELPERS ---
const getTodayDateString = () => new Date().toISOString().split("T")[0];

// 1 -> "1st floor", 2 -> "2nd floor"
const getOrdinalFloor = (n) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  const suffix = (s[(v - 20) % 10] || s[v] || s[0]);
  return `${n}${suffix} floor`;
};

// Generate Filter List (1-10)
const ALL_FLOORS = ["All", ...Array.from({ length: 10 }, (_, i) => getOrdinalFloor(i + 1))];

const pickColorForName = (name) => {
  const colors = ["#FF9F43", "#2ECC71", "#E74C3C", "#6C5CE7", "#00B4D8", "#F472B6"];
  let hash = 0;
  if (!name) return colors[0];
  for (let i = 0; i < name.length; i++) hash = (hash << 5) - hash + name.charCodeAt(i);
  return colors[Math.abs(hash) % colors.length];
};

// --- SMART AVATAR: "Room 505" -> "R5" ---
const getAvatarLabel = (name) => {
  const roomMatch = name.match(/Room\s+(\d+)/i);
  if (roomMatch) {
    const number = parseInt(roomMatch[1]);
    if (number >= 1000) return "R10"; 
    return "R" + Math.floor(number / 100); 
  }
  return name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
};

// --- SMART FLOOR: "Room 505" -> "5th floor" ---
const getFloorFromRoomName = (name) => {
  const roomMatch = name.match(/Room\s+(\d+)/i);
  if (roomMatch) {
    const number = parseInt(roomMatch[1]);
    // Logic: 100-199 = 1st, 500-599 = 5th, 1000+ = 10th
    const floorNum = Math.floor(number / 100);
    return getOrdinalFloor(floorNum > 0 ? floorNum : 1); 
  }
  return "Ground floor"; // Fallback for names like "Lobby"
};

// --- GENERATE DATA ---
const generateSampleRooms = () => {
  const rooms = [];
  const now = new Date();
  
  for (let i = 1; i <= 10; i++) {
    const floorName = getOrdinalFloor(i);
    let status = "Available";
    let startTime = null;
    let endTime = null;
    let eventTitle = "Free for bookings";

    if (i === 2) { 
      status = "Occupied";
      eventTitle = "Strategy Meeting";
      startTime = new Date(now.getTime() - 30 * 60000).toISOString(); 
      endTime = new Date(now.getTime() + 30 * 60000).toISOString(); 
    } else if (i === 5) {
      status = "Upcoming";
      eventTitle = "Lunch & Learn";
      startTime = new Date(now.getTime() + 60 * 60000).toISOString();
      endTime = new Date(now.getTime() + 120 * 60000).toISOString();
    }

    // Room 101, 201, ... 1001
    const roomNum = i * 100 + 1; 

    rooms.push({
      id: i.toString(),
      name: `Room ${roomNum}`,
      floor: floorName, // Uses helper
      capacity: (8 + i).toString(),
      status: status,
      eventTitle: eventTitle,
      date: getTodayDateString(),
      startTime: startTime,
      endTime: endTime,
      color: pickColorForName(`Room ${roomNum}`),
      backupSchedule: null, 
    });
  }
  return rooms;
};

// --- TIMER COMPONENT ---
function RoomTimer({ endTime, status }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    if (status !== "Occupied" || !endTime) {
        setTimeLeft("");
        return;
    }

    const updateTimer = () => {
      const now = new Date();
      const end = new Date(endTime);
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft("Time's up!");
      } else {
        const minutes = Math.floor((diff / 1000 / 60) % 60);
        const hours = Math.floor((diff / 1000 / 60 / 60));
        const seconds = Math.floor((diff / 1000) % 60);
        setTimeLeft(`${hours > 0 ? hours + 'h ' : ''}${minutes}m ${seconds}s left`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [endTime, status]);

  if (status !== "Occupied" || !timeLeft) return null;

  return (
    <View style={styles.timerContainer}>
      <Ionicons name="time-outline" size={12} color="#FFD166" />
      <Text style={styles.timerText}>{timeLeft}</Text>
    </View>
  );
}

// --- ROOM CARD ---
function RoomCard({ item, onUsePress, onLeavePress }) {
  const isAvailable = item.status === "Available";
  const isUpcoming = item.status === "Upcoming";
  const isOccupied = item.status === "Occupied";

  const formatTime = (isoString) => {
    if (!isoString) return "";
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  let scheduleText = "";
  if (item.startTime && item.endTime) {
    scheduleText = `${formatTime(item.startTime)} - ${formatTime(item.endTime)}`;
  }

  let gapInfo = null;
  if (isUpcoming && item.startTime) {
    gapInfo = `Free until ${formatTime(item.startTime)}`;
  }

  // Dynamic Labels
  const avatarLabel = getAvatarLabel(item.name);
  
  return (
    <View style={[styles.card, isOccupied && styles.cardActiveBorder]}>
      <View style={styles.cardLeft}>
        <View style={[styles.roomAvatar, { backgroundColor: item.color || "#4C6EF5" }]}>
          <Text style={styles.roomAvatarText}>{avatarLabel}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.roomTitle}>{item.name}</Text>
          
          {(isAvailable || isUpcoming) && (
            <TouchableOpacity style={styles.useBtn} onPress={() => onUsePress(item)}>
              <Text style={styles.useBtnText}>USE</Text>
            </TouchableOpacity>
          )}
          
          {isOccupied && (
            <TouchableOpacity style={styles.leaveBtn} onPress={() => onLeavePress(item)}>
              <Text style={styles.leaveBtnText}>LEAVE</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Floor is dynamic now */}
        <Text style={styles.roomMeta}>{item.floor}</Text>

        <View style={styles.eventBox}>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    isUpcoming ? "#FFD166"
                    : isAvailable ? "#4CAF50"
                    : "#F44336",
                },
              ]}
            />
            <Text style={styles.statusText}>{item.status}</Text>
            <RoomTimer endTime={item.endTime} status={item.status} />
            
            {gapInfo && (
                <View style={styles.gapContainer}>
                   <Text style={styles.gapText}>{gapInfo}</Text>
                </View>
            )}
          </View>

          <Text numberOfLines={2} style={styles.eventText}>
            {item.eventTitle}
            {scheduleText ? <Text style={styles.timeRangeText}> • {scheduleText}</Text> : null}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const [rooms, setRooms] = useState(generateSampleRooms());
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [seed, setSeed] = useState(0); 

  // Modals
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false); 
  const [bookingModalVisible, setBookingModalVisible] = useState(false); 

  // Booking
  const [bookingMode, setBookingMode] = useState("instant"); 
  const [selectedRoomForBooking, setSelectedRoomForBooking] = useState(null);
  const [inputHours, setInputHours] = useState("0");
  const [inputMinutes, setInputMinutes] = useState("30");
  const [schedDate, setSchedDate] = useState(getTodayDateString());
  const [schedStartTime, setSchedStartTime] = useState("");
  const [schedEndTime, setSchedEndTime] = useState("");
  const [schedTitle, setSchedTitle] = useState("");

  // Add Room
  const [addRoomName, setAddRoomName] = useState("");
  const [addDate, setAddDate] = useState(getTodayDateString());
  const [addStartTime, setAddStartTime] = useState("");
  const [addEndTime, setAddEndTime] = useState("");
  const [addEventTitle, setAddEventTitle] = useState("");

  // Filter
  const [activeFilterStatus, setActiveFilterStatus] = useState("All");
  const [activeFilterFloor, setActiveFilterFloor] = useState("All");
  const [filterDate, setFilterDate] = useState(getTodayDateString());

  const [profile, setProfile] = useState({ imageUri: null, displayName: "" });

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const raw = await AsyncStorage.getItem("profileData");
        if (raw) setProfile(JSON.parse(raw));
      } catch (e) {}
    };
    loadProfile();
    const unsubscribe = router.addListener?.("focus", loadProfile);
    return () => unsubscribe?.();
  }, [router]);

  // AUTO REFRESH
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setRooms(currentRooms => {
        const hasExpiredRooms = currentRooms.some(r => 
          r.status === "Occupied" && r.endTime && now >= new Date(r.endTime)
        );
        if (!hasExpiredRooms) return currentRooms;

        const updatedRooms = currentRooms.map(r => {
          if (r.status === "Occupied" && r.endTime && now >= new Date(r.endTime)) {
            if (r.backupSchedule) {
                return {
                    ...r,
                    status: "Upcoming",
                    eventTitle: r.backupSchedule.eventTitle,
                    startTime: r.backupSchedule.startTime,
                    endTime: r.backupSchedule.endTime,
                    backupSchedule: null
                };
            } else {
                return { ...r, status: "Available", eventTitle: "Free for bookings", startTime: null, endTime: null, backupSchedule: null };
            }
          }
          return r;
        });
        setSeed(s => s + 1);
        return updatedRooms;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // USE
  const handleUsePress = (room) => {
    setSelectedRoomForBooking(room);
    setInputHours("0"); setInputMinutes("30");
    setSchedDate(getTodayDateString()); setSchedStartTime(""); setSchedEndTime(""); setSchedTitle("");
    setBookingMode("instant");
    setBookingModalVisible(true);
  };

  const handleInstantSubmit = () => {
    if (!selectedRoomForBooking) return;
    const h = parseInt(inputHours || "0", 10);
    const m = parseInt(inputMinutes || "0", 10);
    const totalMinutes = (h * 60) + m;
    if (totalMinutes <= 0) { Alert.alert("Invalid Time", "Please enter at least 1 minute."); return; }
    
    const now = new Date();
    const requestedEnd = new Date(now.getTime() + totalMinutes * 60000);

    if (selectedRoomForBooking.status === "Upcoming" && selectedRoomForBooking.startTime) {
        const nextBookingStart = new Date(selectedRoomForBooking.startTime);
        if (requestedEnd > nextBookingStart) {
            const diffMs = nextBookingStart - now;
            const maxMinutes = Math.floor(diffMs / 60000);
            if (maxMinutes <= 0) { Alert.alert("Unavailable", "Event starting now."); return; }
            Alert.alert("Time Conflict", `Next event starts in ${maxMinutes} mins. Shorten duration.`);
            return;
        }
    }

    let backup = null;
    if (selectedRoomForBooking.status === "Upcoming") {
        backup = {
            eventTitle: selectedRoomForBooking.eventTitle,
            startTime: selectedRoomForBooking.startTime,
            endTime: selectedRoomForBooking.endTime,
        };
    }

    setRooms(prevRooms => prevRooms.map(r => {
      if (r.id === selectedRoomForBooking.id) {
        return { 
          ...r, 
          status: "Occupied", 
          eventTitle: "Quick Booking", 
          startTime: now.toISOString(), 
          endTime: requestedEnd.toISOString(),
          backupSchedule: backup
        };
      }
      return r;
    }));
    setSeed(s => s + 1);
    setBookingModalVisible(false);
  };

  const handleScheduleSubmit = () => {
    if (!schedTitle.trim() || !schedStartTime.trim() || !schedEndTime.trim()) {
      Alert.alert("Missing Info", "Please fill in all fields."); return;
    }
    const startISO = `${schedDate}T${schedStartTime}:00`;
    const endISO = `${schedDate}T${schedEndTime}:00`;

    const newRoomEntry = {
      ...selectedRoomForBooking,
      id: Date.now().toString(),
      status: "Upcoming",
      eventTitle: schedTitle,
      date: schedDate,
      startTime: startISO,
      endTime: endISO,
      backupSchedule: null,
    };
    setRooms(prev => [newRoomEntry, ...prev]);
    setSeed(s => s + 1);
    setBookingModalVisible(false);
    Alert.alert("Success", "Room scheduled successfully!");
  };

  // LEAVE
  const handleLeavePress = (room) => {
    setRooms(prevRooms => prevRooms.map(r => {
         if (String(r.id) === String(room.id)) {
             if (r.backupSchedule) {
                 return {
                     ...r,
                     status: "Upcoming",
                     eventTitle: r.backupSchedule.eventTitle,
                     startTime: r.backupSchedule.startTime,
                     endTime: r.backupSchedule.endTime,
                     backupSchedule: null
                 };
             } else {
                 return { ...r, status: "Available", eventTitle: "Free for bookings", startTime: null, endTime: null, backupSchedule: null };
             }
         }
         return r;
    }));
    setSeed(s => s + 1);
  };

  // ADD (FAB)
  const submitGlobalAddForm = () => {
    if (!addRoomName.trim() || !addEventTitle.trim() || !addStartTime.trim() || !addEndTime.trim()) {
      Alert.alert("Missing Info", "Please fill in all fields."); return;
    }
    const startISO = `${addDate}T${addStartTime}:00`;
    const endISO = `${addDate}T${addEndTime}:00`;
    const now = new Date();
    const startObj = new Date(startISO);
    const endObj = new Date(endISO);

    let computedStatus = "Upcoming";
    if (now >= startObj && now <= endObj) computedStatus = "Occupied";
    else if (now > endObj) computedStatus = "Available";

    // DYNAMICALLY CALCULATE FLOOR
    const computedFloor = getFloorFromRoomName(addRoomName);

    const newRoom = {
      id: Date.now().toString(),
      name: addRoomName,
      floor: computedFloor, // <--- NOW DYNAMIC
      capacity: "N/A",
      status: computedStatus,
      eventTitle: addEventTitle,
      date: addDate,
      startTime: startISO,
      endTime: endISO,
      color: pickColorForName(addRoomName),
      backupSchedule: null,
    };

    setRooms(prev => [newRoom, ...prev]);
    setSeed(s => s + 1);
    setAddRoomName(""); setAddStartTime(""); setAddEndTime(""); setAddEventTitle("");
    setAddModalVisible(false);
  };

  // FILTER
  const filteredRooms = useMemo(() => {
    let result = rooms;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      result = result.filter(r => (r.name || "").toLowerCase().includes(q));
    }
    if (activeFilterStatus !== "All") {
        result = result.filter(r => r.status === activeFilterStatus);
    }
    if (activeFilterFloor !== "All") {
        result = result.filter(r => (r.floor || "") === activeFilterFloor);
    }
    if (filterDate) {
      result = result.filter(r => r.date === filterDate);
    }
    return result;
  }, [rooms, query, activeFilterStatus, activeFilterFloor, filterDate, seed]);

  const onRefresh = () => {
    setRefreshing(true);
    setRooms(generateSampleRooms());
    setTimeout(() => setRefreshing(false), 700);
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
          <TouchableOpacity style={styles.profileBtn} onPress={() => router.push("/settings")}>
            {profile.imageUri ? (
              <Image source={{ uri: profile.imageUri }} style={styles.profileImage} />
            ) : (
              <Image source={require("../assets/icon.png")} style={styles.profileImage} />
            )}
          </TouchableOpacity>
        </View>

        {/* Top Bar */}
        <View style={styles.topCard}>
          <View style={styles.topRow}>
            <View style={styles.searchContainer}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search rooms..."
                placeholderTextColor="#cbd5e1"
                style={styles.searchInput}
              />
              <Ionicons name="search" size={18} color="#fff" />
            </View>
          </View>
          <View style={styles.dateRow}>
             <View style={styles.datePill}>
               <Text style={styles.dateText}>{filterDate || "All Dates"}</Text>
             </View>
             <TouchableOpacity 
                style={[styles.filterBtn, (activeFilterStatus !== 'All' || activeFilterFloor !== 'All') && { backgroundColor: '#1F6FEB' }]} 
                onPress={() => setFilterModalVisible(true)}
             >
               <Ionicons name="funnel" size={18} color="#fff" />
             </TouchableOpacity>
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
                onUsePress={handleUsePress} 
                onLeavePress={handleLeavePress} 
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

        <TouchableOpacity style={styles.fab} onPress={() => setAddModalVisible(true)}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>

        {/* --- UNIFIED BOOKING MODAL --- */}
        <Modal visible={bookingModalVisible} animationType="slide" transparent>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{selectedRoomForBooking?.name}</Text>
              
              <View style={styles.tabContainer}>
                <TouchableOpacity style={[styles.tabBtn, bookingMode === 'instant' && styles.tabBtnActive]} onPress={() => setBookingMode('instant')}>
                  <Text style={[styles.tabText, bookingMode === 'instant' && styles.tabTextActive]}>INSTANT</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tabBtn, bookingMode === 'schedule' && styles.tabBtnActive]} onPress={() => setBookingMode('schedule')}>
                  <Text style={[styles.tabText, bookingMode === 'schedule' && styles.tabTextActive]}>SCHEDULE</Text>
                </TouchableOpacity>
              </View>

              {bookingMode === 'instant' ? (
                <View style={{marginTop: 20}}>
                  <Text style={styles.modalLabel}>DURATION (HH:MM)</Text>
                  <View style={styles.timeInputRow}>
                      <View style={styles.timeInputWrapper}>
                          <TextInput style={styles.timeInputBox} value={inputHours} onChangeText={setInputHours} keyboardType="numeric" placeholder="0" placeholderTextColor="#666" maxLength={2}/>
                          <Text style={styles.timeInputLabel}>HOURS</Text>
                      </View>
                      <Text style={styles.timeColon}>:</Text>
                      <View style={styles.timeInputWrapper}>
                          <TextInput style={styles.timeInputBox} value={inputMinutes} onChangeText={setInputMinutes} keyboardType="numeric" placeholder="30" placeholderTextColor="#666" maxLength={2}/>
                          <Text style={styles.timeInputLabel}>MINS</Text>
                      </View>
                  </View>
                  <TouchableOpacity style={styles.enterBtn} onPress={handleInstantSubmit}>
                    <Text style={styles.enterBtnText}>START NOW</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{marginTop: 10}}>
                   <Text style={styles.modalLabel}>DATE</Text>
                   <TextInput style={styles.inputPill} value={schedDate} onChangeText={setSchedDate} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8"/>
                   <View style={{ flexDirection: "row", gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.modalLabel}>START (HH:MM)</Text>
                        <TextInput style={styles.inputPill} value={schedStartTime} onChangeText={setSchedStartTime} placeholder="14:00" placeholderTextColor="#94a3b8"/>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.modalLabel}>END (HH:MM)</Text>
                        <TextInput style={styles.inputPill} value={schedEndTime} onChangeText={setSchedEndTime} placeholder="15:00" placeholderTextColor="#94a3b8"/>
                      </View>
                    </View>
                    <Text style={styles.modalLabel}>EVENT TITLE</Text>
                    <TextInput style={styles.inputPill} value={schedTitle} onChangeText={setSchedTitle} placeholder="Meeting Title" placeholderTextColor="#94a3b8"/>
                    <TouchableOpacity style={styles.enterBtn} onPress={handleScheduleSubmit}>
                      <Text style={styles.enterBtnText}>BOOK SCHEDULE</Text>
                    </TouchableOpacity>
                </View>
              )}
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setBookingModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* --- ADD ROOM MODAL --- */}
        <Modal visible={addModalVisible} animationType="slide" transparent>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
                <Text style={styles.modalTitle}>Add New Room / Booking</Text>
                <Text style={styles.modalLabel}>ROOM NAME (e.g. Room 305)</Text>
                <TextInput style={styles.inputPill} value={addRoomName} onChangeText={setAddRoomName} placeholder="e.g. Room 105" placeholderTextColor="#94a3b8"/>
                <Text style={styles.modalLabel}>DATE (YYYY-MM-DD)</Text>
                <TextInput style={styles.inputPill} value={addDate} onChangeText={setAddDate} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8"/>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalLabel}>START (HH:MM)</Text>
                    <TextInput style={styles.inputPill} value={addStartTime} onChangeText={setAddStartTime} placeholder="14:00" placeholderTextColor="#94a3b8"/>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalLabel}>END (HH:MM)</Text>
                    <TextInput style={styles.inputPill} value={addEndTime} onChangeText={setAddEndTime} placeholder="15:00" placeholderTextColor="#94a3b8"/>
                  </View>
                </View>
                <Text style={styles.modalLabel}>EVENT TITLE</Text>
                <TextInput style={styles.inputPill} value={addEventTitle} onChangeText={setAddEventTitle} placeholder="Meeting Title" placeholderTextColor="#94a3b8"/>
                <TouchableOpacity style={styles.enterBtn} onPress={submitGlobalAddForm}>
                  <Text style={styles.enterBtnText}>CREATE ROOM</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setAddModalVisible(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* --- FILTER MODAL --- */}
        <Modal visible={filterModalVisible} animationType="fade" transparent>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
                <Text style={styles.modalTitle}>Filters</Text>
                <Text style={styles.modalLabel}>STATUS</Text>
                <View style={styles.filterChipsRow}>
                  {["All", "Available", "Occupied", "Upcoming"].map(status => (
                    <TouchableOpacity key={status} style={[styles.filterChip, activeFilterStatus === status && styles.filterChipActive]} onPress={() => setActiveFilterStatus(status)}>
                      <Text style={[styles.filterChipText, activeFilterStatus === status && styles.filterChipTextActive]}>{status}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.modalLabel}>FLOOR</Text>
                <View style={styles.filterChipsRow}>
                  {ALL_FLOORS.map(floor => (
                    <TouchableOpacity key={floor} style={[styles.filterChip, activeFilterFloor === floor && styles.filterChipActive]} onPress={() => setActiveFilterFloor(floor)}>
                      <Text style={[styles.filterChipText, activeFilterFloor === floor && styles.filterChipTextActive]}>{floor}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.modalLabel}>DATE</Text>
                <TextInput style={styles.inputPill} value={filterDate} onChangeText={setFilterDate} placeholder="YYYY-MM-DD" placeholderTextColor="#94a3b8" />
                <TouchableOpacity style={styles.enterBtn} onPress={() => setFilterModalVisible(false)}>
                  <Text style={styles.enterBtnText}>APPLY FILTERS</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

      </View>
    </SafeAreaView>
  );
}

// --- STYLES ---
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
  dateRow: { marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  datePill: { backgroundColor: "#ECEFF1", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  dateText: { color: "#000", fontWeight: "600" },
  filterBtn: { marginLeft: 12, backgroundColor: "#2E3B44", padding: 8, borderRadius: 10 },
  content: { marginTop: 12, flex: 1, backgroundColor: "#0F1724", borderRadius: 8 },
  
  card: { flexDirection: "row", backgroundColor: "#172028", borderRadius: 12, padding: 14, alignItems: "flex-start", ...SHADOW, borderWidth: 1, borderColor: 'transparent' },
  cardActiveBorder: { borderColor: 'rgba(244, 67, 54, 0.5)', backgroundColor: '#1E1515' },
  cardLeft: { marginRight: 12 },
  roomAvatar: { width: 52, height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  roomAvatarText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  cardBody: { flex: 1 },
  cardHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  roomTitle: { color: "#EAF6FF", fontSize: 16, fontWeight: "700", flex: 1, marginRight: 8 },
  
  useBtn: { backgroundColor: '#2ECC71', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  useBtnText: { color: '#000', fontWeight: '800', fontSize: 10 },
  leaveBtn: { backgroundColor: '#E74C3C', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  leaveBtnText: { color: '#fff', fontWeight: '800', fontSize: 10 },

  roomMeta: { color: "#9fb4c8", fontSize: 12, marginTop: 6 },
  eventBox: { marginTop: 10, backgroundColor: "#0E1418", borderRadius: 10, padding: 10 },
  statusRow: { flexDirection: "row", alignItems: "center", flexWrap: 'wrap' },
  statusDot: { width: 10, height: 10, borderRadius: 10, marginRight: 8 },
  statusText: { color: "#DDEEF8", fontSize: 12, fontWeight: "700", marginRight: 10 },
  timerContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 159, 67, 0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  timerText: { color: '#FFD166', fontSize: 11, marginLeft: 4, fontWeight: '600' },
  eventText: { color: "#EAF6FF", marginTop: 8, fontSize: 13, fontWeight: "700" },
  timeRangeText: { color: "#9fb4c8", fontWeight: "400", fontSize: 13, opacity: 0.8 },
  gapContainer: { marginLeft: 10, backgroundColor: '#34495E', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  gapText: { color: '#fff', fontSize: 10, fontWeight: '600' },

  emptyState: { alignItems: "center", paddingTop: 28 },
  emptyTitle: { color: "#fff", fontSize: 16, marginTop: 8, fontWeight: "700" },
  fab: { position: "absolute", right: 18, bottom: 22, backgroundColor: "#1F6FEB", width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", ...SHADOW },
  
  modalBackdrop: { flex: 1, backgroundColor: "rgba(5,10,15,0.8)", justifyContent: "center", padding: 18 },
  modalCard: { backgroundColor: "#39404A", borderRadius: 16, padding: 20, maxHeight: '80%' },
  modalTitle: { color: "#EAF6FF", fontSize: 18, fontWeight: "800", marginBottom: 15 },
  modalLabel: { color: "#9fb4c8", fontSize: 11, marginBottom: 8, marginTop: 12, letterSpacing: 1 },
  inputPill: { backgroundColor: "#EEF2F6", borderRadius: 18, paddingVertical: 10, paddingHorizontal: 12, color: "#0f1724" },
  enterBtn: { marginTop: 24, backgroundColor: "#1F6FEB", paddingVertical: 14, borderRadius: 22, alignItems: "center", ...SHADOW },
  enterBtnText: { color: "#fff", fontWeight: "800" },
  cancelBtn: { marginTop: 12, alignItems: 'center', padding: 10},
  cancelBtnText: { color: '#ccc'},
  
  filterChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#2E3B44', borderWidth: 1, borderColor: '#455A64' },
  filterChipActive: { backgroundColor: '#1F6FEB', borderColor: '#1F6FEB' },
  filterChipText: { color: '#9fb4c8', fontSize: 12 },
  filterChipTextActive: { color: '#fff', fontWeight: '700' },

  timeInputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 10 },
  timeInputWrapper: { alignItems: 'center' },
  timeInputBox: { width: 80, height: 60, backgroundColor: '#263238', borderRadius: 12, fontSize: 28, color: '#fff', textAlign: 'center', fontWeight: '700', borderWidth: 1, borderColor: '#455A64' },
  timeInputLabel: { color: '#9fb4c8', fontSize: 10, marginTop: 6, fontWeight: '600' },
  timeColon: { color: '#fff', fontSize: 32, marginHorizontal: 10, marginBottom: 20, fontWeight: '700' },
  
  // TABS
  tabContainer: { flexDirection: 'row', marginBottom: 10, backgroundColor: '#2E3B44', borderRadius: 12, padding: 4 },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10 },
  tabBtnActive: { backgroundColor: '#3B444A' },
  tabText: { color: '#9fb4c8', fontWeight: '700', fontSize: 12 },
  tabTextActive: { color: '#fff' },
});
