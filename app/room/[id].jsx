// app/room/[id].jsx
import React, { useEffect, useState } from "react";
import { SafeAreaView, View, Text, TouchableOpacity, Alert, StyleSheet, ScrollView, Image } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { isAdminSession, loadRooms, saveRooms, loadCurrentUser } from "../utils/storage";

/**
 * Room detail screen (updated):
 * - Admins: can edit room fields and delete
 * - Non-admins: can cancel (release) a booking they own (bookedBy.id === currentUser.id)
 * - Lists all bookings for the room (sorted)
 */

export default function RoomDetail() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const roomId = params?.id;
  const [room, setRoom] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [catImageUrl, setCatImageUrl] = useState("");

  // Generate cat image based on room status
  const updateCatImage = (roomStatus, bookingsCount = 0) => {
    const baseUrl = "https://cataas.com/cat";
    const timestamp = Date.now();
    
    if (roomStatus === "Occupied") {
      // Busy room - show busy cats
      const tags = ['busy', 'serious', 'glasses', 'working'];
      const randomTag = tags[Math.floor(Math.random() * tags.length)];
      setCatImageUrl(`${baseUrl}?tag=${randomTag}&${timestamp}`);
    } else if (roomStatus === "Upcoming") {
      // Upcoming bookings - show waiting cats
      const tags = ['curious', 'sleepy', 'waiting'];
      const randomTag = tags[Math.floor(Math.random() * tags.length)];
      setCatImageUrl(`${baseUrl}?tag=${randomTag}&${timestamp}`);
    } else if (bookingsCount > 0) {
      // Available but has future bookings - show organized cats
      const tags = ['cute', 'happy', 'organized'];
      const randomTag = tags[Math.floor(Math.random() * tags.length)];
      setCatImageUrl(`${baseUrl}?tag=${randomTag}&${timestamp}`);
    } else {
      // Completely available - show happy available cats
      const tags = ['happy', 'playful', 'gif'];
      const randomTag = tags[Math.floor(Math.random() * tags.length)];
      setCatImageUrl(`${baseUrl}?tag=${randomTag}&${timestamp}`);
    }
  };

  useEffect(() => {
    (async () => {
      const admin = await isAdminSession();
      setIsAdmin(admin);
      const cu = await loadCurrentUser();
      setCurrentUser(cu);
      const all = await loadRooms();
      const found = (all || []).find((r) => String(r.id) === String(roomId));
      if (found) {
        setRoom(found);
        updateCatImage(found.status, found.bookings?.length || 0);
      } else {
        Alert.alert("Not found", "Room not found.");
        router.back();
      }
    })();
  }, [roomId]);

  const refreshLocalRoom = async () => {
    const all = await loadRooms();
    const found = (all || []).find((r) => String(r.id) === String(roomId));
    setRoom(found || null);
    if (found) {
      updateCatImage(found.status, found.bookings?.length || 0);
    }
  };

  const deleteRoom = async () => {
    if (!isAdmin) {
      Alert.alert("Permission denied", "Only admins can delete rooms.");
      return;
    }
    Alert.alert("Confirm", "Delete this room?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const all = (await loadRooms()) || [];
          const updated = all.filter((r) => String(r.id) !== String(roomId));
          await saveRooms(updated);
          Alert.alert("Deleted");
          router.back();
        },
      },
    ]);
  };

  const cancelBooking = async (bookingId) => {
    if (!room) return;
    const all = (await loadRooms()) || [];
    const booking = (room.bookings || []).find(b => String(b.id) === String(bookingId));
    if (!booking) {
      Alert.alert("Not found", "Booking not found.");
      return;
    }
    // permission check
    if (!isAdmin) {
      if (!currentUser || String(booking.bookedBy?.id) !== String(currentUser.id)) {
        Alert.alert("Not allowed", "Only the booking owner can cancel this booking.");
        return;
      }
    }

    const updated = all.map(r => {
      if (String(r.id) !== String(roomId)) return r;
      const filtered = (r.bookings || []).filter(b => String(b.id) !== String(bookingId));
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
    });

    await saveRooms(updated);
    Alert.alert("Cancelled", "Booking cancelled.");
    await refreshLocalRoom();
  };

  const refreshCatImage = () => {
    if (room) {
      updateCatImage(room.status, room.bookings?.length || 0);
    }
  };

  const formatTimeWithAmPm = (isoString) => {
    if (!isoString) return "";
    return new Date(isoString).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatDate = (isoString) => {
    if (!isoString) return "";
    return new Date(isoString).toLocaleDateString([], { 
      month: "short", 
      day: "numeric",
      year: "numeric"
    });
  };

  if (!room) return null;

  // sort bookings by start time ascending
  const bookings = (room.bookings || []).slice().sort((a,b) => new Date(a.startTime) - new Date(b.startTime));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0F1724" }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Header with Room Info and Cat Image */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.roomName}>{room.name}</Text>
            <Text style={styles.floor}>{room.floor}</Text>
          </View>
          
          {/* Cat Image */}
          <TouchableOpacity onPress={refreshCatImage} style={styles.catContainer}>
            <Image 
              source={{ uri: catImageUrl }}
              style={styles.catImage}
              onError={() => {
                // Fallback to default cat
                setCatImageUrl(`https://cataas.com/cat?${Date.now()}`);
              }}
            />
          </TouchableOpacity>
        </View>

        <View style={{ height: 12 }} />

        {/* Room Details */}
        <View style={styles.detailSection}>
          <Text style={styles.sectionLabel}>DESCRIPTION</Text>
          <Text style={styles.sectionValue}>{room.description || "—"}</Text>
        </View>

        <View style={styles.detailSection}>
          <Text style={styles.sectionLabel}>STATUS</Text>
          <View style={styles.statusContainer}>
            <View style={[styles.statusDot, 
              { backgroundColor: room.status === "Occupied" ? "#F44336" : 
                              room.status === "Upcoming" ? "#FFD166" : "#4CAF50" }]} 
            />
            <Text style={styles.statusValue}>{room.status}</Text>
          </View>
        </View>

        <View style={{ height: 18 }} />

        {/* Bookings Section */}
        <Text style={styles.sectionTitle}>Bookings</Text>
        {bookings.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No bookings yet</Text>
            <Text style={styles.emptyStateSubtext}>This room is ready for meetings!</Text>
          </View>
        ) : (
          bookings.map(b => {
            const start = new Date(b.startTime);
            const end = new Date(b.endTime);
            const isOwner = currentUser && String(b.bookedBy?.id) === String(currentUser.id);
            const isActive = new Date(b.startTime) <= new Date() && new Date() < new Date(b.endTime);
            
            return (
              <View key={b.id} style={[
                styles.bookingCard,
                isActive && styles.activeBookingCard
              ]}>
                <View style={styles.bookingHeader}>
                  <Text style={styles.bookingTitle}>{b.description || "Booking"}</Text>
                  {isActive && (
                    <View style={styles.activeBadge}>
                      <Text style={styles.activeBadgeText}>LIVE</Text>
                    </View>
                  )}
                </View>
                
                <Text style={styles.bookingTime}>{`${formatDate(b.startTime)} ${formatTimeWithAmPm(b.startTime)} — ${formatTimeWithAmPm(b.endTime)}`}</Text>
                <Text style={styles.bookingOwner}>By: {b.bookedBy?.username || "Unknown"}</Text>

                {(isAdmin || isOwner) && (
                  <TouchableOpacity 
                    onPress={() => cancelBooking(b.id)} 
                    style={styles.cancelButton}
                  >
                    <Text style={styles.cancelButtonText}>
                      {isAdmin ? "Cancel booking" : "Cancel my booking"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}

        <View style={{ height: 18 }} />

        {/* Action Buttons */}
        {isAdmin && (
          <>
            <TouchableOpacity 
              onPress={() => router.push(`/room/${room.id}?edit=1`)} 
              style={styles.editButton}
            >
              <Text style={styles.buttonText}>Edit Room</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={deleteRoom} 
              style={styles.deleteButton}
            >
              <Text style={styles.buttonText}>Delete Room</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Back to Rooms</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerText: {
    flex: 1,
  },
  roomName: {
    color: "#EAF6FF", 
    fontSize: 24, 
    fontWeight: "700" 
  },
  floor: { 
    color: "#9FB4C8", 
    marginTop: 4,
    fontSize: 16,
  },
  catContainer: {
    width: 80,
    height: 80,
    borderRadius: 12,
    overflow: "hidden",
    marginLeft: 16,
  },
  catImage: {
    width: "100%",
    height: "100%",
  },
  detailSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    color: "#9fb4c8", 
    fontSize: 12,
    marginBottom: 4,
  },
  sectionValue: {
    color: "#fff",
    fontSize: 16,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusValue: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  sectionTitle: {
    color: "#EAF6FF", 
    fontWeight: "700", 
    fontSize: 18,
    marginBottom: 12,
  },
  emptyState: {
    alignItems: "center",
    padding: 20,
    backgroundColor: "#152022",
    borderRadius: 8,
  },
  emptyStateText: {
    color: "#9fb4c8",
    fontSize: 16,
  },
  emptyStateSubtext: {
    color: "#6B7D8A",
    fontSize: 12,
    marginTop: 4,
  },
  bookingCard: {
    marginBottom: 12,
    padding: 16,
    backgroundColor: "#152022",
    borderRadius: 8,
  },
  activeBookingCard: {
    backgroundColor: "#1E1515",
    borderLeftWidth: 4,
    borderLeftColor: "#F44336",
  },
  bookingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  bookingTitle: {
    color: "#EAF6FF", 
    fontWeight: "700",
    fontSize: 16,
    flex: 1,
  },
  activeBadge: {
    backgroundColor: "#F44336",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  activeBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  bookingTime: {
    color: "#9fb4c8",
    fontSize: 14,
    marginBottom: 4,
  },
  bookingOwner: {
    color: "#9fb4c8",
    fontSize: 14,
  },
  cancelButton: {
    marginTop: 12,
    backgroundColor: "#E74C3C",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  editButton: {
    backgroundColor: "#1F6FEB",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 10,
  },
  deleteButton: {
    backgroundColor: "#E74C3C",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 10,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  backButton: {
    backgroundColor: "#2E3B44",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  backButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
});