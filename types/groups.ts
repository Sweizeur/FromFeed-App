export type Collection = {
  id: string;
  name: string;
  description?: string | null;
  createdBy: string;
  createdAt: string;
  placesCount: number;
  sharedWithGroups: string[];
  isPrivate: boolean;
  coverImage?: string | null;
};
