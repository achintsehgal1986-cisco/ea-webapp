type CheckboxButtonProps = {
  checked: boolean;
  label: string;
  onToggle: () => void;
  size?: "sm" | "md";
};

export function CheckboxButton({
  checked,
  label,
  onToggle,
  size = "md",
}: CheckboxButtonProps) {
  const dimension = size === "sm" ? "size-5" : "size-6";

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={checked}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      className={`${dimension} shrink-0 text-primary transition hover:opacity-80`}
    >
      {checked ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="size-full"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="size-full text-border"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9.25" />
        </svg>
      )}
    </button>
  );
}
