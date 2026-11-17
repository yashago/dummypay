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
          recipient_user_id: string
          recipient_wallet_id: string
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
          recipient_user_id: string
          recipient_wallet_id: string
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
          recipient_user_id?: string
          recipient_wallet_id?: string
          sender_user_id?: string | null
          sender_wallet_id?: string | null
          sending_amount_minor?: number | null
          sending_currency?: Database["public"]["Enums"]["currency_code"] | null
          status?: Database["public"]["Enums"]["txn_status"]
          type?: Database["public"]["Enums"]["txn_type"]
        }
        Relationships: [
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
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      amount_side: "send" | "receive"
      currency_code: "ILS" | "USD" | "EUR" | "GBP"
      txn_status: "completed"
      txn_type: "initial_grant" | "transfer"
    }
    CompositeTypes: {
      [_ in never]: never
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
