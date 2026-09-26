export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "manager" | "staff";
export type OperationType = "RECEIPT" | "DELIVERY" | "TRANSFER" | "ADJUSTMENT";
export type OperationStatus = "DRAFT" | "WAITING" | "READY" | "DONE" | "CANCELED";
export type MovementType = "RECEIPT" | "DELIVERY" | "TRANSFER_IN" | "TRANSFER_OUT" | "ADJUSTMENT";

type Table<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        { id: string; display_name: string; email: string; role: UserRole; created_at: string; updated_at: string },
        { id: string; display_name: string; email: string; role?: UserRole; created_at?: string; updated_at?: string },
        { display_name?: string; email?: string; role?: UserRole; updated_at?: string }
      >;
      categories: Table<
        { id: string; name: string; created_at: string },
        { id?: string; name: string; created_at?: string },
        { name?: string }
      >;
      products: Table<
        { id: string; name: string; sku: string; category_id: string | null; unit_of_measure: string; reorder_level: number; unit_cost: number | null; is_active: boolean; created_by: string | null; created_at: string; updated_at: string },
        { id?: string; name: string; sku: string; category_id?: string | null; unit_of_measure?: string; reorder_level?: number; unit_cost?: number | null; is_active?: boolean; created_by?: string | null; created_at?: string; updated_at?: string },
        { name?: string; sku?: string; category_id?: string | null; unit_of_measure?: string; reorder_level?: number; unit_cost?: number | null; is_active?: boolean; updated_at?: string }
      >;
      warehouses: Table<
        { id: string; name: string; short_code: string; address: string | null; created_at: string; updated_at: string },
        { id?: string; name: string; short_code: string; address?: string | null; created_at?: string; updated_at?: string },
        { name?: string; short_code?: string; address?: string | null; updated_at?: string }
      >;
      locations: Table<
        { id: string; warehouse_id: string; name: string; short_code: string; created_at: string; updated_at: string },
        { id?: string; warehouse_id: string; name: string; short_code: string; created_at?: string; updated_at?: string },
        { warehouse_id?: string; name?: string; short_code?: string; updated_at?: string }
      >;
      operations: Table<
        { id: string; type: OperationType; reference: string; status: OperationStatus; scheduled_date: string; responsible_user_id: string | null; partner_name: string | null; source_location_id: string | null; destination_location_id: string | null; reason: string | null; validated_at: string | null; canceled_at: string | null; created_by: string | null; created_at: string; updated_at: string },
        { id?: string; type: OperationType; reference: string; status?: OperationStatus; scheduled_date?: string; responsible_user_id?: string | null; partner_name?: string | null; source_location_id?: string | null; destination_location_id?: string | null; reason?: string | null; validated_at?: string | null; canceled_at?: string | null; created_by?: string | null; created_at?: string; updated_at?: string },
        { status?: OperationStatus; scheduled_date?: string; responsible_user_id?: string | null; partner_name?: string | null; source_location_id?: string | null; destination_location_id?: string | null; reason?: string | null; validated_at?: string | null; canceled_at?: string | null; updated_at?: string }
      >;
      operation_lines: Table<
        { id: string; operation_id: string; product_id: string; quantity: number; line_number: number; created_at: string },
        { id?: string; operation_id: string; product_id: string; quantity: number; line_number?: number; created_at?: string },
        { operation_id?: string; product_id?: string; quantity?: number; line_number?: number }
      >;
      stock_balances: Table<
        { id: string; product_id: string; location_id: string; on_hand: number; updated_at: string },
        { id?: string; product_id: string; location_id: string; on_hand?: number; updated_at?: string },
        { on_hand?: number; updated_at?: string }
      >;
      stock_ledger: Table<
        { id: string; product_id: string; location_id: string; quantity_change: number; movement_type: MovementType; operation_id: string; operation_reference: string; user_id: string | null; created_at: string },
        { id?: string; product_id: string; location_id: string; quantity_change: number; movement_type: MovementType; operation_id: string; operation_reference: string; user_id?: string | null; created_at?: string },
        never
      >;
    };
    Views: {
      stock_with_free_to_use: {
        Row: { stock_balance_id: string; product_id: string; product_name: string; sku: string; unit_cost: number | null; unit_of_measure: string; reorder_level: number; category_id: string | null; category_name: string | null; location_id: string; location_name: string; location_short_code: string; warehouse_id: string; warehouse_name: string; warehouse_short_code: string; on_hand: number; free_to_use: number };
        Relationships: [];
      };
      move_history: {
        Row: { ledger_id: string; operation_id: string; reference: string; date: string; contact: string | null; product_id: string; product_name: string; product_sku: string; quantity_change: number; movement_type: MovementType; status: OperationStatus; operation_type: OperationType; from_location_id: string | null; from_location_name: string | null; to_location_id: string | null; to_location_name: string | null };
        Relationships: [];
      };
    };
    Functions: {
      generate_operation_reference: { Args: { p_type: OperationType; p_location_id: string }; Returns: string };
      create_operation: { Args: { p_type: OperationType; p_lines: Json; p_partner_name?: string | null; p_scheduled_date?: string; p_responsible_user_id?: string | null; p_source_location_id?: string | null; p_destination_location_id?: string | null; p_reason?: string | null }; Returns: Json };
      update_operation: { Args: { p_operation_id: string; p_lines?: Json | null; p_partner_name?: string | null; p_scheduled_date?: string | null; p_responsible_user_id?: string | null; p_source_location_id?: string | null; p_destination_location_id?: string | null; p_reason?: string | null }; Returns: Json };
      mark_operation_ready: { Args: { p_operation_id: string }; Returns: Json };
      cancel_operation: { Args: { p_operation_id: string }; Returns: Json };
      validate_operation: { Args: { p_operation_id: string }; Returns: Json };
      update_stock_from_count: { Args: { p_product_id: string; p_location_id: string; p_physical_count: number; p_reason?: string | null }; Returns: Json };
      get_dashboard_summary: { Args: Record<PropertyKey, never>; Returns: Json };
      get_product_stock: { Args: { p_product_id: string }; Returns: Json };
      create_product_with_initial_stock: { Args: { p_name: string; p_sku: string; p_category_id: string | null; p_unit_of_measure: string; p_reorder_level: number; p_unit_cost: number | null; p_location_id: string | null; p_initial_stock: number }; Returns: Json };
    };
    Enums: {
      user_role: UserRole;
      operation_type: OperationType;
      operation_status: OperationStatus;
      movement_type: MovementType;
    };
    CompositeTypes: Record<string, never>;
  };
};
