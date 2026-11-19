// Home: Today, Topics and Me, from the canvas board "THE APP: start here".
// First run goes to the intro.
import { useEffect, useState } from "react";
import { useSharedValue } from "react-native-reanimated";
import { useWindowDimensions, View } from "react-native";
import { Redirect, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getFinishedCall, TELL_ME } from "../data/lastCall";
import { minutesLeft, replayIntro, useProfile, type SavedGap } from "../data/profile";
import { Me } from "../home/Me";
import { Nav, TopBar, type HomeTab } from "../home/Nav";
import { homeStyles } from "../home/styles";
import { Today } from "../home/Today";
import { Topics } from "../home/Topics";
import { Backdrop } from "../ui/kit";
import { ScreenIn } from "../ui/ScreenIn";

export default function Home() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const profile = useProfile();
  const [tab, setTabState] = useState<HomeTab>("today");
  // How far the page has scrolled, so the top bar can fade in over it.
  const scrollY = useSharedValue(0);
  const setTab = (t: HomeTab) => {
    scrollY.value = 0;
    setTabState(t);
  };
  // A call whose results never came back (the app closed mid-check): finish it.
  useEffect(() => {
    if (profile.introDone && getFinishedCall()) router.push("/results");
    // Once, when the app opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!profile.introDone) return <Redirect href="/intro" />;

  const onNew = () => router.push("/topic");
  const onTopic = (topic: string) => router.push({ pathname: "/session", params: { topic } });
  // A saved gap opens a call on that gap, with Fenny asking them to tell it in their own words.
  const onGap = (topic: string, gap: SavedGap) =>
    router.push({ pathname: "/session", params: { topic, prompt: TELL_ME, focus: gap.title, focusId: gap.id } });
  const common = { profile, top: insets.top, bottom: insets.bottom, scrollY };

  return (
    <View style={homeStyles.root}>
      <Backdrop scene={tab} />
      <ScreenIn key={tab}>
        {tab === "today" && <Today {...common} onNew={onNew} onTopic={onTopic} onGap={onGap} onLook={() => router.push("/look")} />}
        {tab === "topics" && <Topics {...common} onNew={onNew} onTopic={onTopic} />}
        {tab === "me" && (
          <Me
            {...common}
            onReplayIntro={() => {
              replayIntro();
            }}
          />
        )}
      </ScreenIn>
      <TopBar top={insets.top} tab={tab} minutes={minutesLeft(profile)} scrollY={scrollY} onMe={() => setTab("me")} />
      <Nav bottom={insets.bottom} tab={tab} onChange={setTab} onStart={onNew} width={width} />
    </View>
  );
}
