import { useMemo, useState } from 'react';
import { CreditCard, Info, Search } from 'lucide-react';
import { StateMessage } from '@/components/shared/StateMessage';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useAsyncData } from '@/hooks/useAsyncData';
import { listFaturas, simulatePayment, type Fatura } from '@/services/adminData';
import { cn } from '@/utils/cn';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  invoicePresentationStatus,
} from '@/utils/format';

export function FaturasPage() {
  const { data, isLoading, error, reload } = useAsyncData(listFaturas, []);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('todas');
  const [selected, setSelected] = useState<Fatura | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<'success' | 'error' | 'info'>('info');
  const [isPaying, setIsPaying] = useState<string | null>(null);

  const faturas = useMemo(() => {
    return (data ?? [])
      .filter((fatura) => {
        const presentation = invoicePresentationStatus(fatura.status, fatura.data_vencimento);
        const matchesStatus = status === 'todas' || presentation === status;
        const target = `${fatura.id} ${fatura.contratos?.clientes?.nome ?? ''}`.toLowerCase();
        return matchesStatus && target.includes(search.toLowerCase());
      })
      .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento));
  }, [data, search, status]);

  async function handleSimulate(fatura: Fatura) {
    const confirmed = window.confirm(
      `Simular pagamento Pix da fatura ${fatura.id.slice(0, 8)} no valor de ${formatCurrency(fatura.valor)}?`,
    );
    if (!confirmed) return;
    setFeedback(null);
    setFeedbackTone('info');
    setIsPaying(fatura.id);
    try {
      const result = await simulatePayment(fatura.id);
      if (result.webhook?.error) {
        throw new Error(paymentErrorMessage(result.webhook.error));
      }
      setFeedbackTone('success');
      setFeedback(
        result.webhook?.status === 'already_paid'
          ? 'Pagamento já havia sido processado.'
          : 'Pagamento simulado processado com sucesso.',
      );
      await reload();
    } catch (payError) {
      setFeedbackTone('error');
      setFeedback(
        payError instanceof Error
          ? paymentErrorMessage(payError.message)
          : 'Erro ao simular pagamento.',
      );
    } finally {
      setIsPaying(null);
    }
  }

  if (isLoading)
    return (
      <StateMessage
        title="Carregando financeiro"
        description="Buscando faturas..."
        variant="loading"
      />
    );
  if (error)
    return <StateMessage title="Erro ao carregar financeiro" description={error} variant="error" />;

  return (
    <div className="space-y-6">
      <Card className="border-brand-100 bg-brand-50">
        <div className="flex gap-3 text-sm text-brand-800">
          <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <h2 className="font-bold">Pix simulado para demonstração</h2>
            <p className="mt-1 text-brand-700">
              Esta ação não movimenta dinheiro real. A simulação exige usuário administrador,
              confirmação na tela e flag operacional habilitada no backend. A liquidação acontece
              somente pela Edge Function segura e pela RPC financeira idempotente.
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-lg font-bold">Faturas e pagamentos</h2>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="flex items-center gap-2 rounded-2xl border border-sand-100 px-3 py-2 text-sm">
              <Search className="h-4 w-4 text-brand-700" />
              <input
                className="outline-none focus:text-brand-800"
                placeholder="Pesquisar"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <select
              className="rounded-2xl border border-sand-100 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="todas">Todas</option>
              <option value="pendente">Pendentes</option>
              <option value="paga">Pagas</option>
              <option value="atrasada">Atrasadas</option>
            </select>
          </div>
        </div>
        {feedback ? (
          <p
            className={cn(
              'mb-4 rounded-2xl p-3 text-sm font-medium',
              feedbackTone === 'success' && 'bg-emerald-50 text-emerald-700',
              feedbackTone === 'error' && 'bg-red-50 text-red-700',
              feedbackTone === 'info' && 'bg-brand-50 text-brand-700',
            )}
            role={feedbackTone === 'error' ? 'alert' : 'status'}
          >
            {feedback}
          </p>
        ) : null}
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-ink-700">
              <tr className="border-b border-sand-100">
                <th className="py-3">Código</th>
                <th>Cliente</th>
                <th>Contrato</th>
                <th>Vencimento</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Pagamento</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {faturas.map((fatura) => {
                const presentation = invoicePresentationStatus(
                  fatura.status,
                  fatura.data_vencimento,
                );
                const eligible = fatura.status === 'aberta';
                return (
                  <tr key={fatura.id} className="border-b border-sand-100 last:border-0">
                    <td className="py-3 font-mono text-xs">{fatura.id.slice(0, 8)}</td>
                    <td className="font-medium">{fatura.contratos?.clientes?.nome ?? '—'}</td>
                    <td className="font-mono text-xs">{fatura.contrato_id.slice(0, 8)}</td>
                    <td>{formatDate(fatura.data_vencimento)}</td>
                    <td>{formatCurrency(fatura.valor)}</td>
                    <td>
                      <StatusBadge
                        tone={
                          presentation === 'paga'
                            ? 'success'
                            : presentation === 'atrasada'
                              ? 'danger'
                              : 'warning'
                        }
                      >
                        {presentation}
                      </StatusBadge>
                    </td>
                    <td>{formatDateTime(fatura.pago_em)}</td>
                    <td className="space-x-3 whitespace-nowrap">
                      <button
                        className="font-semibold text-brand-700"
                        onClick={() => setSelected(fatura)}
                      >
                        Detalhes
                      </button>
                      {eligible ? (
                        <button
                          className="font-semibold text-brand-700 hover:text-brand-800 disabled:opacity-50"
                          disabled={isPaying === fatura.id}
                          aria-busy={isPaying === fatura.id}
                          title="Simula a liquidação Pix sem movimentação financeira real"
                          onClick={() => void handleSimulate(fatura)}
                        >
                          <CreditCard className="mr-1 inline h-4 w-4" />
                          {isPaying === fatura.id ? 'Processando' : 'Simular Pix'}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {selected ? (
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">Detalhes da fatura</h2>
              <p className="mt-2 text-sm text-ink-700">
                ID completo: <span className="font-mono">{selected.id}</span>
              </p>
              <p className="text-sm text-ink-700">
                Parcela {selected.numero_parcela} — contrato{' '}
                <span className="font-mono">{selected.contrato_id}</span>
              </p>
              <p className="text-sm text-ink-700">Pagamento: {formatDateTime(selected.pago_em)}</p>
            </div>
            <button
              className="rounded-full border border-sand-100 px-4 py-2 text-sm font-semibold hover:border-brand-100 hover:bg-brand-50 hover:text-brand-800"
              onClick={() => setSelected(null)}
            >
              Fechar
            </button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function paymentErrorMessage(error: string) {
  const messages: Record<string, string> = {
    simulation_disabled:
      'A simulação Pix está desabilitada neste ambiente. Solicite a ativação temporária para demonstração.',
    admin_required: 'Apenas administradores autorizados podem simular pagamentos.',
    missing_authentication: 'Sessão ausente. Faça login novamente para simular pagamentos.',
    invalid_session: 'Sessão inválida ou expirada. Faça login novamente.',
    invoice_not_found: 'Fatura não encontrada.',
    invalid_invoice_status: 'Esta fatura não pode ser liquidada no status atual.',
    amount_mismatch: 'O valor informado não corresponde ao valor da fatura.',
    internal_error: 'Erro interno ao processar a simulação. Tente novamente mais tarde.',
  };

  return messages[error] ?? error;
}
