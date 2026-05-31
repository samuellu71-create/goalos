import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://goalos:goalos_dev@localhost:5432/goalos?schema=public";

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// ─── Local enum unions (match prisma/schema.prisma) ──────────────
type PrereqStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED";
type ActStatus = "TODO" | "IN_PROGRESS" | "DONE" | "SKIPPED";
type ActPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type GStatus =
  | "ACTIVE"
  | "BLOCKED"
  | "WAITING"
  | "COMPLETED"
  | "ARCHIVED"
  | "PAUSED"
  | "ABANDONED";

const NOW = new Date();
function daysAgo(n: number): Date {
  const d = new Date(NOW);
  d.setDate(d.getDate() - n);
  return d;
}
function daysFromNow(n: number): Date {
  return daysAgo(-n);
}

// ─── Spec types for data-driven seeding ──────────────────────────
interface EvidenceSpec {
  title: string;
  description?: string;
  source?: string;
}
interface PrereqSpec {
  title: string;
  description?: string;
  status: PrereqStatus;
  confidence: number;
  evidence?: EvidenceSpec[];
}
interface ActionSpec {
  title: string;
  status: ActStatus;
  priority: ActPriority;
  dueInDays?: number; // relative to now (negative = overdue)
  doneDaysAgo?: number; // when it was completed
}
interface ActiveGoalSpec {
  key: string;
  valueIdx: number;
  title: string;
  description: string;
  successCriteria: string;
  status: GStatus;
  targetDate: string;
  createdDaysAgo: number;
  lastEventDaysAgo: number; // controls "needs attention" staleness
  prereqs: PrereqSpec[];
  actions: ActionSpec[];
}

