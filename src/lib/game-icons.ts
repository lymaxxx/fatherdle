/** Gradient + short code per game (HANDOVER §3). */
export const GAME_ICON: Record<string, { code: string; sub?: string; from: string; to: string; fg?: string }> = {
  wordle: { code: "WD", from: "#E6EB5E", to: "#8FD14F" },
  maptap: { code: "MT", from: "#FF8A3D", to: "#FF5A1F" },
  krillion: { code: "K", from: "#F6F3EA", to: "#F2A7C3" },
  noillirk: { code: "N", from: "#C9CC6A", to: "#6B7036" },
  huedle: { code: "H", from: "#6FA8DC", to: "#B79CF5" },
  flagle: { code: "F", from: "#F2A7C3", to: "#FF5A1F" },
  catfishing: { code: "C", from: "#5CC8B0", to: "#6FA8DC" },
  poople: { code: "P", from: "#E3A77A", to: "#B8794F" },
  wordishingrilliontapdle: { code: "WD", sub: "GT", from: "#FFD93D", to: "#3FA34D" },
  metrodle: { code: "MR", from: "#4F8FE8", to: "#F2F6FF" },
  connections: { code: "C", from: "#E6EB5E", to: "#F2A7C3" },
  strands: { code: "S", from: "#5CC8B0", to: "#E6EB5E" },
  geoguessr: { code: "G", from: "#1E3A8A", to: "#DC2626", fg: "#FFFFFF" },
  flagcognito: { code: "FC", from: "#F2A7C3", to: "#6FA8DC" },
  flagments: { code: "FM", from: "#FF8A3D", to: "#E6EB5E" },
  whenography: { code: "WH", from: "#EEF0F3", to: "#7D828A" },
};

export function gameGradient(slug: string, angle = 90): string {
  const g = GAME_ICON[slug];
  return g ? `linear-gradient(${angle}deg, ${g.from}, ${g.to})` : "#2A2A27";
}

