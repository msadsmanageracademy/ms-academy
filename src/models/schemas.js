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
  googleCalendarTokensEnc: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// ==================== CLASS SCHEMAS ====================

export const ClassDBSchema = z.object({
  title: z.string(),
  short_description: z.string(),
  duration: z.number().positive(),
  start_date: z.date().optional().nullable(),
  participants: z.array(z.instanceof(Object)).optional(),
  max_participants: z.number().nonnegative().nullable(),
  price: z.number().nonnegative(),
  status: z.enum(["draft", "published", "enrolled"]).default("draft"),
  editionId: z.instanceof(Object).optional(), // course classes only; standalone classes have none
  createdBy: z.instanceof(Object).optional(),
  googleEventId: z.string().optional(),
  googleEventUrl: z.string().optional(),
  googleMeetLink: z.string().optional(),
  calendarEventLink: z.string().optional(),
  recording_url: z.string().url().optional(),
  resources: z
    .array(z.object({ title: z.string(), url: z.string().url() }))
    .default([]),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// ==================== COURSE SCHEMAS ====================

export const CourseDBSchema = z.object({
  title: z.string(),
  short_description: z.string(),
  full_description: z.string(),
  status: z.enum(["active", "archived"]).default("active"),
  createdBy: z.instanceof(Object).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CourseEditionDBSchema = z.object({
  courseId: z.instanceof(Object),
  price: z.number().nonnegative(),
  max_participants: z.number().positive().nullable(), // null = no limit (0 in the form)
  status: z.enum(["draft", "published"]).default("draft"),
  createdBy: z.instanceof(Object).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// ==================== COURSE ENROLLMENT SCHEMAS ====================

export const CourseEnrollmentDBSchema = z.object({
  userId: z.instanceof(Object),
  editionId: z.instanceof(Object),
  paymentStatus: z.enum(["pending", "paid"]).default("pending"),
  paidAt: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export function prepareCourseEnrollmentForDB(userId, editionId) {
  const now = new Date();
  return {
    userId,
    editionId,
    paymentStatus: "pending",
    createdAt: now,
    updatedAt: now,
  };
}

// ==================== NOTIFICATION SCHEMAS ====================

export const NotificationDBSchema = z.object({
  userId: z.instanceof(Object),
  type: z.enum([
    // Class - User notifications
    "class.enrolled",
    "class.unenrolled",
    "class.removed_by_admin",
    "class.updated",
    "class.added_to_course",
    "class.removed_from_course",
    // Class - Admin notifications
    "class.created",
    "class.participant_joined",
    "class.participant_left",
    "class.participant_removed",
    "class.added_to_calendar",
    "class.status_changed",
    "class.reminder",
    "class.recording_added",
    "class.resources_updated",
    "class.cancelled",
    // Course - User notifications
    "course.pre_enrolled",
    "course.enrolled",
    "course.unenrolled",
    "course.removed_by_admin",
    "course.updated",
    "course.payment_confirmed",
    // Course - Admin notifications
    "course.created",
    "course.participant_joined",
    "course.participant_pre_joined",
    "course.participant_left",
    "course.participant_removed",
    "course.payment_received",
    "course.status_changed",
    "course.cancelled",
    // Contact
    "contact.message",
  ]),
  title: z.string(),
  message: z.string(),
  relatedId: z.instanceof(Object).optional(), // ObjectId - Reference to class/course/edition/user
  relatedType: z.enum(["class", "course", "edition", "user", "contact"]).optional(),
  actorId: z.instanceof(Object).optional(), // ObjectId - Who performed the action
  read: z.boolean().default(false),
  createdAt: z.date(),
  metadata: z.record(z.any()).optional(), // Only for truly dynamic/extra data
});

// ==================== REVIEW SCHEMAS ====================

// Course reviews: editionId + the edition's courseId (denormalized). Class reviews: classId.
export const ReviewDBSchema = z.object({
  courseId: z.instanceof(Object).optional(), // ObjectId
  editionId: z.instanceof(Object).optional(), // ObjectId
  classId: z.instanceof(Object).optional(), // ObjectId
  userId: z.instanceof(Object), // ObjectId
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
  firstName: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
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

// The course only holds its content: price and capacity belong to each edition
export function prepareCourseForDB({ title, short_description, full_description }, userId) {
  const now = new Date();
  return {
    title,
    short_description,
    full_description,
    status: "active",
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  };
}

export function prepareEditionForDB({ courseId, price, max_participants }, userId) {
  const now = new Date();
  return {
    courseId,
    price,
    max_participants: max_participants ? max_participants : null,
    status: "draft",
    createdBy: userId,
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
