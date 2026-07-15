export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      comments: {
        Row: {
          body: string
          created_at: string
          id: string
          user_id: string
          walk_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          user_id: string
          walk_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          user_id?: string
          walk_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_walk_id_fkey"
            columns: ["walk_id"]
            isOneToOne: false
            referencedRelation: "trending_walks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_walk_id_fkey"
            columns: ["walk_id"]
            isOneToOne: false
            referencedRelation: "walks"
            referencedColumns: ["id"]
          },
        ]
      }
      curated_waypoints: {
        Row: {
          created_at: string
          id: string
          lat: number
          lng: number
          location: unknown
          media_credit: string | null
          media_id: string | null
          media_license: string | null
          media_source_url: string | null
          route_id: string
          sort_index: number
          story: string
          time_period: string
          title: string
          title_ja: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          lat: number
          lng: number
          location?: unknown
          media_credit?: string | null
          media_id?: string | null
          media_license?: string | null
          media_source_url?: string | null
          route_id: string
          sort_index: number
          story: string
          time_period: string
          title: string
          title_ja?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          lat?: number
          lng?: number
          location?: unknown
          media_credit?: string | null
          media_id?: string | null
          media_license?: string | null
          media_source_url?: string | null
          route_id?: string
          sort_index?: number
          story?: string
          time_period?: string
          title?: string
          title_ja?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "curated_waypoints_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "walk_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curated_waypoints_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "trending_walks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curated_waypoints_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "walks"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          followee_id: string
          follower_id: string
        }
        Insert: {
          created_at?: string
          followee_id: string
          follower_id: string
        }
        Update: {
          created_at?: string
          followee_id?: string
          follower_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_followee_id_fkey"
            columns: ["followee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      likes: {
        Row: {
          created_at: string
          user_id: string
          walk_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
          walk_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
          walk_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_walk_id_fkey"
            columns: ["walk_id"]
            isOneToOne: false
            referencedRelation: "trending_walks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_walk_id_fkey"
            columns: ["walk_id"]
            isOneToOne: false
            referencedRelation: "walks"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          username?: string
        }
        Relationships: []
      }
      walk_media: {
        Row: {
          alt_text: string | null
          bucket: string
          created_at: string
          id: string
          mime_type: string | null
          orientation: number | null
          original_filename: string | null
          stop_id: string
          storage_path: string
        }
        Insert: {
          alt_text?: string | null
          bucket?: string
          created_at?: string
          id?: string
          mime_type?: string | null
          orientation?: number | null
          original_filename?: string | null
          stop_id: string
          storage_path: string
        }
        Update: {
          alt_text?: string | null
          bucket?: string
          created_at?: string
          id?: string
          mime_type?: string | null
          orientation?: number | null
          original_filename?: string | null
          stop_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "walk_media_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: true
            referencedRelation: "walk_stops"
            referencedColumns: ["id"]
          },
        ]
      }
      walk_stops: {
        Row: {
          captured_at: string | null
          created_at: string
          id: string
          kind: string
          lat: number | null
          lng: number | null
          note: string | null
          sort_index: number
          walk_id: string
        }
        Insert: {
          captured_at?: string | null
          created_at?: string
          id?: string
          kind: string
          lat?: number | null
          lng?: number | null
          note?: string | null
          sort_index: number
          walk_id: string
        }
        Update: {
          captured_at?: string | null
          created_at?: string
          id?: string
          kind?: string
          lat?: number | null
          lng?: number | null
          note?: string | null
          sort_index?: number
          walk_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "walk_stops_walk_id_fkey"
            columns: ["walk_id"]
            isOneToOne: false
            referencedRelation: "trending_walks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "walk_stops_walk_id_fkey"
            columns: ["walk_id"]
            isOneToOne: false
            referencedRelation: "walks"
            referencedColumns: ["id"]
          },
        ]
      }
      walks: {
        Row: {
          created_at: string
          description: string | null
          distance_m: number
          duration_s: number | null
          id: string
          is_curated: boolean
          owner_id: string
          path: Json | null
          region: string | null
          title: string
          visibility: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          distance_m?: number
          duration_s?: number | null
          id?: string
          is_curated?: boolean
          owner_id: string
          path?: Json | null
          region?: string | null
          title: string
          visibility?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          distance_m?: number
          duration_s?: number | null
          id?: string
          is_curated?: boolean
          owner_id?: string
          path?: Json | null
          region?: string | null
          title?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "walks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      trending_walks: {
        Row: {
          created_at: string | null
          description: string | null
          distance_m: number | null
          duration_s: number | null
          id: string | null
          is_curated: boolean | null
          owner_id: string | null
          path: Json | null
          recent_likes: number | null
          region: string | null
          title: string | null
          visibility: string | null
        }
        Relationships: [
          {
            foreignKeyName: "walks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_view_walk: { Args: { w_id: string }; Returns: boolean }
      is_lnglat_array: { Args: { coords: Json }; Returns: boolean }
      match_curated_waypoints: {
        Args: { p_walk_id: string }
        Returns: {
          distance_m: number
          lat: number
          lng: number
          matched_stop_id: string
          media_alt: string
          media_bucket: string
          media_credit: string
          media_id: string
          media_license: string
          media_mime_type: string
          media_path: string
          media_source_url: string
          route_id: string
          route_title: string
          sort_index: number
          story: string
          time_period: string
          title: string
          title_ja: string
          waypoint_id: string
        }[]
      }
      owns_editable_walk: { Args: { w_id: string }; Returns: boolean }
      save_walk_draft: {
        Args: {
          p_description: string
          p_distance_m: number
          p_path: Json
          p_region: string
          p_stops: Json
          p_title: string
          p_visibility: string
          p_walk_id: string
        }
        Returns: string
      }
      walk_is_public: { Args: { w_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
