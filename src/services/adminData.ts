import { supabase } from '@/lib/supabase/client';

/* eslint-disable @typescript-eslint/no-explicit-any */

export type Cliente = {
  id: string;
  nome: string;
  documento: string;
  email: string | null;
  telefone: string | null;
  created_at: string;
};

export type Veiculo = {
  id: string;
  marca: string;
  modelo: string;
  placa: string;
  status: string;
  created_at: string;
};

export type Contrato = {
  id: string;
  cliente_id: string;
  veiculo_id: string;
  valor_semanal: string;
  quantidade_semanas: number;
  data_inicio: string;
  status: string;
  created_at: string;
  clientes?: Pick<Cliente, 'id' | 'nome'> | null;
  veiculos?: Pick<Veiculo, 'id' | 'placa' | 'modelo' | 'marca'> | null;
};

export type Fatura = {
  id: string;
  contrato_id: string;
  numero_parcela: number;
  valor: string;
  data_vencimento: string;
  status: string;
  pago_em: string | null;
  created_at: string;
  contratos?: {
    id: string;
    clientes?: Pick<Cliente, 'id' | 'nome'> | null;
  } | null;
};

function client() {
  if (!supabase) throw new Error('Supabase não configurado.');
  return supabase as any;
}

export async function listClientes() {
  const { data, error } = await client().from('clientes').select('*').order('nome');
  if (error) throw error;
  return data as Cliente[];
}

export async function saveCliente(
  input: Pick<Cliente, 'nome' | 'documento' | 'email' | 'telefone'>,
  id?: string,
) {
  const payload = { ...input, email: input.email || null, telefone: input.telefone || null };
  const query = id
    ? client().from('clientes').update(payload).eq('id', id).select().single()
    : client().from('clientes').insert(payload).select().single();
  const { data, error } = await query;
  if (error) throw error;
  return data as Cliente;
}

export async function listVeiculos() {
  const { data, error } = await client().from('veiculos').select('*').order('placa');
  if (error) throw error;
  return data as Veiculo[];
}

export async function saveVeiculo(
  input: Pick<Veiculo, 'marca' | 'modelo' | 'placa' | 'status'>,
  id?: string,
) {
  const query = id
    ? client().from('veiculos').update(input).eq('id', id).select().single()
    : client().from('veiculos').insert(input).select().single();
  const { data, error } = await query;
  if (error) throw error;
  return data as Veiculo;
}

export async function listContratos() {
  const { data, error } = await client()
    .from('contratos')
    .select('*, clientes(id,nome), veiculos(id,marca,modelo,placa)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as unknown as Contrato[];
}

export async function createContrato(input: {
  cliente_id: string;
  veiculo_id: string;
  valor_semanal: string;
  quantidade_semanas: number;
  data_inicio: string;
  status: string;
}) {
  const { data, error } = await client()
    .from('contratos')
    .insert({ ...input, inicio_em: input.data_inicio })
    .select('*, clientes(id,nome), veiculos(id,marca,modelo,placa)')
    .single();
  if (error) throw error;
  return data as unknown as Contrato;
}

export async function listFaturas() {
  const { data, error } = await client()
    .from('faturas')
    .select('*, contratos(id, clientes(id,nome))')
    .order('data_vencimento', { ascending: true });
  if (error) throw error;
  return data as unknown as Fatura[];
}

export async function listFaturasByContrato(contratoId: string) {
  const { data, error } = await client()
    .from('faturas')
    .select('*')
    .eq('contrato_id', contratoId)
    .order('numero_parcela');
  if (error) throw error;
  return data as Fatura[];
}

export async function simulatePayment(faturaId: string) {
  const { data, error } = await client().functions.invoke('simulate-payment', {
    body: { fatura_id: faturaId },
  });
  if (error) {
    const context = (error as { context?: { json?: () => Promise<unknown> } }).context;
    const body = await context?.json?.().catch(() => null);
    const backendError =
      body && typeof body === 'object' && 'error' in body
        ? String((body as { error: unknown }).error)
        : error.message;
    throw new Error(backendError);
  }
  return data as { ok: boolean; webhook?: { status?: string; error?: string } };
}
