import type { ComponentType, ReactNode } from 'react';

export const CMS_RENDERED_PAGE_CLASS = 'cms-rendered-page';

export interface CmsRenderedPageContext {
  readonly scenarioId: string;
  readonly canonicalUrl: string;
  readonly renderMode: 'published' | 'preview';
  readonly interactionMode?: 'active' | 'static';
}

export interface CmsRenderedPlacement {
  readonly placementKey: string;
  readonly order: number;
  readonly blockType: string;
  readonly content: Readonly<Record<string, unknown>>;
}

export interface CmsRenderedBlockProps {
  readonly page: CmsRenderedPageContext;
  readonly placement: CmsRenderedPlacement;
}

type CmsRenderedBlockComponent = ComponentType<CmsRenderedBlockProps>;

function contentText(
  content: Readonly<Record<string, unknown>>,
  key: string,
  fallback: string
): string {
  const value = content[key];
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function RenderedLink({
  page,
  href,
  className,
  children,
}: Readonly<{
  page: CmsRenderedPageContext;
  href: string;
  className?: string;
  children: ReactNode;
}>) {
  return page.interactionMode === 'static' ? (
    <span className={className}>{children}</span>
  ) : (
    <a className={className} href={href}>
      {children}
    </a>
  );
}

function AuteurMark() {
  return (
    <span className="auteur-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

function NavigationBlock({ page, placement }: CmsRenderedBlockProps) {
  const label = contentText(placement.content, 'label', 'Auteur');
  return (
    <header className="site-nav" data-placement={placement.placementKey}>
      <RenderedLink page={page} className="site-nav__brand" href="/">
        <AuteurMark />
        <span>{label}</span>
      </RenderedLink>
      <nav className="site-nav__links" aria-label="Primary">
        <RenderedLink page={page} href="#overview">
          Overview
        </RenderedLink>
        <RenderedLink page={page} href="#details">
          Details
        </RenderedLink>
        <RenderedLink page={page} className="site-nav__cta" href="#action">
          Get started
        </RenderedLink>
      </nav>
    </header>
  );
}

function HeroBlock({ page, placement }: CmsRenderedBlockProps) {
  const headline = contentText(placement.content, 'headline', 'A page assembled from blocks');
  const eyebrow =
    page.scenarioId === 'stores'
      ? 'Available near you'
      : page.scenarioId === 'eligible-vehicles'
        ? 'Drive on your terms'
        : 'Travel with confidence';
  return (
    <section
      className={`site-hero site-hero--${page.scenarioId}`}
      data-placement={placement.placementKey}
    >
      <div className="site-hero__copy">
        <p className="site-eyebrow">{eyebrow}</p>
        <h1>{headline}</h1>
        <p className="site-hero__lede">
          {page.renderMode === 'published'
            ? 'Local guidance, clear next steps, and a page assembled from one immutable publication.'
            : 'Local guidance, clear next steps, and a page assembled from the current authoring resolution.'}
        </p>
        <div className="site-hero__actions" id="action">
          <RenderedLink page={page} className="site-button site-button--primary" href="#details">
            Explore this page
          </RenderedLink>
          <RenderedLink
            page={page}
            className="site-button site-button--quiet"
            href={page.renderMode === 'published' ? '#publication-details' : '#draft-details'}
          >
            {page.renderMode === 'published' ? 'View publication' : 'View draft'}
          </RenderedLink>
        </div>
      </div>
      <div className="site-hero__visual" aria-hidden="true">
        <div className="site-hero__orb site-hero__orb--one" />
        <div className="site-hero__orb site-hero__orb--two" />
        <div className="site-hero__card">
          <span>{page.scenarioId === 'stores' ? 'Open now' : 'Ready when you are'}</span>
          <strong>{page.canonicalUrl.split('/').at(-1)?.replaceAll('-', ' ')}</strong>
          <i />
        </div>
      </div>
    </section>
  );
}

function HeroAltBlock({ page, placement }: CmsRenderedBlockProps) {
  const headline = contentText(placement.content, 'headline', 'Plan every step of your trip');
  const mapAssetKey = contentText(placement.content, 'mapAssetKey', 'pickup-map');
  return (
    <section className="site-hero-alt" data-placement={placement.placementKey}>
      <div className="site-hero-alt__copy">
        <p className="site-eyebrow">Airport pickup guide</p>
        <h1>{headline}</h1>
        <p>Follow a calmer route from curb to car with guidance tailored to this airport.</p>
        <RenderedLink page={page} className="site-button site-button--primary" href="#details">
          See pickup details
        </RenderedLink>
      </div>
      <div
        className="route-map"
        data-map-asset={mapAssetKey}
        role="img"
        aria-label="Stylized airport pickup map"
      >
        <span className="route-map__road route-map__road--one" />
        <span className="route-map__road route-map__road--two" />
        <span className="route-map__road route-map__road--three" />
        <span className="route-map__pin route-map__pin--start">A</span>
        <span className="route-map__pin route-map__pin--finish">B</span>
        <span className="route-map__route" />
        <small>{page.canonicalUrl.split('/').at(-1)?.toUpperCase()}</small>
      </div>
    </section>
  );
}

function PromoBlock({ page, placement }: CmsRenderedBlockProps) {
  const message = contentText(placement.content, 'message', 'Made for this place');
  const ordinal = placement.order + 1;
  return (
    <section
      className={`site-promo site-promo--${ordinal % 3}`}
      data-placement={placement.placementKey}
      id={placement.order === 2 ? 'details' : undefined}
    >
      <span className="site-promo__number">{String(ordinal).padStart(2, '0')}</span>
      <div>
        <p className="site-eyebrow">{placement.placementKey.replaceAll('-', ' ')}</p>
        <h2>{message}</h2>
        <p>
          Useful, local information rendered from the{' '}
          {page.renderMode === 'published' ? 'published' : 'current authoring'} block at this stable
          placement.
        </p>
      </div>
      <span className="site-promo__arrow" aria-hidden="true">
        ↗
      </span>
    </section>
  );
}

function FooterBlock({ page, placement }: CmsRenderedBlockProps) {
  const legal = contentText(placement.content, 'legal', 'Terms apply.');
  return (
    <footer className="site-footer" data-placement={placement.placementKey}>
      <div className="site-footer__brand">
        <AuteurMark />
        <strong>Auteur</strong>
      </div>
      <p>{legal}</p>
      <p className="site-footer__route">{page.canonicalUrl}</p>
    </footer>
  );
}

export function CmsUnknownBlock({ placement }: CmsRenderedBlockProps) {
  return (
    <section className="unknown-block" data-placement={placement.placementKey} role="note">
      <div>
        <p className="site-eyebrow">Renderer needed</p>
        <h2>Unknown block: {placement.blockType}</h2>
        <p>
          The placement remains visible so a missing registry entry cannot silently remove published
          content.
        </p>
      </div>
      <pre>{JSON.stringify(placement.content, null, 2)}</pre>
    </section>
  );
}

const cmsRenderedBlockRegistry = {
  navigation: NavigationBlock,
  hero: HeroBlock,
  hero_alt: HeroAltBlock,
  promo: PromoBlock,
  footer: FooterBlock,
} as const satisfies Record<string, CmsRenderedBlockComponent>;

export function CmsRenderedBlock({ page, placement }: CmsRenderedBlockProps) {
  const Renderer = Object.hasOwn(cmsRenderedBlockRegistry, placement.blockType)
    ? cmsRenderedBlockRegistry[placement.blockType as keyof typeof cmsRenderedBlockRegistry]
    : CmsUnknownBlock;
  return <Renderer page={page} placement={placement} />;
}
