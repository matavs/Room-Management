// app/components/RoomTimer.jsx
import React, { useEffect, useState } from "react";
import { View, Text, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";

/**
 * RoomTimer: shows remaining time for occupied rooms
 * Props:
 *   - endTime (ISO string)
 *   - status (string)
 */

export default function RoomTimer({ endTime, status, style }) {
  const [timeLeft, setTimeLeft] = useState("");
  const [catImageUrl, setCatImageUrl] = useState("");

  // Generate cat image based on time left
  const updateCatImage = (hours, minutes, seconds) => {
    const baseUrl = "https://cataas.com/cat";
    const timestamp = Date.now();
    
    // Different cat moods based on time remaining
    if (hours > 1) {
      // Plenty of time - relaxed cats
      const tags = ['sleepy', 'relaxed', 'cute', 'happy'];
      const randomTag = tags[Math.floor(Math.random() * tags.length)];
      setCatImageUrl(`${baseUrl}?tag=${randomTag}&${timestamp}`);
    } else if (hours > 0 || minutes > 30) {
      // Moderate time - curious cats
      const tags = ['curious', 'cute', 'funny'];
      const randomTag = tags[Math.floor(Math.random() * tags.length)];
      setCatImageUrl(`${baseUrl}?tag=${randomTag}&${timestamp}`);
    } else if (minutes > 10) {
      // Getting urgent - alert cats
      const tags = ['alert', 'surprised', 'cute'];
      const randomTag = tags[Math.floor(Math.random() * tags.length)];
      setCatImageUrl(`${baseUrl}?tag=${randomTag}&${timestamp}`);
    } else {
      // Very urgent - stressed cats
      const tags = ['angry', 'grumpy', 'shocked'];
      const randomTag = tags[Math.floor(Math.random() * tags.length)];
      setCatImageUrl(`${baseUrl}?tag=${randomTag}&${timestamp}`);
    }
  };

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
        // Time's up cat
        setCatImageUrl(`https://cataas.com/cat?tag=shocked&${Date.now()}`);
        return;
      }

      const minutes = Math.floor((diff / 1000 / 60) % 60);
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const seconds = Math.floor((diff / 1000) % 60);
      
      const timeString = `${hours > 0 ? hours + "h " : ""}${minutes}m ${seconds}s`;
      setTimeLeft(timeString);

      // Update cat image based on remaining time
      updateCatImage(hours, minutes, seconds);
    };

    updateTimer();
    const id = setInterval(updateTimer, 1000);
    return () => clearInterval(id);
  }, [endTime, status]);

  if (!timeLeft) return null;

  return (
    <View style={[{ flexDirection: "row", alignItems: "center" }, style]}>
      {/* Cat Image */}
      {catImageUrl && (
        <View style={styles.catContainer}>
          <Image 
            source={{ uri: catImageUrl }}
            style={styles.catImage}
            onError={() => {
              // Fallback to default cat
              setCatImageUrl(`https://cataas.com/cat?${Date.now()}`);
            }}
          />
        </View>
      )}
      
      {/* Timer Display */}
      <View style={styles.timerContainer}>
        <Ionicons name="time-outline" size={12} color="#FFD166" />
        <Text style={styles.timerText}>{timeLeft}</Text>
      </View>
    </View>
  );
}

const styles = {
  catContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    overflow: "hidden",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 209, 102, 0.3)",
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
};