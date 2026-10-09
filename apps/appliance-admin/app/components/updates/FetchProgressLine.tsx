import type { FetchProgress } from "@/lib/osadmin/types";

import { megabytes } from "@/components/updates/OfferList";

const STATES: Record<string, string> = {
  done: "Fetched",
  downloading: "Downloading",
  failed: "The fetch failed",
  querying: "Asking the mirror",
  verifying: "Verifying the signature and SHA-256",
};

/** True while a fetch is under way: asking, downloading or verifying. */
export const fetchRunning = (progress?: FetchProgress): boolean =>
  !!progress && ["downloading", "querying", "verifying"].includes(progress.state);

const eta = (seconds: number): string =>
  seconds >= 60 ? `${String(Math.ceil(seconds / 60))} min left` : `${String(seconds)} s left`;

/** A fetch under way: its state, the bytes and percentage, the speed and the time left. */
export const FetchProgressLine = ({ progress }: { progress: FetchProgress }) => {
  const done = Number(progress.doneBytes);
  const total = Number(progress.totalBytes);
  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const speed = Number(progress.bytesPerSecond);
  const parts = [
    total > 0 ? `${megabytes(done)} of ${megabytes(total)} (${String(percent)}%)` : megabytes(done),
    speed > 0 ? `${megabytes(speed)}/s` : "",
    Number(progress.etaSeconds) > 0 ? eta(Number(progress.etaSeconds)) : "",
  ].filter(Boolean);
  return (
    <section
      aria-label="Fetch progress"
      className="flex flex-col gap-1.5"
      data-state={progress.state}
    >
      <p className="m-0 font-bold">
        {STATES[progress.state] ?? progress.state}: {progress.fileName}
      </p>
      <progress
        aria-label="Fetch progress"
        className="h-3 w-full accent-primary"
        max={100}
        value={percent}
      />
      <p className="m-0 text-muted">{parts.join(", ")}</p>
    </section>
  );
};
