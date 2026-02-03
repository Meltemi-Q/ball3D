export type ThemeId = 'neon' | 'dark'

export type ThemeConfig = {
  id: ThemeId
  label: string
  cssClass: string
  rendererExposure: number
  bloomIntensity: number
  bloomLuminanceThreshold: number
  vignette: number
}

export const THEMES: Record<ThemeId, ThemeConfig> = {
  neon: {
    id: 'neon',
    label: 'Neon',
    cssClass: 'theme-neon',
    rendererExposure: 1.25,
    bloomIntensity: 1.6,
    bloomLuminanceThreshold: 0.15,
    vignette: 0.35,
  },
  dark: {
    id: 'dark',
    label: 'Dark Minimal',
    cssClass: 'theme-dark',
    rendererExposure: 1.05,
    bloomIntensity: 0.85,
    bloomLuminanceThreshold: 0.3,
    vignette: 0.48,
  },
}

