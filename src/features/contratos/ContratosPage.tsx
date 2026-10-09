import { useState } from 'react';
import { FilePlus2 } from 'lucide-react';
import { StateMessage } from '@/components/shared/StateMessage';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useAsyncData } from '@/hooks/useAsyncData';
import {
  createContrato,
  listClientes,
  listContratos,
  listFaturasByContrato,
  listVeiculos,
  type Fatura,
} from '@/services/adminData';
import { formatCurrency, formatDate } from '@/utils/format';

export function ContratosPage() {
  const { data, isLoading, error, reload } = useAsyncData(async () => {
    const [contratos, clientes, veiculos] = await Promise.all([
      listContratos(),
      listClientes(),
      listVeiculos(),
    ]);
    return { contratos, clientes, veiculos };
  }, []);
  const [form, setForm] = useState({
    cliente_id: '',
    veiculo_id: '',
    valor_semanal: '400.00',
    quantidade_semanas: 4,
    data_inicio: '',
    status: 'ativo',
  });
  const [generated, setGenerated] = useState<Fatura[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const contrato = await createContrato(form);
    const faturas = await listFaturasByContrato(contrato.id);
    setGenerated(faturas);
    setMessage('Contrato criado. As faturas foram geradas pelo PostgreSQL.');
    await reload();
  }

  if (isLoading)
    return (
      <StateMessage
        title="Carregando contratos"
        description="Buscando dados..."
        variant="loading"
      />
    );
  if (error)
    return <StateMessage title="Erro ao carregar contratos" description={error} variant="error" />;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card>
          <h2 className="text-lg font-bold">Contratos</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-ink-700">
                <tr className="border-b border-sand-100">
                  <th className="py-3">Cliente</th>
                  <th>Moto</th>
                  <th>Início</th>
                  <th>Semanas</th>
                  <th>Valor</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(data?.contratos ?? []).map((contrato) => (
                  <tr key={contrato.id} className="border-b border-sand-100 last:border-0">
                    <td className="py-3 font-medium">{contrato.clientes?.nome ?? '—'}</td>
                    <td>{contrato.veiculos?.placa ?? '—'}</td>
                    <td>{formatDate(contrato.data_inicio)}</td>
                    <td>{contrato.quantidade_semanas}</td>
                    <td>{formatCurrency(contrato.valor_semanal)}</td>
                    <td>
                      <StatusBadge tone={contrato.status === 'ativo' ? 'success' : 'neutral'}>
                        {contrato.status}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <FilePlus2 className="h-5 w-5" />
            Novo contrato
          </h2>
          <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
            <label className="block text-sm font-semibold">
              Cliente
              <select
                className="mt-1 w-full rounded-2xl border border-sand-100 px-4 py-3"
                value={form.cliente_id}
                onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}
                required
              >
                <option value="">Selecione</option>
                {data?.clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold">
              Motocicleta
              <select
                className="mt-1 w-full rounded-2xl border border-sand-100 px-4 py-3"
                value={form.veiculo_id}
                onChange={(e) => setForm({ ...form, veiculo_id: e.target.value })}
                required
              >
                <option value="">Selecione</option>
                {data?.veiculos.map((veiculo) => (
                  <option key={veiculo.id} value={veiculo.id}>
                    {veiculo.placa} — {veiculo.modelo}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold">
              Valor semanal
              <input
                className="mt-1 w-full rounded-2xl border border-sand-100 px-4 py-3"
                value={form.valor_semanal}
                onChange={(e) => setForm({ ...form, valor_semanal: e.target.value })}
                required
              />
            </label>
            <label className="block text-sm font-semibold">
              Quantidade de semanas
              <input
                className="mt-1 w-full rounded-2xl border border-sand-100 px-4 py-3"
                type="number"
                min="1"
                value={form.quantidade_semanas}
                onChange={(e) => setForm({ ...form, quantidade_semanas: Number(e.target.value) })}
                required
              />
            </label>
            <label className="block text-sm font-semibold">
              Data de início
              <input
                className="mt-1 w-full rounded-2xl border border-sand-100 px-4 py-3"
                type="date"
                value={form.data_inicio}
                onChange={(e) => setForm({ ...form, data_inicio: e.target.value })}
                required
              />
            </label>
            <label className="block text-sm font-semibold">
              Status
              <select
                className="mt-1 w-full rounded-2xl border border-sand-100 px-4 py-3"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="ativo">Ativo</option>
                <option value="rascunho">Rascunho</option>
                <option value="suspenso">Suspenso</option>
                <option value="encerrado">Encerrado</option>
              </select>
            </label>
            {message ? (
              <p className="rounded-2xl bg-brand-50 p-3 text-sm text-brand-700">{message}</p>
            ) : null}
            <button
              className="w-full rounded-full bg-ink-900 px-5 py-3 text-sm font-bold text-white"
              type="submit"
            >
              Criar contrato
            </button>
          </form>
        </Card>
      </div>

      {generated.length ? (
        <Card>
          <h2 className="text-lg font-bold">Parcelas geradas</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {generated.map((fatura) => (
              <div key={fatura.id} className="rounded-2xl border border-sand-100 p-4">
                <p className="text-sm text-ink-700">Parcela {fatura.numero_parcela}</p>
                <strong>{formatCurrency(fatura.valor)}</strong>
                <p className="text-sm">Vence em {formatDate(fatura.data_vencimento)}</p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
