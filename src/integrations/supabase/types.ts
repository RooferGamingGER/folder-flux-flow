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
          created_by: string | null
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
          created_by?: string | null
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
          created_by?: string | null
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
      organizations: {
        Row: {
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          first_name: string
          id: string
          last_name: string
          organization_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          first_name: string
          id: string
          last_name: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          organization_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          created_by: string | null
          deleted_at: string | null
          id: string
          name: string
          order_index: number | null
          project_id: string
          sync_status: Database["public"]["Enums"]["sync_status"] | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name: string
          order_index?: number | null
          project_id: string
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
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
          created_by: string | null
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
          created_by?: string | null
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
          created_by?: string | null
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
      project_members: {
        Row: {
          added_at: string | null
          added_by: string | null
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          added_at?: string | null
          added_by?: string | null
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          added_at?: string | null
          added_by?: string | null
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
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
      user_roles: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          organization_id: string | null
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          organization_id?: string | null
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          organization_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_project: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      can_delete_directory: {
        Args: { _directory_id: string; _user_id: string }
        Returns: boolean
      }
      can_delete_file: {
        Args: { _file_id: string; _user_id: string }
        Returns: boolean
      }
      can_delete_message: {
        Args: { _message_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_project_members: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_projects: { Args: { _user_id: string }; Returns: boolean }
      has_full_access: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_office_staff: { Args: { _user_id: string }; Returns: boolean }
      is_team_leader: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      sync_status: "synced" | "pending" | "error"
      user_role:
        | "geschaeftsfuehrer"
        | "buerokraft"
        | "team_projektleiter"
        | "vorarbeiter"
        | "mitarbeiter"
        | "azubi"
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
      user_role: [
        "geschaeftsfuehrer",
        "buerokraft",
        "team_projektleiter",
        "vorarbeiter",
        "mitarbeiter",
        "azubi",
      ],
    },
  },
} as const
