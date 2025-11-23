"use client";

import * as Icons from "@/views/components/icons";
import IconLink from "@/views/components/ui/IconLink";
import PageLoader from "@/views/components/layout/PageLoader";
import { es } from "date-fns/locale";
import { format } from "date-fns";
import styles from "./styles.module.css";
import { useNotifications } from "@/providers/NotificationProvider";
import { useSession } from "next-auth/react";
import { toastError } from "@/utils/alerts";
import React, { useEffect, useState } from "react";

const NotificationsPage = () => {
  const { data: session } = useSession();
  const { markAsRead, markAllAsRead, decrementCount, fetchUnreadCount } =
    useNotifications();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (session) {
      fetchNotifications();
    }
  }, [session]);

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) throw new Error("Error fetching notifications");

      const data = await res.json();
      setNotifications(data.data || []);
      // Update context with fresh unread count
      await fetchUnreadCount();
    } catch (err) {
      console.error("Error fetching notifications:", err);
      toastError(3000, "Error", "No se pudieron cargar las notificaciones");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchNotifications(), fetchUnreadCount()]);
    setTimeout(() => setRefreshing(false), 500);
  };

  const handleMarkAsRead = async (id) => {
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
      });

      if (!res.ok) throw new Error("Error marking as read");

      setNotifications(
        notifications.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
      markAsRead();
    } catch (err) {
      console.error("Error marking as read:", err);
      toastError(3000, "Error", "No se pudo marcar como leída");
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const res = await fetch("/api/notifications/mark-all-read", {
        method: "PATCH",
      });

      if (!res.ok) throw new Error("Error marking all as read");

      setNotifications(notifications.map((n) => ({ ...n, read: true })));
      markAllAsRead();
    } catch (err) {
      console.error("Error marking all as read:", err);
      toastError(3000, "Error", "No se pudieron marcar como leídas");
    }
  };

  const handleDelete = async (id) => {
    try {
      const notification = notifications.find((n) => n._id === id);
      const res = await fetch(`/api/notifications/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Error deleting notification");

      setNotifications(notifications.filter((n) => n._id !== id));
      // Only decrement if the deleted notification was unread
      if (notification && !notification.read) {
        decrementCount();
      }
    } catch (err) {
      console.error("Error deleting notification:", err);
      toastError(3000, "Error", "No se pudo eliminar la notificación");
    }
  };

  const handleDeleteAllRead = async () => {
    try {
      const res = await fetch("/api/notifications", {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Error deleting notifications");

      setNotifications(notifications.filter((n) => !n.read));
    } catch (err) {
      console.error("Error deleting notifications:", err);
      toastError(3000, "Error", "No se pudieron eliminar las notificaciones");
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "class_created":
        return "Plus";
      case "class_modified":
        return "Pencil";
      case "class_cancelled":
        return "Cross";
      case "user_signup":
        return "UserPlus";
      case "user_unenroll":
        return "UserMinus";
      case "class_added_to_calendar":
        return "GoogleCalendar";
      default:
        return "Bell";
    }
  };

  if (loading) return <PageLoader />;

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1>Notificaciones</h1>
          {unreadCount > 0 && (
            <p className={styles.unreadText}>
              {unreadCount} sin leer de {notifications.length}
            </p>
          )}
          <p className={styles.infoText}>
            Las notificaciones se eliminan automáticamente después de 30 días
          </p>
        </div>
        <div className={styles.actions}>
          <IconLink
            asButton
            fill="var(--color-4)"
            icon="Refresh"
            onClick={handleRefresh}
            disabled={refreshing}
            spinning={refreshing}
            text="Actualizar"
          />
          {unreadCount > 0 && (
            <IconLink
              asButton
              fill="var(--success)"
              icon="CheckCircle"
              text="Marcar todas como leídas"
              onClick={handleMarkAllAsRead}
            />
          )}
          {notifications.some((n) => n.read) && (
            <IconLink
              asButton
              fill="var(--danger)"
              icon="Delete"
              text="Eliminar leídas"
              onClick={handleDeleteAllRead}
            />
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className={styles.empty}>
          <p>No tienes notificaciones</p>
        </div>
      ) : (
        <div className={styles.list}>
          {notifications.map((notification) => (
            <div
              key={notification._id}
              className={`${styles.notification} ${
                !notification.read ? styles.unread : ""
              }`}
            >
              <div className={styles.iconWrapper}>
                {Icons[getNotificationIcon(notification.type)] &&
                  React.createElement(
                    Icons[getNotificationIcon(notification.type)],
                    { size: 24, fill: "var(--color-6)" }
                  )}
              </div>
              <div className={styles.content}>
                <h3 className={styles.title}>{notification.title}</h3>
                <p className={styles.message}>{notification.message}</p>
                <span className={styles.date}>
                  {format(
                    new Date(notification.createdAt),
                    "dd/MM/yyyy, h:mm a",
                    { locale: es }
                  )}
                </span>
              </div>
              <div className={styles.notificationActions}>
                {!notification.read && (
                  <IconLink
                    asButton
                    success
                    icon="CheckCircle"
                    title="Marcar como leída"
                    onClick={() => handleMarkAsRead(notification._id)}
                  />
                )}
                <IconLink
                  asButton
                  danger
                  icon="Delete"
                  onClick={() => handleDelete(notification._id)}
                  title="Eliminar"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
