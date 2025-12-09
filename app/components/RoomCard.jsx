// app/components/RoomCard.jsx
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import RoomTimer from "./RoomTimer";
import { Ionicons } from "@expo/vector-icons";

export default function RoomCard({ 
  item, 
  onPress, 
  onUsePress, 
  onLeavePress, 
  onDeletePress, 
  onManagePress, 
  onEditPress, 
  isAdmin, 
  currentUser 
}) {
  const bookings = Array.isArray(item.bookings) ? item.bookings.slice() : [];

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
  const activeBooking = bookings.find(
    (b) => new Date(b.startTime) <= now && now < new Date(b.endTime)
  );
  const upcoming = bookings
    .filter((b) => new Date(b.startTime) > now)
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))[0];

  const status = activeBooking ? "Occupied" : upcoming ? "Upcoming" : "Available";
  
  const displayTitle = activeBooking 
    ? (activeBooking.description || (activeBooking.bookedBy?.username || "Booked")) 
    : upcoming 
      ? (upcoming.description || (upcoming.bookedBy?.username || "Upcoming")) 
      : (item.eventTitle || "Free for bookings");
      
  const displayStart = activeBooking ? activeBooking.startTime : upcoming ? upcoming.startTime : item.startTime;
  const displayEnd = activeBooking ? activeBooking.endTime : upcoming ? upcoming.endTime : item.endTime;

  const activeIsOwnedByCurrent = activeBooking && activeBooking.bookedBy && currentUser && String(activeBooking.bookedBy.id) === String(currentUser.id);
  const upcomingOwnedByCurrent = upcoming && upcoming.bookedBy && currentUser && String(upcoming.bookedBy.id) === String(currentUser.id);

  const showUserCancel = (activeBooking && activeIsOwnedByCurrent) || (upcoming && upcomingOwnedByCurrent);
  const showAdminManage = isAdmin && bookings.length > 0;
  const showUse = true;

  // Date Formatter
  const formatFullTimeRange = (startISO, endISO) => {
    if (!startISO || !endISO) return "";
    
    const startObj = new Date(startISO);
    const endObj = new Date(endISO);
    
    const timeOpts = { hour: '2-digit', minute: '2-digit', hour12: true };
    const sTime = startObj.toLocaleTimeString([], timeOpts);
    const eTime = endObj.toLocaleTimeString([], timeOpts);
    
    const sMonth = startObj.toLocaleString('default', { month: 'short' });
    const sDay = startObj.getDate();
    const eMonth = endObj.toLocaleString('default', { month: 'short' });
    const eDay = endObj.getDate();

    let datePart = `${sMonth} ${sDay}`;

    if (sDay !== eDay || sMonth !== eMonth) {
       if (sMonth === eMonth) {
         datePart = `${sMonth} ${sDay}-${eDay}`;
       } else {
         datePart = `${sMonth} ${sDay} - ${eMonth} ${eDay}`;
       }
    }

    return `${datePart} • ${sTime} - ${eTime}`;
  };

  const roomNumber = item.name.replace(/[^0-9]/g, '') || "RM";

  return (
    <TouchableOpacity 
      activeOpacity={onPress ? 0.95 : 1}
      onPress={() => onPress?.(item)} 
      style={[styles.card, status === "Occupied" && styles.cardActive]}
    >
      {/* 1. TOP ROW: Image + Name (Restored Image) */}
      <View style={styles.headerRow}>
         {/* IMAGE RESTORED HERE */}
        <View style={styles.imageWrapper}>
          {item.image ? (
            <Image source={{ uri: item.image }} style={styles.roomImage} />
          ) : (
            <View style={[styles.roomPlaceholder, { backgroundColor: item.color || "#34495E" }]}>
              <Text style={styles.roomPlaceholderText}>{roomNumber}</Text>
            </View>
          )}
        </View>

        <View style={styles.textWrapper}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.floor}>{item.floor}</Text>
        </View>
      </View>

      {/* 2. BUTTON ROW: Moved below the header */}
      <View style={styles.actionRow}>
        {showUse && (
          <TouchableOpacity onPress={() => onUsePress?.(item)} style={styles.useBtn}>
            <Text style={styles.useBtnText}>Book</Text>
          </TouchableOpacity>
        )}

        {showUserCancel && !showAdminManage && (
          <TouchableOpacity
            onPress={() => {
              const bookingId = activeBooking ? activeBooking.id : (upcoming ? upcoming.id : null);
              if (bookingId) onLeavePress?.(item, bookingId);
            }}
            style={styles.leaveBtn}
          >
            <Text style={styles.leaveBtnText}>Cancel</Text>
          </TouchableOpacity>
        )}

        {showAdminManage && (
          <TouchableOpacity onPress={() => onManagePress?.(item)} style={styles.manageBtn}>
            <Text style={styles.manageBtnText}>Manage</Text>
          </TouchableOpacity>
        )}

        {isAdmin && onEditPress && (
          <TouchableOpacity style={styles.iconBtn} onPress={() => onEditPress(item)}>
            <Ionicons name="pencil" size={16} color="#9FB4C8" />
          </TouchableOpacity>
        )}

        {isAdmin && onDeletePress && (
          <TouchableOpacity style={[styles.iconBtn, styles.deleteBtn]} onPress={() => onDeletePress(item)}>
            <Ionicons name="trash-outline" size={16} color="#FF6B6B" />
          </TouchableOpacity>
        )}
      </View>

      {/* 3. EVENT BOX */}
      <View style={styles.eventBox}>
        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
          <View style={[styles.dot, { backgroundColor: status === "Upcoming" ? "#FFD166" : status === "Available" ? "#4CAF50" : "#F44336" }]} />
          <Text style={styles.status}>{status}</Text>
          {activeBooking && <RoomTimer endTime={activeBooking.endTime} status={status} style={{ marginLeft: 8 }} />}
        </View>

        <Text numberOfLines={2} style={styles.eventText}>
          {displayTitle}
          {(displayStart && displayEnd) ? <Text style={styles.timeRange}>  {formatFullTimeRange(displayStart, displayEnd)}</Text> : null}
        </Text>

        {activeBooking && activeBooking.bookedBy && activeBooking.description && (
          <Text style={styles.bookedByText}>By: {activeBooking.bookedBy.username}</Text>
        )}
        
        {item.description && !activeBooking && <Text style={styles.descText}>{item.description}</Text>}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#172028",
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 4,
    flexDirection: "column",
  },
  cardActive: { 
    borderColor: "rgba(244,67,54,0.4)", 
    borderWidth: 1, 
    backgroundColor: "#1E1515" 
  },
  
  // Header Row (Image + Text)
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12, // Space between header and buttons
  },
  imageWrapper: {
    marginRight: 12,
  },
  textWrapper: {
    flex: 1,
    justifyContent: "center",
  },
  
  // Image Styles
  roomImage: {
    width: 52,
    height: 52,
    borderRadius: 12,
  },
  roomPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  roomPlaceholderText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
  },

  name: { color: "#EAF6FF", fontWeight: "700", fontSize: 18 },
  floor: { color: "#9fb4c8", fontSize: 12, marginTop: 2 },

  // Action Row (Buttons) - Now separate
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8, // Consistent spacing between buttons
    marginBottom: 4,
  },
  
  // Button Styles
  useBtn: { backgroundColor: "#2ECC71", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  useBtnText: { color: "#000", fontWeight: "800", fontSize: 12 },
  
  leaveBtn: { backgroundColor: "#E74C3C", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  leaveBtnText: { color: "#fff", fontWeight: "800", fontSize: 12 },

  manageBtn: { backgroundColor: "#34495E", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  manageBtnText: { color: "#fff", fontWeight: "800", fontSize: 12 },

  iconBtn: {
    backgroundColor: "#2C353F", 
    width: 38, // Slightly larger for easier tapping
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8, 
    borderWidth: 1,
    borderColor: "#3E4C59",
  },
  deleteBtn: {
    backgroundColor: "#3E2723",
    borderColor: "#5D4037",
  },

  // Event Box
  eventBox: { 
    marginTop: 8, 
    backgroundColor: "#0E1418", 
    borderRadius: 10, 
    padding: 12 
  },
  dot: { width: 10, height: 10, borderRadius: 10, marginRight: 8 },
  status: { color: "#DDEEF8", fontSize: 12, fontWeight: "700" },
  eventText: { color: "#EAF6FF", marginTop: 8, fontSize: 13, fontWeight: "700" },
  timeRange: { color: "#9fb4c8", fontWeight: "400", fontSize: 13, opacity: 0.8 },
  descText: { color: "#CFE8FF", marginTop: 6, fontSize: 12, fontStyle: "italic" },
  bookedByText: { color: "#9FB4C8", marginTop: 6, fontSize: 11 },
});