import { ScoreboardContent } from "./Scoreboard";

export default function EmbedScoreboard() {
  return (
    <div className="min-h-screen bg-white px-4 py-6">
      <div className="mx-auto max-w-5xl">
        <ScoreboardContent showMissing={false} showTotalsPanel minimal />
      </div>
    </div>
  );
}
