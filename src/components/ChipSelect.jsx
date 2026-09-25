import React, { useState } from 'react'
import { Plus, X, Check } from 'lucide-react'
import { motion } from 'framer-motion'

const funnyMaxHints = (max) => [
  `You can pick only ${max}. Yes, even though you love everything.`,
  `That's the max — pick your top ${max} and let the rest go.`,
  `${max} max. We are trying to avoid another 1,200-message discussion.`,
]

export default function ChipSelect({ options, selected, onChange, noPreference, onNoPreferenceChange, max = 3, allowCustom = true }) {
  const [customValue, setCustomValue] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)
  const atMax = selected.length >= max

  function toggle(option) {
    if (noPreference) return
    if (selected.includes(option)) {
      onChange(selected.filter((o) => o !== option))
    } else {
      if (atMax) return
      onChange([...selected, option])
    }
  }

  function addCustom() {
    const v = customValue.trim()
    if (!v || atMax || noPreference) return
    if (!selected.includes(v)) onChange([...selected, v])
    setCustomValue('')
    setShowCustomInput(false)
  }

  function toggleNoPreference() {
    const next = !noPreference
    onNoPreferenceChange(next)
    if (next) onChange([])
  }

  const customSelections = selected.filter((s) => !options.includes(s))

  return (
    <div>
      <div className="flex items-center justify-between mb-3 px-0.5">
        <span className="text-xs font-semibold text-neutral-400">
          {noPreference ? 'No preference selected' : `${selected.length} / ${max} selected`}
        </span>
        {atMax && !noPreference && (
          <span className="text-xs text-sunset-500 font-medium">{funnyMaxHints(max)[options.length % 3]}</span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = selected.includes(option)
          const disabled = noPreference || (!isSelected && atMax)
          return (
            <motion.button
              key={option}
              type="button"
              whileTap={{ scale: 0.95 }}
              disabled={disabled}
              onClick={() => toggle(option)}
              className={`px-4 py-2.5 rounded-full text-sm font-medium border transition-all flex items-center gap-1.5
                ${isSelected ? 'bg-gradient-to-br from-sunset-400 to-sunset-600 border-sunset-500 text-white shadow-glow' : 'bg-white border-neutral-200 text-neutral-700 hover:border-sunset-300'}
                ${disabled && !isSelected ? 'opacity-35 cursor-not-allowed hover:border-neutral-200' : ''}`}
            >
              {isSelected && <Check size={14} />}
              {option}
            </motion.button>
          )
        })}

        {customSelections.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => toggle(option)}
            className="px-4 py-2.5 rounded-full text-sm font-medium border bg-gradient-to-br from-sunset-400 to-sunset-600 border-sunset-500 text-white shadow-glow flex items-center gap-1.5"
          >
            <Check size={14} />
            {option}
            <X size={13} className="opacity-80" />
          </button>
        ))}

        {allowCustom && !noPreference && !atMax && !showCustomInput && (
          <button
            type="button"
            onClick={() => setShowCustomInput(true)}
            className="px-4 py-2.5 rounded-full text-sm font-medium border border-dashed border-neutral-300 text-neutral-500 flex items-center gap-1.5 hover:border-neutral-400"
          >
            <Plus size={14} /> Add your own
          </button>
        )}
      </div>

      {showCustomInput && (
        <div className="flex gap-2 mt-3">
          <input
            autoFocus
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCustom()}
            placeholder="Type your own..."
            className="flex-1 px-4 py-2.5 rounded-full border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-sunset-400"
          />
          <button onClick={addCustom} className="px-4 py-2 bg-sunset-500 text-white rounded-full text-sm font-semibold">
            Add
          </button>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-neutral-100">
        <button
          type="button"
          onClick={toggleNoPreference}
          className={`w-full text-left px-4 py-3 rounded-2xl text-sm font-medium border transition-colors flex items-center gap-2
            ${noPreference ? 'bg-lagoon-50 border-lagoon-300 text-lagoon-700' : 'bg-neutral-50 border-neutral-200 text-neutral-500'}`}
        >
          <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${noPreference ? 'bg-lagoon-500 border-lagoon-500' : 'border-neutral-300'}`}>
            {noPreference && <Check size={11} className="text-white" />}
          </span>
          I don't have a preference
        </button>
      </div>
    </div>
  )
}
