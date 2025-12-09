// app/components/RoomTimer.jsx
import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

/**
 * RoomTimer: shows remaining time for occupied rooms
 * Props:
 * - endTime (ISO string)
 * - status (string)
 */

export default function RoomTimer({ endTime, status, style }) {
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
        return;
      }

      const minutes = Math.floor((diff / 1000 / 60) % 60);
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const seconds = Math.floor((diff / 1000) % 60);
      
      const timeString = `${hours > 0 ? hours + "h " : ""}${minutes}m ${seconds}s`;
      setTimeLeft(timeString);
    };

    updateTimer();
    const id = setInterval(updateTimer, 1000);
    return () => clearInterval(id);
  }, [endTime, status]);

  if (!timeLeft) return null;

  return (
    <View style={[{ flexDirection: "row", alignItems: "center" }, style]}>
      {/* Timer Display Only - No Cat Image */}
      <View style={styles.timerContainer}>
        <Ionicons name="time-outline" size={12} color="#FFD166" />
        <Text style={styles.timerText}>{timeLeft}</Text>
      </View>
    </View>
  );
}

const styles = {
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