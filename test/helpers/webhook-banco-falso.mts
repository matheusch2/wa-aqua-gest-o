/* Um PostgREST de mentira, só o suficiente para o webhook: guarda as
   linhas num Map e registra TUDO que foi escrito, para o teste conferir. */
export function bancoFalso(linhas: any[], planos: any[]) {
  const escritas: any[] = [];
  const leituras: any[] = [];
  const criar = (tabela: string) => {
    const dados = tabela === "planos" ? planos : linhas;
    const q: any = { _filtros: [] as [string, string][], _modo: "", _mudanca: null as any, _cols: "" };
    q.select = (cols: string) => { if (!q._modo) q._modo = "select"; q._cols = cols; return q; };
    q.update = (m: any) => { q._modo = "update"; q._mudanca = m; return q; };
    q.eq = (c: string, v: string) => { q._filtros.push([c, v]); return q; };
    const achar = () => dados.filter(r => q._filtros.every(([c, v]) => String(r[c]) === String(v)));
    const executar = (um: boolean) => {
      const achadas = achar();
      if (q._modo === "update") {
        escritas.push({ tabela, filtros: [...q._filtros], mudanca: q._mudanca, atingidas: achadas.length });
        achadas.forEach(r => Object.assign(r, q._mudanca));
        return { data: achadas.map(r => ({ user_id: r.user_id })), error: null };
      }
      leituras.push({ tabela, filtros: [...q._filtros], cols: q._cols });
      return um ? { data: achadas[0] ?? null, error: null } : { data: achadas, error: null };
    };
    q.maybeSingle = () => Promise.resolve(executar(true));
    q.then = (ok: any, falha: any) => Promise.resolve(executar(false)).then(ok, falha);
    return q;
  };
  return { cliente: { from: (t: string) => criar(t) }, escritas, leituras };
}
