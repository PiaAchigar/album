'use client'

import { Progress } from '@/components/ui/progress'

const STEPS = [
  { number: 1, label: 'Datos básicos' },
  { number: 2, label: 'Foto de portada' },
  { number: 3, label: 'Límites' },
  { number: 4, label: 'Revisión' },
]

interface WizardProgressProps {
  currentStep: number
}

export function WizardProgress({ currentStep }: WizardProgressProps) {
  const progressValue = ((currentStep - 1) / (STEPS.length - 1)) * 100

  return (
    <div className="space-y-3">
      <Progress value={progressValue} className="h-1.5" />
      <ol className="flex justify-between">
        {STEPS.map((step) => (
          <li key={step.number} className="flex flex-col items-center gap-1.5">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                step.number < currentStep
                  ? 'bg-primary text-primary-foreground'
                  : step.number === currentStep
                    ? 'bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2 ring-offset-background'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {step.number < currentStep ? '✓' : step.number}
            </span>
            <span
              className={`hidden text-xs sm:block ${
                step.number === currentStep
                  ? 'font-semibold text-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              {step.label}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
