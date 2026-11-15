import type { SVGProps } from 'react'

type IconName =
  | 'plus'
  | 'eye'
  | 'eyeOff'
  | 'copy'
  | 'trash'
  | 'chevron'
  | 'reset'
  | 'crosshair'
  | 'settings'
  | 'collapse'
  | 'edit'
  | 'check'
  | 'upload'
  | 'download'
  | 'lock'
  | 'grip'

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName
  size?: number
}

export function Icon({ name, size = 18, ...props }: IconProps) {
  const paths: Record<IconName, React.ReactNode> = {
    plus: <path d="M12 5v14M5 12h14" />,
    eye: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.6" /></>,
    eyeOff: <><path d="m3 3 18 18M10.6 6.2c.5-.1.9-.2 1.4-.2 6 0 9.5 6 9.5 6a17 17 0 0 1-2.1 2.8M6.6 6.6A16.4 16.4 0 0 0 2.5 12s3.5 6 9.5 6c1.3 0 2.4-.3 3.5-.7" /><path d="M10.2 10.2a2.6 2.6 0 0 0 3.6 3.6" /></>,
    copy: <><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
    trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" /></>,
    chevron: <path d="m8 10 4 4 4-4" />,
    reset: <><path d="M4.7 8A8 8 0 1 1 4 13" /><path d="M4 4v4h4" /></>,
    crosshair: <><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19 14.5a1.7 1.7 0 0 0 .3 1.9l.1.1-2.9 2.9-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21H9.5v-.4a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-2.9-2.9.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H2v-4h.4A1.7 1.7 0 0 0 4 8.5a1.7 1.7 0 0 0-.3-1.9l-.1-.1 2.9-2.9.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V2h4v.4a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 2.9 2.9-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.4v4h-.4a1.7 1.7 0 0 0-1.6 1Z" /></>,
    collapse: <><path d="m8 3 4 4 4-4M12 7V2M8 21l4-4 4 4M12 17v5" /></>,
    edit: <><path d="M4 20h4l11-11-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    upload: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M5 14v5h14v-5" /></>,
    download: <><path d="M12 4v12M7 11l5 5 5-5" /><path d="M5 19h14" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    grip: <><path d="M8 5h.01M16 5h.01M8 12h.01M16 12h.01M8 19h.01M16 19h.01" strokeWidth="3" /></>,
  }

  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      {...props}
    >
      {paths[name]}
    </svg>
  )
}
