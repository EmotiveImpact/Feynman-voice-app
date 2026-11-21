import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from "@expo-google-fonts/inter";
import { InstrumentSans_600SemiBold } from "@expo-google-fonts/instrument-sans";
import { GeistMono_400Regular, GeistMono_500Medium } from "@expo-google-fonts/geist-mono";
import { useEffect } from "react";
import { View } from "react-native";
import { getProfile } from "../data/profile";
import { warmPhononOnLaunch } from "../live/phononWarm";
import { colour } from "../theme";

export default function RootLayout() {
  const [loaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    InstrumentSans_600SemiBold,
    GeistMono_400Regular,
    GeistMono_500Medium,
  });
  // Fenny's on-device voice takes a few seconds to load, so start now and it
  // is ready by the time a call begins.
  useEffect(() => {
    warmPhononOnLaunch(getProfile().voice);
  }, []);
  if (!loaded) return <View style={{ flex: 1, backgroundColor: colour.ground }} />;
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colour.ground }, animation: "fade" }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="session" options={{ animation: "fade", gestureEnabled: false }} />
        <Stack.Screen name="results" options={{ animation: "fade", gestureEnabled: false }} />
        <Stack.Screen name="intro" options={{ animation: "fade", gestureEnabled: false }} />
        <Stack.Screen name="topic" options={{ presentation: "transparentModal", animation: "none" }} />
        <Stack.Screen name="map" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="look" options={{ animation: "fade" }} />
        <Stack.Screen name="dev" options={{ presentation: "modal" }} />
      </Stack>
    </>
  );
}
