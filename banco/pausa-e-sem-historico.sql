-- JÁ APLICADA no banco de produção em 13/11/2026 (migração
-- "viveiro_pausas_e_sem_historico"). Fica aqui como registro do que foi feito.
--
-- pausas: PERÍODOS, não um interruptor. O rateio do custo fixo não é guardado:
-- ele é recalculado dia a dia usando o estado atual dos viveiros. Com um
-- booleano "pausado", pausar hoje apagaria o viveiro de TODOS os dias
-- anteriores e os custos de ciclos já encerrados mudariam sozinhos.
--
-- sem_historico: o viveiro já estava povoado antes de o produtor começar a
-- usar o sistema. Conta no rateio (o funcionário trabalha nele) e recebe a
-- parte dele, mas não tem ração, biometria nem estimativa.
alter table public.viveiros
  add column if not exists pausas jsonb not null default '[]'::jsonb,
  add column if not exists sem_historico boolean not null default false;
