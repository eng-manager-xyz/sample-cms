import { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';

const STIX2_FONT_COMPONENT_ROOT = 'https://cdn.jsdelivr.net/npm/@mathjax/mathjax-stix2-font@4.0.0';
const MATHJAX_COMPONENT_ROOT = 'https://cdn.jsdelivr.net/npm/mathjax@4.0.0';
const STIX2_SVG_COMPONENT_URL = `${STIX2_FONT_COMPONENT_ROOT}/tex-mml-svg-mathjax-stix2.js`;
const STIX2_SVG_COMPONENT_INTEGRITY =
  'sha384-xGX42B+tjHdrGFxdGfLXC+tzQp0hPUb7oYfhV8tRTsdXp26SlqNhRIJRqUNlXskR';

interface MathJaxRuntime {
  startup?: {
    promise?: Promise<void>;
  };
  tex2svgPromise: (tex: string, options: Readonly<{ display: boolean }>) => Promise<HTMLElement>;
}

interface MathJaxConfiguration {
  loader: {
    load: string[];
    paths: Record<string, string>;
  };
  options: {
    enableAssistiveMml: boolean;
  };
  startup: {
    promise?: Promise<void>;
    typeset: boolean;
  };
  svg: {
    fontCache: 'local';
  };
  tex: {
    packages: Record<string, string[]>;
    processEscapes: boolean;
  };
}

declare global {
  interface Window {
    MathJax?: MathJaxConfiguration | MathJaxRuntime;
  }
}

let mathJaxPromise: Promise<MathJaxRuntime> | undefined;

function hasMathJaxRuntime(value: unknown): value is MathJaxRuntime {
  return (
    typeof value === 'object' &&
    value !== null &&
    'tex2svgPromise' in value &&
    typeof value.tex2svgPromise === 'function'
  );
}

async function initializeMathJax(): Promise<MathJaxRuntime> {
  if (hasMathJaxRuntime(window.MathJax)) return window.MathJax;

  window.MathJax = {
    loader: {
      load: ['a11y/assistive-mml'],
      paths: {
        mathjax: MATHJAX_COMPONENT_ROOT,
        'mathjax-stix2': STIX2_FONT_COMPONENT_ROOT,
      },
    },
    options: {
      enableAssistiveMml: true,
    },
    startup: {
      typeset: false,
    },
    svg: {
      fontCache: 'local',
    },
    tex: {
      packages: {
        '[+]': ['ams'],
      },
      processEscapes: true,
    },
  };

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.integrity = STIX2_SVG_COMPONENT_INTEGRITY;
    script.src = STIX2_SVG_COMPONENT_URL;
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener(
      'error',
      () => reject(new Error('The pinned MathJax STIX Two component failed to load.')),
      { once: true }
    );
    document.head.append(script);
  });

  const candidate = window.MathJax;
  if (typeof candidate === 'object' && candidate !== null && 'startup' in candidate) {
    await candidate.startup?.promise;
  }
  if (!hasMathJaxRuntime(window.MathJax)) {
    throw new Error('MathJax loaded without its TeX-to-SVG runtime API.');
  }
  return window.MathJax;
}

function loadMathJax(): Promise<MathJaxRuntime> {
  mathJaxPromise ??= initializeMathJax().catch((error: unknown) => {
    mathJaxPromise = undefined;
    throw error;
  });
  return mathJaxPromise;
}

export function MathJaxEquation({ display, tex }: Readonly<{ display: boolean; tex: string }>) {
  const hostRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    host.dataset.mathState = 'loading';

    void loadMathJax()
      .then((mathJax) => mathJax.tex2svgPromise(tex, { display }))
      .then((renderedEquation) => {
        if (cancelled || !host.isConnected) return;
        host.replaceChildren(renderedEquation);
        const spokenEquation = renderedEquation.getAttribute('data-semantic-speech-none');
        if (spokenEquation) host.setAttribute('aria-label', spokenEquation);
        host.dataset.mathState = 'ready';
      })
      .catch(() => {
        if (cancelled || !host.isConnected) return;
        host.dataset.mathState = 'error';
      });

    return () => {
      cancelled = true;
      host.setAttribute('aria-label', tex);
      host.replaceChildren();
    };
  }, [display, tex]);

  return (
    <span
      ref={hostRef}
      aria-label={tex}
      className={cn('mathjax-equation', display && 'mathjax-equation-display')}
      data-math-state="loading"
      data-tex={tex}
      role="math"
    />
  );
}
