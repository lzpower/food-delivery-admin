-- Migration một lần cho RPC lưu nhóm khám phá của món (chạy trong Supabase SQL editor).
-- Chỉ backend (service_role) được gọi; app khách/anon/authenticated không có quyền EXECUTE.
create schema if not exists private;

create or replace function private.admin_set_food_discovery_groups(
  p_food_id uuid,
  p_discovery_category_ids text[],
  p_remove_inactive boolean default false
) returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids text[];
  v_valid integer;
begin
  -- Khóa dòng món: hai lần lưu đồng thời cho cùng món sẽ chạy lần lượt (lần sau cùng thắng).
  perform 1 from public.foods where id = p_food_id for update;
  if not found then
    raise exception 'Không tìm thấy món.' using errcode = 'P0002';
  end if;

  select coalesce(array_agg(distinct x), '{}') into v_ids
  from unnest(coalesce(p_discovery_category_ids, '{}')) as x
  where x is not null;

  select count(*) into v_valid
  from public.discovery_categories
  where id = any(v_ids) and kind = 'food' and is_active;
  if v_valid <> coalesce(cardinality(v_ids), 0) then
    raise exception 'Có nhóm khám phá không tồn tại, đã tắt hoặc không dành cho món. Hãy tải lại danh sách.' using errcode = 'P0001';
  end if;

  if not p_remove_inactive and exists (
    select 1
    from public.food_discovery_categories l
    where l.food_id = p_food_id
      and not exists (
        select 1 from public.discovery_categories d
        where d.id = l.discovery_category_id and d.kind = 'food' and d.is_active
      )
  ) then
    raise exception 'Món còn liên kết với nhóm đã tắt. Hãy xác nhận loại bỏ các liên kết này rồi lưu lại.' using errcode = 'P0001';
  end if;

  delete from public.food_discovery_categories where food_id = p_food_id;
  insert into public.food_discovery_categories (food_id, discovery_category_id)
  select p_food_id, x from unnest(v_ids) as x;

  return (select coalesce(array_agg(discovery_category_id order by discovery_category_id), '{}')
          from public.food_discovery_categories where food_id = p_food_id);
end;
$$;

-- Wrapper để PostgREST gọi được qua db.rpc('admin_set_food_discovery_groups', ...).
create or replace function public.admin_set_food_discovery_groups(
  p_food_id uuid,
  p_discovery_category_ids text[],
  p_remove_inactive boolean default false
) returns text[]
language sql
security invoker
set search_path = ''
as $$
  select private.admin_set_food_discovery_groups(p_food_id, p_discovery_category_ids, p_remove_inactive);
$$;

revoke all on function private.admin_set_food_discovery_groups(uuid, text[], boolean) from public, anon, authenticated;
revoke all on function public.admin_set_food_discovery_groups(uuid, text[], boolean) from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.admin_set_food_discovery_groups(uuid, text[], boolean) to service_role;
grant execute on function public.admin_set_food_discovery_groups(uuid, text[], boolean) to service_role;
