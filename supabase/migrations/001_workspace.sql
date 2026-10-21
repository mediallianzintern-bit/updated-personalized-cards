-- Run using Supabase SQL Editor. This schema is never exposed to the Data API.
create schema if not exists cards_private;
revoke all on schema cards_private from public, anon, authenticated;
create table if not exists cards_private.workspace (
  id integer primary key check (id = 1),
  document jsonb not null,
  updated_at timestamptz not null default now()
);
alter table cards_private.workspace enable row level security;
revoke all on cards_private.workspace from public, anon, authenticated;
-- No browser policies: only the trusted backend connection can read this table.
-- JSONB preserves existing card/account data, including password hashes, on import.
insert into cards_private.workspace(id, document)
values (1, '{"version":1,"cards":[],"clients":[],"leads":[],"events":[],"sessions":{}}')
on conflict (id) do nothing;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('card-media','card-media',false,3000000,array[
'image/png','image/jpeg','image/webp','application/pdf','text/plain',
'application/msword','application/vnd.ms-powerpoint','application/vnd.ms-excel',
'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
'application/vnd.openxmlformats-officedocument.presentationml.presentation',
'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do nothing;
-- Private bucket; uploads are issued by the backend, not anonymous Storage policies.
