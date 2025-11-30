// app/components/RoomCard.jsx
import React from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import RoomTimer from "./RoomTimer";
import { Ionicons } from "@expo/vector-icons";

/**
 * RoomCard component
 * Props:
 *  - item (room object)
 *  - onPress (open detail)
 *  - onUsePress (open booking modal)
 *  - onLeavePress (room, bookingId)
 *  - isAdmin (boolean)
 *  - currentUser ({ id, username } | null)
 *
 * Displays an active booking (if any) or next upcoming booking.
 */

export default function RoomCard({ item, onPress, onUsePress, onLeavePress, isAdmin, currentUser }) {
  const bookings = Array.isArray(item.bookings) ? item.bookings.slice() : [];

  // If the room still uses legacy startTime/endTime, include it as a booking temporarily for display/conflict checks
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

  // Determine status for display
  const status = activeBooking ? "Occupied" : upcoming ? "Upcoming" : "Available";
  const displayTitle = activeBooking ? (activeBooking.description || (activeBooking.bookedBy?.username || "Booked")) : upcoming ? (upcoming.description || (upcoming.bookedBy?.username || "Upcoming")) : (item.eventTitle || "Free for bookings");
  const displayStart = activeBooking ? activeBooking.startTime : upcoming ? upcoming.startTime : item.startTime;
  const displayEnd = activeBooking ? activeBooking.endTime : upcoming ? upcoming.endTime : item.endTime;

  // Show leave/cancel only if current user is booking owner or is admin
  const activeIsOwnedByCurrent =
    activeBooking && activeBooking.bookedBy && currentUser && String(activeBooking.bookedBy.id) === String(currentUser.id);
  const upcomingOwnedByCurrent =
    upcoming && upcoming.bookedBy && currentUser && String(upcoming.bookedBy.id) === String(currentUser.id);

  const showLeave = (activeBooking && (isAdmin || activeIsOwnedByCurrent)) || (upcoming && (isAdmin || upcomingOwnedByCurrent));

  const formatTimeWithAmPm = (isoString) => {
    if (!isoString) return "";
    return new Date(isoString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  // CATAAS Cat Image Logic
  const getCatImageUrl = () => {
    const baseUrl = "https://cataas.com/cat";
    const timestamp = Date.now();
    
    // Different cat images based on room status
    if (status === "Occupied") {
      // For occupied rooms, use "busy" or related tags
      const tags = ['angry', 'grumpy', 'serious', 'glasses'];
      const randomTag = tags[Math.floor(Math.random() * tags.length)];
      return `${baseUrl}?tag=${randomTag}&${timestamp}`;
    } else if (status === "Upcoming") {
      // For upcoming bookings, use curious or waiting cats
      const tags = ['curious', 'sleepy', 'cute'];
      const randomTag = tags[Math.floor(Math.random() * tags.length)];
      return `${baseUrl}?tag=${randomTag}&${timestamp}`;
    } else {
      // For available rooms, use happy and available cats
      const tags = ['happy', 'cute', 'gif'];
      const randomTag = tags[Math.floor(Math.random() * tags.length)];
      return `${baseUrl}?tag=${randomTag}&${timestamp}`;
    }
  };

  const catImageUrl = getCatImageUrl();

  return (
    <TouchableOpacity activeOpacity={0.95} onPress={() => onPress?.(item)} style={[styles.card, status === "Occupied" && styles.cardActive]}>
      <View style={styles.left}>
        {/* Replace avatar with cat image */}
        <View style={styles.catImageContainer}>
          <Image 
            source={{ uri: catImageUrl }}
            style={styles.catImage}
            onError={() => {
              // Fallback to default cat if image fails to load
              console.log("Cat image failed to load, using fallback");
            }}
          />
          {/* Room initials overlay for accessibility */}
          <View style={styles.roomInitialsOverlay}>
            <Text style={styles.roomInitialsText}>
              {String(item.name).split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.headerRow}>
          <Text style={styles.name}>{item.name}</Text>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity onPress={() => onUsePress?.(item)} style={styles.useBtn}>
              <Text style={styles.useBtnText}>USE</Text>
            </TouchableOpacity>

            {showLeave && (
              <TouchableOpacity
                onPress={() => {
                  // choose bookingId to cancel: prefer activeBooking.id, otherwise upcoming owned by user
                  const bookingId = activeBooking ? activeBooking.id : (upcoming && upcomingOwnedByCurrent ? upcoming.id : (upcoming && isAdmin ? upcoming.id : null));
                  if (!bookingId) {
                    // fallback: if upcoming owned by current user use that id
                    const owned = (bookings || []).find(b => b.bookedBy?.id && currentUser && String(b.bookedBy.id) === String(currentUser.id));
                    if (owned) onLeavePress?.(item, owned.id);
                    return;
                  }
                  onLeavePress?.(item, bookingId);
                }}
                style={styles.leaveBtn}
              >
                <Text style={styles.leaveBtnText}>Cancel</Text>
              </TouchableOpacity>
            )}

            {isAdmin && (
              <Ionicons name="pencil" size={16} color="#9FB4C8" style={{ marginLeft: 8 }} />
            )}
          </View>
        </View>

        <Text style={styles.floor}>{item.floor}</Text>

        <View style={styles.eventBox}>
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
            <View style={[styles.dot, { backgroundColor: status === "Upcoming" ? "#FFD166" : status === "Available" ? "#4CAF50" : "#F44336" }]} />
            <Text style={styles.status}>{status}</Text>
            {activeBooking && <RoomTimer endTime={activeBooking.endTime} status={status} style={{ marginLeft: 8 }} />}
            {upcoming && !activeBooking && <Text style={styles.gap}>Next: {formatTimeWithAmPm(upcoming.startTime)}</Text>}
          </View>

          <Text numberOfLines={2} style={styles.eventText}>
            {displayTitle}
            {(displayStart && displayEnd) ? <Text style={styles.timeRange}> • {formatTimeWithAmPm(displayStart)} - {formatTimeWithAmPm(displayEnd)}</Text> : null}
          </Text>

          {activeBooking && activeBooking.bookedBy && (
            <Text style={styles.bookedByText}>By: {activeBooking.bookedBy.username}</Text>
          )}
          {item.description && !activeBooking && <Text style={styles.descText}>{item.description}</Text>}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: "#172028",
    borderRadius: 12,
    padding: 14,
    alignItems: "flex-start",
    marginHorizontal: 4,
  },
  cardActive: { 
    borderColor: "rgba(244,67,54,0.4)", 
    borderWidth: 1, 
    backgroundColor: "#1E1515" 
  },
  left: { 
    marginRight: 12 
  },
  // Cat image styles
  catImageContainer: {
    width: 52,
    height: 52,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  catImage: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
  },
  roomInitialsOverlay: {
    position: "absolute",
    bottom: 2,
    right: 2,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  roomInitialsText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 10,
  },
  body: { 
    flex: 1 
  },
  headerRow: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between" 
  },
  name: { 
    color: "#EAF6FF", 
    fontWeight: "700", 
    fontSize: 16, 
    flex: 1 
  },
  useBtn: { 
    backgroundColor: "#2ECC71", 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 6, 
    marginLeft: 8 
  },
  useBtnText: { 
    color: "#000", 
    fontWeight: "800", 
    fontSize: 10 
  },
  leaveBtn: { 
    backgroundColor: "#E74C3C", 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 6, 
    marginLeft: 8 
  },
  leaveBtnText: { 
    color: "#fff", 
    fontWeight: "800", 
    fontSize: 10 
  },
  floor: { 
    color: "#9fb4c8", 
    fontSize: 12, 
    marginTop: 6 
  },
  eventBox: { 
    marginTop: 10, 
    backgroundColor: "#0E1418", 
    borderRadius: 10, 
    padding: 10 
  },
  dot: { 
    width: 10, 
    height: 10, 
    borderRadius: 10, 
    marginRight: 8 
  },
  status: { 
    color: "#DDEEF8", 
    fontSize: 12, 
    fontWeight: "700" 
  },
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
  eventText: { 
    color: "#EAF6FF", 
    marginTop: 8, 
    fontSize: 13, 
    fontWeight: "700" 
  },
  timeRange: { 
    color: "#9fb4c8", 
    fontWeight: "400", 
    fontSize: 13, 
    opacity: 0.8 
  },
  descText: { 
    color: "#CFE8FF", 
    marginTop: 6, 
    fontSize: 12, 
    fontStyle: "italic" 
  },
  bookedByText: { 
    color: "#9FB4C8", 
    marginTop: 6, 
    fontSize: 11 
  },
});