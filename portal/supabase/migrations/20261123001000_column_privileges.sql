-- =====================================================================
-- Privilegios por columna. Se aplican AL FINAL porque un
-- "grant select on all tables" posterior los anularía.
-- REGLA: cualquier migración nueva que otorgue SELECT sobre todas las
-- tablas debe volver a ejecutar este bloque.
-- =====================================================================
revoke select on public.employments from authenticated;
grant select (id, user_id, organization_id, legal_entity_id, primary_branch_id, sector_id, position, employee_code,
  hire_date, status, manager_user_id, kiosk_locked_until, created_at, updated_at) on public.employments to authenticated;

revoke select on public.kiosk_devices from authenticated;
grant select (id, organization_id, branch_id, name, mode, paired_at, last_seen_at, revoked_at, created_at, pairing_expires_at)
  on public.kiosk_devices to authenticated;

revoke select on public.conversation_participants from authenticated;
grant select (conversation_id, user_id, role, joined_at, left_at) on public.conversation_participants to authenticated;

revoke all on public.qr_tokens, public.qr_token_uses from authenticated, anon;
revoke all on all tables in schema public from anon;
