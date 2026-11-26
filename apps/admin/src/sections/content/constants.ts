import type { LabelColor } from 'src/components/label';
import type { ContentStage, ContentMediaType, ContentProfileState } from 'src/api/admin';

// ----------------------------------------------------------------------

export const STATE_LABEL: Record<ContentProfileState, { text: string; color: LabelColor }> = {
  NO_SUMMARY: { text: 'No summary', color: 'default' },
  DRAFT: { text: 'Draft', color: 'info' },
  NEEDS_MANUAL: { text: 'Needs manual', color: 'error' },
  APPROVED: { text: 'Approved', color: 'success' },
  NEEDS_REVIEW: { text: 'Needs review', color: 'warning' },
};

export const MEDIA_LABEL: Record<ContentMediaType, string> = {
  ARTICLE: 'Article',
  VIDEO: 'Video',
  MIXED: 'Video + text',
};

export const STAGES: { value: ContentStage; label: string }[] = [
  { value: 'NP', label: 'Pregnant' },
  { value: 'PP', label: 'Postpartum' },
  { value: 'NN', label: 'Neither' },
];
