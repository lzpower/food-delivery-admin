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
      banners: {
        Row: {
          id: string;
          image_url: string;
          link_url: string | null;
          is_active: boolean;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          image_url: string;
          link_url?: string | null;
          is_active?: boolean;
          position?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          image_url?: string;
          link_url?: string | null;
          is_active?: boolean;
          position?: number;
          created_at?: string;
        };
      };
      calls: {
        Row: {
          id: string;
          order_id: string;
          caller_id: string;
          receiver_id: string;
          duration_seconds: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          caller_id: string;
          receiver_id: string;
          duration_seconds?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          caller_id?: string;
          receiver_id?: string;
          duration_seconds?: number;
          created_at?: string;
        };
      };
      categories: {
        Row: {
          id: string;
          name: string;
          icon_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          icon_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          icon_url?: string | null;
          created_at?: string;
        };
      };
      favorites: {
        Row: {
          id: string;
          user_id: string;
          restaurant_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          restaurant_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          restaurant_id?: string | null;
          created_at?: string;
        };
      };
      food_option_groups: {
        Row: {
          id: string;
          food_id: string;
          name: string;
          is_required: boolean;
          allow_multiple: boolean;
        };
        Insert: {
          id?: string;
          food_id: string;
          name: string;
          is_required?: boolean;
          allow_multiple?: boolean;
        };
        Update: {
          id?: string;
          food_id?: string;
          name?: string;
          is_required?: boolean;
          allow_multiple?: boolean;
        };
      };
      food_option_items: {
        Row: {
          id: string;
          group_id: string;
          name: string;
          extra_price: number;
        };
        Insert: {
          id?: string;
          group_id: string;
          name: string;
          extra_price?: number;
        };
        Update: {
          id?: string;
          group_id?: string;
          name?: string;
          extra_price?: number;
        };
      };
      foods: {
        Row: {
          id: string;
          restaurant_id: string;
          category_id: string | null;
          name: string;
          description: string | null;
          price: number;
          original_price: number | null;
          image_url: string | null;
          is_available: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          category_id?: string | null;
          name: string;
          description?: string | null;
          price: number;
          original_price?: number | null;
          image_url?: string | null;
          is_available?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          category_id?: string | null;
          name?: string;
          description?: string | null;
          price?: number;
          original_price?: number | null;
          image_url?: string | null;
          is_available?: boolean;
          created_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          order_id: string;
          sender_id: string;
          sender_type: "user" | "driver";
          message_type: "text" | "image";
          content: string | null;
          image_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          sender_id: string;
          sender_type: "user" | "driver";
          message_type?: "text" | "image";
          content?: string | null;
          image_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          sender_id?: string;
          sender_type?: "user" | "driver";
          message_type?: "text" | "image";
          content?: string | null;
          image_url?: string | null;
          created_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string | null;
          title: string;
          content: string;
          image_url: string | null;
          type: string;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          title: string;
          content: string;
          image_url?: string | null;
          type?: string;
          is_read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          title?: string;
          content?: string;
          image_url?: string | null;
          type?: string;
          is_read?: boolean;
          created_at?: string;
        };
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          food_id: string;
          quantity: number;
          unit_price: number;
          options_snapshot: Json;
        };
        Insert: {
          id?: string;
          order_id: string;
          food_id: string;
          quantity?: number;
          unit_price: number;
          options_snapshot?: Json;
        };
        Update: {
          id?: string;
          order_id?: string;
          food_id?: string;
          quantity?: number;
          unit_price?: number;
          options_snapshot?: Json;
        };
      };
      orders: {
        Row: {
          id: string;
          user_id: string;
          restaurant_id: string;
          driver_id: string | null;
          status: string;
          subtotal: number;
          delivery_fee: number;
          voucher_id: string | null;
          discount_amount: number;
          total: number;
          payment_method: string;
          delivery_address: string;
          latitude: number | null;
          longitude: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          restaurant_id: string;
          driver_id?: string | null;
          status?: string;
          subtotal: number;
          delivery_fee?: number;
          voucher_id?: string | null;
          discount_amount?: number;
          total: number;
          payment_method?: string;
          delivery_address: string;
          latitude?: number | null;
          longitude?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          restaurant_id?: string;
          driver_id?: string | null;
          status?: string;
          subtotal?: number;
          delivery_fee?: number;
          voucher_id?: string | null;
          discount_amount?: number;
          total?: number;
          payment_method?: string;
          delivery_address?: string;
          latitude?: number | null;
          longitude?: number | null;
          created_at?: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          full_name: string;
          phone: string | null;
          avatar_url: string | null;
          role: "user" | "driver" | "merchant";
          loyalty_points: number;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          phone?: string | null;
          avatar_url?: string | null;
          role?: "user" | "driver" | "merchant";
          loyalty_points?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          phone?: string | null;
          avatar_url?: string | null;
          role?: "user" | "driver" | "merchant";
          loyalty_points?: number;
          created_at?: string;
        };
      };
      restaurants: {
        Row: {
          id: string;
          name: string;
          address: string;
          latitude: number | null;
          longitude: number | null;
          rating: number;
          image_url: string | null;
          is_active: boolean;
          is_open: boolean;
          opening_hours: string;
          price_range: string;
          promo_tags: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          address: string;
          latitude?: number | null;
          longitude?: number | null;
          rating?: number;
          image_url?: string | null;
          is_active?: boolean;
          is_open?: boolean;
          opening_hours?: string;
          price_range?: string;
          promo_tags?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          address?: string;
          latitude?: number | null;
          longitude?: number | null;
          rating?: number;
          image_url?: string | null;
          is_active?: boolean;
          is_open?: boolean;
          opening_hours?: string;
          price_range?: string;
          promo_tags?: Json;
          created_at?: string;
        };
      };
      reviews: {
        Row: {
          id: string;
          order_id: string;
          user_id: string;
          restaurant_rating: number | null;
          restaurant_feedback: string | null;
          driver_rating: number | null;
          driver_tags: Json;
          driver_feedback: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          user_id: string;
          restaurant_rating?: number | null;
          restaurant_feedback?: string | null;
          driver_rating?: number | null;
          driver_tags?: Json;
          driver_feedback?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          user_id?: string;
          restaurant_rating?: number | null;
          restaurant_feedback?: string | null;
          driver_rating?: number | null;
          driver_tags?: Json;
          driver_feedback?: string | null;
          created_at?: string;
        };
      };
      user_addresses: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          address: string;
          latitude: number | null;
          longitude: number | null;
          is_default: boolean;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          address: string;
          latitude?: number | null;
          longitude?: number | null;
          is_default?: boolean;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          address?: string;
          latitude?: number | null;
          longitude?: number | null;
          is_default?: boolean;
        };
      };
      vouchers: {
        Row: {
          id: string;
          restaurant_id: string | null;
          code: string;
          discount_type: string;
          discount_value: number;
          min_order_value: number;
          expiry_date: string | null;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          restaurant_id?: string | null;
          code: string;
          discount_type: string;
          discount_value: number;
          min_order_value?: number;
          expiry_date?: string | null;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          restaurant_id?: string | null;
          code?: string;
          discount_type?: string;
          discount_value?: number;
          min_order_value?: number;
          expiry_date?: string | null;
          is_active?: boolean;
        };
      };
    };
  };
}
