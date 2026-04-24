export type SectionSlice = {
  ok?: boolean;
  status?: string;
};

export type DashboardSuggestion = {
  id: string;
  priority: number;
  title: string;
  body: string;
  cta_label: string | null;
  cta_href: string | null;
};

export type ResumeStatus = {
  uploaded: boolean;
  parsed: boolean;
  processing?: boolean;
  parse_failed?: boolean;
  last_updated: string | null;
  filename: string | null;
  resume_url: string | null;
  ingestion_id: number | null;
  ingestion_status: string | null;
};

export type DashboardPayload = {
  profile_completion_percentage: number;
  profile_strength: string;
  section_status: Record<string, SectionSlice>;
  counts: {
    education_count: number;
    experience_count: number;
    skills_count: number;
    certifications_count: number;
    projects_count?: number;
  };
  suggestions: DashboardSuggestion[];
  resume_status: ResumeStatus;
};
