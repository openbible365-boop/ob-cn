import { Icon } from "./Icon";

const AUDIO_ICONS = {
  play: "play",
  pause: "pause",
  prev: "skip-back",
  next: "skip-forward",
  replay: "rotate-ccw",
  forward: "rotate-cw",
  chevron: "chevron-down",
} as const;

// Audio controls share the same outline icon set as the rest of the app.
export function AudioGlyph({ name, size = 20 }: {
  name: keyof typeof AUDIO_ICONS;
  size?: number;
}) {
  return <Icon name={AUDIO_ICONS[name]} size={size} className="audio-glyph" />;
}
