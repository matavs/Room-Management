import React, { useEffect, useState } from "react";
import { 
  SafeAreaView, 
  View, 
  Text, 
  TouchableOpacity, 
  Alert, 
  StyleSheet, 
  ScrollView, 
  Image,
  TextInput,
  ActivityIndicator
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons"; 
import { isAdminSession, loadRooms, saveRooms, loadCurrentUser } from "../utils/storage"; 

export default function RoomDetail() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  // FIX 1: Ensure ID is a single string, not an array
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const roomId = String(rawId || "").trim();

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [catImageUrl, setCatImageUrl] = useState("");

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editFloor, setEditFloor] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // --- 1. LOAD DATA ---
  useEffect(() => {
    if (!roomId) return;
    fetchData();
  }, [roomId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const admin = await isAdminSession();
      setIsAdmin(admin);
      const cu = await loadCurrentUser();
      setCurrentUser(cu);
      const all = await loadRooms();
      
      // FIX 2: Robust comparison
      const found = (all || []).find((r) => String(r.id).trim() === roomId);
      
      if (found) {
        setRoom(found);
        setEditName(found.name);
        setEditFloor(found.floor);
        setEditDesc(found.description || "");
        updateCatImage(found.status, found.bookings?.length || 0);
      } else {
        Alert.alert("Room Not Found", "This room may have been deleted.");
        router.replace("/home");
      }
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  const updateCatImage = (roomStatus, bookingsCount = 0) => {
    const baseUrl = "https://cataas.com/cat";
    const timestamp = Date.now();
    let tags = ['happy'];
    if (roomStatus === "Occupied") tags = ['busy', 'working'];
    else if (roomStatus === "Upcoming") tags = ['waiting'];
    else if (bookingsCount > 0) tags = ['organized'];
    const randomTag = tags[Math.floor(Math.random() * tags.length)];
    setCatImageUrl(`${baseUrl}?tag=${randomTag}&${timestamp}`);
  };

  // --- 2. SAVE CHANGES ---
  const handleSaveChanges = async () => {
    try {
        setLoading(true);
        const all = await loadRooms();
        const updatedRooms = all.map(r => {
            if (String(r.id).trim() === roomId) {
                return { 
                    ...r, 
                    name: editName, 
                    floor: editFloor, 
                    description: editDesc 
                };
            }
            return r;
        });

        await saveRooms(updatedRooms);
        setRoom(prev => ({ ...prev, name: editName, floor: editFloor, description: editDesc }));
        setIsEditing(false);
        Alert.alert("Success", "Room updated.");
    } catch (e) {
        Alert.alert("Error", "Failed to save changes.");
    } finally {
        setLoading(false);
    }
  };

  // --- 3. DELETE ROOM FUNCTION (ROBUST FIX) ---
  const deleteRoom = async () => {
    if (!isAdmin) return;
    
    Alert.alert(
      "Delete Room", 
      `Permanently delete "${room?.name}"?`, 
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true); // Show loading
              const all = await loadRooms();
              
              // FIX 3: Filter logic with logging
              const updated = all.filter((r) => String(r.id).trim() !== roomId);
              
              // Verify deletion happened
              if (all.length === updated.length) {
                  setLoading(false);
                  Alert.alert("Error", "Could not find this room ID in the database.");
                  return;
              }

              await saveRooms(updated);
              
              Alert.alert("Success", "Room deleted.", [
                  { 
                      text: "OK", 
                      onPress: () => {
                          // FIX 4: Clear stack to force Home refresh
                          if (router.canGoBack()) router.dismissAll();
                          router.replace("/home"); 
                      } 
                  }
              ]);
            } catch (error) {
              console.error("Delete failed:", error);
              Alert.alert("Error", "Failed to delete room.");
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const cancelBooking = async (bookingId) => {
    if (!room) return;
    const all = await loadRooms();
    const booking = (room.bookings || []).find(b => String(b.id) === String(bookingId));
    
    if (!isAdmin) {
      if (!currentUser || String(booking?.bookedBy?.id) !== String(currentUser?.id)) {
        Alert.alert("Not allowed", "You can only cancel your own bookings.");
        return;
      }
    }

    const updated = all.map(r => {
      if (String(r.id).trim() !== roomId) return r;
      const filtered = (r.bookings || []).filter(b => String(b.id) !== String(bookingId));
      
      const now = new Date();
      const active = filtered.find(b => new Date(b.startTime) <= now && now < new Date(b.endTime));
      const next = filtered.filter(b => new Date(b.startTime) > now).sort((a,b)=>new Date(a.startTime)-new Date(b.startTime))[0];
      
      return {
        ...r,
        bookings: filtered,
        status: active ? "Occupied" : next ? "Upcoming" : "Available",
      };
    });

    await saveRooms(updated);
    Alert.alert("Success", "Booking cancelled.");
    fetchData(); 
  };

  const formatTime = (iso) => !iso ? "" : new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  const formatDate = (iso) => !iso ? "" : new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });

  if (loading || !room) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0F1724", justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#1F6FEB" />
      </SafeAreaView>
    );
  }

  const bookings = (room.bookings || []).slice().sort((a,b) => new Date(a.startTime) - new Date(b.startTime));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0F1724" }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            {isEditing ? (
                <>
                    <Text style={styles.inputLabel}>ROOM NAME</Text>
                    <TextInput 
                        style={styles.input} 
                        value={editName} 
                        onChangeText={setEditName} 
                    />
                    <Text style={styles.inputLabel}>FLOOR</Text>
                    <TextInput 
                        style={styles.input} 
                        value={editFloor} 
                        onChangeText={setEditFloor} 
                    />
                </>
            ) : (
                <>
                    <Text style={styles.roomName}>{room.name}</Text>
                    <Text style={styles.floor}>{room.floor}</Text>
                </>
            )}
          </View>
          
          {!isEditing && (
              <View style={styles.catContainer}>
                <Image source={{ uri: catImageUrl }} style={styles.catImage} />
              </View>
          )}
        </View>

        <View style={{ height: 20 }} />

        {/* DETAILS */}
        <View style={styles.detailSection}>
          <Text style={styles.sectionLabel}>DESCRIPTION</Text>
          {isEditing ? (
              <TextInput 
                  style={[styles.input, { height: 80, textAlignVertical: 'top' }]} 
                  value={editDesc} 
                  onChangeText={setEditDesc} 
                  multiline
              />
          ) : (
              <Text style={styles.sectionValue}>{room.description || "—"}</Text>
          )}
        </View>

        {!isEditing && (
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
        )}

        <View style={{ height: 18 }} />

        {/* BOOKINGS / EDIT ACTIONS */}
        {isEditing ? (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#4CAF50', flex: 1 }]} onPress={handleSaveChanges}>
                    <Text style={styles.btnText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#FF5252', flex: 1 }]} onPress={() => setIsEditing(false)}>
                    <Text style={styles.btnText}>Cancel</Text>
                </TouchableOpacity>
            </View>
        ) : (
            <>
                <Text style={styles.sectionTitle}>Bookings</Text>
                {bookings.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>No bookings yet</Text>
                </View>
                ) : (
                bookings.map(b => {
                    const isActive = new Date(b.startTime) <= new Date() && new Date() < new Date(b.endTime);
                    const isOwner = currentUser && String(b.bookedBy?.id) === String(currentUser.id);
                    
                    return (
                    <View key={b.id} style={[styles.bookingCard, isActive && styles.activeBookingCard]}>
                        <View style={styles.bookingHeader}>
                        <Text style={styles.bookingTitle}>{b.description || "Booking"}</Text>
                        {isActive && <Text style={{color:'#F44336', fontWeight:'700'}}>LIVE</Text>}
                        </View>
                        <Text style={styles.bookingTime}>{`${formatDate(b.startTime)} • ${formatTime(b.startTime)} - ${formatTime(b.endTime)}`}</Text>
                        <Text style={styles.bookingOwner}>By: {b.bookedBy?.username || "Unknown"}</Text>

                        {(isAdmin || isOwner) && (
                        <TouchableOpacity onPress={() => cancelBooking(b.id)} style={styles.cancelButton}>
                            <Text style={styles.cancelButtonText}>{isAdmin ? "Cancel booking" : "Cancel my booking"}</Text>
                        </TouchableOpacity>
                        )}
                    </View>
                    );
                })
                )}

                <View style={{ height: 30 }} />

                {isAdmin && (
                <View style={{ marginBottom: 16 }}>
                    {/* RESTORED EDIT/DELETE BUTTONS */}
                    <TouchableOpacity 
                        style={[styles.actionBtn, { backgroundColor: '#1F6FEB', marginBottom: 12 }]} 
                        onPress={() => setIsEditing(true)}
                    >
                        <Text style={styles.btnText}>Edit Room</Text>
                    </TouchableOpacity>

 
                </View>
                )}

                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Text style={styles.backButtonText}>Back to Rooms</Text>
                </TouchableOpacity>
            </>
        )}
        
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  headerText: { flex: 1, marginRight: 10 },
  roomName: { color: "#EAF6FF", fontSize: 24, fontWeight: "700" },
  floor: { color: "#9FB4C8", marginTop: 4, fontSize: 16 },
  catContainer: { width: 80, height: 80, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: '#333' },
  catImage: { width: "100%", height: "100%" },
  
  inputLabel: { color: '#627D98', fontSize: 10, fontWeight: '700', marginBottom: 4, marginTop: 8 },
  input: { backgroundColor: '#1B2430', color: '#fff', borderRadius: 8, padding: 12, fontSize: 16, borderWidth: 1, borderColor: '#2C3A4A' },
  
  detailSection: { marginBottom: 16 },
  sectionLabel: { color: "#9fb4c8", fontSize: 12, marginBottom: 4, fontWeight: '600' },
  sectionValue: { color: "#fff", fontSize: 16 },
  statusContainer: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  statusValue: { color: "#fff", fontSize: 16, fontWeight: "600" },
  sectionTitle: { color: "#EAF6FF", fontWeight: "700", fontSize: 18, marginBottom: 12 },
  
  emptyState: { alignItems: "center", padding: 24, backgroundColor: "#152022", borderRadius: 12 },
  emptyStateText: { color: "#9fb4c8", fontSize: 16 },
  
  bookingCard: { marginBottom: 12, padding: 16, backgroundColor: "#152022", borderRadius: 12 },
  activeBookingCard: { backgroundColor: "#1E1515", borderLeftWidth: 4, borderLeftColor: "#F44336" },
  bookingHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  bookingTitle: { color: "#EAF6FF", fontWeight: "700", fontSize: 16 },
  bookingTime: { color: "#9fb4c8", fontSize: 14, marginBottom: 4 },
  bookingOwner: { color: "#627D98", fontSize: 13, fontStyle: 'italic' },
  
  cancelButton: { marginTop: 12, backgroundColor: "rgba(231, 76, 60, 0.15)", padding: 10, borderRadius: 8, alignItems: "center", borderWidth: 1, borderColor: "rgba(231, 76, 60, 0.3)" },
  cancelButtonText: { color: "#E74C3C", fontWeight: "700", fontSize: 13 },

  
 
  
  actionBtn: { padding: 16, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  backButton: { backgroundColor: "#2E3B44", padding: 16, borderRadius: 12, alignItems: "center" },
  backButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});