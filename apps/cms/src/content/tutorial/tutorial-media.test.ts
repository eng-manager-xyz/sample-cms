import { describe, expect, test } from 'bun:test';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TutorialSectionMedia } from '@/components/tutorial/tutorial-media';
import type { TutorialSection } from './tutorial-curriculum';

interface MediaFile {
  role: 'mp4' | 'webm' | 'poster' | 'descriptions-vtt';
  path: string;
  state: 'verified';
  bytes: number;
  sha256: string;
}

interface TutorialMedia {
  id: string;
  scenarioId: 'stores' | 'eligible-vehicles' | 'structural-proof' | null;
  status: 'reviewed';
  captureStatus: 'verified';
  sources: { mp4: string; webm: string };
  poster: string;
  descriptionsVtt: string;
  transcript: string[];
  durationMs: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: false;
  codecs: {
    mp4: { codec: 'h264'; pixelFormat: 'yuv420p' };
    webm: { codec: 'vp9'; pixelFormat: 'yuv420p' };
  };
  files: MediaFile[];
  databaseSchemaVersion: number;
  verification: {
    probe: 'passed';
    accessibilityReview: 'passed';
    visualReview: 'passed';
    approvalTimestamp: null;
  };
  notes: string[];
}

interface TutorialMediaManifest {
  schemaVersion: 2;
  packageStatus: 'reviewed';
  integrationMode: 'reviewed-preview';
  readyForApprovedIntegration: boolean;
  media: TutorialMedia[];
}

interface TutorialMediaManifestSchema {
  $id: string;
  required: string[];
  properties: {
    schemaVersion: { const: number };
    integrationMode: { enum: string[] };
    readyForApprovedIntegration: { type: string };
    media: {
      minItems: number;
      maxItems: number;
      allOf: Array<{
        contains: {
          properties: {
            id: { const: string };
            scenarioId: { const: TutorialMedia['scenarioId'] };
          };
        };
        minContains: number;
        maxContains: number;
      }>;
    };
  };
  allOf: Array<{
    if: { properties: { packageStatus: { const: string } } };
    then: {
      properties: {
        integrationMode: { const: string };
        readyForApprovedIntegration: { const: boolean };
      };
    };
  }>;
  $defs: {
    uiFlowVideo: {
      properties: {
        id: { enum: string[] };
      };
    };
  };
}

interface ProbeOutput {
  streams: Array<{
    codec_name: string;
    codec_type: string;
    width: number;
    height: number;
    pix_fmt: string;
    r_frame_rate: string;
  }>;
  format: { duration: string };
}

interface TutorialIllustrationManifest {
  schemaVersion: 2;
  status: 'accepted-substitute';
  requestedGenerator: 'Google Imagen';
  actualGenerator: 'OpenAI built-in image_gen';
  requirementSatisfied: true;
  substitutionAccepted: true;
  acceptedAt: string;
  acceptanceReference: 'AUT-533';
  acceptanceNote: string;
  referenceUrls: string[];
  assets: Array<{
    id: string;
    publicPath: string;
    evidenceClass: 'editorial-illustration';
    status: 'accepted-substitute';
    width: number;
    height: number;
    bytes: number;
    sha256: string;
    alt: string;
    longDescription: string;
  }>;
}

const flowDirectory = new URL('../../../public/media/tutorial/flows/', import.meta.url);
const manifest = (await Bun.file(
  new URL('manifest.json', flowDirectory)
).json()) as TutorialMediaManifest;
const manifestSchema = (await Bun.file(
  new URL('manifest.schema.json', flowDirectory)
).json()) as TutorialMediaManifestSchema;
const ffprobePath = process.env.FFPROBE_PATH ?? Bun.which('ffprobe');
const illustrationDirectory = new URL('../../../public/media/tutorial/', import.meta.url);
const illustrationManifest = (await Bun.file(
  new URL('illustrations.manifest.json', illustrationDirectory)
).json()) as TutorialIllustrationManifest;

function tutorialSection(visual: string, number: string): TutorialSection {
  return {
    id: `test-${visual}`,
    number,
    title: visual,
    readMinutes: 1,
    mediaMinutes: 1,
    digestMinutes: 1,
    prerequisite: null,
    visual,
    prerequisiteId: null,
    markdownHeadingTitle: visual,
    learningOutcome: 'Inspect the media contract.',
    bodyMarkdown: 'Body',
    digestPrompt: 'Digest',
    wordCount: 1,
  };
}

function renderSectionMedia(
  visual: string,
  number: string,
  activeVisual: string | null = null
): string {
  return renderToStaticMarkup(
    createElement(TutorialSectionMedia, {
      section: tutorialSection(visual, number),
      activeVisual,
      onActiveVisualChange: () => undefined,
    })
  );
}

