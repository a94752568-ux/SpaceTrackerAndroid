/** Colores por grupo de misión (compartidos por mapa y listas; sin dependencias). */

import type { GroupId } from "../space/types";

export const GROUP_COLORS: Record<GroupId, string> = {
  crew: "#ffd166",
  weather: "#4cc9f0",
  nav: "#b5e48c",
  science: "#c77dff",
  starlink: "#7ee8fa",
  comms: "#f4a261",
  other: "#8d99ae",
};
