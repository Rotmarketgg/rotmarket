-- ============================================================
-- RotMarket.gg — Reports & Admin SQL
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Reports table
create table if not exists reports (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default now(),
  reporter_id uuid references profiles(id) on delete cascade,
  reported_user_id uuid references profiles(id) on delete cascade,
  listing_id uuid references listings(id) on delete set null,
  reason text not null check (reason in (
    'scam', 'fake_listing', 'inappropriate', 'harassment', 'spam', 'other'
  )),
  details text,
  status text default 'pending' check (status in ('pending', 'reviewed', 'resolved', 'dismissed')),
  admin_notes text,
  reviewed_by uuid references profiles(id) on delete set null,
  reviewed_at timestamp with time zone
);

-- RLS for reports
alter table reports enable row level security;

-- Anyone authenticated can submit a report
create policy "reports_insert_authenticated"
  on reports for insert to authenticated
  with check (auth.uid() = reporter_id);

-- Users can view their own reports
create policy "reports_select_own"
  on reports for select to authenticated
  using (auth.uid() = reporter_id);

-- Admins and mods can view all reports (checked via profiles.badge)
create policy "reports_select_admin"
  on reports for select to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
      and badge in ('Owner', 'Moderator')
    )
  );

-- Admins and mods can update reports
create policy "reports_update_admin"
  on reports for update to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
      and badge in ('Owner', 'Moderator')
    )
  );

grant select, insert on reports to authenticated;
grant update on reports to authenticated;

-- Function for admin to assign badge to user
create or replace function assign_badge(target_user_id uuid, new_badge text)
returns void as $$
begin
  -- Only admins can call this
  if not exists (
    select 1 from profiles where id = auth.uid() and badge = 'Owner'
  ) then
    raise exception 'Unauthorized: Admin access required';
  end if;

  update profiles set badge = new_badge where id = target_user_id;
end;
$$ language plpgsql security definer;

-- Function for admin/mod to ban a user (set username to null and mark banned)
-- We use a simple approach: add a 'banned' column
alter table profiles add column if not exists banned boolean default false;
alter table profiles add column if not exists ban_reason text;

create or replace function ban_user(target_user_id uuid, reason text)
returns void as $$
begin
  if not exists (
    select 1 from profiles where id = auth.uid() and badge in ('Owner', 'Moderator')
  ) then
    raise exception 'Unauthorized';
  end if;

  update profiles set banned = true, ban_reason = reason where id = target_user_id;
  -- Soft delete all their active listings
  update listings set status = 'deleted' where user_id = target_user_id and status = 'active';
end;
$$ language plpgsql security definer;

create or replace function unban_user(target_user_id uuid)
returns void as $$
begin
  if not exists (
    select 1 from profiles where id = auth.uid() and badge = 'Owner'
  ) then
    raise exception 'Unauthorized: Admin access required';
  end if;

  update profiles set banned = false, ban_reason = null where id = target_user_id;
end;
$$ language plpgsql security definer;

-- Index for performance
create index if not exists reports_status_idx on reports(status);
create index if not exists reports_reported_user_idx on reports(reported_user_id);
create index if not exists reports_created_at_idx on reports(created_at desc);

-- ============================================================
-- To make yourself an Admin, run:
-- update profiles set badge = 'Owner' where username = 'YourUsername';
-- ============================================================
