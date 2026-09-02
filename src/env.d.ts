/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly DEPLOY_TARGET?:
    | 'node'
    | 'vercel'
    | 'github-pages'
    | 'cloudflare-pages'
    | 'self-hosted';
  readonly CONTACT_ALLOWED_ORIGINS?: string;
  readonly CONTACT_BUSINESS_TO_EMAIL?: string;
  readonly CONTACT_CREATOR_TO_EMAIL?: string;
  readonly CONTACT_MAIL_TRANSPORT?: 'smtp' | 'webhook';
  readonly CONTACT_MAIL_SERVICE_URL?: string;
  readonly CONTACT_MAIL_SERVICE_TOKEN?: string;
  readonly CONTACT_FROM_EMAIL?: string;
  readonly CONTACT_FROM_NAME?: string;
  readonly CONTACT_SUBJECT_PREFIX?: string;
  readonly SMTP_HOST?: string;
  readonly SMTP_PORT?: string;
  readonly SMTP_SECURE?: string;
  readonly SMTP_REQUIRE_TLS?: string;
  readonly SMTP_USER?: string;
  readonly SMTP_PASSWORD?: string;
  readonly PUBLIC_CONTACT_ENDPOINT?: string;
  readonly PUBLIC_GOOGLE_ANALYTICS_ID?: string;
  readonly PUBLIC_SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
