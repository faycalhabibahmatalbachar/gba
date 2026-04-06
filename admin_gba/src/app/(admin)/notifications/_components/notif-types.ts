export type PushDraft = {
  title: string;
  body: string;
  imageUrl?: string | null;
};

export type SegmentFiltersState = {
  role: string;
  country: string;
  platform: 'ios' | 'android' | 'all';
  valid_only: boolean;
};
