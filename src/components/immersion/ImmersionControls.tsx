/**
 * Toggle audio de misión (mute por defecto).
 */
import { useState } from "react";
import { loadImmersionPrefs, patchImmersionPrefs } from "../../lib/ui/immersionPrefs";
import { syncAmbientFromPrefs } from "../../lib/ui/ambientAudio";

export default function ImmersionControls() {
  const [audio, setAudio] = useState(() => loadImmersionPrefs().audioEnabled);

  const toggleAudio = () => {
    const next = patchImmersionPrefs({ audioEnabled: !audio });
    setAudio(next.audioEnabled);
    syncAmbientFromPrefs();
  };

  return (
    <button
      type="button"
      className={audio ? "st-dock-btn on" : "st-dock-btn"}
      onClick={toggleAudio}
      title={audio ? "Silenciar audio de misión" : "Activar audio de misión (bajo)"}
      aria-pressed={audio}
    >
      {audio ? "🔊" : "🔇"}
    </button>
  );
}
