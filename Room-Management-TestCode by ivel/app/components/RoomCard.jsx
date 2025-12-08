import React, { useState } from "react"; 
import { View, Text, Image, StyleSheet, Pressable, Platform, Alert, ActivityIndicator } from "react-native";
import RoomTimer from "./RoomTimer"; 
import { Ionicons } from "@expo/vector-icons";

export default function RoomCard({ 
  item, 
  onPress, 
  onUsePress, 
  onLeavePress, 
  onDeletePress, 
  isAdmin 
}) {
  
  // --- 0. LOCAL STATE (FIX: Instant updates & visual feedback) ---
  const [loadingId, setLoadingId] = useState(null);
  const [cancelledIds, setCancelledIds] = useState([]); 

  // --- 1. DATA PREP ---
  // FIX: Filter out bookings we just cancelled locally so they disappear immediately
  const rawBookings = Array.isArray(item.bookings) ? item.bookings : [];
  const bookings = rawBookings.filter(b => !cancelledIds.includes(b.id));

  // Handle legacy/simple events
  if ((!bookings || bookings.length === 0) && item.startTime && item.endTime) {
    bookings.push({
      id: "__legacy__",
      startTime: item.startTime,
      endTime: item.endTime,
      description: item.eventTitle || "",
      bookedBy: item.bookedBy || null,
      createdAt: item.createdAt || null,
    });
  }

  const now = new Date();
  
  // Check if occupied RIGHT NOW
  const currentActive = bookings.find(
    (b) => new Date(b.startTime) <= now && now < new Date(b.endTime)
  );
  
  // Find the NEXT booking
  const currentUpcoming = bookings
    .filter((b) => new Date(b.startTime) > now)
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))[0];

  // Determine Status
  let currentStatus = "Available";
  if (currentActive) {
      currentStatus = "Occupied";
  } else if (currentUpcoming) {
      // Only show "Upcoming" if starts within 30 mins
      const diffInMinutes = (new Date(currentUpcoming.startTime) - now) / 1000 / 60;
      if (diffInMinutes <= 30) {
          currentStatus = "Upcoming";
      } else {
          currentStatus = "Available"; 
      }
  }

  const currentDisplay = currentActive || currentUpcoming;

  const displayTitle = currentDisplay 
    ? (currentDisplay.description || (currentDisplay.bookedBy?.username || currentStatus)) 
    : (item.eventTitle || "Free for bookings");

  // Destructure values for the UI
  const status = currentStatus;
  const displayBooking = currentDisplay;
  const displayStart = currentDisplay ? currentDisplay.startTime : item.startTime;
  const displayEnd = currentDisplay ? currentDisplay.endTime : item.endTime;
  const activeBooking = currentActive;
  const upcoming = currentUpcoming;

  // --- 2. PERMISSIONS ---
  // FIX: Ensure we don't show cancel button for legacy/placeholder events
  const canCancel = displayBooking && isAdmin && displayBooking.id !== "__legacy__";

  // --- 3. UTILS ---
  const formatTimeWithAmPm = (isoString) => {
    if (!isoString) return "";
    return new Date(isoString).toLocaleTimeString([], { 
      hour: '2-digit', minute: '2-digit', hour12: true 
    });
  };

  const getCatImageUrl = () => {
    const baseUrl = "https://cataas.com/cat";
    let tags = ['happy', 'cute'];
    if (status === "Occupied") tags = ['angry', 'business'];
    else if (status === "Upcoming") tags = ['curious', 'waiting'];
    const randomTag = tags[Math.floor(Math.random() * tags.length)];
    return `${baseUrl}?tag=${randomTag}&uid=${item.id}-${status}`; 
  };
  const catImageUrl = getCatImageUrl();

  const getStatusColor = () => {
    if (status === "Upcoming") return "#FFD166";
    if (status === "Available") return "#4CAF50";
    return "#F44336"; 
  };

  const roomInitials = String(item.name || "").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  // Check if the current display booking is loading
  const isCancelling = displayBooking && loadingId === displayBooking.id;

  return (
    <Pressable 
      onPress={() => onPress?.(item)} 
      style={({ pressed }) => [
        styles.card, 
        status === "Occupied" && styles.cardActive,
        { opacity: pressed ? 0.9 : 1 }
      ]}
    >
      <View style={styles.left}>
        <View style={styles.catImageContainer}>
          <Image source={{ uri: catImageUrl }} style={styles.catImage} />
          <View style={styles.roomInitialsOverlay}>
            <Text style={styles.roomInitialsText}>{roomInitials}</Text>
          </View>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.headerRow}>
          <Text style={styles.name}>{item.name}</Text>
          
          <View style={styles.actionContainer}>
            
            {/* USE BUTTON */}
            {status === "Available" && (
                <Pressable 
                    onPress={(e) => {
                        e.stopPropagation(); 
                        onUsePress?.(item);
                    }} 
                    style={({ pressed }) => [styles.useBtn, { opacity: pressed ? 0.7 : 1 }]}
                    hitSlop={10} 
                >
                    <Text style={styles.useBtnText}>USE</Text>
                </Pressable>
            )}

            {/* CANCEL BUTTON (UPDATED WITH LOCAL UPDATE) */}
            {canCancel && (
              <Pressable
                onPress={(e) => {
                    e.stopPropagation(); 
                    
                    if (!displayBooking?.id) {
                        Alert.alert("Error", "This booking has no ID.");
                        return;
                    }
                    if (!onLeavePress) {
                        Alert.alert("Error", "Cancel function not connected.");
                        return;
                    }

                    // 1. Show loading state
                    setLoadingId(displayBooking.id);
                    
                    // 2. Hide this booking immediately (Local Optimistic Update)
                    setCancelledIds(prev => [...prev, displayBooking.id]);

                    // 3. Trigger parent action (Database Update)
                    onLeavePress(item, displayBooking.id);
                }}
                disabled={isCancelling} 
                style={({ pressed }) => [
                    styles.leaveBtn, 
                    { opacity: pressed || isCancelling ? 0.7 : 1, minWidth: 80, justifyContent: 'center', alignItems: 'center' }
                ]}
                hitSlop={10}
              >
                {isCancelling ? (
                    <ActivityIndicator size="small" color="#fff" />
                ) : (
                    <Text style={styles.leaveBtnText}>Admin Cancel</Text>
                )}
              </Pressable>
            )}

            {/* DELETE BUTTON */}
            {isAdmin && (
              <Pressable
                 onPress={(e) => {
                    e.stopPropagation(); 
                    onDeletePress?.(item); 
                 }}
                 style={({ pressed }) => [
                     styles.deleteIconBtn,
                     { opacity: pressed ? 0.5 : 1 }
                 ]}
                 hitSlop={15}
              >
                 <Ionicons name="trash-outline" size={20} color="#FF5252" />
              </Pressable>
            )}
            
          </View>
        </View>

        <Text style={styles.floor}>{item.floor}</Text>

        <View style={styles.eventBox}>
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: getStatusColor() }]} />
            <Text style={styles.status}>{status}</Text>
            
            {activeBooking && (
                <RoomTimer endTime={activeBooking.endTime} status={status} style={styles.timerMargin} />
            )}
            
            {!activeBooking && upcoming && (
                <Text style={styles.gap}>Next: {formatTimeWithAmPm(upcoming.startTime)}</Text>
            )}
          </View>

          <Text numberOfLines={2} style={styles.eventText}>
            {displayTitle}
            {(displayStart && displayEnd) ? (
                 <Text style={styles.timeRange}> • {formatTimeWithAmPm(displayStart)} - {formatTimeWithAmPm(displayEnd)}</Text>
            ) : null}
          </Text>

          {displayBooking && displayBooking.bookedBy && (
            <Text style={styles.bookedByText}>By: {displayBooking.bookedBy.username}</Text>
          )}
          
          {item.description && !displayBooking && (
             <Text style={styles.descText}>{item.description}</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: "#172028",
    borderRadius: 12,
    padding: 14,
    alignItems: "flex-start",
    marginBottom: 12, 
    marginHorizontal: 4,
    ...Platform.select({
      android: { elevation: 3 },
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3 }
    })
  },
  cardActive: { 
    borderColor: "rgba(244,67,54,0.4)", 
    borderWidth: 1, 
    backgroundColor: "#1E1515" 
  },
  left: { marginRight: 12 },
  catImageContainer: {
    width: 52, 
    height: 52, 
    borderRadius: 12, 
    overflow: "hidden", 
    position: "relative", 
    backgroundColor: '#333',
  },
  catImage: { width: "100%", height: "100%", borderRadius: 12 },
  roomInitialsOverlay: {
    position: "absolute", 
    bottom: 2, 
    right: 2, 
    backgroundColor: "rgba(0, 0, 0, 0.6)", 
    borderRadius: 6, 
    paddingHorizontal: 4, 
    paddingVertical: 2,
  },
  roomInitialsText: { color: "#fff", fontWeight: "700", fontSize: 10 },
  body: { flex: 1 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  name: { color: "#EAF6FF", fontWeight: "700", fontSize: 16, flex: 1 },
  actionContainer: { flexDirection: "row", alignItems: "center" },
  useBtn: { 
    backgroundColor: "#2ECC71", 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 6, 
    marginLeft: 8,
    zIndex: 10, 
    elevation: 10, 
  },
  useBtnText: { color: "#000", fontWeight: "800", fontSize: 10 },
  leaveBtn: { 
    backgroundColor: "#D32F2F", 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 6, 
    marginLeft: 8,
    zIndex: 10, 
    elevation: 10, 
  },
  leaveBtnText: { color: "#fff", fontWeight: "800", fontSize: 10 },
  deleteIconBtn: {
    marginLeft: 10,
    padding: 4, 
    zIndex: 15,
    elevation: 15,
  },
  floor: { color: "#9fb4c8", fontSize: 12, marginTop: 6 },
  eventBox: { marginTop: 10, backgroundColor: "#0E1418", borderRadius: 10, padding: 10 },
  statusRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  dot: { width: 10, height: 10, borderRadius: 10, marginRight: 8 },
  status: { color: "#DDEEF8", fontSize: 12, fontWeight: "700" },
  timerMargin: { marginLeft: 8 },
  gap: { 
    marginLeft: 8, 
    backgroundColor: "#34495E", 
    color: "#fff", 
    paddingHorizontal: 6, 
    paddingVertical: 2, 
    borderRadius: 4, 
    fontSize: 10, 
    marginTop: 4 
  },
  eventText: { color: "#EAF6FF", marginTop: 8, fontSize: 13, fontWeight: "700" },
  timeRange: { color: "#9fb4c8", fontWeight: "400", fontSize: 13, opacity: 0.8 },
  descText: { color: "#CFE8FF", marginTop: 6, fontSize: 12, fontStyle: "italic" },
  bookedByText: { color: "#9FB4C8", marginTop: 6, fontSize: 11 },
});