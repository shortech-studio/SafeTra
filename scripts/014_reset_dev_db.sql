-- RESET DEV DATABASE SCRIPT (Resilient Version)
-- Safely truncates existing tables without failing on missing tables

BEGIN;

DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'deal_invitations') THEN
        EXECUTE 'TRUNCATE TABLE public.deal_invitations CASCADE;';
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notifications') THEN
        EXECUTE 'TRUNCATE TABLE public.notifications CASCADE;';
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'deals') THEN
        EXECUTE 'TRUNCATE TABLE public.deals CASCADE;';
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'otp_codes') THEN
        EXECUTE 'TRUNCATE TABLE public.otp_codes CASCADE;';
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sessions') THEN
        EXECUTE 'TRUNCATE TABLE public.sessions CASCADE;';
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
        EXECUTE 'TRUNCATE TABLE public.profiles CASCADE;';
    END IF;

    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users') THEN
        EXECUTE 'TRUNCATE TABLE public.users CASCADE;';
    END IF;
END $$;

-- Truncate Supabase Auth system users
TRUNCATE TABLE auth.refresh_tokens CASCADE;
TRUNCATE TABLE auth.identities CASCADE;
TRUNCATE TABLE auth.sessions CASCADE;
TRUNCATE TABLE auth.users CASCADE;

COMMIT;

-- Verification Check (Returns current row counts)
SELECT 
  (SELECT COUNT(*) FROM public.deals) AS total_deals,
  (SELECT COUNT(*) FROM public.deal_invitations) AS total_invitations,
  (SELECT COUNT(*) FROM public.notifications) AS total_notifications,
  (SELECT COUNT(*) FROM public.profiles) AS total_profiles,
  (SELECT COUNT(*) FROM auth.users) AS total_auth_users;
