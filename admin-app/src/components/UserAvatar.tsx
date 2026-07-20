"use client";

import { useState } from "react";

type UserAvatarProps = {
  name: string;
  avatarColor: string;
  avatarUrl: string | null;
  size?: number;
};

export function UserAvatar({
  name,
  avatarColor,
  avatarUrl,
  size = 26,
}: UserAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        flex: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        background: avatarColor,
        borderRadius: "100%",
        fontSize: 11,
        fontWeight: 800,
      }}
    >
      {name.slice(0, 1)}
      {avatarUrl && !imageFailed && (
        <img
          src={avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      )}
    </div>
  );
}
