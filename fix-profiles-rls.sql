-- Drop all existing profile policies and start clean
drop policy if exists "Profiles are viewable by everyone" on profiles;
drop policy if exists "Users can update their own profile" on profiles;
drop policy if exists "Users can insert their own profile" on profiles;

-- Disable RLS temporarily to clear the slate
alter table profiles disable row level security;

-- Re-enable it
alter table profiles enable row level security;

-- Allow anyone to read profiles (public marketplace)
create policy "profiles_select_public"
  on profiles for select
  using (true);

-- Allow users to insert their own profile
create policy "profiles_insert_own"
  on profiles for insert
  with check (auth.uid() = id);

-- Allow users to update their own profile
create policy "profiles_update_own"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Grant table permissions to authenticated role
grant select, insert, update on profiles to authenticated;
grant select on profiles to anon;
