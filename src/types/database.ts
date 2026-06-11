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
      contacts: {
        Row: {
          id: string;
          user_id: string;
          company_id: string;
          search_id: string | null;
          dedup_key: string;
          provider: string;
          provider_contact_id: string | null;
          first_name: string;
          last_name: string | null;
          full_name: string;
          title: string;
          email: string | null;
          linkedin_url: string | null;
          company_name: string | null;
          city: string | null;
          state: string | null;
          country: string | null;
          enriched_at: string | null;
          enrichment_provider: string | null;
          email_syntax_valid: boolean | null;
          email_domain_valid: boolean | null;
          email_verification_status: string | null;
          email_verification_provider: string | null;
          email_verification_message: string | null;
          email_verified_at: string | null;
          first_discovered_at: string;
          last_seen_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          company_id: string;
          search_id?: string | null;
          dedup_key: string;
          provider: string;
          provider_contact_id?: string | null;
          first_name: string;
          last_name?: string | null;
          full_name: string;
          title: string;
          email?: string | null;
          linkedin_url?: string | null;
          company_name?: string | null;
          city?: string | null;
          state?: string | null;
          country?: string | null;
          enriched_at?: string | null;
          enrichment_provider?: string | null;
          email_syntax_valid?: boolean | null;
          email_domain_valid?: boolean | null;
          email_verification_status?: string | null;
          email_verification_provider?: string | null;
          email_verification_message?: string | null;
          email_verified_at?: string | null;
          first_discovered_at?: string;
          last_seen_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          company_id?: string;
          search_id?: string | null;
          dedup_key?: string;
          provider?: string;
          provider_contact_id?: string | null;
          first_name?: string;
          last_name?: string | null;
          full_name?: string;
          title?: string;
          email?: string | null;
          linkedin_url?: string | null;
          company_name?: string | null;
          city?: string | null;
          state?: string | null;
          country?: string | null;
          enriched_at?: string | null;
          enrichment_provider?: string | null;
          email_syntax_valid?: boolean | null;
          email_domain_valid?: boolean | null;
          email_verification_status?: string | null;
          email_verification_provider?: string | null;
          email_verification_message?: string | null;
          email_verified_at?: string | null;
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
