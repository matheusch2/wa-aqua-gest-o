/*
 * O PAINEL DO DONO (ch2/index.html) FALA COM ESTA FUNÇÃO
 *
 * ATENÇÃO AO NOME: no Supabase o slug tem um HÍFEN NO FIM —
 * "admin-clientes-". Foi um erro de digitação que ficou, e mudar o nome
 * quebraria o painel; por isso o painel tenta os dois ("admin-clientes" e
 * depois "admin-clientes-"). Ao publicar daqui, publique como
 * "admin-clientes-".
 *
 * ESTE ARQUIVO SÓ ENTROU NO REPOSITÓRIO EM 24/11/2026. Antes disso a
 * função existia só dentro do Supabase: quem abrisse o repositório não
 * tinha como saber o que a liberação manual fazia, e nenhuma alteração
 * dela ficava registrada em lugar nenhum.
 *
 * É POR AQUI QUE SE LIBERA NA MÃO — continua existindo, lado a lado com o
 * cartão. O cliente que paga no Pix pelo WhatsApp é liberado aqui, e isso
 * não depende do Asaas para nada.
 *
 * DUAS COISAS QUE ESTA FUNÇÃO NÃO DECIDE SOZINHA:
 *   1. O limite de viveiros vem de public.planos, a mesma tabela que a tela
 *      do cliente e a cobrança no cartão leem.
 *   2. Liberar ou trocar plano na mão APAGA a escolha pendente de checkout
 *      (plano_checkout/ciclo_checkout). Sem isso, um link de pagamento que
 *      o cliente abriu antes e pagou depois trocaria o plano que o dono
 *      acabou de dar na mão.
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/* Limites de reserva, para o caso de a tabela public.planos nao responder.
 * A fonte boa e a tabela; isto aqui so evita que uma liberacao manual trave
 * por causa de uma consulta que falhou. A chave 'gratis' e historica: as
 * assinaturas antigas usam ela, e o catalogo chama o mesmo plano de
 * 'gratis1'. */
const LIMITES: Record<string, number> = { gratis: 1, gratis1: 1, basico: 5, intermediario: 10, avancado: 20, pro: 999999 };

/* Quantos dias cada ciclo adianta o vencimento. O semestral entrou junto com
 * o plano de 6 meses do catalogo; antes so existiam mensal e anual, e uma
 * liberacao manual de 6 meses virava 30 dias calada. */
