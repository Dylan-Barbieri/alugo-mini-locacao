export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      clientes: {
        Row: {
          id: string;
          nome: string;
          documento: string;
          email: string | null;
          telefone: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          nome: string;
          documento: string;
          email?: string | null;
          telefone?: string | null;
          created_at?: string;
        };
        Update: {
          nome?: string;
          documento?: string;
          email?: string | null;
          telefone?: string | null;
        };
        Relationships: [];
      };
      app_admins: {
        Row: { user_id: string; created_at: string };
        Insert: { user_id: string; created_at?: string };
        Update: { user_id?: string; created_at?: string };
        Relationships: [];
      };
      veiculos: {
        Row: {
          id: string;
          marca: string;
          placa: string;
          modelo: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          marca?: string;
          placa: string;
          modelo: string;
          status?: string;
          created_at?: string;
        };
        Update: { marca?: string; placa?: string; modelo?: string; status?: string };
        Relationships: [];
      };
      contratos: {
        Row: {
          id: string;
          cliente_id: string;
          veiculo_id: string;
          status: string;
          valor_semanal: string;
          quantidade_semanas: number;
          data_inicio: string;
          inicio_em: string;
          fim_em: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          cliente_id: string;
          veiculo_id: string;
          status?: string;
          valor_semanal: string;
          quantidade_semanas: number;
          data_inicio: string;
          inicio_em?: string;
          fim_em?: string | null;
          created_at?: string;
        };
        Update: {
          status?: string;
          valor_semanal?: string;
          quantidade_semanas?: number;
          data_inicio?: string;
          inicio_em?: string;
          fim_em?: string | null;
        };
        Relationships: [];
      };
      faturas: {
        Row: {
          id: string;
          contrato_id: string;
          numero_parcela: number;
          valor: string;
          data_vencimento: string;
          vencimento_em: string;
          status: string;
          pago_em: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          contrato_id: string;
          numero_parcela: number;
          valor: string;
          data_vencimento: string;
          vencimento_em: string;
          status?: string;
          pago_em?: string | null;
          created_at?: string;
        };
        Update: {
          numero_parcela?: number;
          status?: string;
          pago_em?: string | null;
          data_vencimento?: string;
          vencimento_em?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      liquidar_fatura: {
        Args: { p_fatura_id: string; p_valor_pago: string | number };
        Returns: Json;
      };
      is_admin: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: {
      contrato_status: 'rascunho' | 'ativo' | 'suspenso' | 'encerrado';
      fatura_status: 'aberta' | 'vencida' | 'paga' | 'cancelada';
      veiculo_status: 'disponivel' | 'locado' | 'manutencao' | 'inativo';
    };
    CompositeTypes: Record<string, never>;
  };
};
