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
    PostgrestVersion: "14.1"
  }
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
      addresses: {
        Row: {
          address_line1: string
          address_line2: string | null
          city: string
          country: string | null
          created_at: string | null
          id: string
          is_default: boolean | null
          label: string
          latitude: number | null
          longitude: number | null
          postal_code: string | null
          state: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          address_line1: string
          address_line2?: string | null
          city: string
          country?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          label: string
          latitude?: number | null
          longitude?: number | null
          postal_code?: string | null
          state?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          address_line1?: string
          address_line2?: string | null
          city?: string
          country?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          label?: string
          latitude?: number | null
          longitude?: number | null
          postal_code?: string | null
          state?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_users: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          role: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          account_holder_name: string
          account_number_masked: string
          bank_name: string
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          mobile_money_phone_masked: string | null
          mobile_money_provider: string | null
          routing_number_masked: string | null
          stripe_external_account_id: string | null
          updated_at: string
          user_id: string
          user_type: string
        }
        Insert: {
          account_holder_name: string
          account_number_masked: string
          bank_name: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          mobile_money_phone_masked?: string | null
          mobile_money_provider?: string | null
          routing_number_masked?: string | null
          stripe_external_account_id?: string | null
          updated_at?: string
          user_id: string
          user_type: string
        }
        Update: {
          account_holder_name?: string
          account_number_masked?: string
          bank_name?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          mobile_money_phone_masked?: string | null
          mobile_money_provider?: string | null
          routing_number_masked?: string | null
          stripe_external_account_id?: string | null
          updated_at?: string
          user_id?: string
          user_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          cart_id: string | null
          created_at: string | null
          id: string
          menu_item_id: string | null
          post_id: string | null
          quantity: number | null
          special_instructions: string | null
          total_price: number
          unit_price: number
          updated_at: string | null
        }
        Insert: {
          cart_id?: string | null
          created_at?: string | null
          id?: string
          menu_item_id?: string | null
          post_id?: string | null
          quantity?: number | null
          special_instructions?: string | null
          total_price: number
          unit_price: number
          updated_at?: string | null
        }
        Update: {
          cart_id?: string | null
          created_at?: string | null
          id?: string
          menu_item_id?: string | null
          post_id?: string | null
          quantity?: number | null
          special_instructions?: string | null
          total_price?: number
          unit_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "customer_home_menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "customer_home_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          created_at: string | null
          id: string
          items: Json | null
          restaurant_id: string | null
          status: string | null
          subtotal: number | null
          total_items: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          items?: Json | null
          restaurant_id?: string | null
          status?: string | null
          subtotal?: number | null
          total_items?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          items?: Json | null
          restaurant_id?: string | null
          status?: string | null
          subtotal?: number | null
          total_items?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "carts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string | null
          created_at: string | null
          icon: string | null
          id: string
          name: string
          sort_order: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          name: string
          sort_order?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      comment_likes: {
        Row: {
          comment_id: string | null
          created_at: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          comment_id?: string | null
          created_at?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          comment_id?: string | null
          created_at?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_settings: {
        Row: {
          active_from: string
          active_until: string | null
          commission_rate: number
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean
          restaurant_id: string | null
          updated_at: string
        }
        Insert: {
          active_from?: string
          active_until?: string | null
          commission_rate?: number
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          restaurant_id?: string | null
          updated_at?: string
        }
        Update: {
          active_from?: string
          active_until?: string | null
          commission_rate?: number
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          restaurant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_settings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_settings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          commission_amount: number
          commission_rate: number
          created_at: string
          gross_amount: number
          id: string
          order_id: string
          restaurant_id: string
          restaurant_payout_amount: number
          status: string
          updated_at: string
        }
        Insert: {
          commission_amount: number
          commission_rate: number
          created_at?: string
          gross_amount: number
          id?: string
          order_id: string
          restaurant_id: string
          restaurant_payout_amount: number
          status?: string
          updated_at?: string
        }
        Update: {
          commission_amount?: number
          commission_rate?: number
          created_at?: string
          gross_amount?: number
          id?: string
          order_id?: string
          restaurant_id?: string
          restaurant_payout_amount?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "available_orders_for_drivers"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "commissions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string | null
          created_at: string | null
          id: string
          user_id: string | null
          user_type: string | null
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          user_id?: string | null
          user_type?: string | null
        }
        Update: {
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          user_id?: string | null
          user_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          conversation_type: string
          created_at: string | null
          customer_id: string | null
          driver_id: string | null
          id: string
          is_active: boolean | null
          last_message: string | null
          last_message_at: string | null
          order_id: string | null
          restaurant_id: string | null
          unread_count_customer: number | null
          unread_count_driver: number
          unread_count_restaurant: number | null
          updated_at: string | null
        }
        Insert: {
          conversation_type?: string
          created_at?: string | null
          customer_id?: string | null
          driver_id?: string | null
          id?: string
          is_active?: boolean | null
          last_message?: string | null
          last_message_at?: string | null
          order_id?: string | null
          restaurant_id?: string | null
          unread_count_customer?: number | null
          unread_count_driver?: number
          unread_count_restaurant?: number | null
          updated_at?: string | null
        }
        Update: {
          conversation_type?: string
          created_at?: string | null
          customer_id?: string | null
          driver_id?: string | null
          id?: string
          is_active?: boolean | null
          last_message?: string | null
          last_message_at?: string | null
          order_id?: string | null
          restaurant_id?: string | null
          unread_count_customer?: number | null
          unread_count_driver?: number
          unread_count_restaurant?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_dashboard_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "available_orders_for_drivers"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "conversations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string | null
          date_of_birth: string | null
          favorite_cuisines: string[] | null
          gender: string | null
          id: string
          latitude: number | null
          location_code: string | null
          longitude: number | null
          loyalty_points: number | null
          total_orders: number | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          favorite_cuisines?: string[] | null
          gender?: string | null
          id: string
          latitude?: number | null
          location_code?: string | null
          longitude?: number | null
          loyalty_points?: number | null
          total_orders?: number | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          favorite_cuisines?: string[] | null
          gender?: string | null
          id?: string
          latitude?: number | null
          location_code?: string | null
          longitude?: number | null
          loyalty_points?: number | null
          total_orders?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_users: {
        Row: {
          accepted_orders: number
          address: string | null
          availability: string | null
          background_check_status: string
          bank_account_id: string | null
          bank_account_last4: string | null
          cancelled_orders: number
          created_at: string | null
          current_location_lat: number | null
          current_location_lng: number | null
          documents_updated_at: string | null
          driver_status: string | null
          earnings_today: number | null
          earnings_week: number
          id: string
          id_photo_url: string | null
          id_verification_status: string
          insurance_document_url: string | null
          insurance_number: string | null
          is_active: boolean | null
          is_online: boolean | null
          last_location_update: string | null
          latitude: number | null
          license_expiry_date: string | null
          license_number: string
          license_photo_url: string | null
          location_accuracy: string | null
          location_code: string | null
          longitude: number | null
          on_time_deliveries: number
          pending_balance: number
          rating: number | null
          total_deliveries: number | null
          total_earnings: number | null
          total_offered_orders: number
          updated_at: string | null
          vehicle_color: string | null
          vehicle_insurance_expiry_date: string | null
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_plate: string
          vehicle_registration_url: string | null
          vehicle_type: string | null
          vehicle_year: number | null
          wallet_balance: number
          years_of_experience: number | null
        }
        Insert: {
          accepted_orders?: number
          address?: string | null
          availability?: string | null
          background_check_status?: string
          bank_account_id?: string | null
          bank_account_last4?: string | null
          cancelled_orders?: number
          created_at?: string | null
          current_location_lat?: number | null
          current_location_lng?: number | null
          documents_updated_at?: string | null
          driver_status?: string | null
          earnings_today?: number | null
          earnings_week?: number
          id: string
          id_photo_url?: string | null
          id_verification_status?: string
          insurance_document_url?: string | null
          insurance_number?: string | null
          is_active?: boolean | null
          is_online?: boolean | null
          last_location_update?: string | null
          latitude?: number | null
          license_expiry_date?: string | null
          license_number: string
          license_photo_url?: string | null
          location_accuracy?: string | null
          location_code?: string | null
          longitude?: number | null
          on_time_deliveries?: number
          pending_balance?: number
          rating?: number | null
          total_deliveries?: number | null
          total_earnings?: number | null
          total_offered_orders?: number
          updated_at?: string | null
          vehicle_color?: string | null
          vehicle_insurance_expiry_date?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_plate: string
          vehicle_registration_url?: string | null
          vehicle_type?: string | null
          vehicle_year?: number | null
          wallet_balance?: number
          years_of_experience?: number | null
        }
        Update: {
          accepted_orders?: number
          address?: string | null
          availability?: string | null
          background_check_status?: string
          bank_account_id?: string | null
          bank_account_last4?: string | null
          cancelled_orders?: number
          created_at?: string | null
          current_location_lat?: number | null
          current_location_lng?: number | null
          documents_updated_at?: string | null
          driver_status?: string | null
          earnings_today?: number | null
          earnings_week?: number
          id?: string
          id_photo_url?: string | null
          id_verification_status?: string
          insurance_document_url?: string | null
          insurance_number?: string | null
          is_active?: boolean | null
          is_online?: boolean | null
          last_location_update?: string | null
          latitude?: number | null
          license_expiry_date?: string | null
          license_number?: string
          license_photo_url?: string | null
          location_accuracy?: string | null
          location_code?: string | null
          longitude?: number | null
          on_time_deliveries?: number
          pending_balance?: number
          rating?: number | null
          total_deliveries?: number | null
          total_earnings?: number | null
          total_offered_orders?: number
          updated_at?: string | null
          vehicle_color?: string | null
          vehicle_insurance_expiry_date?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_plate?: string
          vehicle_registration_url?: string | null
          vehicle_type?: string | null
          vehicle_year?: number | null
          wallet_balance?: number
          years_of_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_users_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_achievements: {
        Row: {
          achievement_name: string
          achievement_type: string
          created_at: string | null
          description: string | null
          driver_id: string
          earned_at: string | null
          icon_emoji: string | null
          id: number
          reward_amount: number | null
        }
        Insert: {
          achievement_name: string
          achievement_type: string
          created_at?: string | null
          description?: string | null
          driver_id: string
          earned_at?: string | null
          icon_emoji?: string | null
          id?: number
          reward_amount?: number | null
        }
        Update: {
          achievement_name?: string
          achievement_type?: string
          created_at?: string | null
          description?: string | null
          driver_id?: string
          earned_at?: string | null
          icon_emoji?: string | null
          id?: number
          reward_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_achievements_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_achievements_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_dashboard_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_daily_stats: {
        Row: {
          average_rating: number | null
          cancellation_rate: number | null
          created_at: string | null
          deliveries_count: number | null
          driver_id: string
          earnings_amount: number | null
          hours_online: number | null
          id: number
          orders_accepted: number | null
          orders_declined: number | null
          stats_date: string
          updated_at: string | null
        }
        Insert: {
          average_rating?: number | null
          cancellation_rate?: number | null
          created_at?: string | null
          deliveries_count?: number | null
          driver_id: string
          earnings_amount?: number | null
          hours_online?: number | null
          id?: number
          orders_accepted?: number | null
          orders_declined?: number | null
          stats_date: string
          updated_at?: string | null
        }
        Update: {
          average_rating?: number | null
          cancellation_rate?: number | null
          created_at?: string | null
          deliveries_count?: number | null
          driver_id?: string
          earnings_amount?: number | null
          hours_online?: number | null
          id?: number
          orders_accepted?: number | null
          orders_declined?: number | null
          stats_date?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_daily_stats_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_daily_stats_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_dashboard_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_locations: {
        Row: {
          accuracy: number | null
          battery_level: number | null
          created_at: string
          driver_id: string
          heading: number | null
          id: string
          lat: number
          lng: number
          order_id: string | null
          provider: string | null
          speed: number | null
          updated_at: string
        }
        Insert: {
          accuracy?: number | null
          battery_level?: number | null
          created_at?: string
          driver_id: string
          heading?: number | null
          id?: string
          lat: number
          lng: number
          order_id?: string | null
          provider?: string | null
          speed?: number | null
          updated_at?: string
        }
        Update: {
          accuracy?: number | null
          battery_level?: number | null
          created_at?: string
          driver_id?: string
          heading?: number | null
          id?: string
          lat?: number
          lng?: number
          order_id?: string | null
          provider?: string | null
          speed?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_locations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_locations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_dashboard_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_locations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "available_orders_for_drivers"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "driver_locations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_notifications: {
        Row: {
          body: string
          created_at: string | null
          data: Json | null
          driver_id: string | null
          id: string
          read: boolean | null
          read_at: string | null
          title: string
          type: string | null
        }
        Insert: {
          body: string
          created_at?: string | null
          data?: Json | null
          driver_id?: string | null
          id?: string
          read?: boolean | null
          read_at?: string | null
          title: string
          type?: string | null
        }
        Update: {
          body?: string
          created_at?: string | null
          data?: Json | null
          driver_id?: string | null
          id?: string
          read?: boolean | null
          read_at?: string | null
          title?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_notifications_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_notifications_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_dashboard_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_withdrawal_requests: {
        Row: {
          account_name: string | null
          amount: number
          bank_account_id: string | null
          created_at: string
          currency: string
          driver_id: string
          id: string
          method: string
          notes: string | null
          phone_number: string | null
          processed_at: string | null
          rejected_reason: string | null
          status: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          amount: number
          bank_account_id?: string | null
          created_at?: string
          currency?: string
          driver_id: string
          id?: string
          method?: string
          notes?: string | null
          phone_number?: string | null
          processed_at?: string | null
          rejected_reason?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          currency?: string
          driver_id?: string
          id?: string
          method?: string
          notes?: string | null
          phone_number?: string | null
          processed_at?: string | null
          rejected_reason?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_withdrawal_requests_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_withdrawal_requests_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_dashboard_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "favorites_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "customer_home_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      hotspots: {
        Row: {
          city_code: string | null
          created_at: string | null
          demand_last_updated: string | null
          demand_level: number | null
          description: string | null
          id: number
          is_active: boolean | null
          latitude: number
          longitude: number
          name: string
          radius_meters: number | null
          updated_at: string | null
        }
        Insert: {
          city_code?: string | null
          created_at?: string | null
          demand_last_updated?: string | null
          demand_level?: number | null
          description?: string | null
          id?: number
          is_active?: boolean | null
          latitude: number
          longitude: number
          name: string
          radius_meters?: number | null
          updated_at?: string | null
        }
        Update: {
          city_code?: string | null
          created_at?: string | null
          demand_last_updated?: string | null
          demand_level?: number | null
          description?: string | null
          id?: number
          is_active?: boolean | null
          latitude?: number
          longitude?: number
          name?: string
          radius_meters?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      location_history: {
        Row: {
          accuracy: string | null
          altitude: string | null
          created_at: string | null
          driver_id: string | null
          heading: string | null
          id: string
          latitude: string
          longitude: string
          order_id: string | null
          speed: string | null
          timestamp: string | null
        }
        Insert: {
          accuracy?: string | null
          altitude?: string | null
          created_at?: string | null
          driver_id?: string | null
          heading?: string | null
          id?: string
          latitude: string
          longitude: string
          order_id?: string | null
          speed?: string | null
          timestamp?: string | null
        }
        Update: {
          accuracy?: string | null
          altitude?: string | null
          created_at?: string | null
          driver_id?: string | null
          heading?: string | null
          id?: string
          latitude?: string
          longitude?: string
          order_id?: string | null
          speed?: string | null
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "location_history_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "available_orders_for_drivers"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "location_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          allergens: string[] | null
          calories: number | null
          category: string | null
          created_at: string | null
          description: string | null
          dietary_tags: string[] | null
          id: string
          image_url: string | null
          ingredients: string | null
          is_available: boolean | null
          menu_item_number: number | null
          name: string
          popularity: string | null
          preparation_time: number | null
          price: number
          restaurant_id: string | null
          spice_level: number | null
          updated_at: string | null
        }
        Insert: {
          allergens?: string[] | null
          calories?: number | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          dietary_tags?: string[] | null
          id?: string
          image_url?: string | null
          ingredients?: string | null
          is_available?: boolean | null
          menu_item_number?: number | null
          name: string
          popularity?: string | null
          preparation_time?: number | null
          price: number
          restaurant_id?: string | null
          spice_level?: number | null
          updated_at?: string | null
        }
        Update: {
          allergens?: string[] | null
          calories?: number | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          dietary_tags?: string[] | null
          id?: string
          image_url?: string | null
          ingredients?: string | null
          is_available?: boolean | null
          menu_item_number?: number | null
          name?: string
          popularity?: string | null
          preparation_time?: number | null
          price?: number
          restaurant_id?: string | null
          spice_level?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      message_typing_indicators: {
        Row: {
          conversation_id: string
          id: string
          is_typing: boolean
          updated_at: string
          user_id: string
          user_type: string
        }
        Insert: {
          conversation_id: string
          id?: string
          is_typing?: boolean
          updated_at?: string
          user_id: string
          user_type: string
        }
        Update: {
          conversation_id?: string
          id?: string
          is_typing?: boolean
          updated_at?: string
          user_id?: string
          user_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_typing_indicators_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_typing_indicators_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: Json | null
          conversation_id: string | null
          created_at: string | null
          delivered_at: string | null
          id: string
          image_url: string | null
          is_read: boolean | null
          message: string
          message_type: string | null
          metadata: Json
          order_id: string | null
          read_at: string | null
          receiver_id: string | null
          receiver_type: string | null
          sender_id: string | null
          sender_type: string
          updated_at: string | null
        }
        Insert: {
          attachments?: Json | null
          conversation_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          id?: string
          image_url?: string | null
          is_read?: boolean | null
          message: string
          message_type?: string | null
          metadata?: Json
          order_id?: string | null
          read_at?: string | null
          receiver_id?: string | null
          receiver_type?: string | null
          sender_id?: string | null
          sender_type?: string
          updated_at?: string | null
        }
        Update: {
          attachments?: Json | null
          conversation_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          id?: string
          image_url?: string | null
          is_read?: boolean | null
          message?: string
          message_type?: string | null
          metadata?: Json
          order_id?: string | null
          read_at?: string | null
          receiver_id?: string | null
          receiver_type?: string | null
          sender_id?: string | null
          sender_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "available_orders_for_drivers"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_logs: {
        Row: {
          created_at: string | null
          id: string
          notification_id: string
          recipient_id: string
          recipient_type: string
          title: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          notification_id: string
          recipient_id: string
          recipient_type: string
          title?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          notification_id?: string
          recipient_id?: string
          recipient_type?: string
          title?: string | null
        }
        Relationships: []
      }
      notification_warnings: {
        Row: {
          created_at: string | null
          id: string
          notification_id: string
          recipient_id: string
          recipient_type: string
          sender_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          notification_id: string
          recipient_id: string
          recipient_type: string
          sender_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          notification_id?: string
          recipient_id?: string
          recipient_type?: string
          sender_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          data: Json
          id: string
          is_read: boolean
          push_status: string | null
          read_at: string | null
          sent_via_push: boolean
          title: string
          type: string
          user_id: string
          user_type: string
        }
        Insert: {
          body: string
          created_at?: string
          data?: Json
          id?: string
          is_read?: boolean
          push_status?: string | null
          read_at?: string | null
          sent_via_push?: boolean
          title: string
          type?: string
          user_id: string
          user_type: string
        }
        Update: {
          body?: string
          created_at?: string
          data?: Json
          id?: string
          is_read?: boolean
          push_status?: string | null
          read_at?: string | null
          sent_via_push?: boolean
          title?: string
          type?: string
          user_id?: string
          user_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      order_issues: {
        Row: {
          created_at: string | null
          description: string
          id: string
          images: string[] | null
          issue_type: string
          order_id: string
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          images?: string[] | null
          issue_type: string
          order_id: string
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          images?: string[] | null
          issue_type?: string
          order_id?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_issues_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "available_orders_for_drivers"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_issues_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_issues_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string | null
          id: string
          item_description: string | null
          item_image_url: string | null
          item_name: string | null
          item_price: number | null
          menu_item_id: string | null
          order_id: string | null
          post_id: string | null
          quantity: number
          special_instructions: string | null
          total_price: number | null
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_description?: string | null
          item_image_url?: string | null
          item_name?: string | null
          item_price?: number | null
          menu_item_id?: string | null
          order_id?: string | null
          post_id?: string | null
          quantity?: number
          special_instructions?: string | null
          total_price?: number | null
          unit_price: number
        }
        Update: {
          created_at?: string | null
          id?: string
          item_description?: string | null
          item_image_url?: string | null
          item_name?: string | null
          item_price?: number | null
          menu_item_id?: string | null
          order_id?: string | null
          post_id?: string | null
          quantity?: number
          special_instructions?: string | null
          total_price?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "customer_home_menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "available_orders_for_drivers"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "customer_home_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      order_notifications: {
        Row: {
          created_at: string | null
          data: Json | null
          driver_id: string | null
          id: string
          is_read: boolean | null
          is_sent: boolean | null
          message: string
          notification_type: string
          order_id: string | null
          read_at: string | null
          restaurant_id: string | null
          sent_at: string | null
          target_roles: string[] | null
          title: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          driver_id?: string | null
          id?: string
          is_read?: boolean | null
          is_sent?: boolean | null
          message: string
          notification_type: string
          order_id?: string | null
          read_at?: string | null
          restaurant_id?: string | null
          sent_at?: string | null
          target_roles?: string[] | null
          title: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          driver_id?: string | null
          id?: string
          is_read?: boolean | null
          is_sent?: boolean | null
          message?: string
          notification_type?: string
          order_id?: string | null
          read_at?: string | null
          restaurant_id?: string | null
          sent_at?: string | null
          target_roles?: string[] | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_notifications_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_notifications_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_dashboard_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "available_orders_for_drivers"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_notifications_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          location_lat: number | null
          location_lng: number | null
          note: string | null
          order_id: string
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          note?: string | null
          order_id: string
          status: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          note?: string | null
          order_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "available_orders_for_drivers"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          actual_delivery_time: string | null
          cancelled_at: string | null
          created_at: string | null
          currency: string
          customer_id: string | null
          delivered_at: string | null
          delivery_address: Json
          delivery_fee: number | null
          discount_amount: number | null
          distance_km: number | null
          driver_accepted_at: string | null
          driver_arrived_at: string | null
          driver_assigned_at: string | null
          driver_id: string | null
          driver_location_lat: string | null
          driver_location_lng: string | null
          driver_location_updated_at: string | null
          driver_payout_amount: number
          estimated_delivery_time: string | null
          eta_minutes: number | null
          final_amount: number
          id: string
          order_number: string
          payment_method: string
          payment_processing_fee: number
          payment_status: string | null
          picked_up_at: string | null
          platform_commission_amount: number
          post_id: string | null
          restaurant_id: string | null
          restaurant_payout_amount: number
          special_instructions: string | null
          status: string | null
          stripe_payment_intent_id: string | null
          stripe_payment_status: string | null
          tax_amount: number | null
          tip_amount: number
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          actual_delivery_time?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          currency?: string
          customer_id?: string | null
          delivered_at?: string | null
          delivery_address: Json
          delivery_fee?: number | null
          discount_amount?: number | null
          distance_km?: number | null
          driver_accepted_at?: string | null
          driver_arrived_at?: string | null
          driver_assigned_at?: string | null
          driver_id?: string | null
          driver_location_lat?: string | null
          driver_location_lng?: string | null
          driver_location_updated_at?: string | null
          driver_payout_amount?: number
          estimated_delivery_time?: string | null
          eta_minutes?: number | null
          final_amount: number
          id?: string
          order_number: string
          payment_method: string
          payment_processing_fee?: number
          payment_status?: string | null
          picked_up_at?: string | null
          platform_commission_amount?: number
          post_id?: string | null
          restaurant_id?: string | null
          restaurant_payout_amount?: number
          special_instructions?: string | null
          status?: string | null
          stripe_payment_intent_id?: string | null
          stripe_payment_status?: string | null
          tax_amount?: number | null
          tip_amount?: number
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          actual_delivery_time?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          currency?: string
          customer_id?: string | null
          delivered_at?: string | null
          delivery_address?: Json
          delivery_fee?: number | null
          discount_amount?: number | null
          distance_km?: number | null
          driver_accepted_at?: string | null
          driver_arrived_at?: string | null
          driver_assigned_at?: string | null
          driver_id?: string | null
          driver_location_lat?: string | null
          driver_location_lng?: string | null
          driver_location_updated_at?: string | null
          driver_payout_amount?: number
          estimated_delivery_time?: string | null
          eta_minutes?: number | null
          final_amount?: number
          id?: string
          order_number?: string
          payment_method?: string
          payment_processing_fee?: number
          payment_status?: string | null
          picked_up_at?: string | null
          platform_commission_amount?: number
          post_id?: string | null
          restaurant_id?: string | null
          restaurant_payout_amount?: number
          special_instructions?: string | null
          status?: string | null
          stripe_payment_intent_id?: string | null
          stripe_payment_status?: string | null
          tax_amount?: number | null
          tip_amount?: number
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_dashboard_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "customer_home_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          card_last_four: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          provider: string | null
          type: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          card_last_four?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          provider?: string | null
          type: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          card_last_four?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          provider?: string | null
          type?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      peak_hours_config: {
        Row: {
          boost_percentage: number | null
          created_at: string | null
          day_of_week: number | null
          end_hour: number | null
          id: number
          is_active: boolean | null
          start_hour: number | null
          updated_at: string | null
          zone_id: number | null
        }
        Insert: {
          boost_percentage?: number | null
          created_at?: string | null
          day_of_week?: number | null
          end_hour?: number | null
          id?: number
          is_active?: boolean | null
          start_hour?: number | null
          updated_at?: string | null
          zone_id?: number | null
        }
        Update: {
          boost_percentage?: number | null
          created_at?: string | null
          day_of_week?: number | null
          end_hour?: number | null
          id?: number
          is_active?: boolean | null
          start_hour?: number | null
          updated_at?: string | null
          zone_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "peak_hours_config_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "service_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          currency: string
          description: string | null
          expense_date: string
          id: string
          metadata: Json
          order_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          category?: string
          created_at?: string
          currency?: string
          description?: string | null
          expense_date?: string
          id?: string
          metadata?: Json
          order_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          currency?: string
          description?: string | null
          expense_date?: string
          id?: string
          metadata?: Json
          order_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_expenses_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "available_orders_for_drivers"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "platform_expenses_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          comment: string
          created_at: string | null
          id: string
          likes_count: number | null
          parent_comment_id: string | null
          post_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          comment: string
          created_at?: string | null
          id?: string
          likes_count?: number | null
          parent_comment_id?: string | null
          post_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          comment?: string
          created_at?: string | null
          id?: string
          likes_count?: number | null
          parent_comment_id?: string | null
          post_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "customer_home_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string | null
          id: string
          post_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "customer_home_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      post_views: {
        Row: {
          created_at: string | null
          id: string
          post_id: string | null
          user_id: string | null
          view_date: string | null
          view_time: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id?: string | null
          user_id?: string | null
          view_date?: string | null
          view_time?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string | null
          user_id?: string | null
          view_date?: string | null
          view_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_views_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "customer_home_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_views_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          available_from: string | null
          available_until: string | null
          comments_count: number | null
          created_at: string | null
          description: string | null
          discount_percentage: number | null
          discounted_price: number | null
          id: string
          image_url: string | null
          is_active: boolean | null
          likes_count: number | null
          original_price: number | null
          post_number: number | null
          post_type: string | null
          restaurant_id: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
          view_count: number | null
        }
        Insert: {
          available_from?: string | null
          available_until?: string | null
          comments_count?: number | null
          created_at?: string | null
          description?: string | null
          discount_percentage?: number | null
          discounted_price?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          likes_count?: number | null
          original_price?: number | null
          post_number?: number | null
          post_type?: string | null
          restaurant_id?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
          view_count?: number | null
        }
        Update: {
          available_from?: string | null
          available_until?: string | null
          comments_count?: number | null
          created_at?: string | null
          description?: string | null
          discount_percentage?: number | null
          discounted_price?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          likes_count?: number | null
          original_price?: number | null
          post_number?: number | null
          post_type?: string | null
          restaurant_id?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_bank_accounts: {
        Row: {
          account_holder_name: string
          account_number: string
          bank_name: string
          created_at: string | null
          iban: string | null
          id: string
          is_default: boolean | null
          swift_code: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_holder_name: string
          account_number: string
          bank_name: string
          created_at?: string | null
          iban?: string | null
          id?: string
          is_default?: boolean | null
          swift_code?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_holder_name?: string
          account_number?: string
          bank_name?: string
          created_at?: string | null
          iban?: string | null
          id?: string
          is_default?: boolean | null
          swift_code?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_bank_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_notifications: {
        Row: {
          body: string
          created_at: string | null
          data: Json | null
          id: string
          read: boolean | null
          read_at: string | null
          restaurant_id: string | null
          title: string
          type: string | null
        }
        Insert: {
          body: string
          created_at?: string | null
          data?: Json | null
          id?: string
          read?: boolean | null
          read_at?: string | null
          restaurant_id?: string | null
          title: string
          type?: string | null
        }
        Update: {
          body?: string
          created_at?: string | null
          data?: Json | null
          id?: string
          read?: boolean | null
          read_at?: string | null
          restaurant_id?: string | null
          title?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_notifications_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          address: string
          bank_account_id: string | null
          business_license: string
          capacity: number | null
          commission_rate: number | null
          created_at: string | null
          cuisine_type: string | null
          delivery_fee: number | null
          delivery_radius: number | null
          description: string | null
          features: Json | null
          has_delivery: boolean | null
          has_dine_in: boolean | null
          has_outdoor: boolean | null
          has_parking: boolean | null
          has_pickup: boolean | null
          has_wifi: boolean | null
          id: string
          image_url: string | null
          is_family: boolean | null
          is_halal: boolean | null
          is_verified: boolean | null
          latitude: number | null
          location_code: string | null
          longitude: number | null
          min_order_amount: number | null
          minimum_order: number | null
          opening_hours: string | null
          owner_id: string | null
          payment_methods: string[] | null
          pending_balance: number
          restaurant_name: string
          restaurant_rating: number | null
          restaurant_status: string | null
          setup_completed: boolean | null
          total_earned: number
          total_orders: number | null
          total_withdrawn: number
          updated_at: string | null
          wallet_balance: number
        }
        Insert: {
          address: string
          bank_account_id?: string | null
          business_license: string
          capacity?: number | null
          commission_rate?: number | null
          created_at?: string | null
          cuisine_type?: string | null
          delivery_fee?: number | null
          delivery_radius?: number | null
          description?: string | null
          features?: Json | null
          has_delivery?: boolean | null
          has_dine_in?: boolean | null
          has_outdoor?: boolean | null
          has_parking?: boolean | null
          has_pickup?: boolean | null
          has_wifi?: boolean | null
          id: string
          image_url?: string | null
          is_family?: boolean | null
          is_halal?: boolean | null
          is_verified?: boolean | null
          latitude?: number | null
          location_code?: string | null
          longitude?: number | null
          min_order_amount?: number | null
          minimum_order?: number | null
          opening_hours?: string | null
          owner_id?: string | null
          payment_methods?: string[] | null
          pending_balance?: number
          restaurant_name: string
          restaurant_rating?: number | null
          restaurant_status?: string | null
          setup_completed?: boolean | null
          total_earned?: number
          total_orders?: number | null
          total_withdrawn?: number
          updated_at?: string | null
          wallet_balance?: number
        }
        Update: {
          address?: string
          bank_account_id?: string | null
          business_license?: string
          capacity?: number | null
          commission_rate?: number | null
          created_at?: string | null
          cuisine_type?: string | null
          delivery_fee?: number | null
          delivery_radius?: number | null
          description?: string | null
          features?: Json | null
          has_delivery?: boolean | null
          has_dine_in?: boolean | null
          has_outdoor?: boolean | null
          has_parking?: boolean | null
          has_pickup?: boolean | null
          has_wifi?: boolean | null
          id?: string
          image_url?: string | null
          is_family?: boolean | null
          is_halal?: boolean | null
          is_verified?: boolean | null
          latitude?: number | null
          location_code?: string | null
          longitude?: number | null
          min_order_amount?: number | null
          minimum_order?: number | null
          opening_hours?: string | null
          owner_id?: string | null
          payment_methods?: string[] | null
          pending_balance?: number
          restaurant_name?: string
          restaurant_rating?: number | null
          restaurant_status?: string | null
          setup_completed?: boolean | null
          total_earned?: number
          total_orders?: number | null
          total_withdrawn?: number
          updated_at?: string | null
          wallet_balance?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_restaurants_owner"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurants_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          customer_id: string | null
          driver_id: string | null
          id: string
          order_id: string | null
          rating: number
          restaurant_id: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          customer_id?: string | null
          driver_id?: string | null
          id?: string
          order_id?: string | null
          rating: number
          restaurant_id?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          customer_id?: string | null
          driver_id?: string | null
          id?: string
          order_id?: string | null
          rating?: number
          restaurant_id?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_dashboard_stats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "available_orders_for_drivers"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      service_zones: {
        Row: {
          city_code: string | null
          created_at: string | null
          description: string | null
          id: number
          is_active: boolean | null
          latitude: number | null
          longitude: number | null
          updated_at: string | null
          zone_name: string
        }
        Insert: {
          city_code?: string | null
          created_at?: string | null
          description?: string | null
          id?: number
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          updated_at?: string | null
          zone_name: string
        }
        Update: {
          city_code?: string | null
          created_at?: string | null
          description?: string | null
          id?: number
          is_active?: boolean | null
          latitude?: number | null
          longitude?: number | null
          updated_at?: string | null
          zone_name?: string
        }
        Relationships: []
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          metadata: Json
          order_id: string | null
          status: string
          stripe_payment_intent_id: string | null
          stripe_payout_id: string | null
          type: string
          updated_at: string
          user_id: string | null
          user_type: string
          withdrawal_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json
          order_id?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_payout_id?: string | null
          type: string
          updated_at?: string
          user_id?: string | null
          user_type: string
          withdrawal_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json
          order_id?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_payout_id?: string | null
          type?: string
          updated_at?: string
          user_id?: string | null
          user_type?: string
          withdrawal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "available_orders_for_drivers"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_withdrawal_id_fkey"
            columns: ["withdrawal_id"]
            isOneToOne: false
            referencedRelation: "withdrawals"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notifications: {
        Row: {
          body: string
          created_at: string | null
          data: Json | null
          id: string
          read: boolean | null
          read_at: string | null
          title: string
          type: string | null
          user_id: string | null
        }
        Insert: {
          body: string
          created_at?: string | null
          data?: Json | null
          id?: string
          read?: boolean | null
          read_at?: string | null
          title: string
          type?: string | null
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string | null
          data?: Json | null
          id?: string
          read?: boolean | null
          read_at?: string | null
          title?: string
          type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          addresses: Json | null
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          id: string
          preferences: Json | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          addresses?: Json | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          id?: string
          preferences?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          addresses?: Json | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          id?: string
          preferences?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_push_tokens: {
        Row: {
          apns_token: string | null
          created_at: string | null
          device_id: string | null
          device_type: string
          expo_push_token: string
          fcm_token: string | null
          id: string
          is_active: boolean | null
          last_seen_at: string
          last_used_at: string | null
          platform: string | null
          updated_at: string | null
          user_id: string
          user_type: string
        }
        Insert: {
          apns_token?: string | null
          created_at?: string | null
          device_id?: string | null
          device_type: string
          expo_push_token: string
          fcm_token?: string | null
          id?: string
          is_active?: boolean | null
          last_seen_at?: string
          last_used_at?: string | null
          platform?: string | null
          updated_at?: string | null
          user_id: string
          user_type?: string
        }
        Update: {
          apns_token?: string | null
          created_at?: string | null
          device_id?: string | null
          device_type?: string
          expo_push_token?: string
          fcm_token?: string | null
          id?: string
          is_active?: boolean | null
          last_seen_at?: string
          last_used_at?: string | null
          platform?: string | null
          updated_at?: string | null
          user_id?: string
          user_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_wallets: {
        Row: {
          balance: number
          created_at: string
          currency: string
          id: string
          pending_balance: number
          total_earned: number
          total_withdrawn: number
          updated_at: string
          user_id: string
          user_type: string
        }
        Insert: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          pending_balance?: number
          total_earned?: number
          total_withdrawn?: number
          updated_at?: string
          user_id: string
          user_type: string
        }
        Update: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          pending_balance?: number
          total_earned?: number
          total_withdrawn?: number
          updated_at?: string
          user_id?: string
          user_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          country_code: string | null
          created_at: string | null
          email: string
          full_name: string
          google_id: string | null
          id: string
          is_active: boolean | null
          is_verified: boolean | null
          last_login: string | null
          latitude: number | null
          longitude: number | null
          phone: string | null
          profile_image_url: string | null
          updated_at: string | null
          user_type: string
        }
        Insert: {
          country_code?: string | null
          created_at?: string | null
          email: string
          full_name: string
          google_id?: string | null
          id: string
          is_active?: boolean | null
          is_verified?: boolean | null
          last_login?: string | null
          latitude?: number | null
          longitude?: number | null
          phone?: string | null
          profile_image_url?: string | null
          updated_at?: string | null
          user_type: string
        }
        Update: {
          country_code?: string | null
          created_at?: string | null
          email?: string
          full_name?: string
          google_id?: string | null
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          last_login?: string | null
          latitude?: number | null
          longitude?: number | null
          phone?: string | null
          profile_image_url?: string | null
          updated_at?: string | null
          user_type?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          amount: number
          bank_account_id: string | null
          created_at: string
          currency: string
          estimated_arrival_at: string | null
          fee_amount: number
          id: string
          metadata: Json
          processed_at: string | null
          rejected_reason: string | null
          status: string
          stripe_payout_id: string | null
          transaction_id: string | null
          updated_at: string
          user_id: string
          user_type: string
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          created_at?: string
          currency?: string
          estimated_arrival_at?: string | null
          fee_amount?: number
          id?: string
          metadata?: Json
          processed_at?: string | null
          rejected_reason?: string | null
          status?: string
          stripe_payout_id?: string | null
          transaction_id?: string | null
          updated_at?: string
          user_id: string
          user_type: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          currency?: string
          estimated_arrival_at?: string | null
          fee_amount?: number
          id?: string
          metadata?: Json
          processed_at?: string | null
          rejected_reason?: string | null
          status?: string
          stripe_payout_id?: string | null
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
          user_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawals_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "withdrawals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      available_orders_for_drivers: {
        Row: {
          created_at: string | null
          customer_name: string | null
          delivery_address: Json | null
          delivery_fee: number | null
          driver_earnings: number | null
          estimated_delivery_time: string | null
          final_amount: number | null
          latitude: number | null
          longitude: number | null
          order_id: string | null
          order_number: string | null
          restaurant_address: string | null
          restaurant_delivery_fee: number | null
          restaurant_name: string | null
          restaurant_owner_name: string | null
          restaurant_phone: string | null
          restaurant_rating: number | null
          special_instructions: string | null
          status: string | null
        }
        Relationships: []
      }
      customer_home_menu_items: {
        Row: {
          category: string | null
          created_at: string | null
          cuisine_type: string | null
          delivery_fee: number | null
          description: string | null
          id: string | null
          image_url: string | null
          is_available: boolean | null
          name: string | null
          popularity: string | null
          preparation_time: number | null
          price: number | null
          restaurant_id: string | null
          restaurant_image_url: string | null
          restaurant_name: string | null
          restaurant_rating: number | null
          restaurant_status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_home_posts: {
        Row: {
          available_until: string | null
          comments_count: number | null
          created_at: string | null
          cuisine_type: string | null
          delivery_fee: number | null
          description: string | null
          discount_percentage: number | null
          discounted_price: number | null
          id: string | null
          image_url: string | null
          is_active: boolean | null
          likes_count: number | null
          min_order_amount: number | null
          original_price: number | null
          post_type: string | null
          restaurant_id: string | null
          restaurant_image_url: string | null
          restaurant_name: string | null
          restaurant_rating: number | null
          restaurant_status: string | null
          tags: string[] | null
          title: string | null
          view_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_dashboard_stats: {
        Row: {
          active_deliveries_count: number | null
          available_orders_count: number | null
          current_location_lat: number | null
          current_location_lng: number | null
          driver_status: string | null
          earnings_today: number | null
          id: string | null
          is_online: boolean | null
          last_location_update: string | null
          rating: number | null
          total_deliveries: number | null
          total_earnings: number | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_users_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_withdrawal_requests_legacy: {
        Row: {
          amount: number | null
          bank_account_id: string | null
          created_at: string | null
          currency: string | null
          driver_id: string | null
          id: string | null
          processed_at: string | null
          rejected_reason: string | null
          status: string | null
          transaction_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          bank_account_id?: string | null
          created_at?: string | null
          currency?: string | null
          driver_id?: string | null
          id?: string | null
          processed_at?: string | null
          rejected_reason?: string | null
          status?: string | null
          transaction_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          bank_account_id?: string | null
          created_at?: string | null
          currency?: string | null
          driver_id?: string | null
          id?: string | null
          processed_at?: string | null
          rejected_reason?: string | null
          status?: string | null
          transaction_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_withdrawal_requests_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "delivery_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_withdrawal_requests_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "driver_dashboard_stats"
            referencedColumns: ["id"]
          },
        ]
      }
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      app_setting_numeric: {
        Args: { p_default: number; p_key: string }
        Returns: number
      }
      approve_withdrawal: {
        Args: { p_withdrawal_id: string }
        Returns: {
          amount: number
          bank_account_id: string | null
          created_at: string
          currency: string
          estimated_arrival_at: string | null
          fee_amount: number
          id: string
          metadata: Json
          processed_at: string | null
          rejected_reason: string | null
          status: string
          stripe_payout_id: string | null
          transaction_id: string | null
          updated_at: string
          user_id: string
          user_type: string
        }
        SetofOptions: {
          from: "*"
          to: "withdrawals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      calculate_commission: {
        Args: { p_order_id: string }
        Returns: {
          commission_amount: number
          commission_rate: number
          created_at: string
          gross_amount: number
          id: string
          order_id: string
          restaurant_id: string
          restaurant_payout_amount: number
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "commissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      calculate_delivery_distance_km: {
        Args: {
          p_customer_lat: number
          p_customer_lng: number
          p_restaurant_lat: number
          p_restaurant_lng: number
        }
        Returns: number
      }
      calculate_delivery_fee_from_distance: {
        Args: { p_distance_km: number }
        Returns: number
      }
      calculate_distance: {
        Args: { lat1: number; lat2: number; lon1: number; lon2: number }
        Returns: number
      }
      calculate_order_delivery_pricing: {
        Args: { p_delivery_address: Json; p_restaurant_id: string }
        Returns: {
          delivery_fee: number
          distance_km: number
        }[]
      }
      calculate_profit: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: {
          net_profit: number
          platform_expenses: number
          profit_margin: number
          total_commission: number
          total_paid_drivers: number
          total_paid_restaurants: number
          total_revenue: number
        }[]
      }
      claim_order_for_driver: {
        Args: { p_driver_id: string; p_order_id: string }
        Returns: Json
      }
      create_withdrawal_request: {
        Args: { p_amount: number; p_user_id: string; p_user_type: string }
        Returns: {
          amount: number
          bank_account_id: string | null
          created_at: string
          currency: string
          estimated_arrival_at: string | null
          fee_amount: number
          id: string
          metadata: Json
          processed_at: string | null
          rejected_reason: string | null
          status: string
          stripe_payout_id: string | null
          transaction_id: string | null
          updated_at: string
          user_id: string
          user_type: string
        }
        SetofOptions: {
          from: "*"
          to: "withdrawals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      disablelongtransactions: { Args: never; Returns: string }
      distribute_payments: { Args: { p_order_id: string }; Returns: Json }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      find_nearest_driver: {
        Args: { p_radius_km?: number; p_restaurant_id: string }
        Returns: {
          distance_km: number
          driver_id: string
          driver_name: string
          rating: number
          total_deliveries: number
        }[]
      }
      fix_all_view_counts: { Args: never; Returns: undefined }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_comment_likes_count: {
        Args: { comment_id_param: string }
        Returns: number
      }
      get_driver_earnings_today: {
        Args: { p_driver_id: string }
        Returns: number
      }
      get_messages_with_sender: {
        Args: { p_conversation_id: string }
        Returns: {
          conversation_id: string
          created_at: string
          id: string
          is_read: boolean
          message: string
          message_type: string
          sender_full_name: string
          sender_id: string
          sender_profile_image_url: string
        }[]
      }
      get_nearby_available_orders: {
        Args: {
          driver_lat: number
          driver_lng: number
          max_distance_km?: number
        }
        Returns: {
          created_at: string
          delivery_fee: number
          distance_km: number
          final_amount: number
          id: string
          order_number: string
          restaurant_address: string
          restaurant_lat: number
          restaurant_lng: number
          restaurant_name: string
          status: string
        }[]
      }
      get_nearby_orders_for_driver: {
        Args: {
          driver_lat: number
          driver_lng: number
          max_distance_km?: number
        }
        Returns: {
          delivery_fee: number
          distance_km: number
          id: string
          items_count: number
          order_number: string
          restaurant_name: string
        }[]
      }
      get_paginated_posts: {
        Args: { page_number?: number; page_size?: number }
        Returns: {
          distance_km: number
          post_data: Json
          restaurant_data: Json
        }[]
      }
      get_post_comments_fast: {
        Args: { post_id_param: string }
        Returns: number
      }
      get_post_counts_fast: { Args: { post_id_param: string }; Returns: Json }
      get_post_likes_count: { Args: { post_id_param: string }; Returns: number }
      get_post_likes_fast: { Args: { post_id_param: string }; Returns: number }
      get_post_with_counts: {
        Args: { post_id_param: string }
        Returns: {
          comments_count: number
          likes_count: number
          post_data: Json
          user_has_liked: boolean
          user_id_param: string
          view_count: number
        }[]
      }
      get_post_with_optimized_counts: {
        Args: { post_id_param: string }
        Returns: Json
      }
      get_posts_with_counts: {
        Args: { post_ids: string[] }
        Returns: {
          comments_count: number
          likes_count: number
          post_id: string
          view_count: number
        }[]
      }
      get_profit_per_restaurant: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: {
          admin_profit: number
          commission_paid: number
          restaurant_id: string
          restaurant_name: string
          restaurant_payout: number
          total_orders: number
          total_revenue: number
        }[]
      }
      get_restaurant_weekly_sales: {
        Args: { p_restaurant_id: string }
        Returns: {
          commission: number
          gross_sales: number
          orders_count: number
          period: string
          restaurant_payout: number
        }[]
      }
      get_revenue_by_period: {
        Args: { p_end_date: string; p_grain?: string; p_start_date: string }
        Returns: {
          commission: number
          orders_count: number
          period: string
          revenue: number
        }[]
      }
      gettransactionid: { Args: never; Returns: unknown }
      increment_post_view_fast: {
        Args: { post_id_param: string }
        Returns: number
      }
      increment_post_view_simple: {
        Args: { post_id_param: string }
        Returns: number
      }
      increment_restaurant_reviews: {
        Args: { restaurant_id_param: string }
        Returns: undefined
      }
      increment_view_fast: { Args: { post_id_param: string }; Returns: number }
      is_admin: { Args: never; Returns: boolean }
      is_order_participant: { Args: { p_order_id: string }; Returns: boolean }
      is_restaurant_owner: {
        Args: { restaurant_uuid: string }
        Returns: boolean
      }
      is_service_role: { Args: never; Returns: boolean }
      longtransactionsenabled: { Args: never; Returns: boolean }
      mark_conversation_messages_as_read: {
        Args: { p_conversation_id: string; p_user_id: string }
        Returns: number
      }
      normalize_ugx_amount: { Args: { p_amount: number }; Returns: number }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      process_payment: { Args: { p_order_id: string }; Returns: Json }
      refresh_driver_wallet: {
        Args: { p_driver_id: string }
        Returns: {
          balance: number
          created_at: string
          currency: string
          id: string
          pending_balance: number
          total_earned: number
          total_withdrawn: number
          updated_at: string
          user_id: string
          user_type: string
        }
        SetofOptions: {
          from: "*"
          to: "user_wallets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      safe_numeric: { Args: { p_value: string }; Returns: number }
      send_order_message: {
        Args: {
          p_conversation_id: string
          p_message: string
          p_receiver_id?: string
          p_receiver_type?: string
          p_sender_type: string
        }
        Returns: {
          attachments: Json | null
          conversation_id: string | null
          created_at: string | null
          delivered_at: string | null
          id: string
          image_url: string | null
          is_read: boolean | null
          message: string
          message_type: string | null
          metadata: Json
          order_id: string | null
          read_at: string | null
          receiver_id: string | null
          receiver_type: string | null
          sender_id: string | null
          sender_type: string
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      send_push_notification: {
        Args: {
          p_body: string
          p_data?: Json
          p_title: string
          p_user_id: string
        }
        Returns: Json
      }
      set_conversation_typing: {
        Args: {
          p_conversation_id: string
          p_is_typing: boolean
          p_user_type: string
        }
        Returns: {
          conversation_id: string
          id: string
          is_typing: boolean
          updated_at: string
          user_id: string
          user_type: string
        }
        SetofOptions: {
          from: "*"
          to: "message_typing_indicators"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      sync_all_post_likes_counts: { Args: never; Returns: undefined }
      sync_post_counts: {
        Args: { post_id_param: string }
        Returns: {
          comments_count: number
          likes_count: number
          view_count: number
        }[]
      }
      toggle_comment_like: {
        Args: { comment_id_param: string; user_id_param: string }
        Returns: Json
      }
      toggle_post_like: {
        Args: { post_id_param: string; user_id_param: string }
        Returns: Json
      }
      track_post_view: {
        Args: { post_id_param: string; user_id_param?: string }
        Returns: Json
      }
      unlockrows: { Args: { "": string }; Returns: number }
      update_wallet_balance: {
        Args: {
          p_amount: number
          p_operation?: string
          p_user_id: string
          p_user_type: string
        }
        Returns: {
          balance: number
          created_at: string
          currency: string
          id: string
          pending_balance: number
          total_earned: number
          total_withdrawn: number
          updated_at: string
          user_id: string
          user_type: string
        }
        SetofOptions: {
          from: "*"
          to: "user_wallets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
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
