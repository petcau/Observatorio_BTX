-- Projeto Supabase: observatorio-btx-telao (jaboxhqlxxneetippzfk)
-- Função lida pelo painel "Próximos no telão" (perfil.html): devolve os pedidos
-- ainda não exibidos, na ordem de chegada. Rodar no SQL Editor do Supabase.

create or replace function public.listar_fila_telao()
returns table (researcher_id text, created_at timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $$
  select researcher_id, created_at
    from telao_pedidos
   where shown_at is null
   order by created_at
   limit 10;
$$;

revoke all on function public.listar_fila_telao() from public;
grant execute on function public.listar_fila_telao() to anon, authenticated, service_role;
