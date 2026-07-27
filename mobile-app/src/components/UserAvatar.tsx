type UserAvatarProps = {
  name: string;
  avatarColor: string;
  avatarUrl: string | null;
  size?: number;
  className?: string;
};

export function UserAvatar({
  name,
  avatarColor,
  avatarUrl,
  size = 32,
  className = "",
}: UserAvatarProps) {
  return (
    <span
      className={`user-avatar${className ? ` ${className}` : ""}`}
      style={{ width: size, height: size, background: avatarColor }}
      aria-hidden="true"
    >
      {Array.from(name.trim())[0] ?? "我"}
      {avatarUrl && (
        <img
          src={avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          onError={(event) => { event.currentTarget.style.display = "none"; }}
        />
      )}
    </span>
  );
}
