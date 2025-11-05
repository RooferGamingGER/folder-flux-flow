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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      contacts: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          email: string | null
          id: string
          name: string | null
          phone: string | null
          project_id: string
          sync_status: Database["public"]["Enums"]["sync_status"] | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          project_id: string
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          project_id?: string
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          archived: boolean | null
          created_at: string | null
          deleted_at: string | null
          id: string
          name: string
          sync_status: Database["public"]["Enums"]["sync_status"] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          archived?: boolean | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          name: string
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          archived?: boolean | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          name?: string
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: Json | null
          deleted_at: string | null
          id: string
          project_id: string
          sender: string
          sync_status: Database["public"]["Enums"]["sync_status"] | null
          timestamp: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          content?: Json | null
          deleted_at?: string | null
          id?: string
          project_id: string
          sender: string
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          timestamp?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          content?: Json | null
          deleted_at?: string | null
          id?: string
          project_id?: string
          sender?: string
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          timestamp?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          id: string
          project_id: string
          sync_status: Database["public"]["Enums"]["sync_status"] | null
          text: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          project_id: string
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          text?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          project_id?: string
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          first_name: string
          id: string
          last_name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          first_name: string
          id: string
          last_name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      project_details: {
        Row: {
          ansprechpartner: string | null
          auftragsnummer: string | null
          enddatum: string | null
          id: string
          land: string | null
          notiz: string | null
          plz: string | null
          project_id: string
          projektname: string | null
          projektstatus: string | null
          stadt: string | null
          startdatum: string | null
          strasse: string | null
          sync_status: Database["public"]["Enums"]["sync_status"] | null
          updated_at: string | null
        }
        Insert: {
          ansprechpartner?: string | null
          auftragsnummer?: string | null
          enddatum?: string | null
          id?: string
          land?: string | null
          notiz?: string | null
          plz?: string | null
          project_id: string
          projektname?: string | null
          projektstatus?: string | null
          stadt?: string | null
          startdatum?: string | null
          strasse?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
        }
        Update: {
          ansprechpartner?: string | null
          auftragsnummer?: string | null
          enddatum?: string | null
          id?: string
          land?: string | null
          notiz?: string | null
          plz?: string | null
          project_id?: string
          projektname?: string | null
          projektstatus?: string | null
          stadt?: string | null
          startdatum?: string | null
          strasse?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_details_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_directories: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          id: string
          name: string
          order_index: number | null
          project_id: string
          sync_status: Database["public"]["Enums"]["sync_status"] | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          name: string
          order_index?: number | null
          project_id: string
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          name?: string
          order_index?: number | null
          project_id?: string
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "project_directories_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_files: {
        Row: {
          deleted_at: string | null
          ext: string | null
          folder: string | null
          id: string
          is_image: boolean | null
          local_blob_url: string | null
          mime: string | null
          modified: string | null
          name: string
          project_id: string
          size: string | null
          storage_path: string | null
          sync_status: Database["public"]["Enums"]["sync_status"] | null
          taken_at: string | null
        }
        Insert: {
          deleted_at?: string | null
          ext?: string | null
          folder?: string | null
          id?: string
          is_image?: boolean | null
          local_blob_url?: string | null
          mime?: string | null
          modified?: string | null
          name: string
          project_id: string
          size?: string | null
          storage_path?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          taken_at?: string | null
        }
        Update: {
          deleted_at?: string | null
          ext?: string | null
          folder?: string | null
          id?: string
          is_image?: boolean | null
          local_blob_url?: string | null
          mime?: string | null
          modified?: string | null
          name?: string
          project_id?: string
          size?: string | null
          storage_path?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          taken_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          archived: boolean | null
          created_at: string | null
          deleted_at: string | null
          folder_id: string | null
          id: string
          sync_status: Database["public"]["Enums"]["sync_status"] | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          archived?: boolean | null
          created_at?: string | null
          deleted_at?: string | null
          folder_id?: string | null
          id?: string
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          archived?: boolean | null
          created_at?: string | null
          deleted_at?: string | null
          folder_id?: string | null
          id?: string
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_queue: {
        Row: {
          created_at: string | null
          data: Json | null
          error_message: string | null
          id: string
          operation: string
          record_id: string
          retry_count: number | null
          table_name: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          error_message?: string | null
          id?: string
          operation: string
          record_id: string
          retry_count?: number | null
          table_name: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          error_message?: string | null
          id?: string
          operation?: string
          record_id?: string
          retry_count?: number | null
          table_name?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      sync_status: "synced" | "pending" | "error"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      sync_status: ["synced", "pending", "error"],
    },
  },
} as const
