// app/utils/storage.js
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Storage helpers for rooms, profile, admin and current user
 * Keys:
 *  - rooms_v1 : JSON array of rooms
 *  - profileData : JSON { imageUri, displayName, email }
 *  - adminData : JSON { username, password }
 *  - isAdminLoggedIn : "1" or absent
 *  - currentUser : JSON { id, username }
 */

const ROOMS_KEY = "rooms_v1";
const PROFILE_KEY = "profileData";
const ADMIN_KEY = "adminData";
const ADMIN_SESSION_KEY = "isAdminLoggedIn";
const CURRENT_USER_KEY = "currentUser";

export async function loadRooms() {
  try {
    const raw = await AsyncStorage.getItem(ROOMS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn("loadRooms error", e);
  }
  return null;
}

export async function saveRooms(rooms) {
  try {
    await AsyncStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
  } catch (e) {
    console.warn("saveRooms error", e);
  }
}

export async function clearRooms() {
  try {
    await AsyncStorage.removeItem(ROOMS_KEY);
  } catch (e) {
    console.warn("clearRooms error", e);
  }
}

export async function loadProfile() {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn("loadProfile error", e);
  }
  return null;
}

export async function saveProfile(profile) {
  try {
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.warn("saveProfile error", e);
  }
}

/**
 * loadAdminData:
 *  - returns stored admin object if present
 *  - otherwise creates and returns a default admin object { username: "admin", password: "admin123" }
 */
export async function loadAdminData() {
  try {
    const raw = await AsyncStorage.getItem(ADMIN_KEY);
    if (raw) return JSON.parse(raw);
    // if none present, create sensible default and persist it
    const defaultAdmin = { username: "admin", password: "admin123" };
    await AsyncStorage.setItem(ADMIN_KEY, JSON.stringify(defaultAdmin));
    return defaultAdmin;
  } catch (e) {
    console.warn("loadAdminData error", e);
    return { username: "admin", password: "admin123" };
  }
}

export async function saveAdminData(admin) {
  try {
    await AsyncStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
  } catch (e) {
    console.warn("saveAdminData error", e);
  }
}

export async function setAdminSession(value = true) {
  try {
    if (value) {
      await AsyncStorage.setItem(ADMIN_SESSION_KEY, "1");
    } else {
      await AsyncStorage.removeItem(ADMIN_SESSION_KEY);
    }
  } catch (e) {
    console.warn("setAdminSession error", e);
  }
}

export async function isAdminSession() {
  try {
    const v = await AsyncStorage.getItem(ADMIN_SESSION_KEY);
    return v === "1";
  } catch (e) {
    return false;
  }
}

/* Current user (used to mark booking ownership) */

export async function saveCurrentUser(user) {
  try {
    await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  } catch (e) {
    console.warn("saveCurrentUser error", e);
  }
}

export async function loadCurrentUser() {
  try {
    const raw = await AsyncStorage.getItem(CURRENT_USER_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn("loadCurrentUser error", e);
  }
  return null;
}

export async function clearCurrentUser() {
  try {
    await AsyncStorage.removeItem(CURRENT_USER_KEY);
  } catch (e) {
    console.warn("clearCurrentUser error", e);
  }
}