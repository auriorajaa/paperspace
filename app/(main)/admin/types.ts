// app\(main)\admin\types.ts
export type AdminUser = {
  id: string;
  name: string;
  email: string;
  imageUrl: string;
  createdAt: number;
  updatedAt: number;
  lastSignInAt: number | null;
  lastActiveAt: number | null;
  lastActivityAt: number;
  inactiveDays: number;
  banned: boolean;
  locked: boolean;
  role: string | null;
  warningSentAt: number | null;
  counts: {
    documents: number;
    templates: number;
    forms: number;
    collections: number;
    submissions: number;
    generatedDocuments: number;
  };
};

export type AdminStats = {
  usersCount: number;
  documentsCount: number;
  collectionsCount: number;
  templatesCount: number;
  formsCount: number;
  submissionsCount: number;
  generatedDocumentsCount: number;
  formConnectionsCount: number;
  googleAccountsCount: number;
  totalUsersWithData: number;
  recentUsers: AdminUser[];
};

export type AdminContentRow = {
  _id: string;
  _creationTime: number;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  ownerImageUrl: string;
  organizationId?: string;
  title?: string;
  name?: string;
  status?: string;
  isArchived?: boolean;
  fieldsCount?: number;
  questionsCount?: number;
};

export type AdminActivityItem = {
  id: string;
  type: "document" | "template" | "form" | "submission";
  title: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  ownerImageUrl: string;
  at: number;
};
