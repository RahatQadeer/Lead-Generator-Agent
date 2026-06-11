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
          lead_score: number | null;
          lead_score_factors: Json | null;
          lead_scored_at: string | null;
          follow_ups_paused: boolean;
          follow_ups_paused_reason: string | null;
          follow_ups_paused_at: string | null;
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
          lead_score?: number | null;
          lead_score_factors?: Json | null;
          lead_scored_at?: string | null;
          follow_ups_paused?: boolean;
          follow_ups_paused_reason?: string | null;
          follow_ups_paused_at?: string | null;
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
          lead_score?: number | null;
          lead_score_factors?: Json | null;
          lead_scored_at?: string | null;
          follow_ups_paused?: boolean;
          follow_ups_paused_reason?: string | null;
          follow_ups_paused_at?: string | null;
          first_discovered_at?: string;
          last_seen_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      follow_ups: {
        Row: {
          id: string;
          user_id: string;
          contact_id: string;
          source_email_id: string;
          sequence_number: number;
          scheduled_at: string;
          status: string;
          cancel_reason: string | null;
          cancelled_at: string | null;
          suggested_subject: string | null;
          suggested_body: string | null;
          suggestion_provider: string | null;
          suggestion_model: string | null;
          suggested_at: string | null;
          draft_email_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          contact_id: string;
          source_email_id: string;
          sequence_number?: number;
          scheduled_at: string;
          status?: string;
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          suggested_subject?: string | null;
          suggested_body?: string | null;
          suggestion_provider?: string | null;
          suggestion_model?: string | null;
          suggested_at?: string | null;
          draft_email_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          contact_id?: string;
          source_email_id?: string;
          sequence_number?: number;
          scheduled_at?: string;
          status?: string;
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          suggested_subject?: string | null;
          suggested_body?: string | null;
          suggestion_provider?: string | null;
          suggestion_model?: string | null;
          suggested_at?: string | null;
          draft_email_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      outreach_emails: {
        Row: {
          id: string;
          user_id: string;
          contact_id: string;
          subject: string;
          body: string;
          provider: string;
          model: string | null;
          status: string;
          lead_company: string | null;
          industry: string | null;
          pain_points: string[];
          tone: string;
          sent_at: string | null;
          gmail_message_id: string | null;
          recipient_email: string | null;
          campaign_id: string | null;
          reply_status: string;
          replied_at: string | null;
          reply_snippet: string | null;
          provider_thread_id: string | null;
          reply_checked_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          contact_id: string;
          subject: string;
          body: string;
          provider: string;
          model?: string | null;
          status?: string;
          lead_company?: string | null;
          industry?: string | null;
          pain_points?: string[];
          tone?: string;
          sent_at?: string | null;
          gmail_message_id?: string | null;
          recipient_email?: string | null;
          campaign_id?: string | null;
          reply_status?: string;
          replied_at?: string | null;
          reply_snippet?: string | null;
          provider_thread_id?: string | null;
          reply_checked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          contact_id?: string;
          subject?: string;
          body?: string;
          provider?: string;
          model?: string | null;
          status?: string;
          lead_company?: string | null;
          industry?: string | null;
          pain_points?: string[];
          tone?: string;
          sent_at?: string | null;
          gmail_message_id?: string | null;
          recipient_email?: string | null;
          campaign_id?: string | null;
          reply_status?: string;
          replied_at?: string | null;
          reply_snippet?: string | null;
          provider_thread_id?: string | null;
          reply_checked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      outreach_campaigns: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          status: string;
          provider: string;
          total_count: number;
          sent_count: number;
          failed_count: number;
          started_at: string;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name?: string;
          status?: string;
          provider: string;
          total_count?: number;
          sent_count?: number;
          failed_count?: number;
          started_at?: string;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          status?: string;
          provider?: string;
          total_count?: number;
          sent_count?: number;
          failed_count?: number;
          started_at?: string;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      gmail_connections: {
        Row: {
          user_id: string;
          gmail_address: string;
          refresh_token: string;
          access_token: string | null;
          token_expires_at: string | null;
          connected_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          gmail_address: string;
          refresh_token: string;
          access_token?: string | null;
          token_expires_at?: string | null;
          connected_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          gmail_address?: string;
          refresh_token?: string;
          access_token?: string | null;
          token_expires_at?: string | null;
          connected_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      outlook_connections: {
        Row: {
          user_id: string;
          outlook_address: string;
          refresh_token: string;
          access_token: string | null;
          token_expires_at: string | null;
          connected_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          outlook_address: string;
          refresh_token: string;
          access_token?: string | null;
          token_expires_at?: string | null;
          connected_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          outlook_address?: string;
          refresh_token?: string;
          access_token?: string | null;
          token_expires_at?: string | null;
          connected_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      openai_settings: {
        Row: {
          user_id: string;
          generation_provider: string;
          model: string;
          api_key: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          generation_provider?: string;
          model?: string;
          api_key?: string | null;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          generation_provider?: string;
          model?: string;
          api_key?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      gmail_settings: {
        Row: {
          user_id: string;
          sending_provider: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          sending_provider?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          sending_provider?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      outlook_settings: {
        Row: {
          user_id: string;
          sending_provider: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          sending_provider?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          sending_provider?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      lead_scoring_settings: {
        Row: {
          user_id: string;
          industry_weight: number;
          company_size_weight: number;
          location_weight: number;
          job_role_weight: number;
          technology_weight: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          industry_weight?: number;
          company_size_weight?: number;
          location_weight?: number;
          job_role_weight?: number;
          technology_weight?: number;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          industry_weight?: number;
          company_size_weight?: number;
          location_weight?: number;
          job_role_weight?: number;
          technology_weight?: number;
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
