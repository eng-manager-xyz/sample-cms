import { CirclePlay, Database, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface TutorialVideoProps {
  id: string;
  instanceId?: string;
  title: string;
  description: string;
  duration: string;
  evidenceLabel?: string;
  poster: string;
  mp4: string;
  webm: string;
  descriptionsVtt: string;
  transcript: string[];
}

export function TutorialVideo({
  id,
  instanceId,
  title,
  description,
  duration,
  evidenceLabel = 'Reviewed SQLite capture',
  poster,
  mp4,
  webm,
  descriptionsVtt,
  transcript,
}: Readonly<TutorialVideoProps>) {
  const domId = instanceId ?? id;
  const descriptionId = `${domId}-description`;
  const transcriptId = `${domId}-transcript`;

  return (
    <figure
      id={domId}
      aria-labelledby={`${domId}-title`}
      aria-describedby={`${descriptionId} ${transcriptId}`}
      className="my-6 overflow-hidden rounded-xl border border-line bg-canvas shadow-[0_12px_35px_rgba(22,22,26,0.06)]"
    >
      <figcaption className="flex flex-col gap-3 border-b border-line bg-surface-subtle px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <Badge tone="success">
              <Database aria-hidden="true" className="size-3" /> {evidenceLabel}
            </Badge>
            <Badge tone="neutral">{duration}</Badge>
            <Badge tone="warning">Final source approval pending</Badge>
          </div>
          <h4 id={`${domId}-title`} className="text-sm font-semibold text-ink">
            {title}
          </h4>
          <p id={descriptionId} className="mt-1 max-w-3xl text-[11px] leading-5 text-ink-muted">
            {description}
          </p>
        </div>
        <CirclePlay aria-hidden="true" className="mt-1 size-5 shrink-0 text-accent-strong" />
      </figcaption>

      <div className="bg-ink p-1 sm:p-2">
        <video
          controls
          playsInline
          preload="none"
          aria-labelledby={`${domId}-title`}
          aria-describedby={descriptionId}
          poster={poster}
          className="aspect-[8/5] w-full rounded-lg bg-ink object-contain"
        >
          <source src={mp4} type="video/mp4" />
          <source src={webm} type="video/webm" />
          <track
            default
            kind="captions"
            src={descriptionsVtt}
            srcLang="en"
            label="English descriptions"
          />
          Your browser cannot play this recording. The complete transcript follows.
        </video>
      </div>

      <details id={transcriptId} className="group border-t border-line bg-canvas">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-xs font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus [&::-webkit-details-marker]:hidden">
          <FileText aria-hidden="true" className="size-3.5 text-accent-strong" />
          Read transcript
          <span className="ml-auto text-[10px] font-normal text-ink-faint group-open:hidden">
            {transcript.length} beats
          </span>
        </summary>
        <ol className="space-y-3 border-t border-line bg-surface-subtle px-4 py-4">
          {transcript.map((line, index) => (
            <li key={line} className="grid grid-cols-[26px_1fr] gap-3">
              <span className="font-mono text-[10px] tabular-nums text-ink-faint">
                {String(index + 1).padStart(2, '0')}
              </span>
              <p className="text-xs leading-5 text-ink-muted">{line}</p>
            </li>
          ))}
        </ol>
      </details>
    </figure>
  );
}