async function main() {
  // Clean existing data
  await prisma.scheduleEvent.deleteMany();
  await prisma.calendarConnection.deleteMany();
  await prisma.event.deleteMany();
  await prisma.relationship.deleteMany();
  await prisma.evidence.deleteMany();
  await prisma.action.deleteMany();
  await prisma.prerequisite.deleteMany();
  await prisma.stakeholder.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.value.deleteMany();

  // ─── Values (9 values, rank 1 = most important) ───────────────

  const values = await Promise.all([
    prisma.value.create({ data: { label: "Financial Security", rank: 1, description: "Building wealth and financial independence is a top priority", tags: ["money", "wealth", "career", "income"] } }),
    prisma.value.create({ data: { label: "Career Growth", rank: 2, description: "Advancing professionally and building expertise", tags: ["career", "education", "skills"] } }),
    prisma.value.create({ data: { label: "Knowledge & Learning", rank: 3, description: "Continuous learning and intellectual growth", tags: ["education", "skills", "creative"] } }),
    prisma.value.create({ data: { label: "Health & Fitness", rank: 4, description: "Maintaining physical and mental health", tags: ["health", "fitness", "wellness"] } }),
    prisma.value.create({ data: { label: "Family", rank: 5, description: "Supporting and being present for family", tags: ["family", "relationships"] } }),
    prisma.value.create({ data: { label: "Impact & Giving Back", rank: 6, description: "Making a positive difference in the world", tags: ["impact", "community"] } }),
    prisma.value.create({ data: { label: "Romantic Relationships", rank: 7, description: "Finding and nurturing a meaningful romantic partnership", tags: ["relationships", "romantic"] } }),
    prisma.value.create({ data: { label: "Travel & Adventure", rank: 8, description: "Exploring new places and broadening perspective", tags: ["travel", "adventure", "experiences"] } }),
    prisma.value.create({ data: { label: "Creativity & Hobbies", rank: 9, description: "Making time for creative expression and play", tags: ["creative", "hobbies", "art", "music"] } }),
  ]);

  // ─── Completed Goals (24, spread across the last ~14 months) ──

  const completedGoalDefs: {
    valueIdx: number;
    title: string;
    description: string;
    successCriteria: string;
    completedAt: string;
    targetDate: string;
  }[] = [
    { valueIdx: 2, title: "Complete Machine Learning Coursera Specialization", description: "Finish all 5 courses in the Andrew Ng ML specialization", successCriteria: "All 5 course certificates earned", completedAt: "2025-04-01", targetDate: "2025-05-01" },
    { valueIdx: 0, title: "Build $5K Emergency Fund", description: "Save $5,000 in a high-yield savings account as a financial safety net", successCriteria: "Balance of $5,000+ in HYSA", completedAt: "2025-05-18", targetDate: "2025-06-01" },
    { valueIdx: 1, title: "Complete AWS Cloud Practitioner Certification", description: "Pass the AWS Certified Cloud Practitioner exam to strengthen cloud skills", successCriteria: "AWS certification badge received", completedAt: "2025-06-20", targetDate: "2025-07-01" },
    { valueIdx: 3, title: "Complete Dry January", description: "Go alcohol-free for 31 days and track energy and sleep", successCriteria: "31 consecutive alcohol-free days", completedAt: "2025-07-05", targetDate: "2025-07-10" },
    { valueIdx: 4, title: "Plan Family Reunion", description: "Organize a family reunion with 20+ relatives during summer", successCriteria: "Event held with 20+ attendees", completedAt: "2025-07-20", targetDate: "2025-08-01" },
    { valueIdx: 8, title: "Build a Custom Mechanical Keyboard", description: "Assemble and program a custom 65% mechanical keyboard", successCriteria: "Working keyboard with custom keymap", completedAt: "2025-08-12", targetDate: "2025-08-20" },
    { valueIdx: 3, title: "Establish Morning Meditation Habit", description: "Meditate for 10 minutes every morning for 90 consecutive days", successCriteria: "90-day streak completed", completedAt: "2025-08-30", targetDate: "2025-09-01" },
    { valueIdx: 0, title: "Build $5K Emergency Fund (Phase 2)", description: "Grow the emergency fund to a full 3 months of expenses", successCriteria: "3 months of expenses saved", completedAt: "2025-09-15", targetDate: "2025-10-01" },
    { valueIdx: 7, title: "Join a Local Climbing Gym", description: "Sign up and attend a bouldering gym to meet new people", successCriteria: "Member attending 2x/week", completedAt: "2025-09-28", targetDate: "2025-10-01" },
    { valueIdx: 3, title: "Run a 10K Race", description: "Train for and complete a 10K race under 55 minutes", successCriteria: "10K completed in under 55 minutes", completedAt: "2025-10-05", targetDate: "2025-10-15" },
    { valueIdx: 5, title: "Volunteer at Local Food Bank", description: "Volunteer 40 hours at the community food bank over the quarter", successCriteria: "40 logged volunteer hours", completedAt: "2025-10-22", targetDate: "2025-11-01" },
    { valueIdx: 1, title: "Deliver Conference Talk at LocalDevConf", description: "Submit and present a talk on graph-based reasoning at a local developer conference", successCriteria: "Talk delivered with positive audience feedback", completedAt: "2025-11-10", targetDate: "2025-11-15" },
    { valueIdx: 8, title: "Weekend Trip to Yosemite", description: "Plan and take a long weekend backpacking trip in Yosemite", successCriteria: "3-day trip completed", completedAt: "2025-11-24", targetDate: "2025-11-30" },
    { valueIdx: 2, title: "Read 12 Non-Fiction Books", description: "Read one non-fiction book per month covering tech, business, and psychology", successCriteria: "12 books completed with notes", completedAt: "2025-12-15", targetDate: "2025-12-31" },
    { valueIdx: 5, title: "Mentor 2 Junior Developers", description: "Provide weekly mentoring sessions to 2 junior developers for a semester", successCriteria: "Both mentees complete their projects", completedAt: "2025-12-28", targetDate: "2025-12-31" },
    { valueIdx: 0, title: "Negotiate 15% Salary Increase", description: "Prepare and execute a salary negotiation for a 15% raise", successCriteria: "Written offer with 15%+ raise", completedAt: "2026-01-10", targetDate: "2026-02-01" },
    { valueIdx: 6, title: "Launch Personal Portfolio Site", description: "Design and ship a personal portfolio website", successCriteria: "Site live with 5+ projects", completedAt: "2026-01-26", targetDate: "2026-02-01" },
    { valueIdx: 2, title: "Finish Database Internals Course", description: "Complete the CMU Database Systems course videos and labs", successCriteria: "All labs passing", completedAt: "2026-02-14", targetDate: "2026-02-28" },
    { valueIdx: 3, title: "Complete a Strength Training Program", description: "Finish a 12-week progressive strength program", successCriteria: "12 weeks logged, lifts increased 20%", completedAt: "2026-02-27", targetDate: "2026-03-01" },
    { valueIdx: 1, title: "Ship Internal Analytics Dashboard at Work", description: "Lead and ship an internal analytics dashboard used by the team", successCriteria: "Dashboard adopted by 3+ teams", completedAt: "2026-03-18", targetDate: "2026-03-31" },
    { valueIdx: 8, title: "Plan Japan Itinerary", description: "Research and lock in a 2-week Japan travel itinerary", successCriteria: "Flights and lodging booked", completedAt: "2026-03-30", targetDate: "2026-04-01" },
    { valueIdx: 4, title: "Set Up Parents' Estate Documents", description: "Help parents organize wills and key documents", successCriteria: "Documents signed and filed", completedAt: "2026-04-15", targetDate: "2026-04-30" },
    { valueIdx: 6, title: "Open Source: First Merged PR to a Major Project", description: "Get a first PR merged into a widely used OSS project", successCriteria: "PR merged into main", completedAt: "2026-04-29", targetDate: "2026-05-01" },
    { valueIdx: 2, title: "Complete SQL Performance Tuning Workshop", description: "Finish a hands-on workshop on query optimization", successCriteria: "Workshop completed with capstone", completedAt: "2026-05-12", targetDate: "2026-05-15" },
  ];

  const completedGoals = await Promise.all(
    completedGoalDefs.map((g, i) =>
      prisma.goal.create({
        data: {
          valueId: values[g.valueIdx].id,
          title: g.title,
          description: g.description,
          successCriteria: g.successCriteria,
          status: "COMPLETED",
          completedAt: new Date(g.completedAt),
          targetDate: new Date(g.targetDate),
          createdAt: new Date(new Date(g.completedAt).getTime() - (45 + i) * 24 * 60 * 60 * 1000),
        },
      })
    )
  );

  // ─── Active goals (data-driven, with prereqs + actions) ───────

  const activeGoalSpecs: ActiveGoalSpec[] = [
    // Financial Security (rank 1)
    {
      key: "invest", valueIdx: 0, status: "ACTIVE",
      title: "Start Index Fund Portfolio",
      description: "Open a brokerage account and invest $500/month in diversified index funds",
      successCriteria: "Portfolio value reaches $10K with consistent contributions",
      targetDate: "2026-09-01", createdDaysAgo: 120, lastEventDaysAgo: 3,
      prereqs: [
        { title: "Open brokerage account", description: "Research and open an account at Fidelity or Vanguard", status: "COMPLETED", confidence: 100, evidence: [{ title: "Fidelity account opened", description: "Account funded with initial $1K", source: "document" }] },
        { title: "Set up automatic transfers", description: "Configure $500/month auto-invest", status: "IN_PROGRESS", confidence: 60 },
        { title: "Choose target allocation", description: "Decide on a 3-fund portfolio split", status: "NOT_STARTED", confidence: 40 },
      ],
      actions: [
        { title: "Research index fund allocation strategies", status: "TODO", priority: "MEDIUM", dueInDays: 12 },
        { title: "Automate $500 monthly transfer", status: "IN_PROGRESS", priority: "HIGH", dueInDays: 5 },
        { title: "Open brokerage account", status: "DONE", priority: "HIGH", doneDaysAgo: 30 },
      ],
    },
    {
      key: "freelance", valueIdx: 0, status: "ACTIVE",
      title: "Launch Freelance Consulting Practice",
      description: "Land 3 paying freelance clients for AI/ML consulting on the side",
      successCriteria: "3 active clients with signed contracts",
      targetDate: "2026-08-01", createdDaysAgo: 95, lastEventDaysAgo: 9,
      prereqs: [
        { title: "Define service offering & pricing", status: "COMPLETED", confidence: 85, evidence: [{ title: "Service one-pager finalized", source: "document" }] },
        { title: "Build a simple landing page", status: "IN_PROGRESS", confidence: 55 },
        { title: "Get first testimonial", status: "NOT_STARTED", confidence: 25 },
      ],
      actions: [
        { title: "Publish consulting landing page", status: "IN_PROGRESS", priority: "HIGH", dueInDays: 8 },
        { title: "Reach out to 10 warm leads", status: "TODO", priority: "HIGH", dueInDays: 14 },
        { title: "Draft standard consulting contract", status: "DONE", priority: "MEDIUM", doneDaysAgo: 20 },
      ],
    },
    {
      key: "budget", valueIdx: 0, status: "ACTIVE",
      title: "Reduce Monthly Expenses by 20%",
      description: "Audit and cut unnecessary spending to increase savings rate",
      successCriteria: "Monthly expenses reduced by 20% for 3 consecutive months",
      targetDate: "2026-07-01", createdDaysAgo: 70, lastEventDaysAgo: 2,
      prereqs: [
        { title: "Categorize last 3 months of spending", status: "COMPLETED", confidence: 90, evidence: [{ title: "Spending categorized in spreadsheet", source: "document" }] },
        { title: "Cancel unused subscriptions", status: "IN_PROGRESS", confidence: 70 },
        { title: "Set monthly category budgets", status: "NOT_STARTED", confidence: 45 },
      ],
      actions: [
        { title: "Audit recurring subscriptions", status: "DONE", priority: "MEDIUM", doneDaysAgo: 6 },
        { title: "Negotiate lower phone/internet bills", status: "TODO", priority: "LOW", dueInDays: 20 },
      ],
    },
    // Career Growth (rank 2)
    {
      key: "ta", valueIdx: 1, status: "ACTIVE",
      title: "Obtain TA Position",
      description: "Secure a teaching assistant role in the Computer Science department for Fall semester",
      successCriteria: "Receive official TA appointment letter",
      targetDate: "2026-08-15", createdDaysAgo: 110, lastEventDaysAgo: 1,
      prereqs: [
        { title: "Earn A in CS 301", description: "Achieve an A grade in the target course", status: "COMPLETED", confidence: 95, evidence: [{ title: "A grade achieved in CS 301", description: "Final grade posted: A", source: "transcript" }] },
        { title: "Build relationship with Prof. Chen", description: "Establish a strong working relationship through office hours", status: "IN_PROGRESS", confidence: 70 },
        { title: "Demonstrate teaching experience", description: "Show evidence of teaching or tutoring ability", status: "NOT_STARTED", confidence: 20 },
        { title: "Obtain recommendation letter", description: "Get a recommendation from a faculty member", status: "NOT_STARTED", confidence: 40 },
      ],
      actions: [
        { title: "Volunteer to assist classmates in study group", status: "TODO", priority: "HIGH", dueInDays: 16 },
        { title: "Schedule meeting with Prof. Chen", status: "TODO", priority: "HIGH", dueInDays: -3 },
        { title: "Ask Prof. Chen for recommendation", status: "TODO", priority: "MEDIUM", dueInDays: 32 },
      ],
    },
    {
      key: "startup", valueIdx: 1, status: "ACTIVE",
      title: "Raise Pre-Seed Round",
      description: "Close a $500K pre-seed round for the AI productivity startup",
      successCriteria: "Term sheet signed, funds in bank",
      targetDate: "2026-06-30", createdDaysAgo: 100, lastEventDaysAgo: 1,
      prereqs: [
        { title: "Complete MVP", description: "Build a working prototype of the AI productivity tool", status: "IN_PROGRESS", confidence: 65 },
        { title: "Pitch deck finalized", description: "Create a compelling investor pitch deck with market data", status: "COMPLETED", confidence: 90, evidence: [{ title: "Pitch deck v3 completed", description: "Updated deck with market size and competitive analysis", source: "document" }] },
        { title: "Warm intros to 5+ investors", description: "Get warm introductions to at least 5 angel/pre-seed investors", status: "IN_PROGRESS", confidence: 35 },
        { title: "Show early traction metrics", status: "NOT_STARTED", confidence: 30 },
      ],
      actions: [
        { title: "Complete MVP core features", status: "IN_PROGRESS", priority: "CRITICAL", dueInDays: 12 },
        { title: "Email Sarah Kim for investor intros", status: "TODO", priority: "HIGH", dueInDays: -2 },
        { title: "Instrument product analytics", status: "DONE", priority: "MEDIUM", doneDaysAgo: 11 },
      ],
    },
    {
      key: "leadership", valueIdx: 1, status: "ACTIVE",
      title: "Lead Open Source Project to 500 Stars",
      description: "Grow the graph-reasoning OSS project to 500 GitHub stars with active contributors",
      successCriteria: "500+ stars, 10+ external contributors",
      targetDate: "2026-12-01", createdDaysAgo: 60, lastEventDaysAgo: 7,
      prereqs: [
        { title: "Write thorough README & docs", status: "COMPLETED", confidence: 80, evidence: [{ title: "Docs site published", source: "document" }] },
        { title: "Label good-first-issues", status: "IN_PROGRESS", confidence: 60 },
        { title: "Get featured in a newsletter", status: "NOT_STARTED", confidence: 25 },
      ],
      actions: [
        { title: "Write a launch blog post", status: "TODO", priority: "MEDIUM", dueInDays: 18 },
        { title: "Triage open issues", status: "IN_PROGRESS", priority: "LOW", dueInDays: 9 },
      ],
    },
    // Knowledge & Learning (rank 3)
    {
      key: "research", valueIdx: 2, status: "ACTIVE",
      title: "Publish Research Paper",
      description: "Submit and publish a paper on graph-based reasoning systems at a top-tier conference",
      successCriteria: "Paper accepted at NeurIPS, ICML, or similar venue",
      targetDate: "2026-12-01", createdDaysAgo: 130, lastEventDaysAgo: 4,
      prereqs: [
        { title: "Literature review complete", description: "Complete a comprehensive review of related work", status: "IN_PROGRESS", confidence: 55 },
        { title: "Experiment design approved", description: "Get experiment methodology approved by advisor", status: "NOT_STARTED", confidence: 25 },
        { title: "Secure compute resources", status: "IN_PROGRESS", confidence: 50 },
      ],
      actions: [
        { title: "Schedule literature review session with Dr. Patel", status: "TODO", priority: "MEDIUM", dueInDays: 20 },
        { title: "Draft related-work section", status: "IN_PROGRESS", priority: "MEDIUM", dueInDays: 25 },
      ],
    },
    {
      key: "rust", valueIdx: 2, status: "ACTIVE",
      title: "Learn Rust Programming",
      description: "Become proficient in Rust by completing the Rustlings exercises and building a CLI tool",
      successCriteria: "Rustlings completed, CLI tool published to crates.io",
      targetDate: "2026-10-01", createdDaysAgo: 80, lastEventDaysAgo: 6,
      prereqs: [
        { title: "Complete Rustlings exercises", description: "Work through all Rustlings exercises", status: "IN_PROGRESS", confidence: 45 },
        { title: "Build a small CLI tool", status: "NOT_STARTED", confidence: 30 },
      ],
      actions: [
        { title: "Finish ownership & borrowing exercises", status: "IN_PROGRESS", priority: "MEDIUM", dueInDays: 10 },
        { title: "Pick a CLI project idea", status: "DONE", priority: "LOW", doneDaysAgo: 14 },
      ],
    },
    {
      key: "philosophy", valueIdx: 2, status: "PAUSED",
      title: "Complete Philosophy Reading List",
      description: "Read and annotate 8 foundational philosophy texts covering ethics, epistemology, and logic",
      successCriteria: "8 books read with written reflections",
      targetDate: "2026-11-01", createdDaysAgo: 75, lastEventDaysAgo: 48,
      prereqs: [
        { title: "Assemble reading list", status: "COMPLETED", confidence: 90 },
        { title: "Read first 2 texts", status: "NOT_STARTED", confidence: 35 },
      ],
      actions: [
        { title: "Order remaining books", status: "TODO", priority: "LOW", dueInDays: 30 },
      ],
    },
    // Health & Fitness (rank 4)
    {
      key: "marathon", valueIdx: 3, status: "ACTIVE",
      title: "Train for Half Marathon",
      description: "Complete a half marathon under 2 hours, building on the 10K race completion",
      successCriteria: "Half marathon completed in under 2 hours",
      targetDate: "2026-11-15", createdDaysAgo: 50, lastEventDaysAgo: 2,
      prereqs: [
        { title: "Build base mileage to 20 mi/week", description: "Gradually increase weekly running volume", status: "IN_PROGRESS", confidence: 50 },
        { title: "Register for race", description: "Sign up for a half marathon event", status: "NOT_STARTED", confidence: 30 },
      ],
      actions: [
        { title: "Run long run (8 miles)", status: "DONE", priority: "MEDIUM", doneDaysAgo: 3 },
        { title: "Register for the November race", status: "TODO", priority: "HIGH", dueInDays: 21 },
      ],
    },
    {
      key: "nutrition", valueIdx: 3, status: "ACTIVE",
      title: "Meal Prep Consistently for 3 Months",
      description: "Prepare healthy meals every Sunday for the week ahead for 12 consecutive weeks",
      successCriteria: "12-week streak of meal prepping",
      targetDate: "2026-09-01", createdDaysAgo: 40, lastEventDaysAgo: 1,
      prereqs: [
        { title: "Build a rotating recipe set", status: "COMPLETED", confidence: 80 },
        { title: "Establish Sunday prep routine", status: "IN_PROGRESS", confidence: 60 },
      ],
      actions: [
        { title: "Create meal prep plan for week 1", status: "DONE", priority: "MEDIUM", doneDaysAgo: 5 },
        { title: "Buy meal-prep containers", status: "DONE", priority: "LOW", doneDaysAgo: 8 },
        { title: "Prep meals for the week", status: "TODO", priority: "MEDIUM", dueInDays: 3 },
      ],
    },
    {
      key: "sleep", valueIdx: 3, status: "ACTIVE",
      title: "Fix Sleep Schedule",
      description: "Consistently sleep 7-8 hours with a 10:30pm bedtime and 6:30am wake time",
      successCriteria: "30-day streak of consistent sleep schedule",
      targetDate: "2026-08-01", createdDaysAgo: 35, lastEventDaysAgo: 5,
      prereqs: [
        { title: "Set a consistent wind-down routine", status: "IN_PROGRESS", confidence: 55 },
        { title: "Remove screens 1h before bed", status: "NOT_STARTED", confidence: 35 },
      ],
      actions: [
        { title: "Set phone bedtime reminder", status: "DONE", priority: "LOW", doneDaysAgo: 10 },
        { title: "Track sleep for 2 weeks", status: "IN_PROGRESS", priority: "MEDIUM", dueInDays: 7 },
      ],
    },
    // Family (rank 5)
    {
      key: "dadCalls", valueIdx: 4, status: "ACTIVE",
      title: "Weekly Video Calls with Parents",
      description: "Establish a consistent weekly video call with Mom and Dad every Sunday",
      successCriteria: "12-week streak of weekly calls",
      targetDate: "2026-09-01", createdDaysAgo: 55, lastEventDaysAgo: 2,
      prereqs: [
        { title: "Agree on a recurring time", status: "COMPLETED", confidence: 95 },
        { title: "Keep a 12-week streak", status: "IN_PROGRESS", confidence: 65 },
      ],
      actions: [
        { title: "Send calendar invite for Sunday calls", status: "DONE", priority: "MEDIUM", doneDaysAgo: 28 },
        { title: "Call parents this Sunday", status: "TODO", priority: "HIGH", dueInDays: 2 },
      ],
    },
    {
      key: "siblingTrip", valueIdx: 4, status: "WAITING",
      title: "Plan Sibling Road Trip",
      description: "Organize and take a week-long road trip with siblings along the West Coast",
      successCriteria: "Trip completed with at least 2 siblings",
      targetDate: "2026-08-15", createdDaysAgo: 42, lastEventDaysAgo: 27,
      prereqs: [
        { title: "Align everyone's schedules", status: "IN_PROGRESS", confidence: 45 },
        { title: "Book accommodations", status: "NOT_STARTED", confidence: 20 },
      ],
      actions: [
        { title: "Create shared trip planning doc", status: "DONE", priority: "MEDIUM", doneDaysAgo: 16 },
        { title: "Poll siblings for available weeks", status: "IN_PROGRESS", priority: "MEDIUM", dueInDays: 6 },
      ],
    },
    {
      key: "familyFinance", valueIdx: 4, status: "ACTIVE",
      title: "Help Parents Set Up Retirement Planning",
      description: "Research and help parents understand retirement account options and create a plan",
      successCriteria: "Parents have opened retirement accounts with a contribution plan",
      targetDate: "2026-10-01", createdDaysAgo: 38, lastEventDaysAgo: 24,
      prereqs: [
        { title: "Research account options", status: "COMPLETED", confidence: 85 },
        { title: "Meet with a financial advisor", status: "NOT_STARTED", confidence: 40 },
      ],
      actions: [
        { title: "Summarize IRA vs 401k for parents", status: "DONE", priority: "MEDIUM", doneDaysAgo: 12 },
        { title: "Book advisor consultation", status: "TODO", priority: "MEDIUM", dueInDays: 18 },
      ],
    },
    // Impact & Giving Back (rank 6)
    {
      key: "oss", valueIdx: 5, status: "ACTIVE",
      title: "Contribute to 5 Open Source Projects",
      description: "Make meaningful contributions (PRs merged) to 5 different open source ML/AI projects",
      successCriteria: "5 merged PRs across 5 different repos",
      targetDate: "2026-12-01", createdDaysAgo: 65, lastEventDaysAgo: 5,
      prereqs: [
        { title: "Shortlist target repos", status: "COMPLETED", confidence: 90 },
        { title: "Land first 2 merged PRs", status: "IN_PROGRESS", confidence: 60, evidence: [{ title: "First PR merged", source: "document" }] },
      ],
      actions: [
        { title: "Find a good-first-issue this week", status: "TODO", priority: "MEDIUM", dueInDays: -4 },
        { title: "Open PR on shortlisted repo", status: "IN_PROGRESS", priority: "MEDIUM", dueInDays: 10 },
      ],
    },
    {
      key: "workshop", valueIdx: 5, status: "ACTIVE",
      title: "Run Free Coding Workshop for Beginners",
      description: "Organize and teach a free 4-week intro to programming workshop at the local library",
      successCriteria: "Workshop completed with 10+ attendees",
      targetDate: "2026-09-15", createdDaysAgo: 33, lastEventDaysAgo: 8,
      prereqs: [
        { title: "Secure a venue & dates", status: "IN_PROGRESS", confidence: 55 },
        { title: "Prepare curriculum", status: "NOT_STARTED", confidence: 35 },
      ],
      actions: [
        { title: "Email library about room booking", status: "DONE", priority: "MEDIUM", doneDaysAgo: 9 },
        { title: "Outline 4-week curriculum", status: "TODO", priority: "MEDIUM", dueInDays: 14 },
      ],
    },
    {
      key: "blog", valueIdx: 5, status: "ACTIVE",
      title: "Write 10 Technical Blog Posts",
      description: "Publish 10 in-depth technical blog posts on ML, systems design, and career advice",
      successCriteria: "10 posts published with 1000+ total views",
      targetDate: "2026-12-31", createdDaysAgo: 58, lastEventDaysAgo: 6,
      prereqs: [
        { title: "Build a backlog of post ideas", status: "COMPLETED", confidence: 85 },
        { title: "Publish first 3 posts", status: "IN_PROGRESS", confidence: 50, evidence: [{ title: "First post published", source: "document" }] },
      ],
      actions: [
        { title: "Draft first blog post outline", status: "DONE", priority: "LOW", doneDaysAgo: 18 },
        { title: "Write post #2", status: "IN_PROGRESS", priority: "MEDIUM", dueInDays: 12 },
      ],
    },
    // Romantic Relationships (rank 7)
    {
      key: "social", valueIdx: 6, status: "ACTIVE",
      title: "Expand Social Circle",
      description: "Join 2 new social groups or clubs to meet new people outside of work/school",
      successCriteria: "Active member of 2 new groups, attending regularly",
      targetDate: "2026-08-01", createdDaysAgo: 45, lastEventDaysAgo: 4,
      prereqs: [
        { title: "Find local groups to join", status: "COMPLETED", confidence: 80 },
        { title: "Attend 4 meetups", status: "IN_PROGRESS", confidence: 55 },
      ],
      actions: [
        { title: "RSVP to hiking club meetup", status: "DONE", priority: "MEDIUM", doneDaysAgo: 7 },
        { title: "Attend board game night", status: "TODO", priority: "LOW", dueInDays: 6 },
      ],
    },
    {
      key: "boundaries", valueIdx: 6, status: "ACTIVE",
      title: "Develop Healthy Relationship Boundaries",
      description: "Work through a relationship skills workbook and practice setting boundaries",
      successCriteria: "Workbook completed, boundaries discussed with close friends",
      targetDate: "2026-09-01", createdDaysAgo: 28, lastEventDaysAgo: 13,
      prereqs: [
        { title: "Get the workbook", status: "COMPLETED", confidence: 95 },
        { title: "Complete first 4 chapters", status: "IN_PROGRESS", confidence: 50 },
      ],
      actions: [
        { title: "Schedule weekly workbook time", status: "DONE", priority: "LOW", doneDaysAgo: 13 },
        { title: "Do chapter 3 exercises", status: "TODO", priority: "MEDIUM", dueInDays: 9 },
      ],
    },
    {
      key: "dating", valueIdx: 6, status: "BLOCKED",
      title: "Go on 12 First Dates",
      description: "Actively date by going on at least one first date per month",
      successCriteria: "12 first dates completed",
      targetDate: "2026-12-31", createdDaysAgo: 50, lastEventDaysAgo: 26,
      prereqs: [
        { title: "Refresh dating profiles", status: "IN_PROGRESS", confidence: 40 },
        { title: "Free up evening time", status: "BLOCKED", confidence: 20 },
      ],
      actions: [
        { title: "Update profile photos", status: "TODO", priority: "LOW", dueInDays: -6 },
      ],
    },
    // Travel & Adventure (rank 8)
    {
      key: "backpackEurope", valueIdx: 7, status: "ACTIVE",
      title: "Backpack Through Europe for 3 Weeks",
      description: "Plan and take a 3-week multi-country backpacking trip across Europe",
      successCriteria: "Trip completed across 4+ countries on budget",
      targetDate: "2026-10-15", createdDaysAgo: 47, lastEventDaysAgo: 3,
      prereqs: [
        { title: "Set a trip budget", status: "COMPLETED", confidence: 85 },
        { title: "Book flights", status: "NOT_STARTED", confidence: 30 },
        { title: "Plan rough route", status: "IN_PROGRESS", confidence: 55 },
      ],
      actions: [
        { title: "Compare flight options", status: "IN_PROGRESS", priority: "MEDIUM", dueInDays: 8 },
        { title: "Draft city-by-city itinerary", status: "TODO", priority: "MEDIUM", dueInDays: 15 },
      ],
    },
    {
      key: "spanish", valueIdx: 7, status: "ACTIVE",
      title: "Reach Conversational Spanish",
      description: "Reach a B1 conversational level in Spanish to travel more confidently",
      successCriteria: "Hold a 15-minute conversation with a native speaker",
      targetDate: "2026-12-01", createdDaysAgo: 62, lastEventDaysAgo: 4,
      prereqs: [
        { title: "Daily practice streak (60 days)", status: "IN_PROGRESS", confidence: 60 },
        { title: "Weekly conversation practice", status: "NOT_STARTED", confidence: 35 },
      ],
      actions: [
        { title: "Hit 30-day Duolingo streak", status: "DONE", priority: "LOW", doneDaysAgo: 4 },
        { title: "Book a conversation tutor", status: "TODO", priority: "MEDIUM", dueInDays: 10 },
      ],
    },
    {
      key: "parks", valueIdx: 7, status: "ACTIVE",
      title: "Visit 5 National Parks This Year",
      description: "Plan road trips to visit 5 national parks across the year",
      successCriteria: "5 parks visited with photos logged",
      targetDate: "2026-11-30", createdDaysAgo: 30, lastEventDaysAgo: 9,
      prereqs: [
        { title: "Buy annual parks pass", status: "COMPLETED", confidence: 100, evidence: [{ title: "Annual pass purchased", source: "document" }] },
        { title: "Schedule trips on calendar", status: "IN_PROGRESS", confidence: 50 },
      ],
      actions: [
        { title: "Plan first park weekend", status: "TODO", priority: "MEDIUM", dueInDays: 13 },
      ],
    },
    // Creativity & Hobbies (rank 9)
    {
      key: "guitar", valueIdx: 8, status: "ACTIVE",
      title: "Learn 10 Songs on Guitar",
      description: "Practice guitar regularly and learn to play 10 full songs",
      successCriteria: "10 songs played start-to-finish",
      targetDate: "2026-12-01", createdDaysAgo: 44, lastEventDaysAgo: 2,
      prereqs: [
        { title: "Build a daily practice habit", status: "IN_PROGRESS", confidence: 60 },
        { title: "Learn barre chords", status: "NOT_STARTED", confidence: 35 },
      ],
      actions: [
        { title: "Practice 20 minutes today", status: "DONE", priority: "LOW", doneDaysAgo: 2 },
        { title: "Learn song #4", status: "IN_PROGRESS", priority: "MEDIUM", dueInDays: 7 },
      ],
    },
    {
      key: "novel", valueIdx: 8, status: "PAUSED",
      title: "Write First Draft of a Novel",
      description: "Write a 50,000-word first draft of a science-fiction novel",
      successCriteria: "50K-word draft completed",
      targetDate: "2026-12-31", createdDaysAgo: 90, lastEventDaysAgo: 40,
      prereqs: [
        { title: "Outline the plot", status: "COMPLETED", confidence: 80 },
        { title: "Write 10K words", status: "IN_PROGRESS", confidence: 40 },
      ],
      actions: [
        { title: "Write 1,000 words", status: "TODO", priority: "LOW", dueInDays: 25 },
      ],
    },
    {
      key: "photography", valueIdx: 8, status: "ACTIVE",
      title: "Build a Photography Portfolio",
      description: "Develop photography skills and assemble a portfolio of 30 strong images",
      successCriteria: "Portfolio of 30 curated photos published",
      targetDate: "2026-11-01", createdDaysAgo: 36, lastEventDaysAgo: 6,
      prereqs: [
        { title: "Learn manual exposure", status: "COMPLETED", confidence: 75 },
        { title: "Shoot 10 themed sessions", status: "IN_PROGRESS", confidence: 50 },
      ],
      actions: [
        { title: "Do a golden-hour shoot", status: "DONE", priority: "LOW", doneDaysAgo: 6 },
        { title: "Edit and select top 10 shots", status: "TODO", priority: "MEDIUM", dueInDays: 12 },
      ],
    },
  ];

  // Create active goals + their prereqs/actions/evidence, and collect refs.
  const goalByKey: Record<string, { id: string; title: string }> = {};
  // Events collected as we go, so we can backdate occurredAt meaningfully.
  const eventRows: {
    entityType: "GOAL" | "STAKEHOLDER" | "PREREQUISITE" | "EVIDENCE" | "ACTION";
    entityId: string;
    eventType: string;
    payload: Prisma.InputJsonValue;
    occurredAt: Date;
  }[] = [];

  for (const spec of activeGoalSpecs) {
    const goal = await prisma.goal.create({
      data: {
        valueId: values[spec.valueIdx].id,
        title: spec.title,
        description: spec.description,
        successCriteria: spec.successCriteria,
        status: spec.status,
        targetDate: new Date(spec.targetDate),
        createdAt: daysAgo(spec.createdDaysAgo),
      },
    });
    goalByKey[spec.key] = { id: goal.id, title: goal.title };

    eventRows.push({
      entityType: "GOAL",
      entityId: goal.id,
      eventType: "CREATED",
      payload: { title: goal.title },
      occurredAt: daysAgo(spec.createdDaysAgo),
    });
    // A "most recent activity" event so staleness + momentum reflect real cadence.
    if (spec.lastEventDaysAgo < spec.createdDaysAgo) {
      eventRows.push({
        entityType: "GOAL",
        entityId: goal.id,
        eventType: "UPDATED",
        payload: { title: goal.title, updatedFields: ["progress"] },
        occurredAt: daysAgo(spec.lastEventDaysAgo),
      });
    }

    for (const p of spec.prereqs) {
      const prereq = await prisma.prerequisite.create({
        data: {
          title: p.title,
          description: p.description,
          status: p.status,
          confidenceScore: p.confidence,
          goalId: goal.id,
        },
      });
      if (p.status === "COMPLETED" || p.status === "IN_PROGRESS") {
        eventRows.push({
          entityType: "PREREQUISITE",
          entityId: prereq.id,
          eventType: "STATUS_CHANGED",
          payload: { from: "NOT_STARTED", to: p.status, title: p.title },
          occurredAt: daysAgo(spec.lastEventDaysAgo + 1),
        });
      }
      for (const e of p.evidence ?? []) {
        await prisma.evidence.create({
          data: {
            title: e.title,
            description: e.description,
            source: e.source,
            prerequisiteId: prereq.id,
          },
        });
      }
    }

    for (const a of spec.actions) {
      const action = await prisma.action.create({
        data: {
          title: a.title,
          status: a.status,
          priority: a.priority,
          dueDate: a.dueInDays !== undefined ? daysFromNow(a.dueInDays) : null,
          goalId: goal.id,
        },
      });
      if (a.status === "DONE" && a.doneDaysAgo !== undefined) {
        eventRows.push({
          entityType: "ACTION",
          entityId: action.id,
          eventType: "STATUS_CHANGED",
          payload: { from: "IN_PROGRESS", to: "DONE", title: a.title },
          occurredAt: daysAgo(a.doneDaysAgo),
        });
      }
    }
  }

  // Convenient aliases for goals referenced by schedule events / relationships.
  const taGoal = goalByKey["ta"];
  const startupGoal = goalByKey["startup"];
  const researchGoal = goalByKey["research"];
  const marathonGoal = goalByKey["marathon"];
  const nutritionGoal = goalByKey["nutrition"];

  // Events for completed goals (created + completed) so the trend/timeline fill in.
  for (let i = 0; i < completedGoals.length; i++) {
    const g = completedGoals[i];
    eventRows.push({
      entityType: "GOAL",
      entityId: g.id,
      eventType: "CREATED",
      payload: { title: g.title },
      occurredAt: g.createdAt,
    });
    if (g.completedAt) {
      eventRows.push({
        entityType: "GOAL",
        entityId: g.id,
        eventType: "STATUS_CHANGED",
        payload: { from: "ACTIVE", to: "COMPLETED", title: g.title },
        occurredAt: g.completedAt,
      });
    }
  }

  // ─── Stakeholders (22) ────────────────────────────────────────

  interface StakeholderSpec {
    name: string;
    organization: string | null;
    role: string | null;
    relationshipStrength: number;
    lastInteractionDaysAgo: number;
    notes: string;
    capabilities: { type: string; description: string; condition: string | null }[];
  }

  const stakeholderSpecs: StakeholderSpec[] = [
    { name: "Prof. Chen", organization: "CS Department", role: "Professor, CS 301", relationshipStrength: 75, lastInteractionDaysAgo: 10, notes: "Very supportive, met during office hours multiple times", capabilities: [{ type: "willingness", description: "write recommendation letter", condition: "maintain A grade and attend office hours regularly" }, { type: "capability", description: "TA position referral", condition: "demonstrate teaching ability in study groups" }, { type: "willingness", description: "research mentorship", condition: "commit to weekly lab meetings" }] },
    { name: "Sarah Kim", organization: "Sequoia Capital", role: "Venture Partner", relationshipStrength: 30, lastInteractionDaysAgo: 28, notes: "Met at YC Demo Day, expressed interest in AI tools", capabilities: [{ type: "willingness", description: "pre-seed investment", condition: "working MVP with early traction metrics" }, { type: "capability", description: "warm introductions to other VCs", condition: "strong pitch deck and clear market thesis" }, { type: "willingness", description: "strategic advising for fundraising", condition: null }] },
    { name: "Dr. Patel", organization: "ML Research Lab", role: "Lab Director", relationshipStrength: 60, lastInteractionDaysAgo: 22, notes: "Potential research advisor, strong publication record", capabilities: [{ type: "capability", description: "co-author research paper", condition: "novel contribution to graph-based reasoning" }, { type: "willingness", description: "provide lab resources and compute", condition: "formal research collaboration agreement" }, { type: "capability", description: "conference submission guidance", condition: null }] },
    { name: "Dad", organization: null, role: "Family", relationshipStrength: 95, lastInteractionDaysAgo: 2, notes: "Supportive of education goals, willing to help financially under conditions", capabilities: [{ type: "willingness", description: "financial support for tuition", condition: "maintain 3.5 GPA" }, { type: "willingness", description: "cover living expenses", condition: "enrolled full-time" }, { type: "willingness", description: "fund conference travel", condition: "paper accepted at a top venue" }] },
    { name: "Mom", organization: null, role: "Family", relationshipStrength: 95, lastInteractionDaysAgo: 1, notes: "Emotional support, well-connected in healthcare industry", capabilities: [{ type: "willingness", description: "emotional support and guidance", condition: null }, { type: "capability", description: "introductions in healthcare industry", condition: "relevant to health-tech or biotech" }, { type: "willingness", description: "co-sign apartment lease", condition: "enrolled in university" }] },
    { name: "Lisa Wang", organization: "Accel Partners", role: "Associate", relationshipStrength: 20, lastInteractionDaysAgo: 210, notes: "Brief intro at networking event", capabilities: [{ type: "capability", description: "seed-stage deal flow introductions", condition: "strong product-market fit signal" }] },
    { name: "James Rodriguez", organization: "CS Department", role: "PhD Student", relationshipStrength: 55, lastInteractionDaysAgo: 86, notes: "Collaborator on side project", capabilities: [{ type: "capability", description: "peer tutoring and study group leadership", condition: null }, { type: "willingness", description: "co-author papers", condition: "shared research interest" }] },
    { name: "Emily Zhang", organization: "Google Research", role: "Research Scientist", relationshipStrength: 40, lastInteractionDaysAgo: 227, notes: "Met at ICML poster session", capabilities: [{ type: "capability", description: "industry research collaboration", condition: "publishable results" }] },
    { name: "Michael Torres", organization: "Stanford AI Lab", role: "Postdoc", relationshipStrength: 35, lastInteractionDaysAgo: 252, notes: "Potential co-author", capabilities: [{ type: "willingness", description: "co-author research paper", condition: "complementary expertise in NLP" }] },
    { name: "Anna Kowalski", organization: "YC", role: "Group Partner", relationshipStrength: 15, lastInteractionDaysAgo: 293, notes: "Attended YC info session", capabilities: [{ type: "capability", description: "accelerator application guidance", condition: "viable startup idea with technical founder" }] },
    { name: "Diana Wu", organization: "Stanford CS", role: "PhD Candidate", relationshipStrength: 70, lastInteractionDaysAgo: 42, notes: "Close research collaborator", capabilities: [{ type: "willingness", description: "co-author and peer review papers", condition: null }, { type: "capability", description: "share GPU compute resources", condition: "reciprocal collaboration" }] },
    { name: "Marcus Lee", organization: "Stripe", role: "Engineering Manager", relationshipStrength: 50, lastInteractionDaysAgo: 18, notes: "Former colleague, great for career advice", capabilities: [{ type: "capability", description: "referral for senior engineering roles", condition: "strong system design interview prep" }, { type: "willingness", description: "mock interviews", condition: null }] },
    { name: "Priya Nair", organization: "First Round Capital", role: "Principal", relationshipStrength: 25, lastInteractionDaysAgo: 64, notes: "Intro via Sarah Kim, focuses on dev tools", capabilities: [{ type: "willingness", description: "pre-seed check", condition: "clear developer adoption metrics" }] },
    { name: "Tom Becker", organization: "Local Library", role: "Programs Coordinator", relationshipStrength: 45, lastInteractionDaysAgo: 12, notes: "Helping arrange the beginner coding workshop", capabilities: [{ type: "capability", description: "provide free venue and promotion", condition: "free public workshop" }] },
    { name: "Grace Okafor", organization: "TechWomen Meetup", role: "Organizer", relationshipStrength: 38, lastInteractionDaysAgo: 33, notes: "Met through social-circle goal, very welcoming", capabilities: [{ type: "willingness", description: "speaker slot at meetup", condition: "talk relevant to community" }] },
    { name: "Coach Dave", organization: "City Running Club", role: "Run Coach", relationshipStrength: 65, lastInteractionDaysAgo: 4, notes: "Helping with half-marathon training plan", capabilities: [{ type: "capability", description: "personalized training plan", condition: "consistent attendance" }] },
    { name: "Hiro Tanaka", organization: null, role: "Friend / Travel buddy", relationshipStrength: 80, lastInteractionDaysAgo: 6, notes: "Planning the Japan trip together", capabilities: [{ type: "willingness", description: "co-plan and split travel costs", condition: null }] },
    { name: "Elena Sokolova", organization: "Spanish Tutoring Co.", role: "Language Tutor", relationshipStrength: 30, lastInteractionDaysAgo: 50, notes: "Trial Spanish lesson, good fit", capabilities: [{ type: "capability", description: "weekly conversation practice", condition: "consistent scheduling" }] },
    { name: "Nina Patel", organization: "DevTools Weekly", role: "Newsletter Editor", relationshipStrength: 22, lastInteractionDaysAgo: 70, notes: "Could feature the OSS project", capabilities: [{ type: "willingness", description: "feature project in newsletter", condition: "compelling launch story" }] },
    { name: "Carlos Mendes", organization: "Open Source Collective", role: "Maintainer", relationshipStrength: 48, lastInteractionDaysAgo: 16, notes: "Reviews my OSS PRs, very responsive", capabilities: [{ type: "capability", description: "mentor first-time contributors", condition: null }, { type: "willingness", description: "review PRs promptly", condition: null }] },
    { name: "Rachel Green", organization: "Wellness Studio", role: "Sleep Coach", relationshipStrength: 28, lastInteractionDaysAgo: 95, notes: "One session on sleep hygiene", capabilities: [{ type: "capability", description: "sleep routine coaching", condition: null }] },
    { name: "Sam Idowu", organization: "Photo Club", role: "Club Lead", relationshipStrength: 33, lastInteractionDaysAgo: 24, notes: "Runs monthly photo walks", capabilities: [{ type: "willingness", description: "portfolio feedback", condition: "attend photo walks" }] },
  ];

  const stakeholderByName: Record<string, { id: string; name: string }> = {};
  for (const s of stakeholderSpecs) {
    const created = await prisma.stakeholder.create({
      data: {
        name: s.name,
        organization: s.organization,
        role: s.role,
        relationshipStrength: s.relationshipStrength,
        lastInteraction: daysAgo(s.lastInteractionDaysAgo),
        notes: s.notes,
        capabilities: s.capabilities,
      },
    });
    stakeholderByName[s.name] = { id: created.id, name: created.name };
    eventRows.push({
      entityType: "STAKEHOLDER",
      entityId: created.id,
      eventType: "CREATED",
      payload: { title: created.name },
      occurredAt: daysAgo(Math.min(s.lastInteractionDaysAgo + 5, 300)),
    });
    // A recent interaction event for stakeholders contacted in the last ~45 days.
    if (s.lastInteractionDaysAgo <= 45) {
      eventRows.push({
        entityType: "STAKEHOLDER",
        entityId: created.id,
        eventType: "UPDATED",
        payload: { title: created.name, updatedFields: ["lastInteraction"] },
        occurredAt: daysAgo(s.lastInteractionDaysAgo),
      });
    }
  }

  // Some standalone evidence tied to stakeholders.
  await prisma.evidence.create({ data: { title: "Meeting with Sarah Kim at demo day", description: "Positive conversation, exchanged contacts", source: "meeting", stakeholderId: stakeholderByName["Sarah Kim"].id } });
  await prisma.evidence.create({ data: { title: "Coffee chat with Marcus Lee", description: "Discussed senior role referral path", source: "meeting", stakeholderId: stakeholderByName["Marcus Lee"].id } });
  await prisma.evidence.create({ data: { title: "Library confirmed workshop room", description: "Room booked for 4 Saturdays", source: "email", stakeholderId: stakeholderByName["Tom Becker"].id } });

  // ─── Relationships (graph edges) ──────────────────────────────

  const relSpecs: { from: { id: string }; to: { id: string }; label: string; sFrom?: string; gTo?: string; gFrom?: string }[] = [];

  async function linkStakeholderToGoal(stakeholderName: string, goalKey: string, label: string) {
    const sh = stakeholderByName[stakeholderName];
    const g = goalByKey[goalKey];
    if (!sh || !g) return;
    await prisma.relationship.create({
      data: {
        fromType: "STAKEHOLDER", fromId: sh.id, toType: "GOAL", toId: g.id,
        label, stakeholderFromId: sh.id, goalToId: g.id,
      },
    });
    eventRows.push({ entityType: "STAKEHOLDER", entityId: sh.id, eventType: "RELATIONSHIP_ADDED", payload: { title: sh.name, to: g.title }, occurredAt: daysAgo(20) });
  }

  async function linkGoalToGoal(fromKey: string, toKey: string, label: string) {
    const f = goalByKey[fromKey];
    const t = goalByKey[toKey];
    if (!f || !t) return;
    await prisma.relationship.create({
      data: {
        fromType: "GOAL", fromId: f.id, toType: "GOAL", toId: t.id,
        label, goalFromId: f.id, goalToId: t.id,
      },
    });
  }
  void relSpecs;

  await linkStakeholderToGoal("Prof. Chen", "ta", "can recommend for");
  await linkStakeholderToGoal("James Rodriguez", "ta", "co-leads study group");
  await linkStakeholderToGoal("Sarah Kim", "startup", "potential investor");
  await linkStakeholderToGoal("Priya Nair", "startup", "potential investor");
  await linkStakeholderToGoal("Lisa Wang", "startup", "investor intro");
  await linkStakeholderToGoal("Dr. Patel", "research", "research advisor");
  await linkStakeholderToGoal("Diana Wu", "research", "co-author");
  await linkStakeholderToGoal("Emily Zhang", "research", "industry collaborator");
  await linkStakeholderToGoal("Michael Torres", "research", "potential co-author");
  await linkStakeholderToGoal("Marcus Lee", "freelance", "referral source");
  await linkStakeholderToGoal("Tom Becker", "workshop", "venue host");
  await linkStakeholderToGoal("Grace Okafor", "social", "community connector");
  await linkStakeholderToGoal("Coach Dave", "marathon", "training coach");
  await linkStakeholderToGoal("Hiro Tanaka", "backpackEurope", "travel partner");
  await linkStakeholderToGoal("Elena Sokolova", "spanish", "language tutor");
  await linkStakeholderToGoal("Nina Patel", "leadership", "could feature project");
  await linkStakeholderToGoal("Carlos Mendes", "oss", "reviews PRs");
  await linkStakeholderToGoal("Rachel Green", "sleep", "sleep coach");
  await linkStakeholderToGoal("Sam Idowu", "photography", "portfolio feedback");
  await linkStakeholderToGoal("Dad", "familyFinance", "stakeholder");
  await linkStakeholderToGoal("Mom", "dadCalls", "stakeholder");

  await linkGoalToGoal("research", "ta", "strengthens application");
  await linkGoalToGoal("startup", "freelance", "shares client network");
  await linkGoalToGoal("spanish", "backpackEurope", "supports");
  await linkGoalToGoal("marathon", "sleep", "depends on");
  await linkGoalToGoal("blog", "leadership", "drives awareness for");

  // ─── Persist all events ───────────────────────────────────────

  for (const e of eventRows) {
    await prisma.event.create({
      data: {
        entityType: e.entityType,
        entityId: e.entityId,
        eventType: e.eventType,
        payload: e.payload,
        occurredAt: e.occurredAt,
      },
    });
  }

  // ─── Schedule Events (this week) ──────────────────────────────

  const weekStart = new Date(NOW);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  // TA Goal - study group sessions (Mon/Wed/Fri)
  for (const dayOffset of [1, 3, 5]) {
    const start = new Date(weekStart);
    start.setDate(start.getDate() + dayOffset);
    start.setHours(14, 0, 0, 0);
    const end = new Date(start);
    end.setHours(15, 0, 0, 0);
    await prisma.scheduleEvent.create({ data: { title: "Study group session", description: "Lead classmate study group for CS 301", startTime: start, endTime: end, source: "GOALOS", goalId: taGoal.id, color: "#3b82f6" } });
  }

  // TA Goal - office hours (Tuesday)
  const taOfficeHours = new Date(weekStart);
  taOfficeHours.setDate(taOfficeHours.getDate() + 2);
  taOfficeHours.setHours(10, 0, 0, 0);
  const taOfficeEnd = new Date(taOfficeHours);
  taOfficeEnd.setHours(11, 0, 0, 0);
  await prisma.scheduleEvent.create({ data: { title: "Office hours with Prof. Chen", description: "Weekly office hours to strengthen relationship", startTime: taOfficeHours, endTime: taOfficeEnd, source: "GOALOS", goalId: taGoal.id, color: "#3b82f6" } });

  // Startup Goal - MVP work blocks (Mon/Tue/Thu 9-12)
  for (const dayOffset of [1, 2, 4]) {
    const start = new Date(weekStart);
    start.setDate(start.getDate() + dayOffset);
    start.setHours(9, 0, 0, 0);
    const end = new Date(start);
    end.setHours(12, 0, 0, 0);
    await prisma.scheduleEvent.create({ data: { title: "MVP development sprint", description: "Core feature development for AI productivity tool", startTime: start, endTime: end, source: "GOALOS", goalId: startupGoal.id, color: "#10b981" } });
  }

  // Startup Goal - investor outreach (Wednesday)
  const investorBlock = new Date(weekStart);
  investorBlock.setDate(investorBlock.getDate() + 3);
  investorBlock.setHours(16, 0, 0, 0);
  const investorEnd = new Date(investorBlock);
  investorEnd.setHours(18, 0, 0, 0);
  await prisma.scheduleEvent.create({ data: { title: "Investor outreach & follow-ups", description: "Email warm intros, update pitch materials", startTime: investorBlock, endTime: investorEnd, source: "GOALOS", goalId: startupGoal.id, color: "#10b981" } });

  // Research Goal - literature review (Tue/Thu 14-16)
  for (const dayOffset of [2, 4]) {
    const start = new Date(weekStart);
    start.setDate(start.getDate() + dayOffset);
    start.setHours(14, 0, 0, 0);
    const end = new Date(start);
    end.setHours(16, 0, 0, 0);
    await prisma.scheduleEvent.create({ data: { title: "Literature review & note-taking", description: "Read and annotate papers for graph-based reasoning survey", startTime: start, endTime: end, source: "GOALOS", goalId: researchGoal.id, color: "#f59e0b" } });
  }

  // Research Goal - experiment design (Saturday morning)
  const satResearch = new Date(weekStart);
  satResearch.setDate(satResearch.getDate() + 6);
  satResearch.setHours(10, 0, 0, 0);
  const satResearchEnd = new Date(satResearch);
  satResearchEnd.setHours(13, 0, 0, 0);
  await prisma.scheduleEvent.create({ data: { title: "Experiment design work", description: "Draft methodology section and plan experiments", startTime: satResearch, endTime: satResearchEnd, source: "GOALOS", goalId: researchGoal.id, color: "#f59e0b" } });

  // Marathon training (Mon/Wed/Sat morning)
  for (const dayOffset of [1, 3, 6]) {
    const start = new Date(weekStart);
    start.setDate(start.getDate() + dayOffset);
    start.setHours(6, 30, 0, 0);
    const end = new Date(start);
    end.setHours(7, 30, 0, 0);
    await prisma.scheduleEvent.create({ data: { title: "Running training", description: "Half marathon training run", startTime: start, endTime: end, source: "GOALOS", goalId: marathonGoal.id, color: "#ef4444" } });
  }

  // Meal prep (Sunday afternoon)
  const mealPrepStart = new Date(weekStart);
  mealPrepStart.setHours(15, 0, 0, 0);
  const mealPrepEnd = new Date(mealPrepStart);
  mealPrepEnd.setHours(17, 0, 0, 0);
  await prisma.scheduleEvent.create({ data: { title: "Weekly meal prep", description: "Prepare healthy meals for the week", startTime: mealPrepStart, endTime: mealPrepEnd, source: "GOALOS", goalId: nutritionGoal.id, color: "#8b5cf6" } });

  // ─── Summary ──────────────────────────────────────────────────
  const totalPrereqs = activeGoalSpecs.reduce((n, g) => n + g.prereqs.length, 0);
  const totalActions = activeGoalSpecs.reduce((n, g) => n + g.actions.length, 0);
  console.log("Seed data created successfully");
  console.log(`  - ${values.length} values`);
  console.log(`  - ${completedGoals.length} completed goals`);
  console.log(`  - ${activeGoalSpecs.length} active goals`);
  console.log(`  - ${stakeholderSpecs.length} stakeholders`);
  console.log(`  - ${totalPrereqs} prerequisites`);
  console.log(`  - ${totalActions} actions`);
  console.log(`  - ${eventRows.length} events`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
