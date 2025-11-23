// app/room/[id].jsx
import React, { useEffect, useState } from "react";
import { SafeAreaView, View, Text, TouchableOpacity, Alert, StyleSheet, ScrollView } from "react-native";
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

  if (!room) return null;

  // sort bookings by start time ascending
  const bookings = (room.bookings || []).slice().sort((a,b) => new Date(a.startTime) - new Date(b.startTime));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0F1724" }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={{ color: "#EAF6FF", fontSize: 20, fontWeight: "700" }}>{room.name}</Text>
        <Text style={{ color: "#9FB4C8", marginTop: 6 }}>{room.floor}</Text>

        <View style={{ height: 12 }} />

        <Text style={{ color: "#9fb4c8", fontSize: 12 }}>DESCRIPTION</Text>
        <Text style={{ color: "#fff", marginTop: 6 }}>{room.description || "—"}</Text>

        <Text style={{ color: "#9fb4c8", fontSize: 12, marginTop: 12 }}>STATUS</Text>
        <Text style={{ color: "#fff", marginTop: 6 }}>{room.status}</Text>

        <View style={{ height: 18 }} />

        <Text style={{ color: "#EAF6FF", fontWeight: "700", marginBottom: 8 }}>Bookings</Text>
        {bookings.length === 0 ? (
          <Text style={{ color: "#9fb4c8" }}>No bookings yet</Text>
        ) : (
          bookings.map(b => {
            const start = new Date(b.startTime);
            const end = new Date(b.endTime);
            const isOwner = currentUser && String(b.bookedBy?.id) === String(currentUser.id);
            return (
              <View key={b.id} style={{ marginBottom: 12, padding: 12, backgroundColor: "#152022", borderRadius: 8 }}>
                <Text style={{ color: "#EAF6FF", fontWeight: "700" }}>{b.description || "Booking"}</Text>
                <Text style={{ color: "#9fb4c8", marginTop: 6 }}>{`${start.toLocaleDateString()} ${start.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})} — ${end.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}`}</Text>
                <Text style={{ color: "#9fb4c8", marginTop: 6 }}>By: {b.bookedBy?.username || "Unknown"}</Text>

                {(isAdmin || isOwner) && (
                  <TouchableOpacity onPress={() => cancelBooking(b.id)} style={{ marginTop: 10, backgroundColor: "#E74C3C", padding: 10, borderRadius: 8, alignItems: "center" }}>
                    <Text style={{ color: "#fff", fontWeight: "700" }}>{isAdmin ? "Cancel booking" : "Cancel my booking"}</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}

        <View style={{ height: 18 }} />

        {isAdmin && (
          <>
            <TouchableOpacity onPress={() => router.push(`/room/${room.id}?edit=1`)} style={{ backgroundColor: "#1F6FEB", padding: 12, borderRadius: 8, alignItems: "center", marginBottom: 10 }}>
              <Text style={{ color: "#fff", fontWeight: "700" }}>Edit Room</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={deleteRoom} style={{ backgroundColor: "#E74C3C", padding: 12, borderRadius: 8, alignItems: "center" }}>
              <Text style={{ color: "#fff", fontWeight: "700" }}>Delete Room</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity style={{ marginTop: 12, backgroundColor: "#2E3B44", padding: 12, borderRadius: 8, alignItems: "center" }} onPress={() => router.back()}>
          <Text style={{ color: "#fff", fontWeight: "700" }}>Back</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}