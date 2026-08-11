export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.15';
  };
  public: {
    Tables: {
      album_artists: {
        Row: {
          album_id: string;
          artist_id: string;
        };
        Insert: {
          album_id: string;
          artist_id: string;
        };
        Update: {
          album_id?: string;
          artist_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'album_artists_album_id_fkey';
            columns: ['album_id'];
            isOneToOne: false;
            referencedRelation: 'albums';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'album_artists_artist_id_fkey';
            columns: ['artist_id'];
            isOneToOne: false;
            referencedRelation: 'artists';
            referencedColumns: ['id'];
          },
        ];
      };
      albums: {
        Row: {
          cover_url: string | null;
          created_at: string;
          id: string;
          release_year: number | null;
          title: string;
          type: Database['public']['Enums']['AlbumType'];
          updated_at: string;
        };
        Insert: {
          cover_url?: string | null;
          created_at?: string;
          id?: string;
          release_year?: number | null;
          title: string;
          type?: Database['public']['Enums']['AlbumType'];
          updated_at?: string;
        };
        Update: {
          cover_url?: string | null;
          created_at?: string;
          id?: string;
          release_year?: number | null;
          title?: string;
          type?: Database['public']['Enums']['AlbumType'];
          updated_at?: string;
        };
        Relationships: [];
      };
      artists: {
        Row: {
          bio: string | null;
          country: string | null;
          created_at: string;
          id: string;
          image_path: string | null;
          image_url: string | null;
          name: string;
          updated_at: string;
        };
        Insert: {
          bio?: string | null;
          country?: string | null;
          created_at?: string;
          id?: string;
          image_path?: string | null;
          image_url?: string | null;
          name: string;
          updated_at?: string;
        };
        Update: {
          bio?: string | null;
          country?: string | null;
          created_at?: string;
          id?: string;
          image_path?: string | null;
          image_url?: string | null;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      likes: {
        Row: {
          created_at: string;
          id: string;
          song_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          song_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          song_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'likes_song_id_fkey';
            columns: ['song_id'];
            isOneToOne: false;
            referencedRelation: 'songs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'likes_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      movies: {
        Row: {
          created_at: string;
          id: string;
          poster_url: string | null;
          release_year: number | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          poster_url?: string | null;
          release_year?: number | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          poster_url?: string | null;
          release_year?: number | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      playlist_songs: {
        Row: {
          added_at: string;
          id: string;
          playlist_id: string;
          position: number | null;
          song_id: string;
        };
        Insert: {
          added_at?: string;
          id?: string;
          playlist_id: string;
          position?: number | null;
          song_id: string;
        };
        Update: {
          added_at?: string;
          id?: string;
          playlist_id?: string;
          position?: number | null;
          song_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'playlist_songs_playlist_id_fkey';
            columns: ['playlist_id'];
            isOneToOne: false;
            referencedRelation: 'playlists';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'playlist_songs_song_id_fkey';
            columns: ['song_id'];
            isOneToOne: false;
            referencedRelation: 'songs';
            referencedColumns: ['id'];
          },
        ];
      };
      playlists: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'playlists_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      song_credits: {
        Row: {
          artist_id: string;
          role: Database['public']['Enums']['CreditRole'];
          song_id: string;
        };
        Insert: {
          artist_id: string;
          role: Database['public']['Enums']['CreditRole'];
          song_id: string;
        };
        Update: {
          artist_id?: string;
          role?: Database['public']['Enums']['CreditRole'];
          song_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'song_credits_artist_id_fkey';
            columns: ['artist_id'];
            isOneToOne: false;
            referencedRelation: 'artists';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'song_credits_song_id_fkey';
            columns: ['song_id'];
            isOneToOne: false;
            referencedRelation: 'songs';
            referencedColumns: ['id'];
          },
        ];
      };
      songs: {
        Row: {
          album: string | null;
          album_id: string | null;
          artist: string[];
          audio_path: string;
          composers: string[];
          cover_path: string | null;
          created_at: string;
          duration: number;
          genre: string | null;
          id: string;
          lyrics: string | null;
          movie: string | null;
          movie_id: string | null;
          title: string;
          updated_at: string;
          uploaded_by_user_id: string;
        };
        Insert: {
          album?: string | null;
          album_id?: string | null;
          artist?: string[];
          audio_path: string;
          composers?: string[];
          cover_path?: string | null;
          created_at?: string;
          duration: number;
          genre?: string | null;
          id?: string;
          lyrics?: string | null;
          movie?: string | null;
          movie_id?: string | null;
          title: string;
          updated_at?: string;
          uploaded_by_user_id: string;
        };
        Update: {
          album?: string | null;
          album_id?: string | null;
          artist?: string[];
          audio_path?: string;
          composers?: string[];
          cover_path?: string | null;
          created_at?: string;
          duration?: number;
          genre?: string | null;
          id?: string;
          lyrics?: string | null;
          movie?: string | null;
          movie_id?: string | null;
          title?: string;
          updated_at?: string;
          uploaded_by_user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'songs_album_id_fkey';
            columns: ['album_id'];
            isOneToOne: false;
            referencedRelation: 'albums';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'songs_movie_id_fkey';
            columns: ['movie_id'];
            isOneToOne: false;
            referencedRelation: 'movies';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'songs_uploaded_by_user_id_fkey';
            columns: ['uploaded_by_user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      upload_job_items: {
        Row: {
          asset_prefix: string;
          audio_path: string | null;
          chunk_size: number;
          completed_at: string | null;
          cover_path: string | null;
          created_at: string;
          error_code: string | null;
          id: string;
          job_id: string;
          original_name: string;
          signed_at: string | null;
          song_id: string | null;
          status: Database['public']['Enums']['UploadItemStatus'];
          total_bytes: number;
          updated_at: string;
          upload_session_id: string | null;
          uploaded_bytes: number;
        };
        Insert: {
          asset_prefix: string;
          audio_path?: string | null;
          chunk_size: number;
          completed_at?: string | null;
          cover_path?: string | null;
          created_at?: string;
          error_code?: string | null;
          id?: string;
          job_id: string;
          original_name: string;
          signed_at?: string | null;
          song_id?: string | null;
          status?: Database['public']['Enums']['UploadItemStatus'];
          total_bytes: number;
          updated_at?: string;
          upload_session_id?: string | null;
          uploaded_bytes?: number;
        };
        Update: {
          asset_prefix?: string;
          audio_path?: string | null;
          chunk_size?: number;
          completed_at?: string | null;
          cover_path?: string | null;
          created_at?: string;
          error_code?: string | null;
          id?: string;
          job_id?: string;
          original_name?: string;
          signed_at?: string | null;
          song_id?: string | null;
          status?: Database['public']['Enums']['UploadItemStatus'];
          total_bytes?: number;
          updated_at?: string;
          upload_session_id?: string | null;
          uploaded_bytes?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'upload_job_items_job_id_fkey';
            columns: ['job_id'];
            isOneToOne: false;
            referencedRelation: 'upload_jobs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'upload_job_items_song_id_fkey';
            columns: ['song_id'];
            isOneToOne: false;
            referencedRelation: 'songs';
            referencedColumns: ['id'];
          },
        ];
      };
      upload_jobs: {
        Row: {
          created_at: string;
          expires_at: string;
          id: string;
          status: Database['public']['Enums']['UploadJobStatus'];
          total_items: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          expires_at: string;
          id?: string;
          status?: Database['public']['Enums']['UploadJobStatus'];
          total_items: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          id?: string;
          status?: Database['public']['Enums']['UploadJobStatus'];
          total_items?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'upload_jobs_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      users: {
        Row: {
          created_at: string;
          email: string;
          firstName: string | null;
          id: string;
          lastName: string | null;
          profile_image_url: string | null;
          role: Database['public']['Enums']['UserRole'];
          signup_method: Database['public']['Enums']['SignupMethod'];
          status: Database['public']['Enums']['UserStatus'];
          supabase_user_id: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          firstName?: string | null;
          id?: string;
          lastName?: string | null;
          profile_image_url?: string | null;
          role?: Database['public']['Enums']['UserRole'];
          signup_method?: Database['public']['Enums']['SignupMethod'];
          status?: Database['public']['Enums']['UserStatus'];
          supabase_user_id?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          firstName?: string | null;
          id?: string;
          lastName?: string | null;
          profile_image_url?: string | null;
          role?: Database['public']['Enums']['UserRole'];
          signup_method?: Database['public']['Enums']['SignupMethod'];
          status?: Database['public']['Enums']['UserStatus'];
          supabase_user_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      webhook_events: {
        Row: {
          event_type: string;
          received_at: string;
          svix_id: string;
        };
        Insert: {
          event_type: string;
          received_at?: string;
          svix_id: string;
        };
        Update: {
          event_type?: string;
          received_at?: string;
          svix_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      album_song_counts: {
        Args: never;
        Returns: {
          album_name: string;
          cover_path: string;
          song_count: number;
        }[];
      };
      artist_song_counts: {
        Args: never;
        Returns: {
          artist_name: string;
          song_count: number;
        }[];
      };
      current_app_user_id: { Args: never; Returns: string };
      is_admin: { Args: never; Returns: boolean };
      song_like_counts: {
        Args: { p_song_ids: string[] };
        Returns: {
          like_count: number;
          song_id: string;
        }[];
      };
    };
    Enums: {
      AlbumType: 'ALBUM' | 'SINGLE' | 'EP' | 'COMPILATION' | 'SOUNDTRACK';
      CreditRole:
        'PRIMARY_ARTIST' | 'FEATURED_ARTIST' | 'PRODUCER' | 'COMPOSER' | 'LYRICIST' | 'ARRANGER';
      SignupMethod: 'EMAIL' | 'GOOGLE';
      UploadItemStatus: 'PENDING' | 'SIGNED' | 'UPLOADED' | 'COMPLETED' | 'FAILED';
      UploadJobStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';
      UserRole: 'USER' | 'ADMIN';
      UserStatus: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      AlbumType: ['ALBUM', 'SINGLE', 'EP', 'COMPILATION', 'SOUNDTRACK'],
      CreditRole: [
        'PRIMARY_ARTIST',
        'FEATURED_ARTIST',
        'PRODUCER',
        'COMPOSER',
        'LYRICIST',
        'ARRANGER',
      ],
      SignupMethod: ['EMAIL', 'GOOGLE'],
      UploadItemStatus: ['PENDING', 'SIGNED', 'UPLOADED', 'COMPLETED', 'FAILED'],
      UploadJobStatus: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED'],
      UserRole: ['USER', 'ADMIN'],
      UserStatus: ['ACTIVE', 'INACTIVE', 'SUSPENDED'],
    },
  },
} as const;
