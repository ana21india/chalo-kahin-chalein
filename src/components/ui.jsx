import React from 'react'

export function Screen({ children, className = '' }) {
  return (
    <div className="min-h-screen w-full bg-cream flex justify-center relative overflow-hidden">
      {/* Decorative warm gradient blobs — purely atmospheric, never interactive. */}
      <div className="pointer-events-none fixed -top-24 -right-20 w-72 h-72 rounded-full bg-gradient-to-br from-sunset-200/60 to-sunset-400/20 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-28 -left-20 w-72 h-72 rounded-full bg-gradient-to-tr from-lagoon-200/50 to-lagoon-400/10 blur-3xl" />
      <div className={`w-full max-w-md min-h-screen flex flex-col relative z-10 ${className}`}>{children}</div>
    </div>
  )
}

export function TopBar({ title, subtitle, onBack, action }) {
  return (
    <div className="px-5 pt-6 pb-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {onBack && (
            <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-neutral-400 mb-2.5 hover:text-sunset-500 transition-colors">
              <span aria-hidden>←</span> Back
            </button>
          )}
          {title && <h1 className="font-display text-2xl font-semibold text-neutral-900 truncate tracking-tight">{title}</h1>}
          {subtitle && <p className="text-sm text-neutral-500 mt-1">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0 pt-0.5">{action}</div>}
      </div>
    </div>
  )
}

export function Button({ children, onClick, variant = 'primary', disabled, className = '', type = 'button', size = 'md' }) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-2xl transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none'
  const sizes = { md: 'px-5 py-3 text-sm', lg: 'px-6 py-4 text-base', sm: 'px-3.5 py-2 text-xs' }
  const variants = {
    primary: 'bg-gradient-to-br from-sunset-400 to-sunset-600 text-white shadow-glow hover:-translate-y-0.5 hover:shadow-lg',
    secondary: 'bg-gradient-to-br from-lagoon-500 to-lagoon-700 text-white shadow-glowLagoon hover:-translate-y-0.5 hover:shadow-lg',
    outline: 'bg-white border border-neutral-200 text-neutral-800 hover:border-sunset-300 hover:text-sunset-600',
    ghost: 'bg-transparent text-neutral-500 hover:text-neutral-800',
    subtle: 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200',
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

export function Card({ children, className = '' }) {
  return <div className={`bg-white/90 backdrop-blur-sm rounded-3xl shadow-soft border border-neutral-100/80 ${className}`}>{children}</div>
}

export function Pill({ children, tone = 'neutral', className = '' }) {
  const tones = {
    neutral: 'bg-neutral-100 text-neutral-600',
    green: 'bg-emerald-100 text-emerald-700',
    yellow: 'bg-amber-100 text-amber-700',
    red: 'bg-rose-100 text-rose-700',
    sunset: 'bg-sunset-100 text-sunset-700',
    lagoon: 'bg-lagoon-100 text-lagoon-700',
  }
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${tones[tone]} ${className}`}>{children}</span>
}

export function TextInput({ value, onChange, placeholder, type = 'text', className = '', ...rest }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full px-4 py-3.5 rounded-2xl border border-neutral-200 bg-white text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-sunset-400 focus:border-transparent text-sm ${className}`}
      {...rest}
    />
  )
}

export function ProgressDots({ step, total }) {
  return (
    <div className="flex items-center gap-1.5 px-5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-gradient-to-r from-sunset-400 to-sunset-600' : i < step ? 'w-1.5 bg-sunset-300' : 'w-1.5 bg-neutral-200'}`}
        />
      ))}
    </div>
  )
}
