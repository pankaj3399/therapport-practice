/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'lucide-react' {
  import { ComponentType, SVGProps } from 'react';
  export const X: ComponentType<SVGProps<SVGSVGElement>>;
  // Add other icon exports as needed when imported
}