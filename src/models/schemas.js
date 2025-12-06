import { z } from "zod";

// ==================== USER SCHEMAS ====================

export const UserDBSchema = z.object({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().email(),
  password: z.string(),
  role: z.enum(["user", "admin"]),
  age: z.number().nullable().optional(),
  avatar: z.string().optional(),
  hasAuthorizedCalendar: z.boolean().optional(),
  googleCalendarTokens: z
    .object({
      access_token: z.string(),
      refresh_token: z.string().optional(),
      expiry_date: z.number().optional(),
      token_type: z.string().optional(),
      scope: z.string().optional(),
    })
    .optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// ==================== CLASS SCHEMAS ====================

export const ClassDBSchema = z.object({
  title: z.string(),
  short_description: z.string(),
  duration: z.number().positive(),
  start_date: z.date(),
  participants: z.array(z.instanceof(Object)).default([]),
  max_participants: z.number().nonnegative().nullable(),
  price: z.number().nonnegative(),
  status: z.enum(["draft", "published"]).default("draft"),
  type: z.literal("class"),
  createdBy: z.instanceof(Object).optional(),
  googleEventId: z.string().optional(),
  googleEventUrl: z.string().optional(),
  googleMeetLink: z.string().optional(),
  calendarEventLink: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// ==================== COURSE SCHEMAS ====================

export const CourseDBSchema = z.object({
  title: z.string(),
  short_description: z.string(),
  full_description: z.string(),
  duration: z.number().positive(),
  start_date: z.date(),
  end_date: z.date(),
  participants: z.array(z.instanceof(Object)).default([]),
  amount_of_classes: z.number().min(2),
  max_participants: z.number().nonnegative().nullable(),
  price: z.number().nonnegative(),
  status: z.enum(["draft", "published"]).default("draft"),
  type: z.literal("course"),
  createdBy: z.instanceof(Object).optional(),
  googleEventId: z.string().optional(),
  googleEventUrl: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// ==================== NOTIFICATION SCHEMAS ====================

export const NotificationDBSchema = z.object({
  userId: z.instanceof(Object),
  type: z.string(),
  title: z.string(),
  message: z.string(),
  relatedId: z.instanceof(Object).optional(),
  relatedType: z.string().optional(),
  read: z.boolean().default(false),
  createdAt: z.date(),
  metadata: z.record(z.any()).optional(),
});

// ==================== HELPER FUNCTIONS ====================

export function prepareClassForDB(formData, userId) {
  const now = new Date();
  return {
    ...formData,
    type: "class",
    status: "draft",
    createdBy: userId,
    participants: [],
    max_participants:
      formData.max_participants === 0 ? null : formData.max_participants,
    createdAt: now,
    updatedAt: now,
  };
}

export function prepareCourseForDB(formData, userId) {
  const now = new Date();
  return {
    ...formData,
    type: "course",
    status: "draft",
    createdBy: userId,
    participants: [],
    max_participants:
      formData.max_participants === 0 ? null : formData.max_participants,
    createdAt: now,
    updatedAt: now,
  };
}

export function prepareUserForDB(formData, hashedPassword) {
  const now = new Date();
  return {
    ...formData,
    password: hashedPassword,
    createdAt: now,
    updatedAt: now,
  };
}

export function addTimestampToUpdate(updateData) {
  const now = new Date();
  return {
    ...updateData,
    updatedAt: now,
  };
}

export function prepareNotificationForDB(notificationData) {
  const now = new Date();
  return {
    ...notificationData,
    read: notificationData.read ?? false,
    createdAt: now,
  };
}
