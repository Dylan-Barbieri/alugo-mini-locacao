import { CheckCircle2, Clock, FileText, ReceiptText, TrendingUp, Wallet } from 'lucide-react';
import { StateMessage } from '@/components/shared/StateMessage';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useAsyncData } from '@/hooks/useAsyncData';
import { listContratos, listFaturas } from '@/services/adminData';
import { formatCurrency, formatDate, invoicePresentationStatus } from '@/utils/format';

export function DashboardPage() {
  const { data, isLoading, error } = useAsyncData(async () => {
    const [contratos, faturas] = await Promise.all([listContratos(), listFaturas()]);
    return { contratos, faturas };
  }, []);

  if (isLoading)
    return (
      <StateMessage
        title="Carregando dashboard"
        description="Buscando dados reais no Supabase..."
        variant="loading"
      />
    );
  if (error)
    return <StateMessage title="Erro ao carregar dashboard" description={error} variant="error" />;

  const contratosAtivos =
    data?.contratos.filter((contrato) => contrato.status === 'ativo').length ?? 0;
  const faturas = data?.faturas ?? [];
  const pagas = faturas.filter((fatura) => fatura.status === 'paga');
  const pendentes = faturas.filter(
    (fatura) => invoicePresentationStatus(fatura.status, fatura.data_vencimento) === 'pendente',
  );
  const atrasadas = faturas.filter(
    (fatura) => invoicePresentationStatus(fatura.status, fatura.data_vencimento) === 'atrasada',
  );
  const recebido = pagas.reduce((total, fatura) => total + Number(fatura.valor), 0);
  const pendente = [...pendentes, ...atrasadas].reduce(
    (total, fatura) => total + Number(fatura.valor),
    0,
  );

  const metrics = [
    { label: 'Contratos ativos', value: contratosAtivos, icon: FileText },
    { label: 'Faturas pendentes', value: pendentes.length, icon: Clock },
    { label: 'Faturas pagas', value: pagas.length, icon: CheckCircle2 },
    { label: 'Faturas atrasadas', value: atrasadas.length, icon: ReceiptText },
    { label: 'Total recebido', value: formatCurrency(recebido), icon: TrendingUp },
    { label: 'Total pendente', value: formatCurrency(pendente), icon: Wallet },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.label}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-ink-700">{metric.label}</p>
                  <strong className="mt-2 block text-2xl">{metric.value}</strong>
                </div>
                <div className="rounded-2xl bg-brand-50 p-3 text-brand-700">
                  <Icon className="h-6 w-6" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card>
        <h2 className="text-lg font-bold">Faturas recentes</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-ink-700">
              <tr className="border-b border-sand-100">
                <th className="py-3">Cliente</th>
                <th>Vencimento</th>
                <th>Valor</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {faturas.slice(0, 6).map((fatura) => {
                const status = invoicePresentationStatus(fatura.status, fatura.data_vencimento);
                return (
                  <tr key={fatura.id} className="border-b border-sand-100 last:border-0">
                    <td className="py-3 font-medium">{fatura.contratos?.clientes?.nome ?? '—'}</td>
                    <td>{formatDate(fatura.data_vencimento)}</td>
                    <td>{formatCurrency(fatura.valor)}</td>
                    <td>
                      <StatusBadge
                        tone={
                          status === 'paga'
                            ? 'success'
                            : status === 'atrasada'
                              ? 'danger'
                              : 'warning'
                        }
                      >
                        {status}
                      </StatusBadge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
