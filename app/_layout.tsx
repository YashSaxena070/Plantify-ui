import { FontAwesome6, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { createContext, useContext, useEffect, useState } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { plantService } from '@/services/plantService';
import { resolveLocalUri } from '@/services/uriHelper';

// Create User Context
export const UserContext = createContext({
  userName: 'User',
  setUserName: (name: string) => { },
  scansCount: 0,
  setScansCount: (count: number) => { },
  userAvatar: null as string | null,
  setUserAvatar: (avatar: string) => { },
  userEmail: 'alina.smith@gmail.com',
  setUserEmail: (email: string) => { },
  savedPlants: [] as any[],
  savePlant: (plant: any) => { },
  removePlant: (id: string) => { },
  recentScans: [] as any[],
  addRecentScan: (scan: any) => { },
  removeRecentScan: (id: string) => { },
  reminders: [] as any[],
  saveReminder: (reminder: any) => { },
  isDbSyncing: false,
  dbSyncProgress: 0,
  dbSyncStatusText: '',
});

// Custom hook to consume context
export const useUser = () => useContext(UserContext);

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [userName, setUserName] = useState('User');
  const [scansCount, setScansCount] = useState(0);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('alina.smith@gmail.com');
  const [savedPlants, setSavedPlants] = useState<any[]>([]);
  const [recentScans, setRecentScans] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);

  // Syncing states
  const [isDbSyncing, setIsDbSyncing] = useState(false);
  const [dbSyncProgress, setDbSyncProgress] = useState(0);
  const [dbSyncStatusText, setDbSyncStatusText] = useState('');

  // Start SQLite synchronization in the background on startup
  useEffect(() => {
    const runBackgroundSync = async () => {
      try {
        const needsSync = await plantService.initializeDatabase();
        if (needsSync) {
          setIsDbSyncing(true);
          await plantService.downloadAndSyncPlants((prog, text) => {
            setDbSyncProgress(prog);
            setDbSyncStatusText(text);
          });
          setIsDbSyncing(false);
        }
      } catch (err) {
        console.warn('Background database synchronization failed:', err);
        setIsDbSyncing(false);
      }
    };
    runBackgroundSync();
  }, []);

  useEffect(() => {
    // Load stored values on startup
    const loadStoredData = async () => {
      try {
        const storedName = await AsyncStorage.getItem('@user_name');
        if (storedName) {
          setUserName(storedName);
        }
        const storedScansCount = await AsyncStorage.getItem('@total_scans_count');
        if (storedScansCount) {
          setScansCount(parseInt(storedScansCount, 10) || 0);
        }
        const storedAvatar = await AsyncStorage.getItem('@user_avatar');
        if (storedAvatar) {
          setUserAvatar(storedAvatar);
        }
        const storedEmail = await AsyncStorage.getItem('@user_email');
        if (storedEmail) {
          setUserEmail(storedEmail);
        }
        const storedPlants = await AsyncStorage.getItem('@saved_plants');
        if (storedPlants) {
          const parsed = JSON.parse(storedPlants);
          if (Array.isArray(parsed)) {
            const fixed = parsed.map((p: any) => ({
              ...p,
              imageUri: resolveLocalUri(p.imageUri) || p.imageUri,
            }));
            setSavedPlants(fixed);
          } else {
            setSavedPlants(parsed);
          }
        }
        const storedScans = await AsyncStorage.getItem('@recent_scans');
        if (storedScans) {
          const parsed = JSON.parse(storedScans);
          if (Array.isArray(parsed)) {
            const fixed = parsed.map((s: any) => ({
              ...s,
              imageUri: resolveLocalUri(s.imageUri) || s.imageUri,
            }));
            setRecentScans(fixed);
          } else {
            setRecentScans(parsed);
          }
        }
        const storedReminders = await AsyncStorage.getItem('@reminders');
        if (storedReminders) {
          setReminders(JSON.parse(storedReminders));
        }
      } catch (err) {
        console.error('Failed to load AsyncStorage data:', err);
      }
    };
    loadStoredData();
  }, []);

  const updateUserName = async (name: string) => {
    try {
      setUserName(name);
      await AsyncStorage.setItem('@user_name', name);
    } catch (err) {
      console.error(err);
    }
  };

  const updateUserAvatar = async (avatar: string) => {
    try {
      setUserAvatar(avatar);
      await AsyncStorage.setItem('@user_avatar', avatar);
    } catch (err) {
      console.error(err);
    }
  };

  const updateUserEmail = async (email: string) => {
    try {
      setUserEmail(email);
      await AsyncStorage.setItem('@user_email', email);
    } catch (err) {
      console.error(err);
    }
  };

  const savePlant = async (plant: any) => {
    try {
      const fixedPlant = {
        ...plant,
        imageUri: resolveLocalUri(plant.imageUri) || plant.imageUri,
      };
      setSavedPlants((prev) => {
        if (prev.some((p) => p.name === fixedPlant.name)) return prev;
        const updated = [...prev, fixedPlant];
        AsyncStorage.setItem('@saved_plants', JSON.stringify(updated)).catch(console.error);
        return updated;
      });
    } catch (err) {
      console.error(err);
    }
  };

  const removePlant = async (id: string) => {
    try {
      setSavedPlants((prev) => {
        const updated = prev.filter((p) => p.id !== id);
        AsyncStorage.setItem('@saved_plants', JSON.stringify(updated)).catch(console.error);
        return updated;
      });
    } catch (err) {
      console.error(err);
    }
  };

  const addRecentScan = async (scan: any) => {
    try {
      const fixedScan = {
        ...scan,
        imageUri: resolveLocalUri(scan.imageUri) || scan.imageUri,
      };
      setRecentScans((prev) => {
        const filtered = prev.filter((s) => s.name !== fixedScan.name);
        const updated = [fixedScan, ...filtered].slice(0, 8);
        AsyncStorage.setItem('@recent_scans', JSON.stringify(updated)).catch(console.error);
        return updated;
      });
      setScansCount((prev) => {
        const newVal = prev + 1;
        AsyncStorage.setItem('@total_scans_count', String(newVal)).catch(console.error);
        return newVal;
      });
    } catch (err) {
      console.error(err);
    }
  };

  const removeRecentScan = async (id: string) => {
    try {
      setRecentScans((prev) => {
        const updated = prev.filter((s) => s.id !== id);
        AsyncStorage.setItem('@recent_scans', JSON.stringify(updated)).catch(console.error);
        return updated;
      });
    } catch (err) {
      console.error(err);
    }
  };

  const saveReminder = async (reminder: any) => {
    try {
      setReminders((prev) => {
        const filtered = prev.filter((r) => r.plantName !== reminder.plantName);
        const updated = [...filtered, reminder];
        AsyncStorage.setItem('@reminders', JSON.stringify(updated)).catch(console.error);
        return updated;
      });
    } catch (err) {
      console.error(err);
    }
  };

  const [loaded, error] = useFonts({
    ...Ionicons.font,
    'Ionicons': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'),
    ...MaterialCommunityIcons.font,
    'Material Design Icons': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf'),
    'MaterialCommunityIcons': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf'),
    ...FontAwesome6.font,
  });

  useEffect(() => {
    if (error) {
      console.warn('Font loading error in Expo:', error);
    }
  }, [error]);

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <UserContext.Provider value={{ 
      userName, 
      setUserName: updateUserName, 
      scansCount,
      setScansCount,
      userAvatar,
      setUserAvatar: updateUserAvatar,
      userEmail,
      setUserEmail: updateUserEmail,
      savedPlants, 
      savePlant, 
      removePlant, 
      recentScans, 
      addRecentScan,
      removeRecentScan,
      reminders, 
      saveReminder,
      isDbSyncing,
      dbSyncProgress,
      dbSyncStatusText
    }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="location-permission" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="upload-photo" />
          <Stack.Screen name="camera" />
          <Stack.Screen name="upload-progress" />
          <Stack.Screen name="ai-analysis" />
          <Stack.Screen name="plant-details" />
          <Stack.Screen name="care-reminder" />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal', headerShown: true }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </UserContext.Provider>
  );
}
