import OpenAI from "openai";

function getClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Missing GROQ_API_KEY env var");
  return new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" });
}

const SYSTEM_PROMPT = `You write short, specific cold outreach emails for a student job-searching off-campus. Follow these rules exactly:

- Body is 3-5 sentences maximum. Cold emails die in paragraph two.
- Reference one concrete, specific detail from the job description (a technology, a team, a responsibility) — never generic praise like "I'm excited about your company."
- End with one clear, low-friction ask (e.g. "open to a 10-minute call this week?" or "happy to share my resume if useful").
- No filler openers like "I am writing to express my interest" or "I hope this email finds you well."
- Subject line: short and specific, something a busy recruiter would actually open. Never "Application for [Role]."
- Sign off with the student's actual name, not a placeholder.
- Output ONLY valid JSON, no markdown fences, no preamble, in exactly this shape:
{"subject": "...", "body": "..."}`;

export interface DraftInput {
  companyName: string;
  jdText: string;
  resumeText: string;
  studentName: string;
  contactName?: string | null;
}

export interface DraftOutput {
  subject: string;
  body: string;
}

export async function generateDraft(input: DraftInput): Promise<DraftOutput> {
  const client = getClient();

  const userPrompt = `Company: ${input.companyName}
Recruiter name (if known): ${input.contactName || "unknown — use 'Hi there,' as the greeting"}
Student name: ${input.studentName}

Job description:
"""
${input.jdText}
"""

Student's relevant background:
"""
${input.resumeText}
"""

Write the cold outreach email now.`;

  const completion = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  const cleaned = raw.replace(/```json|```/g, "").trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (!parsed.subject || !parsed.body) {
      throw new Error("Draft response missing subject or body");
    }
    return { subject: parsed.subject, body: parsed.body };
  } catch (err) {
    throw new Error(
      `Could not parse draft response from Groq: ${cleaned.slice(0, 200)}`
    );
  }
}

export interface FollowUpInput extends DraftInput {
  originalSubject: string;
  originalBody: string;
  attemptNumber: number; // 1 or 2
}

export async function generateFollowUp(
  input: FollowUpInput
): Promise<DraftOutput> {
  const client = getClient();

  const followUpPrompt = `You previously sent this email and got no reply. Write a short follow-up (2-3 sentences max), referencing the original without re-pitching everything, with a slightly different angle than a plain "just bumping this up." This is follow-up attempt #${input.attemptNumber} of 2.

Original subject: ${input.originalSubject}
Original body:
"""
${input.originalBody}
"""

Output ONLY valid JSON: {"subject": "...", "body": "..."}`;

  const completion = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: followUpPrompt },
    ],
    temperature: 0.7,
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(cleaned);
  return { subject: parsed.subject, body: parsed.body };
}
