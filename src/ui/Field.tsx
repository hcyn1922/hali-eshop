import React, { useId } from 'react';
import { cn } from './cn';

const controlBase =
  'focus-ring w-full rounded-lg border border-line-strong bg-surface text-fg shadow-xs placeholder:text-fg-4 disabled:bg-subtle disabled:text-fg-4 transition-shadow';

export interface FieldProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  required?: boolean;
  className?: string;
  children: (id: string, describedBy?: string) => React.ReactNode;
}

/** Label + control + hint/error, wired up for screen readers. */
export function Field({ label, hint, error, required, className, children }: FieldProps) {
  const id = useId();
  const describedBy = error || hint ? `${id}-desc` : undefined;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-fg-2">
          {label}
          {required && <span className="text-brand-500"> *</span>}
        </label>
      )}
      {children(id, describedBy)}
      {(error || hint) && (
        <p id={describedBy} className={cn('text-sm', error ? 'text-error-600' : 'text-fg-3')}>
          {error || hint}
        </p>
      )}
    </div>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  containerClassName?: string;
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, leading, trailing, className, containerClassName, required, ...rest },
  ref
) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={containerClassName}>
      {(id, describedBy) => (
        <div className="relative flex items-center">
          {leading && <span className="pointer-events-none absolute left-3 flex items-center text-fg-4">{leading}</span>}
          <input
            ref={ref}
            id={id}
            required={required}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={describedBy}
            className={cn(
              controlBase,
              'h-10 px-3.5 text-[15px] sm:text-sm',
              leading ? 'pl-10' : '',
              trailing ? 'pr-10' : '',
              error ? 'border-error-500' : '',
              className
            )}
            {...rest}
          />
          {trailing && <span className="absolute right-3 flex items-center text-fg-4">{trailing}</span>}
        </div>
      )}
    </Field>
  );
});

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  containerClassName?: string;
};

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, containerClassName, required, rows = 3, ...rest },
  ref
) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={containerClassName}>
      {(id, describedBy) => (
        <textarea
          ref={ref}
          id={id}
          rows={rows}
          required={required}
          aria-describedby={describedBy}
          className={cn(controlBase, 'px-3.5 py-2.5 text-[15px] sm:text-sm', error ? 'border-error-500' : '', className)}
          {...rest}
        />
      )}
    </Field>
  );
});

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  containerClassName?: string;
};

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, className, containerClassName, required, children, ...rest },
  ref
) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={containerClassName}>
      {(id, describedBy) => (
        <select
          ref={ref}
          id={id}
          required={required}
          aria-describedby={describedBy}
          className={cn(
            controlBase,
            'h-10 appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pl-3.5 pr-10 text-[15px] sm:text-sm',
            "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='%23667085' stroke-width='1.67' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m5 7.5 5 5 5-5'/%3E%3C/svg%3E\")]",
            error ? 'border-error-500' : '',
            className
          )}
          {...rest}
        >
          {children}
        </select>
      )}
    </Field>
  );
});

export function Checkbox({
  label,
  hint,
  className,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-3', className)}>
      <input
        type="checkbox"
        className="focus-ring mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-line-strong accent-navy-900 dark:accent-brand-500"
        {...rest}
      />
      <span className="flex flex-col">
        <span className="text-sm font-medium text-fg-2">{label}</span>
        {hint && <span className="text-sm text-fg-3">{hint}</span>}
      </span>
    </label>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: React.ReactNode;
  hint?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className={cn('flex items-start gap-3', disabled ? 'opacity-50' : 'cursor-pointer')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'focus-ring relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
          checked ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform dark:bg-gray-100',
            checked ? 'translate-x-[18px] dark:bg-navy-900' : 'translate-x-0.5'
          )}
        />
      </button>
      <span className="flex flex-col">
        <span className="text-sm font-medium text-fg-2">{label}</span>
        {hint && <span className="text-sm text-fg-3">{hint}</span>}
      </span>
    </label>
  );
}