function timestampToMilliseconds(timestamp: string): number {
  const match = timestamp.match(/^(\d{2}):(\d{2}):(\d{2})\.(\d{3})$/);
  if (!match) throw new Error(`Invalid WebVTT timestamp: ${timestamp}`);
  const [, hours = '0', minutes = '0', seconds = '0', milliseconds = '0'] = match;
  return (
    Number(hours) * 3_600_000 +
    Number(minutes) * 60_000 +
    Number(seconds) * 1_000 +
    Number(milliseconds)
  );
}

async function probeMedia(publicPath: string): Promise<ProbeOutput> {
  if (!ffprobePath) {
    throw new Error('Set FFPROBE_PATH or install ffprobe to re-probe tutorial video encodes.');
  }
  const basename = publicPath.replace('/media/tutorial/flows/', '');
  const mediaPath = fileURLToPath(new URL(basename, flowDirectory));
  const process = Bun.spawn(
    [
      ffprobePath,
      '-v',
      'error',
      '-show_entries',
      'stream=codec_name,codec_type,width,height,r_frame_rate,pix_fmt:format=duration',
      '-of',
      'json',
      mediaPath,
    ],
    { stdout: 'pipe', stderr: 'pipe' }
  );
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);

  if (exitCode !== 0) {
    throw new Error(`ffprobe failed for ${basename}: ${stderr.trim()}`);
  }

  return JSON.parse(stdout) as ProbeOutput;
}

