import { useMemo, useState } from 'react';
import { Search, UserPlus } from 'lucide-react';
import { StateMessage } from '@/components/shared/StateMessage';
import { Card } from '@/components/ui/Card';
import { useAsyncData } from '@/hooks/useAsyncData';
import { type Cliente, listClientes, saveCliente } from '@/services/adminData';

const emptyCliente = { nome: '', documento: '', email: '', telefone: '' };

export function ClientesPage() {
  const { data, isLoading, error, reload } = useAsyncData(listClientes, []);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [form, setForm] = useState(emptyCliente);
  const [message, setMessage] = useState<string | null>(null);

  const clientes = useMemo(
    () =>
      (data ?? []).filter((cliente) => cliente.nome.toLowerCase().includes(search.toLowerCase())),
    [data, search],
  );

  function startEdit(cliente: Cliente) {
    setEditing(cliente);
    setForm({
      nome: cliente.nome,
      documento: cliente.documento,
      email: cliente.email ?? '',
      telefone: cliente.telefone ?? '',
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    await saveCliente(form, editing?.id);
    setForm(emptyCliente);
    setEditing(null);
    setMessage('Cliente salvo com sucesso.');
    await reload();
  }

  if (isLoading)
    return (
      <StateMessage
        title="Carregando clientes"
        description="Buscando cadastros..."
        variant="loading"
      />
    );
  if (error)
    return <StateMessage title="Erro ao carregar clientes" description={error} variant="error" />;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <Card>
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-bold">Clientes cadastrados</h2>
          <label className="flex items-center gap-2 rounded-2xl border border-sand-100 px-3 py-2 text-sm">
            <Search className="h-4 w-4 text-brand-700" />
            <input
              className="outline-none focus:text-brand-800"
              placeholder="Pesquisar por nome"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase text-ink-700">
              <tr className="border-b border-sand-100">
                <th className="py-3">Nome</th>
                <th>Documento</th>
                <th>E-mail</th>
                <th>Telefone</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((cliente) => (
                <tr key={cliente.id} className="border-b border-sand-100 last:border-0">
                  <td className="py-3 font-medium">{cliente.nome}</td>
                  <td>{cliente.documento}</td>
                  <td>{cliente.email ?? '—'}</td>
                  <td>{cliente.telefone ?? '—'}</td>
                  <td>
                    <button
                      className="font-semibold text-brand-700"
                      onClick={() => startEdit(cliente)}
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
          <UserPlus className="h-5 w-5 text-brand-700" />
          {editing ? 'Editar cliente' : 'Novo cliente'}
        </h2>
        <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
          {(['nome', 'documento', 'email', 'telefone'] as const).map((field) => (
            <label key={field} className="block text-sm font-semibold capitalize text-ink-800">
              {field}
              <input
                className="mt-1 w-full rounded-2xl border border-sand-100 px-4 py-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                value={form[field]}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                required={field === 'nome' || field === 'documento'}
              />
            </label>
          ))}
          {message ? (
            <p className="rounded-2xl bg-brand-50 p-3 text-sm text-brand-700">{message}</p>
          ) : null}
          <button
            className="w-full rounded-full bg-brand-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-800"
            type="submit"
          >
            Salvar cliente
          </button>
        </form>
      </Card>
    </div>
  );
}
