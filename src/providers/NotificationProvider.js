"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useSession } from "next-auth/react";

const NotificationContext = createContext();

// How often the unread counter is refreshed while the tab is visible
const POLL_INTERVAL_MS = 60 * 1000;

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotifications must be used within NotificationProvider",
    );
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";

  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const response = await fetch("/api/notifications/unread-count");
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.data?.count ?? 0);
      }
    } catch (error) {
      console.error("Error fetching unread count:", error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Fetch on login, poll while the tab is visible and refresh when it regains focus.
  // Visitors don't hit the API at all; the counter resets on logout.
  useEffect(() => {
    if (status === "loading") return;
    if (!isAuthenticated) {
      setUnreadCount(0);
      setIsLoading(false);
      return;
    }

    fetchUnreadCount();

    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") fetchUnreadCount();
    };
    const intervalId = setInterval(refreshIfVisible, POLL_INTERVAL_MS);
    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [status, isAuthenticated, fetchUnreadCount]);

  const decrementCount = useCallback(() => {
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  const incrementCount = useCallback(() => {
    setUnreadCount((prev) => prev + 1);
  }, []);

  const markAllAsRead = useCallback(() => {
    setUnreadCount(0);
  }, []);

  const markAsRead = useCallback(() => {
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  const value = {
    decrementCount,
    fetchUnreadCount,
    incrementCount,
    isLoading,
    markAllAsRead,
    markAsRead,
    unreadCount,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
