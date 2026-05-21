interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: 'text-lg',
  md: 'text-[22px]',
  lg: 'text-[32px]',
}

export default function Logo({ size = 'md', className = '' }: LogoProps) {
  return (
    <span
      className={`font-semibold tracking-[-0.035em] leading-none ${sizes[size]} ${className}`}
      style={{ fontFamily: 'var(--font-sans, system-ui, sans-serif)' }}
    >
      <span className="opacity-70">gym</span>
      <span className="italic">moo</span>
      <span className="text-[var(--accent)] font-bold">.</span>
    </span>
  )
}
