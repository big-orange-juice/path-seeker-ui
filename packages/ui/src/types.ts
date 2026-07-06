export type AppIconName =
  | "archive"
  | "arrow-up-down"
  | "compass"
  | "library"
  | "map"
  | "route"
  | "search"
  | "sparkles"
  | "user-round"

export interface SelectOption {
  label: string
  value: string
  disabled?: boolean
}
