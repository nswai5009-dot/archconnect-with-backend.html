import { pgTable, uuid, text, integer, boolean, timestamp, numeric } from "drizzle-orm/pg-core";

export const projects = pgTable("projects", {
  id: uuid().primaryKey().defaultRandom(),
  clientName: text("client_name").notNull(),
  email: text().notNull(),
  phone: text(),
  location: text().notNull(),
  projectType: text("project_type").notNull(),
  description: text().notNull().default(""),
  budget: text().notNull(),
  timeline: text().notNull().default("Flexible"),
  status: text().notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const companies = pgTable("companies", {
  id: uuid().primaryKey().defaultRandom(),
  companyName: text("company_name").notNull(),
  registrationNumber: text("registration_number"),
  location: text().notNull(),
  yearsInOperation: numeric("years_in_operation", { mode: "number" }).notNull().default(0),
  description: text().notNull().default(""),
  verified: boolean().notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const staff = pgTable("staff", {
  id: uuid().primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  name: text().notNull(),
  role: text().notNull(),
  experience: integer().notNull().default(0),
});
