/* Um PostgREST de mentira, só o suficiente para o webhook: guarda as
   linhas num Map e registra TUDO que foi escrito, para o teste conferir. */
export function bancoFalso(linhas: any[], planos: any[]) {
  const escritas: any[] = [];
  const leituras: any[] = [];
  const tabelas: Record<string,any[]> = { planos, assinaturas: linhas, cobrancas_pix: [], periodos_cartao: [], cobranca_revisao: [] };
  const chamadas:any[]=[];
  const criar = (tabela: string) => {
    const dados = tabelas[tabela];
    const q: any = { _filtros: [] as [string, string][], _modo: "", _mudanca: null as any, _cols: "" };
    q.select = (cols: string) => { if (!q._modo) q._modo = "select"; q._cols = cols; return q; };
    q.update = (m: any) => { q._modo = "update"; q._mudanca = m; return q; };
    q.upsert = async (row:any, opt:any) => {
      const hit=dados.find(r=>r[opt.onConflict]===row[opt.onConflict]);
      if (!hit) dados.push({...row}); else if (!opt.ignoreDuplicates) Object.assign(hit,row);
      return {error:null};
    };
    q.is = (c:string,v:any)=>q.eq(c,v);
    q.eq = (c: string, v: string) => { q._filtros.push([c, v]); return q; };
    const achar = () => dados.filter(r => q._filtros.every(([c, v]) => (r[c] ?? null) === v));
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
  return { cliente: { from: (t: string) => criar(t), rpc: async (nome:string,args:any)=>{chamadas.push({nome,args});return {data:null,error:null}} }, chamadas,tabelas, escritas, leituras };
}
