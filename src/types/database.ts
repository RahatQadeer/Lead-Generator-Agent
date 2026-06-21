export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      searches: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          industry: string | null;
          company_size_min: number | null;
          company_size_max: number | null;
          country: string | null;
          keywords: string[];
          technologies: string[];
          job_titles: string[];
          exclude_domains: string[];
          exclude_industries: string[];
          exclude_keywords: string[];
          exclude_countries: string[];
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          industry?: string | null;
          company_size_min?: number | null;
          company_size_max?: number | null;
          country?: string | null;
          keywords?: string[];
          technologies?: string[];
          job_titles?: string[];
          exclude_domains?: string[];
          exclude_industries?: string[];
          exclude_keywords?: string[];
          exclude_countries?: string[];
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          industry?: string | null;
          company_size_min?: number | null;
          company_size_max?: number | null;
          country?: string | null;
          keywords?: string[];
          technologies?: string[];
          job_titles?: string[];
          exclude_domains?: string[];
          exclude_industries?: string[];
          exclude_keywords?: string[];
          exclude_countries?: string[];
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      companies: {
        Row: {
          id: string;
          user_id: string;
          search_id: string | null;
          dedup_key: string;
          provider: string;
          provider_company_id: string | null;
          name: string;
          domain: string | null;
          industry: string | null;
          employee_count: number | null;
          country: string | null;
          city: string | null;
          state: string | null;
          linkedin_url: string | null;
          website_url: string | null;
          technologies: string[];
          first_discovered_at: string;
          last_seen_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          search_id?: string | null;
          dedup_key: string;
          provider: string;
          provider_company_id?: string | null;
          name: string;
          domain?: string | null;
          industry?: string | null;
          employee_count?: number | null;
          country?: string | null;
          city?: string | null;
          state?: string | null;
          linkedin_url?: string | null;
          website_url?: string | null;
          technologies?: string[];
          first_discovered_at?: string;
          last_seen_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          search_id?: string | null;
          dedup_key?: string;
          provider?: string;
          provider_company_id?: string | null;
          name?: string;
          domain?: string | null;
          industry?: string | null;
          employee_count?: number | null;
          country?: string | null;
          city?: string | null;
          state?: string | null;
          linkedin_url?: string | null;
          website_url?: string | null;
          technologies?: string[];
          first_discovered_at?: string;
          last_seen_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
