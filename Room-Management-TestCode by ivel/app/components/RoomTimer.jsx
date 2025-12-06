import React, { useEffect, useState, useRef } from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

/**
 * RoomTimer: shows remaining time for occupied rooms with a reactive Cat avatar
 */
export default function RoomTimer({ endTime, status, style }) {
  const [timeLeft, setTimeLeft] = useState("");
  const [catImageUrl, setCatImageUrl] = useState("");
  
  // Use a ref to track the last mood so we don't refresh the image every single second
  const lastMoodRef = useRef(""); 

  useEffect(() => {
    if (status !== "Occupied" || !endTime) {
      setTimeLeft("");
      setCatImageUrl("");
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      const end = new Date(endTime);
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft("Time's up!");
        if (lastMoodRef.current !== "finished") {
            setCatImageUrl(`https://cataas.com/cat?tag=shocked&${Date.now()}`);
            lastMoodRef.current = "finished";
        }
        return;
      }

      const minutes = Math.floor((diff / 1000 / 60) % 60);
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const seconds = Math.floor((diff / 1000) % 60);
      
      const timeString = `${hours > 0 ? hours + "h " : ""}${minutes}m ${seconds}s`;
      setTimeLeft(timeString);

      // --- Determine Cat Mood based on time ---
      let currentMood = "";
      if (hours > 1) {
         currentMood = "relaxed"; // Plenty of time
      } else if (hours > 0 || minutes > 30) {
         currentMood = "curious"; // Getting closer
      } else if (minutes > 10) {
         currentMood = "alert";   // Urgent
      } else {
         currentMood = "stressed"; // Very Urgent
      }

      // Only fetch new image if the mood category changed (prevents flickering)
      if (currentMood !== lastMoodRef.current) {
         lastMoodRef.current = currentMood;
         
         const baseUrl = "https://cataas.com/cat";
         const timestamp = Date.now();
         let tags = [];
         
         if (currentMood === "relaxed") tags = ['sleepy', 'relaxed', 'cute', 'happy'];
         else if (currentMood === "curious") tags = ['curious', 'cute', 'funny'];
         else if (currentMood === "alert") tags = ['alert', 'surprised', 'cute'];
         else tags = ['angry', 'grumpy', 'shocked'];

         const randomTag = tags[Math.floor(Math.random() * tags.length)];
         setCatImageUrl(`${baseUrl}?tag=${randomTag}&${timestamp}`);
      }
    };

    updateTimer(); // Run immediately
    const id = setInterval(updateTimer, 1000); // Update every second
    return () => clearInterval(id);
  }, [endTime, status]);

  if (!timeLeft) return null;

  return (
    <View style={[styles.container, style]}>
      {/* Cat Image */}
      {catImageUrl ? (
        <View style={styles.catContainer}>
          <Image 
            source={{ uri: catImageUrl }}
            style={styles.catImage}
            onError={() => {
              // Fallback if network fails
              setCatImageUrl(`https://cataas.com/cat?${Date.now()}`);
            }}
          />
        </View>
      ) : null}
      
      {/* Timer Display */}
      <View style={styles.timerContainer}>
        <Ionicons name="time-outline" size={12} color="#FFD166" />
        <Text style={styles.timerText}>{timeLeft}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flexDirection: "row", 
    alignItems: "center" 
  },
  catContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    overflow: "hidden",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 209, 102, 0.3)",
    backgroundColor: '#333'
  },
  catImage: {
    width: "100%",
    height: "100%",
  },
  timerContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(255,159,67,0.12)",
  },
  timerText: {
    color: "#FFD166",
    marginLeft: 6,
    fontSize: 11,
    fontWeight: "600",
  },
});