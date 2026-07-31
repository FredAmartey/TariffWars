/// <reference types="vite/client" />

// An ImportMetaEnv augmentation used to live here declaring VITE_API_URL and
// VITE_USITC_API_KEY. Nothing read either one: the API client builds its own
// path prefix, and every credential is server-side. The reference above is
// still needed for the typed asset imports (`import logo from "*.png"`).
