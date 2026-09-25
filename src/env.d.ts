interface ImportMetaEnv {
  readonly VITE_GOOGLE_API_KEY?: string
  readonly VITE_AGENDAS_FOLDER_ID?: string
  readonly VITE_PUBLISHED_FOLDER_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