describe('tutorial UI-flow media manifest', () => {
  test('permits a labeled reviewed preview while approved integration stays fail-closed', () => {
    expect(manifest.schemaVersion).toBe(2);
    expect(manifest.packageStatus).toBe('reviewed');
    expect(manifest.integrationMode).toBe('reviewed-preview');
    expect(manifest.readyForApprovedIntegration).toBe(false);
    if (manifest.readyForApprovedIntegration) expect(ffprobePath).toBeTruthy();
    expect(manifest.media).toHaveLength(4);
    expect(manifest.media.map((media) => media.id).sort()).toEqual([
      'eligible-vehicles-authoring-v1',
      'store-authoring-v1',
      'structural-replacement-authoring-v1',
      'wall-navigation-v1',
    ]);

    for (const media of manifest.media) {
      expect(media.status).toBe('reviewed');
      expect(media.captureStatus).toBe('verified');
      expect(media.verification).toEqual({
        probe: 'passed',
        accessibilityReview: 'passed',
        visualReview: 'passed',
        approvalTimestamp: null,
      });
      expect(media.notes.join(' ')).toMatch(
        /Source provenance is anchored by AUT-533.*final integration approval remains pending/
      );
    }
  });

  test('keeps the manifest schema identity, states, and exact media inventory coherent', () => {
    expect(manifestSchema.$id).toBe('https://auteur.local/schemas/tutorial-flow-manifest-v2.json');
    expect(manifestSchema.required.sort()).toEqual([
      'integrationMode',
      'media',
      'packageStatus',
      'readyForApprovedIntegration',
      'schemaVersion',
    ]);
    expect(manifestSchema.properties.schemaVersion.const).toBe(2);
    expect(manifestSchema.properties.integrationMode.enum).toEqual([
      'not-integrated',
      'reviewed-preview',
      'approved',
    ]);
    expect(manifestSchema.properties.readyForApprovedIntegration.type).toBe('boolean');
    expect(manifestSchema.properties.media.minItems).toBe(manifest.media.length);
    expect(manifestSchema.properties.media.maxItems).toBe(manifest.media.length);

    const manifestIds = manifest.media.map((media) => media.id).sort();
    expect(manifestSchema.$defs.uiFlowVideo.properties.id.enum.sort()).toEqual(manifestIds);

    const manifestPairs = manifest.media
      .map((media) => JSON.stringify([media.id, media.scenarioId]))
      .sort();
    const schemaPairs = manifestSchema.properties.media.allOf
      .map((contract) =>
        JSON.stringify([
          contract.contains.properties.id.const,
          contract.contains.properties.scenarioId.const,
        ])
      )
      .sort();
    expect(schemaPairs).toEqual(manifestPairs);
    for (const contract of manifestSchema.properties.media.allOf) {
      expect(contract.minContains).toBe(1);
      expect(contract.maxContains).toBe(1);
    }

    const stateContracts = Object.fromEntries(
      manifestSchema.allOf.map((contract) => [
        contract.if.properties.packageStatus.const,
        [
          contract.then.properties.integrationMode.const,
          contract.then.properties.readyForApprovedIntegration.const,
        ],
      ])
    );
    expect(stateContracts).toEqual({
      approved: ['approved', true],
      reviewed: ['reviewed-preview', false],
      draft: ['not-integrated', false],
    });
  });

  test('matches every committed derivative by byte count and SHA-256', async () => {
    const referencedFiles = new Set<string>();
    let totalBytes = 0;

    for (const media of manifest.media) {
      expect(media.files).toHaveLength(4);
      const pathsByRole = new Map(media.files.map((file) => [file.role, file.path]));
      expect(pathsByRole.size).toBe(4);
      expect(pathsByRole.get('mp4') ?? '').toBe(media.sources.mp4);
      expect(pathsByRole.get('webm') ?? '').toBe(media.sources.webm);
      expect(pathsByRole.get('poster') ?? '').toBe(media.poster);
      expect(pathsByRole.get('descriptions-vtt') ?? '').toBe(media.descriptionsVtt);
      expect(media.width).toBe(1440);
      expect(media.height).toBe(900);
      expect(media.fps).toBe(30);
      expect(media.hasAudio).toBe(false);
      expect(media.databaseSchemaVersion).toBe(6);
      expect(media.durationMs).toBeGreaterThanOrEqual(20_000);
      expect(media.durationMs).toBeLessThanOrEqual(35_000);
      expect(media.codecs).toEqual({
        mp4: { codec: 'h264', pixelFormat: 'yuv420p' },
        webm: { codec: 'vp9', pixelFormat: 'yuv420p' },
      });

      for (const file of media.files) {
        expect(file.state).toBe('verified');
        const basename = file.path.replace('/media/tutorial/flows/', '');
        referencedFiles.add(basename);
        const asset = Bun.file(new URL(basename, flowDirectory));
        expect(await asset.exists()).toBe(true);
        const bytes = await asset.arrayBuffer();
        const digest = new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
        expect(bytes.byteLength).toBe(file.bytes);
        expect(digest).toBe(file.sha256);
        totalBytes += bytes.byteLength;

        if (file.role === 'mp4') expect(bytes.byteLength).toBeLessThanOrEqual(15_000_000);
        if (file.role === 'webm') expect(bytes.byteLength).toBeLessThanOrEqual(12_000_000);
        if (file.role === 'poster') expect(bytes.byteLength).toBeLessThanOrEqual(300_000);
      }
    }

    const shippedDerivatives = new Set(
      (await readdir(flowDirectory)).filter((name) => /\.(?:mp4|webm|webp|vtt)$/.test(name)).sort()
    );
    expect([...referencedFiles].sort()).toEqual([...shippedDerivatives].sort());
    expect(totalBytes).toBeLessThanOrEqual(60_000_000);
  });

  test('keeps every WebVTT cue monotonic and inside its measured video', async () => {
    for (const media of manifest.media) {
      const vttFile = media.files.find((file) => file.role === 'descriptions-vtt');
      expect(vttFile).toBeDefined();
      if (!vttFile) continue;

      const basename = vttFile.path.replace('/media/tutorial/flows/', '');
      const vtt = await Bun.file(new URL(basename, flowDirectory)).text();
      const cues = [...vtt.matchAll(/(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})/g)];
      expect(cues).toHaveLength(media.transcript.length);
      const cueText = vtt
        .trim()
        .split(/\n{2,}/)
        .filter((block) => block.includes('-->'))
        .map((block) => block.split('\n').slice(2).join(' ').trim());
      expect(cueText).toEqual(media.transcript);

      let previousEnd = 0;
      for (const cue of cues) {
        const start = timestampToMilliseconds(cue[1] ?? '');
        const end = timestampToMilliseconds(cue[2] ?? '');
        expect(start).toBeGreaterThanOrEqual(previousEnd);
        expect(end).toBeGreaterThan(start);
        expect(end).toBeLessThanOrEqual(media.durationMs);
        previousEnd = end;
      }
    }
  });

  test.skipIf(!ffprobePath)(
    'probes every encoded source instead of trusting declared codec metadata',
    async () => {
      for (const media of manifest.media) {
        for (const role of ['mp4', 'webm'] as const) {
          const probe = await probeMedia(media.sources[role]);
          const videoStreams = probe.streams.filter((stream) => stream.codec_type === 'video');
          const audioStreams = probe.streams.filter((stream) => stream.codec_type === 'audio');

          expect(videoStreams).toHaveLength(1);
          expect(audioStreams).toHaveLength(0);
          expect(videoStreams[0]).toMatchObject({
            codec_name: media.codecs[role].codec,
            width: media.width,
            height: media.height,
            pix_fmt: media.codecs[role].pixelFormat,
            r_frame_rate: '30/1',
          });
          expect(
            Math.abs(Number(probe.format.duration) * 1000 - media.durationMs)
          ).toBeLessThanOrEqual(40);
        }
      }
    }
  );

  test('pairs the current Chapter 5 wall walkthrough with the live Store resolution pin', () => {
    const wallMarkup = renderSectionMedia('wall-ui-walkthrough', '5.1');
    const pinMarkup = renderSectionMedia('pin-ui-walkthrough', '5.2', 'pin-ui-walkthrough');

    expect(wallMarkup).toContain('id="wall-navigation-v1"');
    expect(wallMarkup).toContain('/media/tutorial/flows/wall-navigation-v1.mp4');
    expect(wallMarkup).toContain('The tutorial and operational workspace remain adjacent routes');
    expect(pinMarkup).toContain('Inspect the current Store resolution pin');
    expect(pinMarkup).toContain('Layers to manifest · Store');
    expect(pinMarkup).toContain('stored route-status gate');
    expect(pinMarkup).not.toContain('pin-inspection-v1');
    expect(pinMarkup).not.toContain('<video');
    expect(wallMarkup).toContain('preload="none"');
    expect(wallMarkup).toContain('aria-labelledby="wall-navigation-v1-title"');
    expect(wallMarkup).toContain('aria-describedby="wall-navigation-v1-description"');
    expect(pinMarkup).toContain('aria-labelledby="stores-resolution-title"');
    expect(wallMarkup).toContain('Reviewed UI capture');
  });

  test('renders Chapter 1 as an executable current-code path', () => {
    const markup = renderSectionMedia('current-code-flow', '1.1');

    expect(markup).toContain('Executable code path');
    expect(markup).toContain('author → publish → serve');
    expect(markup).toContain('apps/cms/src/server-functions/cms.functions.ts');
    expect(markup).toContain('packages/cms-service/src/cms-service.ts');
    expect(markup).toContain('apps/website/src/server-functions/published-page.functions.ts');
    expect(markup).toContain('apps/website/src/components/block-renderer.tsx');
    expect(markup).not.toMatch(/(?:old world|route[- ]tree|legacy|Median)/i);
  });

  test('keeps the Chapter 5 scenario replay in place with unique DOM ids', () => {
    const markup = renderSectionMedia('scenario-flow-videos', '5.3');
    const ids = [...markup.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);

    expect(markup).not.toContain('href="#eligible-vehicles-authoring-v1"');
    expect(markup).not.toContain('href="#store-authoring-v1"');
    expect(markup).not.toContain('href="#structural-replacement-authoring-v1"');
    expect(markup).toContain('aria-controls="chapter-5-scenario-flow-player"');
    expect(markup).toContain('id="chapter-5-eligible-vehicles-authoring-v1"');
    expect(markup).toContain('Three reviewed SQLite captures');
    expect(markup).toContain('Final source approval pending');
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('keeps the accepted illustration substitution explicit and integrity checked', async () => {
    expect(illustrationManifest).toMatchObject({
      schemaVersion: 2,
      status: 'accepted-substitute',
      requestedGenerator: 'Google Imagen',
      actualGenerator: 'OpenAI built-in image_gen',
      requirementSatisfied: true,
      substitutionAccepted: true,
      acceptanceReference: 'AUT-533',
    });
    expect(illustrationManifest.acceptedAt).toBe('2026-08-30T01:35:41.690Z');
    expect(illustrationManifest.acceptanceNote).toContain(
      'explicitly accepted the OpenAI image_gen illustrations'
    );
    expect(illustrationManifest.referenceUrls).toEqual([
      'https://ai.google.dev/gemini-api/docs/models/imagen',
      'https://docs.cloud.google.com/vertex-ai/generative-ai/docs/release-notes',
    ]);
    expect(illustrationManifest.assets).toHaveLength(2);
    expect(illustrationManifest.assets.map((asset) => asset.id).sort()).toEqual([
      'atomic-publication-rollback-v1',
      'three-proof-shapes-v1',
    ]);
    expect(
      illustrationManifest.assets.some((asset) =>
        asset.publicPath.includes('old-world-to-wall-of-maps')
      )
    ).toBe(false);

    for (const asset of illustrationManifest.assets) {
      expect(asset).toMatchObject({
        evidenceClass: 'editorial-illustration',
        status: 'accepted-substitute',
        width: 1672,
        height: 941,
      });
      expect(asset.alt.length).toBeGreaterThan(40);
      expect(asset.longDescription.length).toBeGreaterThan(100);
      const basename = asset.publicPath.replace('/media/tutorial/', '');
      const file = Bun.file(new URL(basename, illustrationDirectory));
      expect(await file.exists()).toBe(true);
      const bytes = await file.arrayBuffer();
      expect(bytes.byteLength).toBe(asset.bytes);
      expect(new Bun.CryptoHasher('sha256').update(bytes).digest('hex')).toBe(asset.sha256);
    }
  });
});
