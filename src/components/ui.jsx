import React from 'react'

export function Screen({ children, className = '' }) {
  return (
    <div className={`min-h-screen w-full bg-[#fbf8f4] flex justify-center ${className}`}>
      <div className="w-full max-w-md min-h-screen bg-[#fbf8f4] flex flex-col">{children}</div>
    </div>
  )
}

export function TopBar({ title, subtitle, onBack, action }) {
  return (
    <div className="px-5 pt-6 pb-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {onBack && (
            <button onClick={onBack} className="text-sm text-neutral-400 mb-2 hover:text-neutral-600">
              ← Back
            </button>
          )}
          {title && <h1 className="text-xl font-extrabold text-neutral-900 truncate">{title}</h1>}
          {subtitle && <p className="text-sm text-neutral-500 mt-1">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0 pt-0.5">{action}</div>}
      </div>
    </div>
  )
}

export function Button({ children, onClick, variant = 'primary', disabled, className = '', type = 'button', size = 'md' }) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-2xl transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed'
  const sizes = { md: 'px-5 py-3 text-sm', lg: 'px-6 py-4 text-base', sm: 'px-3.5 py-2 text-xs' }
  const variants = {
    primary: 'bg-sunset-500 text-white shadow-soft hover:bg-sunset-600',
    secondary: 'bg-lagoon-600 text-white shadow-soft hover:bg-lagoon-700',
    outline: 'bg-white border border-neutral-200 text-neutral-800 hover:border-neutral-300',
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
  return <div className={`bg-white rounded-xl2 shadow-soft border border-neutral-100 ${className}`}>{children}</div>
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
          className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-sunset-500' : i < step ? 'w-1.5 bg-sunset-300' : 'w-1.5 bg-neutral-200'}`}
        />
      ))}
    </div>
  )
}
