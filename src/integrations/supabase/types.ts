export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.5" };
  public: {
    Tables: {
      branches: {
        Row: { id: string; name: string; created_at: string };
        Insert: { id?: string; name: string; created_at?: string };
        Update: { id?: string; name?: string; created_at?: string };
        Relationships: [];
      };
      products: {
        Row: {
          id: string; branch_id: string | null; name: string; unit: string;
          product_name: string | null; sub_product: string | null;
          product_code: string | null; code: string | null;
          active: boolean; materials: Json; created_at: string;
        };
        Insert: {
          id?: string; branch_id?: string | null; name: string; unit?: string;
          product_name?: string | null; sub_product?: string | null;
          product_code?: string | null; code?: string | null;
          active?: boolean; materials?: Json; created_at?: string;
        };
        Update: {
          id?: string; branch_id?: string | null; name?: string; unit?: string;
          product_name?: string | null; sub_product?: string | null;
          product_code?: string | null; code?: string | null;
          active?: boolean; materials?: Json; created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "products_branch_id_fkey"; columns: ["branch_id"]; referencedRelation: "branches"; referencedColumns: ["id"] },
        ];
      };
      sub_products: {
        Row: { id: string; product_id: string; name: string; code: string | null; materials: Json; created_at: string };
        Insert: { id?: string; product_id: string; name: string; code?: string | null; materials?: Json; created_at?: string };
        Update: { id?: string; product_id?: string; name?: string; code?: string | null; materials?: Json; created_at?: string };
        Relationships: [
          { foreignKeyName: "sub_products_product_id_fkey"; columns: ["product_id"]; referencedRelation: "products"; referencedColumns: ["id"] },
        ];
      };
      production_entries: {
        Row: {
          id: string; branch_id: string | null; product_id: string;
          entry_date: string; target_qty: number; completed_qty: number;
          manpower: number | null; notes: string | null;
          created_by: string | null; created_at: string; updated_at: string;
          delay_reason: string | null;
        };
        Insert: {
          id?: string; branch_id?: string | null; product_id: string;
          entry_date?: string; target_qty?: number; completed_qty?: number;
          manpower?: number | null; notes?: string | null;
          created_by?: string | null; created_at?: string; updated_at?: string;
          delay_reason?: string | null;
        };
        Update: {
          id?: string; branch_id?: string | null; product_id?: string;
          entry_date?: string; target_qty?: number; completed_qty?: number;
          manpower?: number | null; notes?: string | null;
          created_by?: string | null; created_at?: string; updated_at?: string;
          delay_reason?: string | null;
        };
        Relationships: [
          { foreignKeyName: "production_entries_branch_id_fkey"; columns: ["branch_id"]; referencedRelation: "branches"; referencedColumns: ["id"] },
          { foreignKeyName: "production_entries_product_id_fkey"; columns: ["product_id"]; referencedRelation: "products"; referencedColumns: ["id"] },
          { foreignKeyName: "production_entries_created_by_fkey"; columns: ["created_by"]; referencedRelation: "users"; referencedColumns: ["id"] },
        ];
      };
      profiles: {
        Row: { id: string; display_name: string | null; avatar_url: string | null; created_at: string; updated_at: string };
        Insert: { id: string; display_name?: string | null; avatar_url?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; display_name?: string | null; avatar_url?: string | null; created_at?: string; updated_at?: string };
        Relationships: [
          { foreignKeyName: "profiles_id_fkey"; columns: ["id"]; referencedRelation: "users"; referencedColumns: ["id"] },
        ];
      };
      monthly_targets: {
        Row: {
          id: string; branch_id: string | null; product_id: string;
          sub_product_id: string | null; year: number; month: number;
          target_qty: number; created_by: string | null;
          created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; branch_id?: string | null; product_id: string;
          sub_product_id?: string | null; year: number; month: number;
          target_qty?: number; created_by?: string | null;
          created_at?: string; updated_at?: string;
        };
        Update: {
          id?: string; branch_id?: string | null; product_id?: string;
          sub_product_id?: string | null; year?: number; month?: number;
          target_qty?: number; created_by?: string | null;
          created_at?: string; updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "monthly_targets_branch_id_fkey"; columns: ["branch_id"]; referencedRelation: "branches"; referencedColumns: ["id"] },
          { foreignKeyName: "monthly_targets_product_id_fkey"; columns: ["product_id"]; referencedRelation: "products"; referencedColumns: ["id"] },
          { foreignKeyName: "monthly_targets_sub_product_id_fkey"; columns: ["sub_product_id"]; referencedRelation: "sub_products"; referencedColumns: ["id"] },
        ];
      };
      smtp_config: {
        Row: {
          user_id: string; smtp_email: string; smtp_password: string;
          smtp_host: string; smtp_port: number; smtp_secure: boolean;
          created_at: string; updated_at: string;
        };
        Insert: {
          user_id: string; smtp_email: string; smtp_password: string;
          smtp_host?: string; smtp_port?: number; smtp_secure?: boolean;
          created_at?: string; updated_at?: string;
        };
        Update: {
          user_id?: string; smtp_email?: string; smtp_password?: string;
          smtp_host?: string; smtp_port?: number; smtp_secure?: boolean;
          created_at?: string; updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "smtp_config_user_id_fkey"; columns: ["user_id"]; referencedRelation: "users"; referencedColumns: ["id"] },
        ];
      };
      users: {
        Row: { id: string; name: string | null; role: string; created_at: string; updated_at: string; email: string | null };
        Insert: { id: string; name?: string | null; role?: string; created_at?: string; updated_at?: string; email?: string | null };
        Update: { id?: string; name?: string | null; role?: string; created_at?: string; updated_at?: string; email?: string | null };
        Relationships: [
          { foreignKeyName: "users_id_fkey"; columns: ["id"]; referencedRelation: "users"; referencedColumns: ["id"] },
        ];
      };
      activity_logs: {
        Row: {
          id: string; branch_id: string | null; product_id: string | null;
          action: string; description: string; user_id: string | null;
          user_name: string | null; metadata: Json | null; created_at: string | null;
        };
        Insert: {
          id?: string; branch_id?: string | null; product_id?: string | null;
          action: string; description: string; user_id?: string | null;
          user_name?: string | null; metadata?: Json | null; created_at?: string | null;
        };
        Update: {
          id?: string; branch_id?: string | null; product_id?: string | null;
          action?: string; description?: string; user_id?: string | null;
          user_name?: string | null; metadata?: Json | null; created_at?: string | null;
        };
        Relationships: [
          { foreignKeyName: "activity_logs_branch_id_fkey"; columns: ["branch_id"]; referencedRelation: "branches"; referencedColumns: ["id"] },
          { foreignKeyName: "activity_logs_product_id_fkey"; columns: ["product_id"]; referencedRelation: "products"; referencedColumns: ["id"] },
          { foreignKeyName: "activity_logs_user_id_fkey"; columns: ["user_id"]; referencedRelation: "users"; referencedColumns: ["id"] },
        ];
      };
      material_transfers: {
        Row: {
          id: string; source_branch_id: string | null; dest_branch_id: string | null;
          product_id: string | null; product_name: string | null;
          raw_material_id: string | null;
          quantity: number; status: string; notes: string | null;
          requested_by: string | null; completed_by: string | null;
          received_at: string | null; received_by: string | null;
          created_at: string | null; updated_at: string | null;
        };
        Insert: {
          id?: string; source_branch_id?: string | null; dest_branch_id?: string | null;
          product_id?: string | null; product_name?: string | null;
          raw_material_id?: string | null;
          quantity?: number; status?: string; notes?: string | null;
          requested_by?: string | null; completed_by?: string | null;
          received_at?: string | null; received_by?: string | null;
          created_at?: string | null; updated_at?: string | null;
        };
        Update: {
          id?: string; source_branch_id?: string | null; dest_branch_id?: string | null;
          product_id?: string | null; product_name?: string | null;
          raw_material_id?: string | null;
          quantity?: number; status?: string; notes?: string | null;
          requested_by?: string | null; completed_by?: string | null;
          received_at?: string | null; received_by?: string | null;
          created_at?: string | null; updated_at?: string | null;
        };
        Relationships: [
          { foreignKeyName: "material_transfers_source_branch_id_fkey"; columns: ["source_branch_id"]; referencedRelation: "branches"; referencedColumns: ["id"] },
          { foreignKeyName: "material_transfers_dest_branch_id_fkey"; columns: ["dest_branch_id"]; referencedRelation: "branches"; referencedColumns: ["id"] },
          { foreignKeyName: "material_transfers_product_id_fkey"; columns: ["product_id"]; referencedRelation: "products"; referencedColumns: ["id"] },
          { foreignKeyName: "material_transfers_raw_material_id_fkey"; columns: ["raw_material_id"]; referencedRelation: "raw_materials"; referencedColumns: ["id"] },
          { foreignKeyName: "material_transfers_requested_by_fkey"; columns: ["requested_by"]; referencedRelation: "users"; referencedColumns: ["id"] },
          { foreignKeyName: "material_transfers_completed_by_fkey"; columns: ["completed_by"]; referencedRelation: "users"; referencedColumns: ["id"] },
        ];
      };
      raw_materials: {
        Row: { id: string; name: string; unit: string; created_at: string };
        Insert: { id?: string; name: string; unit?: string; created_at?: string };
        Update: { id?: string; name?: string; unit?: string; created_at?: string };
        Relationships: [];
      };
      raw_inventory: {
        Row: { id: string; branch_id: string; raw_material_id: string; quantity: number; created_at: string; updated_at: string };
        Insert: { id?: string; branch_id: string; raw_material_id: string; quantity?: number; created_at?: string; updated_at?: string };
        Update: { id?: string; branch_id?: string; raw_material_id?: string; quantity?: number; created_at?: string; updated_at?: string };
        Relationships: [
          { foreignKeyName: "raw_inventory_branch_id_fkey"; columns: ["branch_id"]; referencedRelation: "branches"; referencedColumns: ["id"] },
          { foreignKeyName: "raw_inventory_raw_material_id_fkey"; columns: ["raw_material_id"]; referencedRelation: "raw_materials"; referencedColumns: ["id"] },
        ];
      };
      inventory: {
        Row: {
          id: string; branch_id: string | null; product_id: string | null;
          product_name: string | null; quantity: number; unit: string | null;
          updated_by: string | null; created_at: string | null; updated_at: string | null;
          plan_qty: number; actual_complete_qty: number;
        };
        Insert: {
          id?: string; branch_id?: string | null; product_id?: string | null;
          product_name?: string | null; quantity?: number; unit?: string | null;
          updated_by?: string | null; created_at?: string | null; updated_at?: string | null;
          plan_qty?: number; actual_complete_qty?: number;
        };
        Update: {
          id?: string; branch_id?: string | null; product_id?: string | null;
          product_name?: string | null; quantity?: number; unit?: string | null;
          updated_by?: string | null; created_at?: string | null; updated_at?: string | null;
          plan_qty?: number; actual_complete_qty?: number;
        };
        Relationships: [
          { foreignKeyName: "inventory_branch_id_fkey"; columns: ["branch_id"]; referencedRelation: "branches"; referencedColumns: ["id"] },
          { foreignKeyName: "inventory_product_id_fkey"; columns: ["product_id"]; referencedRelation: "products"; referencedColumns: ["id"] },
          { foreignKeyName: "inventory_updated_by_fkey"; columns: ["updated_by"]; referencedRelation: "users"; referencedColumns: ["id"] },
        ];
      };
      status_updates: {
        Row: {
          id: string; branch_id: string | null; product_id: string | null;
          message: string; update_type: string; user_id: string | null;
          user_name: string | null; created_at: string | null;
        };
        Insert: {
          id?: string; branch_id?: string | null; product_id?: string | null;
          message: string; update_type?: string; user_id?: string | null;
          user_name?: string | null; created_at?: string | null;
        };
        Update: {
          id?: string; branch_id?: string | null; product_id?: string | null;
          message?: string; update_type?: string; user_id?: string | null;
          user_name?: string | null; created_at?: string | null;
        };
        Relationships: [
          { foreignKeyName: "status_updates_branch_id_fkey"; columns: ["branch_id"]; referencedRelation: "branches"; referencedColumns: ["id"] },
          { foreignKeyName: "status_updates_product_id_fkey"; columns: ["product_id"]; referencedRelation: "products"; referencedColumns: ["id"] },
          { foreignKeyName: "status_updates_user_id_fkey"; columns: ["user_id"]; referencedRelation: "users"; referencedColumns: ["id"] },
        ];
      };
      edit_overrides: {
        Row: {
          id: string; user_id: string | null; granted_by: string | null;
          product_id: string | null; reason: string | null;
          expires_at: string; created_at: string | null;
        };
        Insert: {
          id?: string; user_id?: string | null; granted_by?: string | null;
          product_id?: string | null; reason?: string | null;
          expires_at: string; created_at?: string | null;
        };
        Update: {
          id?: string; user_id?: string | null; granted_by?: string | null;
          product_id?: string | null; reason?: string | null;
          expires_at?: string; created_at?: string | null;
        };
        Relationships: [
          { foreignKeyName: "edit_overrides_user_id_fkey"; columns: ["user_id"]; referencedRelation: "users"; referencedColumns: ["id"] },
          { foreignKeyName: "edit_overrides_granted_by_fkey"; columns: ["granted_by"]; referencedRelation: "users"; referencedColumns: ["id"] },
          { foreignKeyName: "edit_overrides_product_id_fkey"; columns: ["product_id"]; referencedRelation: "products"; referencedColumns: ["id"] },
        ];
      };
      accessories: {
        Row: { id: string; branch_id: string; name: string; code: string | null; unit: string; created_at: string };
        Insert: { id?: string; branch_id: string; name: string; code?: string | null; unit?: string; created_at?: string };
        Update: { id?: string; branch_id?: string; name?: string; code?: string | null; unit?: string; created_at?: string };
        Relationships: [
          { foreignKeyName: "accessories_branch_id_fkey"; columns: ["branch_id"]; referencedRelation: "branches"; referencedColumns: ["id"] },
        ];
      };
      accessory_inventory: {
        Row: {
          id: string; branch_id: string; accessory_id: string;
          plan_qty: number; actual_complete_qty: number; stock_qty: number;
          created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; branch_id: string; accessory_id: string;
          plan_qty?: number; actual_complete_qty?: number; stock_qty?: number;
          created_at?: string; updated_at?: string;
        };
        Update: {
          id?: string; branch_id?: string; accessory_id?: string;
          plan_qty?: number; actual_complete_qty?: number; stock_qty?: number;
          created_at?: string; updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "accessory_inventory_branch_id_fkey"; columns: ["branch_id"]; referencedRelation: "branches"; referencedColumns: ["id"] },
          { foreignKeyName: "accessory_inventory_accessory_id_fkey"; columns: ["accessory_id"]; referencedRelation: "accessories"; referencedColumns: ["id"] },
        ];
      };
      stock_entries: {
        Row: {
          id: string; branch_id: string; product_id: string | null;
          accessory_id: string | null; entry_date: string;
          plan_qty: number; actual_complete_qty: number; stock_qty: number;
          category: string; created_at: string; updated_at: string;
        };
        Insert: {
          id?: string; branch_id: string; product_id?: string | null;
          accessory_id?: string | null; entry_date?: string;
          plan_qty?: number; actual_complete_qty?: number; stock_qty?: number;
          category?: string; created_at?: string; updated_at?: string;
        };
        Update: {
          id?: string; branch_id?: string; product_id?: string | null;
          accessory_id?: string | null; entry_date?: string;
          plan_qty?: number; actual_complete_qty?: number; stock_qty?: number;
          category?: string; created_at?: string; updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "stock_entries_branch_id_fkey"; columns: ["branch_id"]; referencedRelation: "branches"; referencedColumns: ["id"] },
          { foreignKeyName: "stock_entries_product_id_fkey"; columns: ["product_id"]; referencedRelation: "products"; referencedColumns: ["id"] },
          { foreignKeyName: "stock_entries_accessory_id_fkey"; columns: ["accessory_id"]; referencedRelation: "accessories"; referencedColumns: ["id"] },
        ];
      };
      processed_invoices: {
        Row: {
          id: string; invoice_id: string; status: string;
          error_message: string | null; processed_at: string;
        };
        Insert: {
          id?: string; invoice_id: string; status?: string;
          error_message?: string | null; processed_at?: string;
        };
        Update: {
          id?: string; invoice_id?: string; status?: string;
          error_message?: string | null; processed_at?: string;
        };
        Relationships: [];
      };
      inventory_logs: {
        Row: {
          id: string; product_id: string | null; product_name: string | null;
          change_type: string; quantity_change: number;
          previous_stock: number; new_stock: number;
          reference_id: string | null; created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string; product_id?: string | null; product_name?: string | null;
          change_type: string; quantity_change: number;
          previous_stock: number; new_stock: number;
          reference_id?: string | null; created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string; product_id?: string | null; product_name?: string | null;
          change_type?: string; quantity_change?: number;
          previous_stock?: number; new_stock?: number;
          reference_id?: string | null; created_by?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "inventory_logs_product_id_fkey"; columns: ["product_id"]; referencedRelation: "products"; referencedColumns: ["id"] },
        ];
      };
      sales_entries: {
        Row: {
          id: string; branch_id: string; product_id: string;
          quantity: number; sale_date: string; reference_no: string | null;
          created_by: string | null; created_at: string;
          reversed_at: string | null; reversed_by: string | null;
        };
        Insert: {
          id?: string; branch_id: string; product_id: string;
          quantity: number; sale_date?: string; reference_no?: string | null;
          created_by?: string | null; created_at?: string;
          reversed_at?: string | null; reversed_by?: string | null;
        };
        Update: {
          id?: string; branch_id?: string; product_id?: string;
          quantity?: number; sale_date?: string; reference_no?: string | null;
          created_by?: string | null; created_at?: string;
          reversed_at?: string | null; reversed_by?: string | null;
        };
        Relationships: [
          { foreignKeyName: "sales_entries_branch_id_fkey"; columns: ["branch_id"]; referencedRelation: "branches"; referencedColumns: ["id"] },
          { foreignKeyName: "sales_entries_product_id_fkey"; columns: ["product_id"]; referencedRelation: "products"; referencedColumns: ["id"] },
        ];
      };
      stock_override_requests: {
        Row: {
          id: string; action_type: string; product_id: string | null;
          branch_id: string | null; requested_quantity: number;
          current_stock: number; params: any; requested_by: string | null;
          approved_by: string | null; status: string; reason: string | null;
          created_at: string; reviewed_at: string | null;
        };
        Insert: {
          id?: string; action_type: string; product_id?: string | null;
          branch_id?: string | null; requested_quantity: number;
          current_stock: number; params?: any; requested_by?: string | null;
          approved_by?: string | null; status?: string; reason?: string | null;
          created_at?: string; reviewed_at?: string | null;
        };
        Update: {
          id?: string; action_type?: string; product_id?: string | null;
          branch_id?: string | null; requested_quantity?: number;
          current_stock?: number; params?: any; requested_by?: string | null;
          approved_by?: string | null; status?: string; reason?: string | null;
          created_at?: string; reviewed_at?: string | null;
        };
        Relationships: [
          { foreignKeyName: "stock_override_requests_product_id_fkey"; columns: ["product_id"]; referencedRelation: "products"; referencedColumns: ["id"] },
          { foreignKeyName: "stock_override_requests_branch_id_fkey"; columns: ["branch_id"]; referencedRelation: "branches"; referencedColumns: ["id"] },
        ];
      };
      daily_inventory_snapshot: {
        Row: {
          id: string; branch_id: string; product_id: string;
          snapshot_date: string; opening_stock: number; closing_stock: number;
          created_at: string;
        };
        Insert: {
          id?: string; branch_id: string; product_id: string;
          snapshot_date?: string; opening_stock?: number; closing_stock?: number;
          created_at?: string;
        };
        Update: {
          id?: string; branch_id?: string; product_id?: string;
          snapshot_date?: string; opening_stock?: number; closing_stock?: number;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "daily_inventory_snapshot_branch_id_fkey"; columns: ["branch_id"]; referencedRelation: "branches"; referencedColumns: ["id"] },
          { foreignKeyName: "daily_inventory_snapshot_product_id_fkey"; columns: ["product_id"]; referencedRelation: "products"; referencedColumns: ["id"] },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      set_updated_at: { Args: Record<string, never>; Returns: "trigger" };
      is_manager: { Args: Record<string, never>; Returns: "boolean" };
      reduce_stock: {
        Args: { p_product_name: string; p_qty: number; p_change_type?: string; p_reference_id?: string | null; p_override_approved_by?: string | null };
        Returns: { matched: boolean; previous_stock: number; new_stock: number }[];
      };
      record_sale: {
        Args: { p_product_id: string; p_quantity: number; p_branch_id: string; p_sale_date?: string; p_reference_no?: string | null; p_override_approved_by?: string | null };
        Returns: { success: boolean; previous_stock: number; new_stock: number; override_id: string | null }[];
      };
      reverse_sale: {
        Args: { p_sale_id: string; p_reason?: string | null };
        Returns: { success: boolean; previous_stock: number; new_stock: number; reversed_sale_id: string }[];
      };
      send_raw_material: {
        Args: { p_raw_material_id: string; p_quantity: number; p_source_branch_id: string; p_dest_branch_id: string; p_notes?: string | null };
        Returns: { success: boolean; transfer_id: string; previous_stock: number; new_stock: number }[];
      };
      receive_raw_material: {
        Args: { p_transfer_id: string };
        Returns: { success: boolean; transfer_id: string; previous_stock: number; new_stock: number }[];
      };
      record_daily_snapshot: {
        Args: { p_snapshot_date?: string };
        Returns: number;
      };
      get_stock_forecast: {
        Args: { p_product_id: string; p_branch_id: string };
        Returns: { current_stock: number; avg_daily_sales: number; days_remaining: number | null }[];
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = { public: { Enums: {} } } as const;
