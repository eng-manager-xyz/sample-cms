import { CmsRenderedBlock, CmsUnknownBlock } from '@repo/cms-renderer';
import type { WebsitePageViewModel, WebsitePlacement } from '@/data/website-page';

export interface PublishedBlockProps {
  readonly page: WebsitePageViewModel;
  readonly placement: WebsitePlacement;
}

export function UnknownBlock({ page, placement }: PublishedBlockProps) {
  return <CmsUnknownBlock page={page} placement={placement} />;
}

export function PublishedBlock({ page, placement }: PublishedBlockProps) {
  return <CmsRenderedBlock page={page} placement={placement} />;
}
