import { useId, type ReactNode } from 'react';

/**
 * Form field wrapper that wires the label, hint, and error message together
 * with `aria-describedby` and `aria-invalid` automatically.
 */
export function Field({
  label,
  hint,
  error,
  required,
  children,
  htmlFor,
  className = '',
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: (props: {
    id: string;
    'aria-describedby': string | undefined;
    'aria-invalid': boolean | undefined;
    className: string;
  }) => ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  const generatedId = useId();
  const id = htmlFor ?? generatedId;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint !== undefined ? hintId : null, error !== undefined ? errorId : null]
      .filter((value): value is string => value !== null)
      .join(' ') || undefined;

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className={`field-label ${required === true ? 'field-label-required' : ''}`}
      >
        {label}
      </label>
      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error !== undefined ? true : undefined,
        className: `input ${error !== undefined ? 'input-error' : ''}`,
      })}
      {hint !== undefined && (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      )}
      {error !== undefined && (
        <p id={errorId} className="mt-1.5 text-xs font-medium leading-5 text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** A compact labelled select with the shared archive styling. */
export function SelectField({
  id,
  label,
  value,
  onChange,
  children,
  hint,
  error,
  className = '',
}: {
  id: string;
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
}) {
  return (
    <Field label={label} htmlFor={id} hint={hint} error={error} className={className}>
      {(props) => (
        <select
          {...props}
          className={`select ${props.className}`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {children}
        </select>
      )}
    </Field>
  );
}
