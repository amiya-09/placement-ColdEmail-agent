-- Run this once in the Supabase SQL editor (Project → SQL Editor → New query).
-- Phase 1 schema: just enough for the manual core loop.
-- Discovery tables (TargetCompany, Posting, FilterConfig) come in Phase 2.

create extension if not exists "pgcrypto";

create table profile (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  resume_label text not null unique, -- e.g. 'SWE-general', 'DS'
  resume_text text not null,         -- plain-text bullets, used as AI context
  resume_file_url text,              -- optional: link to uploaded PDF in Supabase Storage
  skills text[] default '{}',
  target_roles text[] default '{}',
  created_at timestamptz default now()
);

create table oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'google',
  email text not null,
  encrypted_refresh_token text not null,
  created_at timestamptz default now()
);

create table contacts (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  name text,
  email text not null,
  source text not null default 'manual', -- manual | apollo | hunter | excel_import | generic
  valid boolean default true,
  created_at timestamptz default now()
);

create table applications (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  jd_text text not null,
  contact_id uuid references contacts(id),
  resume_label text,
  status text not null default 'new',
  -- new | drafted | sent | opened | replied | follow_up_sent | closed
  draft_subject text,
  draft_body text,
  gmail_thread_id text,
  gmail_message_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table email_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications(id) on delete cascade,
  event_type text not null, -- sent | opened | replied | bounced
  occurred_at timestamptz default now()
);

create index on email_events (application_id);
create index on applications (status);
