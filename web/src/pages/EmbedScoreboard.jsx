import { ScoreboardContent } from "./Scoreboard";

export default function EmbedScoreboard() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <ScoreboardContent showMissing={false} showTotalsPanel minimal />
      </div>
    </div>
  );
}
