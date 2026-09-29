import type { Config } from "@netlify/functions";
import { asc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { companies, projects, staff } from "../../db/schema.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function sendJSON(status: number, data: unknown) {
  return Response.json(data, { status, headers: CORS_HEADERS });
}

async function readBody(req: Request): Promise<Record<string, any>> {
  const text = await req.text();
  return text ? JSON.parse(text) : {};
}

export default async (req: Request) => {
  const path = new URL(req.url).pathname.replace(/\/+$/, "") || "/";
  const method = req.method;

  // Handle CORS preflight
  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    // Health Check
    if ((path === "/" || path === "/api") && method === "GET") {
      return sendJSON(200, {
        status: "success",
        message: "ArchConnect Backend is running successfully!",
        version: "1.0.0",
      });
    }

    // POST /api/projects
    if (path === "/api/projects" && method === "POST") {
      const body = await readBody(req);
      const { clientName, email, phone, location, projectType, description, budget, timeline } = body;

      if (!clientName || !email || !location || !projectType || !budget) {
        return sendJSON(400, { success: false, error: "Please fill all required fields" });
      }

      const [newProject] = await db
        .insert(projects)
        .values({
          clientName,
          email,
          phone: phone || null,
          location,
          projectType,
          description: description || "",
          budget: String(budget),
          timeline: timeline || "Flexible",
        })
        .returning();

      return sendJSON(201, {
        success: true,
        message: "Project submitted successfully!",
        project: newProject,
      });
    }

    // GET /api/projects
    if (path === "/api/projects" && method === "GET") {
      const openProjects = await db
        .select()
        .from(projects)
        .where(eq(projects.status, "open"))
        .orderBy(asc(projects.createdAt));
      return sendJSON(200, {
        success: true,
        count: openProjects.length,
        projects: openProjects,
      });
    }

    // POST /api/companies
    if (path === "/api/companies" && method === "POST") {
      const body = await readBody(req);
      const { companyName, registrationNumber, location, yearsInOperation, description } = body;

      if (!companyName || !location) {
        return sendJSON(400, { success: false, error: "Company name and location are required" });
      }

      const [newCompany] = await db
        .insert(companies)
        .values({
          companyName,
          registrationNumber: registrationNumber || null,
          location,
          yearsInOperation: Number(yearsInOperation) || 0,
          description: description || "",
        })
        .returning();

      return sendJSON(201, {
        success: true,
        message: "Company registered successfully!",
        company: { ...newCompany, staff: [] },
      });
    }

    // GET /api/companies
    if (path === "/api/companies" && method === "GET") {
      const allCompanies = await db.select().from(companies).orderBy(asc(companies.createdAt));
      const allStaff = await db.select().from(staff);
      const result = allCompanies.map((c) => ({
        ...c,
        staff: allStaff
          .filter((s) => s.companyId === c.id)
          .map(({ companyId, ...s }) => s),
      }));
      return sendJSON(200, {
        success: true,
        count: result.length,
        companies: result,
      });
    }

    // POST /api/companies/:id/staff
    const staffMatch = path.match(/^\/api\/companies\/([^/]+)\/staff$/);
    if (staffMatch && method === "POST") {
      const companyId = staffMatch[1];
      const body = await readBody(req);
      const { name, role, experience } = body;

      const isUuid = /^[0-9a-f-]{36}$/i.test(companyId);
      const [company] = isUuid
        ? await db.select().from(companies).where(eq(companies.id, companyId))
        : [];
      if (!company) {
        return sendJSON(404, { success: false, error: "Company not found" });
      }

      if (!name || !role) {
        return sendJSON(400, { success: false, error: "Name and role are required" });
      }

      await db.insert(staff).values({
        companyId,
        name,
        role,
        experience: Number(experience) || 0,
      });

      const companyStaff = await db
        .select({ id: staff.id, name: staff.name, role: staff.role, experience: staff.experience })
        .from(staff)
        .where(eq(staff.companyId, companyId));

      return sendJSON(200, {
        success: true,
        message: "Staff member added successfully",
        staff: companyStaff,
      });
    }

    // POST /api/payments/calculate
    if (path === "/api/payments/calculate" && method === "POST") {
      const body = await readBody(req);
      const { projectAmount } = body;

      if (!projectAmount || isNaN(projectAmount) || projectAmount <= 0) {
        return sendJSON(400, { success: false, error: "Valid project amount is required" });
      }

      const amount = Number(projectAmount);
      const commission = Math.round(amount * 0.05);
      const amountToCompany = amount - commission;

      return sendJSON(200, {
        success: true,
        projectAmount: amount,
        commissionRate: "5%",
        commissionAmount: commission,
        amountToCompany: amountToCompany,
        currency: "TZS",
      });
    }

    // 404
    return sendJSON(404, { success: false, error: "Route not found" });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return sendJSON(400, { success: false, error: "Invalid JSON body" });
    }
    console.error(err);
    return sendJSON(500, { success: false, error: "Internal server error" });
  }
};

export const config: Config = {
  path: ["/", "/api", "/api/*"],
};
