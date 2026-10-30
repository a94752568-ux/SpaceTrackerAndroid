/** Colores por grupo de misión (compartidos por mapa y listas; sin dependencias).
 *  Alineados con tokens poster-neon (Image 2). */

import type { GroupId } from "../space/types";

export const GROUP_COLORS: Record<GroupId, string> = {
  crew: "#FFD60A",
  weather: "#00F5FF",
  nav: "#8FFF00",
  science: "#A020F0",
  starlink: "#00F5FF",
  comms: "#FF6A00",
  other: "#7ec8d8",
};
