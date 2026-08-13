import { useEffect, useState } from "react";
import {
  PROFILE_CHANGED_EVENT,
  fetchMe,
  type SessionUser,
} from "../data/profile";

export function useSessionUser() {
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    let active = true;
    void fetchMe().then((value) => {
      if (active) setUser(value);
    });
    const handleProfileChanged = (event: Event) => {
      setUser((event as CustomEvent<SessionUser>).detail);
    };
    window.addEventListener(PROFILE_CHANGED_EVENT, handleProfileChanged);
    return () => {
      active = false;
      window.removeEventListener(PROFILE_CHANGED_EVENT, handleProfileChanged);
    };
  }, []);

  return user;
}
