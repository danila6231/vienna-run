/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare const __BUILD__: string;

interface ImportMetaEnv {
  readonly NEXT_PUBLIC_SUPABASE_URL?: string;
  readonly NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  readonly NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
}
