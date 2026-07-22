import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

type MediaControlAction =
  | "play"
  | "pause"
  | "stop"
  | "seekBackward"
  | "seekForward"
  | "seekTo";

type MediaControlEvent = {
  action: MediaControlAction;
  positionMs?: number;
};

type MediaState = {
  title: string;
  text: string;
  album: string;
  playing: boolean;
  durationMs: number;
  positionMs: number;
  speed: number;
};

interface OpenBibleMediaPlugin {
  requestNotificationPermission(): Promise<{ granted: boolean }>;
  update(state: MediaState): Promise<void>;
  stop(): Promise<void>;
  addListener(
    eventName: "control",
    listener: (event: MediaControlEvent) => void,
  ): Promise<PluginListenerHandle>;
}

const OpenBibleMedia = registerPlugin<OpenBibleMediaPlugin>("OpenBibleMedia");

export const hasAndroidMediaControls = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";

export const requestAndroidMediaPermission = async () => {
  if (!hasAndroidMediaControls()) return false;
  try {
    return (await OpenBibleMedia.requestNotificationPermission()).granted;
  } catch {
    return false;
  }
};

export const updateAndroidMedia = async (state: MediaState) => {
  if (!hasAndroidMediaControls()) return;
  await OpenBibleMedia.update(state);
};

export const stopAndroidMedia = async () => {
  if (!hasAndroidMediaControls()) return;
  await OpenBibleMedia.stop();
};

export const listenForAndroidMediaControls = (
  listener: (event: MediaControlEvent) => void,
) => OpenBibleMedia.addListener("control", listener);
