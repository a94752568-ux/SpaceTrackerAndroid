#!/usr/bin/env python3
"""Apply MapView visual/animation patches. Read original MapView from stdin, write to stdout."""
import sys
text = sys.stdin.read()
if "PLACEHOLDER" in text or "RENDERIZADO" not in text:
    sys.stderr.write("Expected full MapView on stdin\n")
    sys.exit(1)

text = text.replace("""    termRef.current = L.polygon([], {
      color: \"#22d3ee\",
      weight: 1,
      opacity: 0.5,
      dashArray: \"4 4\",
      fillColor: \"#000000\",
      fillOpacity: 0.38,
      interactive: false,
      bubblingMouseEvents: false,
    });""", """    termRef.current = L.polygon([], {
      color: \"#00f5ff\",
      weight: 1.2,
      opacity: 0.55,
      dashArray: \"5 6\",
      fillColor: \"#020814\",
      fillOpacity: 0.22,
      interactive: false,
      bubblingMouseEvents: false,
      className: \"st-terminator\",
    });""")

text = text.replace(
    'overlayPane.style.filter =\n          "hue-rotate(90deg) contrast(180%) drop-shadow(2px 0px 0px #FF2DAA) drop-shadow(-2px 0px 0px #00E5FF)";',
    'overlayPane.style.filter =\n          "contrast(1.35) saturate(1.45) drop-shadow(3px 0 0 #FF2DAA) drop-shadow(-3px 0 0 #00F5FF)";',
)

text = text.replace("""    const trackOpts = {
      color: \"#22d3ee\",
      weight: 1.6,
      interactive: false,          // capa de soporte: nunca intercepta clics
      bubblingMouseEvents: false,  // ni propaga eventos al mapa
    } as L.PolylineOptions;
    // Órbita estilizada: fade de opacidad hacia el pasado (3 trazos SVG).
    if (!trackOldRef.current) {
      trackOldRef.current = L.polyline(segOld, { ...trackOpts, opacity: 0.12, className: \"st-track-old\" }).addTo(map);
      trackMidRef.current = L.polyline(segMid, { ...trackOpts, opacity: 0.28, className: \"st-track-mid\" }).addTo(map);
      trackFutRef.current = L.polyline(segFut, { ...trackOpts, opacity: 0.55, className: \"st-track-fut\" }).addTo(map);""",
"""    const trackOpts = {
      color: \"#00f5ff\",
      weight: 1.8,
      interactive: false,
      bubblingMouseEvents: false,
      lineCap: \"round\" as const,
      lineJoin: \"round\" as const,
    } as L.PolylineOptions;
    // Órbita estilizada: fade hacia el pasado + dash animado en el futuro.
    if (!trackOldRef.current) {
      trackOldRef.current = L.polyline(segOld, { ...trackOpts, opacity: 0.14, className: \"st-track-old\" }).addTo(map);
      trackMidRef.current = L.polyline(segMid, { ...trackOpts, opacity: 0.32, className: \"st-track-mid\" }).addTo(map);
      trackFutRef.current = L.polyline(segFut, {
        ...trackOpts,
        opacity: 0.7,
        weight: 2.2,
        dashArray: \"10 8\",
        className: \"st-track-fut\",
      }).addTo(map);""")

text = text.replace(
"""radius: 2,
            weight: 1,
            color: GROUP_COLORS[s.group],
            fillColor: GROUP_COLORS[s.group],""",
"""radius: 2.8,
            weight: 1.25,
            color: GROUP_COLORS[s.group],
            fillColor: GROUP_COLORS[s.group],""")
text = text.replace(
"""radius: 2,
          weight: 1,
          color: GROUP_COLORS[s.group],
          fillColor: GROUP_COLORS[s.group],""",
"""radius: 2.8,
          weight: 1.25,
          color: GROUP_COLORS[s.group],
          fillColor: GROUP_COLORS[s.group],""")

text = text.replace(
  'map.flyTo([fix.latDeg, fix.lonDeg], Math.max(map.getZoom(), 4), { duration: 1.25 });',
  'map.flyTo([fix.latDeg, fix.lonDeg], Math.max(map.getZoom(), 4), { duration: 1.6, easeLinearity: 0.35 });')
text = text.replace(
  'map.panTo([fix.latDeg, fix.lonDeg], { animate: true, duration: 0.9, easeLinearity: 0.9 });',
  'map.panTo([fix.latDeg, fix.lonDeg], { animate: true, duration: 1.15, easeLinearity: 0.45 });')

sys.stdout.write(text)
sys.stderr.write("patched OK\n")
