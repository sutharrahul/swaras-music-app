/**
 * Database types for supabase-js.
 *
 * HAND-WRITTEN, and only because it has to be: generating this needs either a
 * reachable database or a linked project (`supabase login` + `supabase link`),
 * and this repo has neither. It is a faithful transcription of
 * supabase/migrations/*.sql — if you change a migration, change this file in the
 * same commit, or regenerate it once the project is linked:
 *
 *     npm run db:types
 *
 * Shape notes, all of which follow the SQL rather than taste:
 *   - `id` columns are `text` holding a uuid (carried over from Prisma), so they
 *     type as `string` — same as a real uuid column would.
 *   - timestamps are `timestamp(3)`; PostgREST serialises them as strings.
 *   - `users."firstName"` / `users."lastName"` really are camelCase columns.
 *   - `users.supabase_user_id` references `auth.users(id)`, which lives in a
 *     schema PostgREST does not expose, so it has no entry in `Relationships`.
 */

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          firstName: string | null;
          lastName: string | null;
          role: Database['public']['Enums']['UserRole'];
          status: Database['public']['Enums']['UserStatus'];
          profile_image_url: string | null;
          signup_method: Database['public']['Enums']['SignupMethod'];
          supabase_user_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          firstName?: string | null;
          lastName?: string | null;
          role?: Database['public']['Enums']['UserRole'];
          status?: Database['public']['Enums']['UserStatus'];
          profile_image_url?: string | null;
          signup_method?: Database['public']['Enums']['SignupMethod'];
          supabase_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          firstName?: string | null;
          lastName?: string | null;
          role?: Database['public']['Enums']['UserRole'];
          status?: Database['public']['Enums']['UserStatus'];
          profile_image_url?: string | null;
          signup_method?: Database['public']['Enums']['SignupMethod'];
          supabase_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      artists: {
        Row: {
          id: string;
          name: string;
          bio: string | null;
          image_url: string | null;
          country: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          bio?: string | null;
          image_url?: string | null;
          country?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          bio?: string | null;
          image_url?: string | null;
          country?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      albums: {
        Row: {
          id: string;
          title: string;
          type: Database['public']['Enums']['AlbumType'];
          release_year: number | null;
          cover_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          type?: Database['public']['Enums']['AlbumType'];
          release_year?: number | null;
          cover_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          type?: Database['public']['Enums']['AlbumType'];
          release_year?: number | null;
          cover_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      movies: {
        Row: {
          id: string;
          title: string;
          release_year: number | null;
          poster_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          release_year?: number | null;
          poster_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          release_year?: number | null;
          poster_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
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
      songs: {
        Row: {
          id: string;
          title: string;
          duration: number;
          uploaded_by_user_id: string;
          artist: string[];
          composers: string[];
          album: string | null;
          genre: string | null;
          lyrics: string | null;
          audio_path: string;
          cover_path: string | null;
          album_id: string | null;
          movie_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          duration: number;
          uploaded_by_user_id: string;
          artist?: string[];
          composers?: string[];
          album?: string | null;
          genre?: string | null;
          lyrics?: string | null;
          audio_path: string;
          cover_path?: string | null;
          album_id?: string | null;
          movie_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          duration?: number;
          uploaded_by_user_id?: string;
          artist?: string[];
          composers?: string[];
          album?: string | null;
          genre?: string | null;
          lyrics?: string | null;
          audio_path?: string;
          cover_path?: string | null;
          album_id?: string | null;
          movie_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'songs_uploaded_by_user_id_fkey';
            columns: ['uploaded_by_user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
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
        ];
      };
      song_credits: {
        Row: {
          song_id: string;
          artist_id: string;
          role: Database['public']['Enums']['CreditRole'];
        };
        Insert: {
          song_id: string;
          artist_id: string;
          role: Database['public']['Enums']['CreditRole'];
        };
        Update: {
          song_id?: string;
          artist_id?: string;
          role?: Database['public']['Enums']['CreditRole'];
        };
        Relationships: [
          {
            foreignKeyName: 'song_credits_song_id_fkey';
            columns: ['song_id'];
            isOneToOne: false;
            referencedRelation: 'songs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'song_credits_artist_id_fkey';
            columns: ['artist_id'];
            isOneToOne: false;
            referencedRelation: 'artists';
            referencedColumns: ['id'];
          },
        ];
      };
      playlists: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
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
      playlist_songs: {
        Row: {
          id: string;
          playlist_id: string;
          song_id: string;
          position: number | null;
          added_at: string;
        };
        Insert: {
          id?: string;
          playlist_id: string;
          song_id: string;
          position?: number | null;
          added_at?: string;
        };
        Update: {
          id?: string;
          playlist_id?: string;
          song_id?: string;
          position?: number | null;
          added_at?: string;
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
      likes: {
        Row: {
          id: string;
          user_id: string;
          song_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          song_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          song_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'likes_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'likes_song_id_fkey';
            columns: ['song_id'];
            isOneToOne: false;
            referencedRelation: 'songs';
            referencedColumns: ['id'];
          },
        ];
      };
      upload_jobs: {
        Row: {
          id: string;
          user_id: string;
          status: Database['public']['Enums']['UploadJobStatus'];
          total_items: number;
          expires_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          status?: Database['public']['Enums']['UploadJobStatus'];
          total_items: number;
          expires_at: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          status?: Database['public']['Enums']['UploadJobStatus'];
          total_items?: number;
          expires_at?: string;
          created_at?: string;
          updated_at?: string;
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
      upload_job_items: {
        Row: {
          id: string;
          job_id: string;
          status: Database['public']['Enums']['UploadItemStatus'];
          original_name: string;
          asset_prefix: string;
          upload_session_id: string | null;
          total_bytes: number;
          uploaded_bytes: number;
          chunk_size: number;
          audio_path: string | null;
          cover_path: string | null;
          song_id: string | null;
          error_code: string | null;
          signed_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          status?: Database['public']['Enums']['UploadItemStatus'];
          original_name: string;
          asset_prefix: string;
          upload_session_id?: string | null;
          total_bytes: number;
          uploaded_bytes?: number;
          chunk_size: number;
          audio_path?: string | null;
          cover_path?: string | null;
          song_id?: string | null;
          error_code?: string | null;
          signed_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          job_id?: string;
          status?: Database['public']['Enums']['UploadItemStatus'];
          original_name?: string;
          asset_prefix?: string;
          upload_session_id?: string | null;
          total_bytes?: number;
          uploaded_bytes?: number;
          chunk_size?: number;
          audio_path?: string | null;
          cover_path?: string | null;
          song_id?: string | null;
          error_code?: string | null;
          signed_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
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
            isOneToOne: true;
            referencedRelation: 'songs';
            referencedColumns: ['id'];
          },
        ];
      };
      webhook_events: {
        Row: {
          svix_id: string;
          event_type: string;
          received_at: string;
        };
        Insert: {
          svix_id: string;
          event_type: string;
          received_at?: string;
        };
        Update: {
          svix_id?: string;
          event_type?: string;
          received_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      current_app_user_id: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      song_like_counts: {
        Args: { p_song_ids: string[] };
        Returns: { song_id: string; like_count: number }[];
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

type PublicSchema = Database['public'];

export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row'];
export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Update'];
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T];
