import React from "react";

interface Props {
  type?: "text" | "email" | "password" | "number" | "search" | "url";
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  name?: string;
  autoComplete?: string;
  id?: string;
}

export function Input({
  type = "text",
  value,
  defaultValue,
  placeholder,
  label,
  error,
  disabled = false,
  required = false,
  className = "",
  onChange,
  onKeyDown,
  onBlur,
  name,
  autoComplete,
  id,
}: Props) {
  const inputId = id || name || `input-${Math.random().toString(36).slice(2, 9)}`;

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-foreground mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <input
        id={inputId}
        name={name}
        type={type}
        value={value ?? defaultValue}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        autoComplete={autoComplete}
        className={[
          "w-full rounded-lg border bg-surface-card px-4 py-2.5 text-sm",
          "transition-colors focus:outline-none focus:ring-2",
          error
            ? "border-red-400 focus:border-red-500 focus:ring-red-200"
            : "border-border focus:border-primary focus:ring-primary/20",
          "placeholder:text-muted placeholder:opacity-60",
          className,
        ].join(" ")}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