const DIAS: Record<string, number> = { mensal: 30, semestral: 182, anual: 365 };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "content-type": "application/json" } });
  try {
    const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
    const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: eUser } = await anon.auth.getUser(jwt);
    if (eUser || !user) return json({ error: "Não autenticado" }, 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: perfil } = await admin.from("perfis").select("role").eq("user_id", user.id).maybeSingle();
    if (!perfil || perfil.role !== "admin") return json({ error: "Acesso negado" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const log = (alvo: string, acao: string, detalhes = {}) =>
      admin.from("admin_historico").insert({ admin_id: user.id, alvo_user_id: alvo, acao, detalhes });

    /* O limite de viveiros de um plano vem de public.planos — a MESMA tabela
     * que a tela do cliente e a cobranca no cartao leem. Antes estava escrito
     * aqui dentro, e numero de plano escrito em dois lugares diverge. */
    const limiteDoPlano = async (plano: string): Promise<number | null> => {
      const { data, error } = await admin.from("planos")
        .select("limite_viveiros").eq("chave", plano).maybeSingle();
      if (!error && data) return data.limite_viveiros as number;
      if (error) console.error("Nao consegui ler o limite em planos:", error);
      return plano in LIMITES ? LIMITES[plano] : null;
    };

    // Lista todos os usuários do Auth (paginado)
    const listarUsuarios = async () => {
      const usuarios: any[] = [];
      let page = 1;
      while (true) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (error) throw error;
        usuarios.push(...data.users);
        if (data.users.length < 200) break;
        page++;
      }
      return usuarios;
    };

    if (action === "listar") {
      const usuarios = await listarUsuarios();
      const { data: assins } = await admin.from("assinaturas").select("*");
      const { data: vivs } = await admin.from("viveiros").select("user_id").eq("ativo", true);
      const lanc: Record<string, number> = {};
      for (const t of ["racoes", "biometrias", "despescas"]) {
        const { data: rows } = await admin.from(t).select("user_id");
        (rows ?? []).forEach((r) => { lanc[r.user_id] = (lanc[r.user_id] ?? 0) + 1; });
      }
      const contViv: Record<string, number> = {};
      (vivs ?? []).forEach((v) => { contViv[v.user_id] = (contViv[v.user_id] ?? 0) + 1; });
      const mapA: Record<string, any> = {};
      (assins ?? []).forEach((a) => { mapA[a.user_id] = a; });
      const clientes = usuarios.map((u) => ({
        id: u.id, email: u.email, nome: u.user_metadata?.nome ?? null,
        criado_em: u.created_at, ultimo_acesso: u.last_sign_in_at ?? null,
        viveiros: contViv[u.id] ?? 0, lancamentos: lanc[u.id] ?? 0,
        assinatura: mapA[u.id] ?? null,
      }));
      return json({ clientes });
    }

    if (action === "backup") {
      const usuarios = (await listarUsuarios()).map((u) => ({
        id: u.id, email: u.email, nome: u.user_metadata?.nome ?? null, criado_em: u.created_at,
      }));
      const tabelas = ["perfis", "assinaturas", "viveiros", "racoes", "biometrias",
        "despescas", "custos", "ciclos", "boletos", "custos_fixos", "produtos", "tipos_racao", "admin_historico"];
      const dump: any = { gerado_em: new Date().toISOString(), usuarios, tabelas: {} };
      for (const t of tabelas) {
        const { data } = await admin.from(t).select("*");
        dump.tabelas[t] = data ?? [];
      }
      await log(user.id, "backup", { tabelas: tabelas.length, usuarios: usuarios.length });
      return json(dump);
    }

    const alvo = body.alvo;
    if (!alvo) return json({ error: "alvo obrigatório" }, 400);
    const agora = new Date().toISOString();

    if (action === "liberar") {
      const plano = String(body.plano ?? "");
      const limite = await limiteDoPlano(plano);
      if (limite === null) return json({ error: "plano inválido" }, 400);
      const ciclo = body.ciclo in DIAS ? String(body.ciclo) : "mensal";
      const venc = new Date();
      venc.setDate(venc.getDate() + DIAS[ciclo]);
      const row = {
        user_id: alvo, plano, ciclo, status: "ativo", limite_viveiros: limite,
        proximo_vencimento: venc.toISOString().split("T")[0], atualizado_em: agora,
        /* Liberar na mao apaga a escolha pendente de checkout: se o cliente
         * tinha aberto um link de outro plano e nao pagou, aquele link nao
         * pode mais trocar o plano que o dono acabou de dar. */
        plano_checkout: null, ciclo_checkout: null,
      };
      const { error } = await admin.from("assinaturas").upsert(row, { onConflict: "user_id" });
      if (error) throw error;
      await log(alvo, "liberar", { plano, ciclo, vencimento: row.proximo_vencimento });
      return json({ ok: true });
    }

    /* BLOQUEAR E REATIVAR SAIRAM DAQUI, de proposito.
     *
     * Esta funcao escreve com service_role, que nao tem auth.uid(): o bloqueio
     * ficava sem responsavel, e o log ia com detalhes vazios — os cinco
     * bloqueios do historico ate 26/11/2026 nao tem motivo nenhum registrado.
     * Pior: ela gravava assinaturas.status, o MESMO campo que o Pix, o cartao
     * e o "liberar" escrevem. Quem escrevesse por ultimo mandava.
     *
     * Agora o painel chama direto as RPCs admin_bloquear_cliente e
     * admin_desbloquear_cliente, com o JWT do administrador: elas exigem
     * motivo, gravam quem e quando em colunas proprias, e um gatilho impede
     * que qualquer outro caminho — inclusive este, com service_role — encoste
     * nessas colunas.
     *
     * A recusa abaixo e explicita para que um painel antigo em cache nao
     * continue bloqueando pelo caminho velho em silencio. */
    if (action === "bloquear" || action === "reativar") {
      return json({ error: "Acao movida: use as funcoes admin_bloquear_cliente / "
                         + "admin_desbloquear_cliente. Atualize a pagina do painel." }, 410);
    }

    if (action === "trocar") {
      const plano = String(body.plano ?? "");
      const limite = await limiteDoPlano(plano);
      if (limite === null) return json({ error: "plano inválido" }, 400);
      const { error } = await admin.from("assinaturas")
        .upsert({ user_id: alvo, plano, limite_viveiros: limite, atualizado_em: agora,
                  plano_checkout: null, ciclo_checkout: null }, { onConflict: "user_id" });
      if (error) throw error;
      await log(alvo, "trocar", { plano });
      return json({ ok: true });
    }

    if (action === "historico") {
      const { data } = await admin.from("admin_historico").select("*")
        .eq("alvo_user_id", alvo).order("criado_em", { ascending: false }).limit(50);
      return json({ historico: data ?? [] });
    }

    return json({ error: "action desconhecida" }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
