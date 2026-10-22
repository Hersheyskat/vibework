type Props = {
  name: string;
  initials: string;
  color: string;
  size?: number;
  online?: boolean;
};

export function Avatar({ name, initials, color, size = 32, online }: Props) {
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center rounded-[8px] font-semibold text-white"
      style={{
        width: size,
        height: size,
        background: color,
        fontSize: Math.max(10, Math.round(size * 0.34)),
      }}
      aria-label={name}
      title={name}
    >
      {initials}
      {online ? (
        <span
          className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2"
          style={{
            background: "#3dd68c",
            borderColor: "var(--vw-sidebar)",
          }}
        />
      ) : null}
    </span>
  );
}
