-- ============================================================
-- RotMarket.gg — Complete Supabase SQL Setup
-- Run this entire file in your Supabase SQL Editor
-- ============================================================

-- STEP 1: Profiles table
create table if not exists profiles (
  id uuid references auth.users primary key,
  created_at timestamp with time zone default now(),
  username text unique,
  epic_username text,
  roblox_username text,
  paypal_email text,
  cashapp_handle text,
  venmo_handle text,
  trade_count integer default 0,
  rating numeric(3,1) default 0,
  review_count integer default 0,
  badge text,
  bio text,
  avatar_url text
);

-- STEP 2: Listings table
create table if not exists listings (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default now(),
  user_id uuid references profiles(id) on delete cascade,
  title text not null,
  game text not null check (game in ('fortnite', 'roblox')),
  rarity text,
  price numeric(10,2),
  description text,
  type text default 'sale' check (type in ('sale', 'trade')),
  accepts text[] default '{}',
  status text default 'active' check (status in ('active', 'sold', 'deleted')),
  promoted boolean default false,
  views integer default 0,
  images text[] default '{}'
);

-- STEP 3: Reviews table
create table if not exists reviews (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default now(),
  reviewer_id uuid references profiles(id) on delete cascade,
  seller_id uuid references profiles(id) on delete cascade,
  listing_id uuid references listings(id) on delete cascade,
  rating integer check (rating >= 1 and rating <= 5),
  comment text,
  unique(reviewer_id, listing_id)
);

-- STEP 4: Messages table
create table if not exists messages (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default now(),
  sender_id uuid references profiles(id) on delete cascade,
  receiver_id uuid references profiles(id) on delete cascade,
  listing_id uuid references listings(id) on delete cascade,
  content text not null,
  read boolean default false
);

-- STEP 5: Trade confirmations table
create table if not exists trade_confirmations (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default now(),
  listing_id uuid references listings(id) on delete cascade,
  buyer_id uuid references profiles(id) on delete cascade,
  seller_id uuid references profiles(id) on delete cascade,
  buyer_confirmed boolean default false,
  seller_confirmed boolean default false,
  completed boolean default false,
  unique(listing_id, buyer_id)
);

-- STEP 6: Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- STEP 7: Increment trade count function
create or replace function increment_trade_count(user_id uuid)
returns void as $$
begin
  update profiles set trade_count = trade_count + 1 where id = user_id;
end;
$$ language plpgsql security definer;

-- STEP 8: Row Level Security
alter table profiles enable row level security;
alter table listings enable row level security;
alter table reviews enable row level security;
alter table messages enable row level security;
alter table trade_confirmations enable row level security;

-- Profiles policies
create policy "Profiles are viewable by everyone"
  on profiles for select using (true);

create policy "Users can update their own profile"
  on profiles for update using (auth.uid() = id);

-- Listings policies
create policy "Listings are viewable by everyone"
  on listings for select using (status != 'deleted');

create policy "Authenticated users can create listings"
  on listings for insert with check (auth.uid() = user_id);

create policy "Users can update their own listings"
  on listings for update using (auth.uid() = user_id);

-- Reviews policies
create policy "Reviews are viewable by everyone"
  on reviews for select using (true);

create policy "Authenticated users can create reviews"
  on reviews for insert with check (auth.uid() = reviewer_id);

-- Messages policies
create policy "Users can view their own messages"
  on messages for select using (
    auth.uid() = sender_id or auth.uid() = receiver_id
  );

create policy "Authenticated users can send messages"
  on messages for insert with check (auth.uid() = sender_id);

create policy "Users can mark their messages as read"
  on messages for update using (auth.uid() = receiver_id);

-- Trade confirmations policies
create policy "Users can view trade confirmations they're involved in"
  on trade_confirmations for select using (
    auth.uid() = buyer_id or auth.uid() = seller_id
  );

create policy "Authenticated users can create trade confirmations"
  on trade_confirmations for insert with check (
    auth.uid() = buyer_id or auth.uid() = seller_id
  );

create policy "Users can update trade confirmations they're involved in"
  on trade_confirmations for update using (
    auth.uid() = buyer_id or auth.uid() = seller_id
  );

-- STEP 9: Enable realtime for messages
alter publication supabase_realtime add table messages;

-- STEP 10: Storage RLS policies (run after creating the bucket)
-- Allow anyone to view listing images
create policy "Listing images are publicly viewable"
  on storage.objects for select
  using (bucket_id = 'listing-images');

-- Allow authenticated users to upload images
create policy "Authenticated users can upload listing images"
  on storage.objects for insert
  with check (bucket_id = 'listing-images' and auth.role() = 'authenticated');

-- Allow users to delete their own images
create policy "Users can delete their own listing images"
  on storage.objects for delete
  using (bucket_id = 'listing-images' and auth.uid()::text = (storage.foldername(name))[1]);

-- STEP 11: Indexes for performance
create index if not exists listings_game_idx on listings(game);
create index if not exists listings_status_idx on listings(status);
create index if not exists listings_user_id_idx on listings(user_id);
create index if not exists listings_created_at_idx on listings(created_at desc);
create index if not exists messages_sender_receiver_idx on messages(sender_id, receiver_id);
create index if not exists reviews_seller_id_idx on reviews(seller_id);

-- ============================================================
-- STORAGE BUCKET (run separately if needed)
-- Go to Storage in your Supabase dashboard and create:
-- Bucket name: listing-images
-- Public: true
-- ============================================================

-- DONE! Your database is ready.
