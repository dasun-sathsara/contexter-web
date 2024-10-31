"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"
import type { ToasterProps } from "sonner"

type ToasterPropsType = ToasterProps

const Toaster = ({ ...props }: ToasterPropsType) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterPropsType["theme"]}
      className="toaster group"
      toastOptions={{
        style: {
          background: 'var(--background)',
          border: '1px solid var(--border)',
          color: 'var(--foreground)',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
