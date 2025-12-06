import AsyncStorage from '@react-native-async-storage/async-storage';

// Keys to identify data in the phone's storage
const ROOMS_KEY = "rooms_data";
const USER_KEY = "current_user_session";
const IS_ADMIN_KEY = "is_admin_session";

// --- USER SESSION (Token & Profile) ---
export const saveCurrentUser = async (user) => {
  try {
    if (user === null) {
        // If user is null, we are logging out, so delete data
        await AsyncStorage.removeItem(USER_KEY);
    } else {
        // Save the user object as a string
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  } catch (e) { 
    console.error("Error saving user", e); 
  }
};

export const loadCurrentUser = async () => {
  try {
    const json = await AsyncStorage.getItem(USER_KEY);
    // Convert string back to object
    return json != null ? JSON.parse(json) : null;
  } catch (e) { 
    return null; 
  }
};

// --- ADMIN SESSION ---
export const setAdminSession = async (isAdmin) => {
  try {
    await AsyncStorage.setItem(IS_ADMIN_KEY, JSON.stringify(isAdmin));
  } catch (e) { 
    console.error("Error saving admin status", e); 
  }
};

export const isAdminSession = async () => {
  try {
    const json = await AsyncStorage.getItem(IS_ADMIN_KEY);
    return json != null ? JSON.parse(json) : false;
  } catch (e) { 
    return false; 
  }
};

// --- ROOMS DATA ---
export const saveRooms = async (rooms) => {
  try {
    await AsyncStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
  } catch (e) { 
    console.error("Error saving rooms", e); 
  }
};

export const loadRooms = async () => {
  try {
    const json = await AsyncStorage.getItem(ROOMS_KEY);
    return json != null ? JSON.parse(json) : null;
  } catch (e) { 
    return null; 
  }
};