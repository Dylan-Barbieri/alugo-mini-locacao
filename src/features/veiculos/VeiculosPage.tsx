import { useMemo, useState } from 'react';
import { Bike, Search } from 'lucide-react';
import { StateMessage } from '@/components/shared/StateMessage';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useAsyncData } from '@/hooks/useAsyncData';
import { listContratos, listVeiculos, saveVeiculo, type Veiculo } from '@/services/adminData';

const emptyVeiculo = { marca: 'Haojue', modelo: 'DK 160', placa: '', status: 'disponivel' };

export function VeiculosPage() {
  const { data, isLoading, error, reload } = useAsyncData(async () => {
    const [veiculos, contratos] = await Promise.all([listVeiculos(), listContratos()]);
    return { veiculos, contratos };
  }, []);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Veiculo | null>(null);
  const [form, setForm] = useState(emptyVeiculo);
  const [message, setMessage] = useState<string | null>(null);

  const activeVehicleIds = new Set(
    (data?.contratos ?? [])
      .filter((contrato) => contrato.status === 'ativo')
      .map((contrato) => contrato.veiculo_id),
  );
  const veiculos = useMemo(
    () =>
      (data?.veiculos ?? []).filter((veiculo) =>
        `${veiculo.placa} ${veiculo.marca} ${veiculo.modelo}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [data?.veiculos, search],
  );

  function startEdit(veiculo: Veiculo) {
    setEditing(veiculo);
    setForm({
      marca: veiculo.marca,
      modelo: veiculo.modelo,
      placa: veiculo.placa,
      status: veiculo.status,
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    if (editing && activeVehicleIds.has(editing.id) && form.status === 'disponivel') {
      setMessage('Veículo com contrato ativo não pode ser marcado como disponível.');
      return;
    }
    await saveVeiculo({ ...form, placa: form.placa.toUpperCase() }, editing?.id);
    setForm(emptyVeiculo);
    setEditing(null);
    setMessage('Veículo salvo com sucesso.');
    await reload();
  }

  if (isLoading)
    return (
      <StateMessage title="Carregando veículos" description="Buscando frota..." variant="loading" />
    );
  if (error)
    return <StateMessage title="Erro ao carregar veículos" description={error} variant="error" />;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <Card>
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-bold">Motocicletas</h2>
          <label className="flex items-center gap-2 rounded-2xl border border-sand-100 px-3 py-2 text-sm">
            <Search className="h-4 w-4 text-ink-700" />
            <input
              className="outline-none"
              placeholder="Pesquisar"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-ink-700">
              <tr className="border-b border-sand-100">
                <th className="py-3">Moto</th>
                <th>Placa</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {veiculos.map((veiculo) => (
                <tr key={veiculo.id} className="border-b border-sand-100 last:border-0">
                  <td className="py-3 font-medium">
                    {veiculo.marca} {veiculo.modelo}
                  </td>
                  <td>{veiculo.placa}</td>
                  <td>
                    <StatusBadge
                      tone={
                        veiculo.status === 'disponivel'
                          ? 'success'
                          : veiculo.status === 'locado'
                            ? 'warning'
                            : 'neutral'
                      }
                    >
                      {veiculo.status}
                    </StatusBadge>
                  </td>
                  <td>
                    <button
                      className="font-semibold text-brand-700"
                      onClick={() => startEdit(veiculo)}
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Bike className="h-5 w-5" />
          {editing ? 'Editar veículo' : 'Novo veículo'}
        </h2>
        <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
          <label className="block text-sm font-semibold">
            Marca
            <input
              className="mt-1 w-full rounded-2xl border border-sand-100 px-4 py-3"
              value={form.marca}
              onChange={(e) => setForm({ ...form, marca: e.target.value })}
              required
            />
          </label>
          <label className="block text-sm font-semibold">
            Modelo
            <input
              className="mt-1 w-full rounded-2xl border border-sand-100 px-4 py-3"
              value={form.modelo}
              onChange={(e) => setForm({ ...form, modelo: e.target.value })}
              required
            />
          </label>
          <label className="block text-sm font-semibold">
            Placa
            <input
              className="mt-1 w-full rounded-2xl border border-sand-100 px-4 py-3 uppercase"
              value={form.placa}
              onChange={(e) => setForm({ ...form, placa: e.target.value })}
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
              <option value="disponivel">Disponível</option>
              <option value="locado">Locado</option>
              <option value="manutencao">Manutenção</option>
              <option value="inativo">Inativo</option>
            </select>
          </label>
          {message ? (
            <p className="rounded-2xl bg-brand-50 p-3 text-sm text-brand-700">{message}</p>
          ) : null}
          <button
            className="w-full rounded-full bg-ink-900 px-5 py-3 text-sm font-bold text-white"
            type="submit"
          >
            Salvar veículo
          </button>
        </form>
      </Card>
    </div>
  );
}
