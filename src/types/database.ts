export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      fx_rate_history: {
        Row: {
          currency: Database["public"]["Enums"]["currency_code"]
          fetched_at: string
          id: number
          provider: string
          provider_updated_at: string
          units_per_usd: number
        }
        Insert: {
          currency: Database["public"]["Enums"]["currency_code"]
          fetched_at?: string
          id?: never
          provider: string
          provider_updated_at: string
          units_per_usd: number
        }
        Update: {
          currency?: Database["public"]["Enums"]["currency_code"]
          fetched_at?: string
          id?: never
          provider?: string
          provider_updated_at?: string
          units_per_usd?: number
        }
        Relationships: []
      }
      fx_rates: {
        Row: {
          currency: Database["public"]["Enums"]["currency_code"]
          fetched_at: string
          provider: string
          provider_updated_at: string
          units_per_usd: number
        }
        Insert: {
          currency: Database["public"]["Enums"]["currency_code"]
          fetched_at?: string
          provider: string
          provider_updated_at: string
          units_per_usd: number
        }
        Update: {
          currency?: Database["public"]["Enums"]["currency_code"]
          fetched_at?: string
          provider?: string
          provider_updated_at?: string
          units_per_usd?: number
        }
        Relationships: [
          {
            foreignKeyName: "fx_rates_currency_fkey"
            columns: ["currency"]
            isOneToOne: true
            referencedRelation: "supported_currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      fx_status: {
        Row: {
          id: boolean
          last_attempt_at: string | null
          last_error: string | null
          last_success_at: string | null
        }
        Insert: {
          id?: boolean
          last_attempt_at?: string | null
          last_error?: string | null
          last_success_at?: string | null
        }
        Update: {
          id?: boolean
          last_attempt_at?: string | null
          last_error?: string | null
          last_success_at?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          amount_minor: number
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          id: string
          is_read: boolean
          kind: string
          message: string
          read_at: string | null
          sender_display_name: string
          sender_email: string
          title: string
          transaction_id: string
          user_id: string
        }
        Insert: {
          amount_minor: number
          created_at?: string
          currency: Database["public"]["Enums"]["currency_code"]
          id?: string
          is_read?: boolean
          kind?: string
          message: string
          read_at?: string | null
          sender_display_name: string
          sender_email: string
          title: string
          transaction_id: string
          user_id: string
        }
        Update: {
          amount_minor?: number
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          id?: string
          is_read?: boolean
          kind?: string
          message?: string
          read_at?: string | null
          sender_display_name?: string
          sender_email?: string
          title?: string
          transaction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          email: string
          id: string
          preferred_currency: Database["public"]["Enums"]["currency_code"]
        }
        Insert: {
          created_at?: string
          display_name: string
          email: string
          id: string
          preferred_currency: Database["public"]["Enums"]["currency_code"]
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          preferred_currency?: Database["public"]["Enums"]["currency_code"]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_preferred_currency_fkey"
            columns: ["preferred_currency"]
            isOneToOne: false
            referencedRelation: "supported_currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      rate_limits: {
        Row: {
          action: string
          hits: number
          user_id: string
          window_start: string
        }
        Insert: {
          action: string
          hits?: number
          user_id: string
          window_start: string
        }
        Update: {
          action?: string
          hits?: number
          user_id?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_limits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      supported_currencies: {
        Row: {
          code: Database["public"]["Enums"]["currency_code"]
          initial_grant_minor: number
          minor_units: number
          name: string
          symbol: string
        }
        Insert: {
          code: Database["public"]["Enums"]["currency_code"]
          initial_grant_minor: number
          minor_units?: number
          name: string
          symbol: string
        }
        Update: {
          code?: Database["public"]["Enums"]["currency_code"]
          initial_grant_minor?: number
          minor_units?: number
          name?: string
          symbol?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount_input_side: Database["public"]["Enums"]["amount_side"] | null
          created_at: string
          exchange_rate: number | null
          id: string
          idempotency_key: string | null
          quote_id: string | null
          rate_provider: string | null
          rate_provider_updated_at: string | null
          receiving_amount_minor: number
          receiving_currency: Database["public"]["Enums"]["currency_code"]
          recipient_display_name: string
          recipient_email: string
          recipient_user_id: string
          recipient_wallet_id: string
          sender_display_name: string | null
          sender_email: string | null
          sender_user_id: string | null
          sender_wallet_id: string | null
          sending_amount_minor: number | null
          sending_currency: Database["public"]["Enums"]["currency_code"] | null
          status: Database["public"]["Enums"]["txn_status"]
          type: Database["public"]["Enums"]["txn_type"]
        }
        Insert: {
          amount_input_side?: Database["public"]["Enums"]["amount_side"] | null
          created_at?: string
          exchange_rate?: number | null
          id?: string
          idempotency_key?: string | null
          quote_id?: string | null
          rate_provider?: string | null
          rate_provider_updated_at?: string | null
          receiving_amount_minor: number
          receiving_currency: Database["public"]["Enums"]["currency_code"]
          recipient_display_name: string
          recipient_email: string
          recipient_user_id: string
          recipient_wallet_id: string
          sender_display_name?: string | null
          sender_email?: string | null
          sender_user_id?: string | null
          sender_wallet_id?: string | null
          sending_amount_minor?: number | null
          sending_currency?: Database["public"]["Enums"]["currency_code"] | null
          status?: Database["public"]["Enums"]["txn_status"]
          type: Database["public"]["Enums"]["txn_type"]
        }
        Update: {
          amount_input_side?: Database["public"]["Enums"]["amount_side"] | null
          created_at?: string
          exchange_rate?: number | null
          id?: string
          idempotency_key?: string | null
          quote_id?: string | null
          rate_provider?: string | null
          rate_provider_updated_at?: string | null
          receiving_amount_minor?: number
          receiving_currency?: Database["public"]["Enums"]["currency_code"]
          recipient_display_name?: string
          recipient_email?: string
          recipient_user_id?: string
          recipient_wallet_id?: string
          sender_display_name?: string | null
          sender_email?: string | null
          sender_user_id?: string | null
          sender_wallet_id?: string | null
          sending_amount_minor?: number | null
          sending_currency?: Database["public"]["Enums"]["currency_code"] | null
          status?: Database["public"]["Enums"]["txn_status"]
          type?: Database["public"]["Enums"]["txn_type"]
        }
        Relationships: [
          {
            foreignKeyName: "transactions_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: true
            referencedRelation: "transfer_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_recipient_wallet_id_fkey"
            columns: ["recipient_wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_sender_wallet_id_fkey"
            columns: ["sender_wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_quotes: {
        Row: {
          amount_input_side: Database["public"]["Enums"]["amount_side"]
          consumed_at: string | null
          created_at: string
          exchange_rate: number
          expires_at: string
          id: string
          rate_provider: string
          rate_provider_updated_at: string
          receiving_amount_minor: number
          receiving_currency: Database["public"]["Enums"]["currency_code"]
          recipient_user_id: string
          sender_user_id: string
          sending_amount_minor: number
          sending_currency: Database["public"]["Enums"]["currency_code"]
        }
        Insert: {
          amount_input_side: Database["public"]["Enums"]["amount_side"]
          consumed_at?: string | null
          created_at?: string
          exchange_rate: number
          expires_at: string
          id?: string
          rate_provider: string
          rate_provider_updated_at: string
          receiving_amount_minor: number
          receiving_currency: Database["public"]["Enums"]["currency_code"]
          recipient_user_id: string
          sender_user_id: string
          sending_amount_minor: number
          sending_currency: Database["public"]["Enums"]["currency_code"]
        }
        Update: {
          amount_input_side?: Database["public"]["Enums"]["amount_side"]
          consumed_at?: string | null
          created_at?: string
          exchange_rate?: number
          expires_at?: string
          id?: string
          rate_provider?: string
          rate_provider_updated_at?: string
          receiving_amount_minor?: number
          receiving_currency?: Database["public"]["Enums"]["currency_code"]
          recipient_user_id?: string
          sender_user_id?: string
          sending_amount_minor?: number
          sending_currency?: Database["public"]["Enums"]["currency_code"]
        }
        Relationships: [
          {
            foreignKeyName: "transfer_quotes_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_quotes_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance_minor: number
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_minor?: number
          created_at?: string
          currency: Database["public"]["Enums"]["currency_code"]
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_minor?: number
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "supported_currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      fx_cross_rates: {
        Row: {
          fetched_at: string | null
          from_currency: Database["public"]["Enums"]["currency_code"] | null
          provider: string | null
          provider_updated_at: string | null
          rate: number | null
          to_currency: Database["public"]["Enums"]["currency_code"] | null
        }
        Relationships: [
          {
            foreignKeyName: "fx_rates_currency_fkey"
            columns: ["from_currency"]
            isOneToOne: true
            referencedRelation: "supported_currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "fx_rates_currency_fkey"
            columns: ["to_currency"]
            isOneToOne: true
            referencedRelation: "supported_currencies"
            referencedColumns: ["code"]
          },
        ]
      }
    }
    Functions: {
      add_wallet: {
        Args: { p_currency: Database["public"]["Enums"]["currency_code"] }
        Returns: {
          balance_minor: number
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          id: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "wallets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_fx_refresh: { Args: { p_min_interval: string }; Returns: boolean }
      convert_minor: {
        Args: {
          p_amount: number
          p_rate: number
          p_side: Database["public"]["Enums"]["amount_side"]
        }
        Returns: number
      }
      create_transfer_quote: {
        Args: {
          p_amount_minor: number
          p_input_side: Database["public"]["Enums"]["amount_side"]
          p_recipient_id: string
          p_sending_currency: Database["public"]["Enums"]["currency_code"]
        }
        Returns: Database["public"]["CompositeTypes"]["transfer_quote_view"]
        SetofOptions: {
          from: "*"
          to: "transfer_quote_view"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      execute_transfer: {
        Args: { p_idempotency_key: string; p_quote_id: string }
        Returns: {
          amount_input_side: Database["public"]["Enums"]["amount_side"] | null
          created_at: string
          exchange_rate: number | null
          id: string
          idempotency_key: string | null
          quote_id: string | null
          rate_provider: string | null
          rate_provider_updated_at: string | null
          receiving_amount_minor: number
          receiving_currency: Database["public"]["Enums"]["currency_code"]
          recipient_display_name: string
          recipient_email: string
          recipient_user_id: string
          recipient_wallet_id: string
          sender_display_name: string | null
          sender_email: string | null
          sender_user_id: string | null
          sender_wallet_id: string | null
          sending_amount_minor: number | null
          sending_currency: Database["public"]["Enums"]["currency_code"] | null
          status: Database["public"]["Enums"]["txn_status"]
          type: Database["public"]["Enums"]["txn_type"]
        }
        SetofOptions: {
          from: "*"
          to: "transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      format_money: {
        Args: {
          p_currency: Database["public"]["Enums"]["currency_code"]
          p_minor: number
        }
        Returns: string
      }
      fx_max_age: { Args: never; Returns: string }
      fx_rate: {
        Args: {
          p_from: Database["public"]["Enums"]["currency_code"]
          p_to: Database["public"]["Enums"]["currency_code"]
        }
        Returns: {
          provider: string
          provider_updated_at: string
          rate: number
        }[]
      }
      get_wallet_summary: {
        Args: never
        Returns: {
          preferred_currency: Database["public"]["Enums"]["currency_code"]
          rates_as_of: string
          rates_stale: boolean
          total_minor: number
          wallet_count: number
        }[]
      }
      hit_rate_limit: {
        Args: {
          p_action: string
          p_limit: number
          p_user: string
          p_window: string
        }
        Returns: undefined
      }
      ingest_fx_rates: {
        Args: {
          p_provider: string
          p_provider_updated_at: string
          p_rates: Json
        }
        Returns: undefined
      }
      list_my_transactions: {
        Args: {
          p_currency?: Database["public"]["Enums"]["currency_code"]
          p_direction?: string
          p_from?: string
          p_limit?: number
          p_offset?: number
          p_to?: string
        }
        Returns: {
          amount_input_side: Database["public"]["Enums"]["amount_side"]
          created_at: string
          direction: string
          exchange_rate: number
          id: string
          rate_provider_updated_at: string
          receiving_amount_minor: number
          receiving_currency: Database["public"]["Enums"]["currency_code"]
          recipient_display_name: string
          recipient_email: string
          recipient_user_id: string
          sender_display_name: string
          sender_email: string
          sender_user_id: string
          sending_amount_minor: number
          sending_currency: Database["public"]["Enums"]["currency_code"]
          status: Database["public"]["Enums"]["txn_status"]
          total_count: number
          type: Database["public"]["Enums"]["txn_type"]
        }[]
      }
      lookup_recipient: {
        Args: { p_email: string }
        Returns: {
          display_name: string
          email: string
          preferred_currency: Database["public"]["Enums"]["currency_code"]
          status: string
          user_id: string
        }[]
      }
      mark_notifications_read: { Args: { p_ids?: string[] }; Returns: number }
      preview_conversion: {
        Args: {
          p_amount_minor: number
          p_from: Database["public"]["Enums"]["currency_code"]
          p_side?: Database["public"]["Enums"]["amount_side"]
          p_to: Database["public"]["Enums"]["currency_code"]
        }
        Returns: {
          rate: number
          rate_provider_updated_at: string
          receiving_amount_minor: number
          receiving_currency: Database["public"]["Enums"]["currency_code"]
          sending_amount_minor: number
          sending_currency: Database["public"]["Enums"]["currency_code"]
        }[]
      }
      record_fx_failure: { Args: { p_error: string }; Returns: undefined }
      require_user: { Args: never; Returns: string }
      set_preferred_currency: {
        Args: { p_currency: Database["public"]["Enums"]["currency_code"] }
        Returns: {
          created_at: string
          display_name: string
          email: string
          id: string
          preferred_currency: Database["public"]["Enums"]["currency_code"]
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      amount_side: "send" | "receive"
      currency_code: "ILS" | "USD" | "EUR" | "GBP"
      txn_status: "completed"
      txn_type: "initial_grant" | "transfer"
    }
    CompositeTypes: {
      transfer_quote_view: {
        quote_id: string | null
        recipient_user_id: string | null
        recipient_display_name: string | null
        recipient_email: string | null
        sending_currency: Database["public"]["Enums"]["currency_code"] | null
        receiving_currency: Database["public"]["Enums"]["currency_code"] | null
        sending_amount_minor: number | null
        receiving_amount_minor: number | null
        amount_input_side: Database["public"]["Enums"]["amount_side"] | null
        exchange_rate: number | null
        rate_provider_updated_at: string | null
        expires_at: string | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      amount_side: ["send", "receive"],
      currency_code: ["ILS", "USD", "EUR", "GBP"],
      txn_status: ["completed"],
      txn_type: ["initial_grant", "transfer"],
    },
  },
} as const
