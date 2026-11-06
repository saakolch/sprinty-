import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { ensureActivePeriod } from "@/lib/finance-period";
import { summarize } from "@/lib/finance";
import { todayIn } from "@/lib/habits";
import { DEFAULT_COLUMN_NAMES } from "@/lib/kanban";

/**
 * MCP tool definitions.
 *
 * Every tool runs with the caller's Supabase client, so Row Level Security is
 * the only thing deciding what a tool can read or write. `userId` is used for
 * inserts and comes from the verified JWT — never from tool arguments.
 */

export interface McpToolContext {
  supabase: SupabaseClient;
  userId: string;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: z.ZodType;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

const uuid = z.string().uuid();

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "Use a real ISO date (YYYY-MM-DD).");

const priority = z.enum(["low", "medium", "high"]);

function fail(message: string): never {
  throw new Error(message);
}

function userIdOf(context: McpToolContext): string {
  return context.userId;
}

async function todayFor(context: McpToolContext): Promise<string> {
  const { data } = await context.supabase
    .from("profiles")
    .select("timezone")
    .eq("id", context.userId)
    .maybeSingle();

  return todayIn((data as { timezone?: string } | null)?.timezone ?? "UTC");
}

async function periodId(context: McpToolContext, name?: string): Promise<string> {
  if (name) {
    const { data, error } = await context.supabase
      .from("finance_periods")
      .select("id")
      .eq("name", name)
      .maybeSingle();
    if (error) fail(error.message);
    if (!data) fail(`No finance period named "${name}".`);
    return (data as { id: string }).id;
  }

  const id = await ensureActivePeriod(context.supabase, context.userId);
  if (!id) fail("Could not open a finance period.");
  return id;
}

async function nextCardPosition(context: McpToolContext, columnId: string): Promise<number> {
  const { data } = await context.supabase
    .from("cards")
    .select("position")
    .eq("column_id", columnId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  return ((data as { position?: number } | null)?.position ?? -1) + 1;
}

async function ensureColumn(
  context: McpToolContext,
  boardId?: string,
  columnId?: string,
): Promise<{ boardId: string; columnId: string }> {
  if (columnId) {
    const { data, error } = await context.supabase
      .from("board_columns")
      .select("id, board_id")
      .eq("id", columnId)
      .maybeSingle();
    if (error) fail(error.message);
    if (!data) fail("Column not found.");
    return { boardId: (data as { board_id: string }).board_id, columnId };
  }

  if (boardId) {
    const { data } = await context.supabase
      .from("board_columns")
      .select("id")
      .eq("board_id", boardId)
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!data) fail("That board has no columns.");
    return { boardId, columnId: (data as { id: string }).id };
  }

  const { data: existingBoard } = await context.supabase
    .from("boards")
    .select("id")
    .order("position", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let resolvedBoard = (existingBoard as { id: string } | null)?.id;

  if (!resolvedBoard) {
    const { data: board, error } = await context.supabase
      .from("boards")
      .insert({ user_id: userIdOf(context), name: "My Projects" })
      .select("id")
      .single();
    if (error) fail(error.message);
    resolvedBoard = (board as { id: string }).id;

    const { error: columnError } = await context.supabase.from("board_columns").insert(
      DEFAULT_COLUMN_NAMES.map((name, index) => ({
        user_id: userIdOf(context),
        board_id: resolvedBoard,
        name,
        position: index,
      })),
    );
    if (columnError) fail(columnError.message);
  }

  const { data: firstColumn } = await context.supabase
    .from("board_columns")
    .select("id")
    .eq("board_id", resolvedBoard)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!firstColumn) fail("Board has no columns.");
  return { boardId: resolvedBoard, columnId: (firstColumn as { id: string }).id };
}

async function completeCard(context: McpToolContext, cardId: string): Promise<void> {
  const { data: card, error } = await context.supabase
    .from("cards")
    .select("id, board_id")
    .eq("id", cardId)
    .maybeSingle();
  if (error) fail(error.message);
  if (!card) fail("Card not found.");

  const boardId = (card as { board_id: string }).board_id;
  const { data: doneColumn } = await context.supabase
    .from("board_columns")
    .select("id")
    .eq("board_id", boardId)
    .ilike("name", "done")
    .limit(1)
    .maybeSingle();

  const update: Record<string, unknown> = { completed_at: new Date().toISOString() };
  if (doneColumn) {
    const target = (doneColumn as { id: string }).id;
    update.column_id = target;
    update.position = await nextCardPosition(context, target);
  }

  const { error: updateError } = await context.supabase
    .from("cards")
    .update(update)
    .eq("id", cardId);
  if (updateError) fail(updateError.message);
}

const goalFields = {
  title: z.string().trim().min(1).max(200),
  description: z.string().max(20_000).optional(),
  notes: z.string().max(20_000).optional(),
  category: z.string().max(200).optional(),
  priority: priority.optional(),
  status: z.enum(["active", "completed", "archived"]).optional(),
  start_date: isoDate.nullable().optional(),
  deadline: isoDate.nullable().optional(),
  progress_source: z.enum(["measures", "habit", "manual"]).optional(),
  measures: z
    .array(
      z.object({
        metric: z.string().trim().min(1).max(120),
        target: z.number().min(0).max(1e15).nullable().optional(),
        current: z.number().min(0).max(1e15).nullable().optional(),
        unit: z.string().max(20).optional(),
      }),
    )
    .max(50)
    .optional(),
  tasks: z
    .array(z.object({ title: z.string().trim().min(1).max(300), done: z.boolean().optional() }))
    .max(200)
    .optional(),
};

const goalPatch = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(20_000).optional(),
  notes: z.string().max(20_000).optional(),
  category: z.string().max(200).optional(),
  priority: priority.optional(),
  status: z.enum(["active", "completed", "archived"]).optional(),
  start_date: isoDate.nullable().optional(),
  deadline: isoDate.nullable().optional(),
  progress_source: z.enum(["measures", "habit", "manual"]).optional(),
  measures: goalFields.measures,
  tasks: goalFields.tasks,
});

const taskFields = {
  title: z.string().trim().min(1).max(300),
  description: z.string().max(20_000).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  due_date: isoDate.nullable().optional(),
  board_id: uuid.optional(),
  column_id: uuid.optional(),
};

const taskPatch = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  description: z.string().max(20_000).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  due_date: isoDate.nullable().optional(),
  done: z.boolean().optional(),
});

const noteFields = {
  title: z.string().max(200).optional(),
  body: z.string().max(100_000).optional(),
};

export function createTools(context: McpToolContext): McpTool[] {
  const { supabase } = context;

  return [
    {
      name: "lifeos_query",
      description:
        "Read LifeOS data. Types: dashboard (totals, today's habits, due cards, finance summary), habits, today_habits, finance_summary (optional period), notes, note, goals, goal, tasks, task. `id` is required for note, goal and task.",
      inputSchema: z.object({
        type: z.enum([
          "dashboard",
          "habits",
          "today_habits",
          "finance_summary",
          "notes",
          "note",
          "goals",
          "goal",
          "tasks",
          "task",
        ]),
        id: uuid.optional(),
        period: z.string().trim().min(1).max(120).optional(),
      }),
      execute: async (args) => {
        const type = args.type as string;
        const id = args.id as string | undefined;
        const today = await todayFor(context);

        switch (type) {
          case "dashboard": {
            const [habitRows, logRows, dueCards, tx, goalCount] = await Promise.all([
              supabase.from("habits").select("id, name").eq("archived", false),
              supabase.from("habit_logs").select("habit_id").eq("log_date", today).eq("done", true),
              supabase
                .from("cards")
                .select("id, title, priority")
                .eq("due_date", today)
                .eq("archived", false),
              supabase.from("finance_periods").select("id").eq("is_active", true).maybeSingle(),
              supabase.from("goals").select("id", { count: "exact", head: true }),
            ]);

            const period = (tx.data as { id: string } | null)?.id;
            let transactions: { kind: string; amount: number | string }[] = [];
            if (period) {
              const { data } = await supabase
                .from("finance_transactions")
                .select("kind, amount")
                .eq("period_id", period);
              transactions = (data ?? []) as { kind: string; amount: number | string }[];
            }

            const doneIds = new Set(
              ((logRows.data ?? []) as { habit_id: string }[]).map((row) => row.habit_id),
            );

            return {
              today,
              goals: goalCount.count ?? 0,
              habits: ((habitRows.data ?? []) as { id: string; name: string }[]).map((habit) => ({
                ...habit,
                done: doneIds.has(habit.id),
              })),
              dueToday: dueCards.data ?? [],
              finance: summarize(transactions),
            };
          }

          case "habits": {
            const { data, error } = await supabase
              .from("habits")
              .select("id, name, created_at")
              .eq("archived", false)
              .order("position", { ascending: true });
            if (error) fail(error.message);
            return { habits: data ?? [] };
          }

          case "today_habits": {
            const [habitRows, logRows] = await Promise.all([
              supabase
                .from("habits")
                .select("id, name")
                .eq("archived", false)
                .order("position", { ascending: true }),
              supabase.from("habit_logs").select("habit_id").eq("log_date", today).eq("done", true),
            ]);
            const done = new Set(
              ((logRows.data ?? []) as { habit_id: string }[]).map((row) => row.habit_id),
            );
            return {
              date: today,
              habits: ((habitRows.data ?? []) as { id: string; name: string }[]).map((habit) => ({
                ...habit,
                done: done.has(habit.id),
              })),
            };
          }

          case "finance_summary": {
            const period = await periodId(context, args.period as string | undefined);
            const { data, error } = await supabase
              .from("finance_transactions")
              .select("kind, amount")
              .eq("period_id", period);
            if (error) fail(error.message);
            return {
              period,
              ...summarize((data ?? []) as { kind: string; amount: number | string }[]),
            };
          }

          case "notes": {
            const { data, error } = await supabase
              .from("notes")
              .select("id, title, updated_at")
              .order("updated_at", { ascending: false })
              .limit(50);
            if (error) fail(error.message);
            return { notes: data ?? [] };
          }

          case "note": {
            if (!id) fail("note requires an id.");
            const { data, error } = await supabase
              .from("notes")
              .select("id, title, body, updated_at")
              .eq("id", id)
              .maybeSingle();
            if (error) fail(error.message);
            if (!data) fail("Note not found.");
            return { note: data };
          }

          case "goals": {
            const { data, error } = await supabase
              .from("goals")
              .select(
                "id, title, status, deadline, goal_measures(id, metric, target, current, unit)",
              )
              .order("created_at", { ascending: true });
            if (error) fail(error.message);
            return { goals: data ?? [] };
          }

          case "goal": {
            if (!id) fail("goal requires an id.");
            const { data, error } = await supabase
              .from("goals")
              .select(
                "id, title, description, notes, status, deadline, goal_measures(id, metric, target, current, unit), goal_tasks(id, title, done)",
              )
              .eq("id", id)
              .maybeSingle();
            if (error) fail(error.message);
            if (!data) fail("Goal not found.");
            return { goal: data };
          }

          case "tasks": {
            const { data, error } = await supabase
              .from("cards")
              .select("id, title, description, priority, due_date, column_id, completed_at")
              .eq("archived", false)
              .order("position", { ascending: true });
            if (error) fail(error.message);
            return { tasks: data ?? [] };
          }

          case "task": {
            if (!id) fail("task requires an id.");
            const { data, error } = await supabase
              .from("cards")
              .select("id, title, description, priority, due_date, column_id, completed_at")
              .eq("id", id)
              .maybeSingle();
            if (error) fail(error.message);
            if (!data) fail("Task not found.");
            return { task: data };
          }

          default:
            fail(`Unknown query type "${type}".`);
        }
      },
    },

    {
      name: "lifeos_create_goal",
      description: "Create a goal with optional success measures and checklist tasks.",
      inputSchema: z.object(goalFields),
      execute: async (args) => {
        const { measures, tasks, ...fields } = args as {
          measures?: {
            metric: string;
            target?: number | null;
            current?: number | null;
            unit?: string;
          }[];
          tasks?: { title: string; done?: boolean }[];
        } & Record<string, unknown>;

        const { data, error } = await supabase
          .from("goals")
          .insert({ user_id: userIdOf(context), ...fields })
          .select("id")
          .single();
        if (error) fail(error.message);

        const goalId = (data as { id: string }).id;

        if (measures?.length) {
          const { error: measureError } = await supabase.from("goal_measures").insert(
            measures.map((measure, index) => ({
              user_id: userIdOf(context),
              goal_id: goalId,
              metric: measure.metric,
              target: measure.target ?? null,
              current: measure.current ?? null,
              unit: measure.unit ?? "",
              position: index,
            })),
          );
          if (measureError) fail(measureError.message);
        }

        if (tasks?.length) {
          const { error: taskError } = await supabase.from("goal_tasks").insert(
            tasks.map((task, index) => ({
              user_id: userIdOf(context),
              goal_id: goalId,
              title: task.title,
              done: task.done ?? false,
              position: index,
            })),
          );
          if (taskError) fail(taskError.message);
        }

        return { id: goalId, measures: measures?.length ?? 0, tasks: tasks?.length ?? 0 };
      },
    },

    {
      name: "lifeos_update_goal",
      description:
        "Update goal fields. Supplying measures or tasks replaces their lists; omitted fields are kept.",
      inputSchema: z.object({ id: uuid, patch: goalPatch }),
      execute: async (args) => {
        const id = args.id as string;
        const patch = args.patch as Record<string, unknown>;

        const update: Record<string, unknown> = {};
        for (const key of [
          "title",
          "description",
          "notes",
          "category",
          "priority",
          "status",
          "start_date",
          "deadline",
          "progress_source",
        ]) {
          if (key in patch) update[key] = patch[key];
        }

        if (Object.keys(update).length > 0) {
          const { data, error } = await supabase
            .from("goals")
            .update(update)
            .eq("id", id)
            .select("id")
            .maybeSingle();
          if (error) fail(error.message);
          if (!data) fail("Goal not found.");
        }

        if (Array.isArray(patch.measures)) {
          await supabase.from("goal_measures").delete().eq("goal_id", id);
          const measures = patch.measures as {
            metric: string;
            target?: number | null;
            current?: number | null;
            unit?: string;
          }[];
          if (measures.length) {
            const { error } = await supabase.from("goal_measures").insert(
              measures.map((measure, index) => ({
                user_id: userIdOf(context),
                goal_id: id,
                metric: measure.metric,
                target: measure.target ?? null,
                current: measure.current ?? null,
                unit: measure.unit ?? "",
                position: index,
              })),
            );
            if (error) fail(error.message);
          }
        }

        if (Array.isArray(patch.tasks)) {
          await supabase.from("goal_tasks").delete().eq("goal_id", id);
          const tasks = patch.tasks as { title: string; done?: boolean }[];
          if (tasks.length) {
            const { error } = await supabase.from("goal_tasks").insert(
              tasks.map((task, index) => ({
                user_id: userIdOf(context),
                goal_id: id,
                title: task.title,
                done: task.done ?? false,
                position: index,
              })),
            );
            if (error) fail(error.message);
          }
        }

        return { id };
      },
    },

    {
      name: "lifeos_delete_goal",
      description: "Permanently delete a goal with its measures and tasks.",
      inputSchema: z.object({ id: uuid }),
      execute: async (args) => {
        const id = args.id as string;
        const { data, error } = await supabase
          .from("goals")
          .delete()
          .eq("id", id)
          .select("id")
          .maybeSingle();
        if (error) fail(error.message);
        if (!data) fail("Goal not found.");
        return { id, deleted: true };
      },
    },

    {
      name: "lifeos_create_task",
      description:
        "Create a Kanban card. Without board/column it goes to the first column of the first board (creating the default board when needed).",
      inputSchema: z.object(taskFields),
      execute: async (args) => {
        const target = await ensureColumn(
          context,
          args.board_id as string | undefined,
          args.column_id as string | undefined,
        );
        const position = await nextCardPosition(context, target.columnId);

        const { data, error } = await supabase
          .from("cards")
          .insert({
            user_id: userIdOf(context),
            board_id: target.boardId,
            column_id: target.columnId,
            title: args.title,
            description: (args.description as string | undefined) ?? "",
            priority: (args.priority as string | undefined) ?? "medium",
            due_date: (args.due_date as string | undefined) ?? null,
            position,
          })
          .select("id")
          .single();
        if (error) fail(error.message);

        return { id: (data as { id: string }).id, ...target };
      },
    },

    {
      name: "lifeos_update_task",
      description:
        "Update a Kanban card. Setting done=true moves it to the Done column when one exists.",
      inputSchema: z.object({ id: uuid, patch: taskPatch }),
      execute: async (args) => {
        const id = args.id as string;
        const patch = args.patch as Record<string, unknown>;

        const update: Record<string, unknown> = {};
        for (const key of ["title", "description", "priority", "due_date"]) {
          if (key in patch) update[key] = patch[key];
        }

        if (patch.done === true) {
          await completeCard(context, id);
        } else if (patch.done === false) {
          update.completed_at = null;
        }

        if (Object.keys(update).length > 0) {
          const { data, error } = await supabase
            .from("cards")
            .update(update)
            .eq("id", id)
            .select("id")
            .maybeSingle();
          if (error) fail(error.message);
          if (!data) fail("Task not found.");
        }

        return { id };
      },
    },

    {
      name: "lifeos_complete_task",
      description: "Complete a Kanban card, moving it to the Done column when one exists.",
      inputSchema: z.object({ id: uuid }),
      execute: async (args) => {
        const id = args.id as string;
        await completeCard(context, id);
        return { id, done: true };
      },
    },

    {
      name: "lifeos_delete_task",
      description: "Permanently delete a Kanban card.",
      inputSchema: z.object({ id: uuid }),
      execute: async (args) => {
        const id = args.id as string;
        const { data, error } = await supabase
          .from("cards")
          .delete()
          .eq("id", id)
          .select("id")
          .maybeSingle();
        if (error) fail(error.message);
        if (!data) fail("Task not found.");
        return { id, deleted: true };
      },
    },

    {
      name: "lifeos_complete_habit",
      description: "Mark a habit complete for a date (default: today).",
      inputSchema: z.object({ habit_id: uuid, date: isoDate.optional() }),
      execute: async (args) => {
        const habitId = args.habit_id as string;
        const date = (args.date as string | undefined) ?? (await todayFor(context));

        const { data: habit, error } = await supabase
          .from("habits")
          .select("id")
          .eq("id", habitId)
          .maybeSingle();
        if (error) fail(error.message);
        if (!habit) fail("Habit not found.");

        const { error: logError } = await supabase
          .from("habit_logs")
          .upsert(
            { user_id: userIdOf(context), habit_id: habitId, log_date: date, done: true },
            { onConflict: "habit_id,log_date" },
          );
        if (logError) fail(logError.message);

        return { habit_id: habitId, date, done: true };
      },
    },

    {
      name: "lifeos_uncomplete_habit",
      description: "Remove a habit completion for a date (default: today).",
      inputSchema: z.object({ habit_id: uuid, date: isoDate.optional() }),
      execute: async (args) => {
        const habitId = args.habit_id as string;
        const date = (args.date as string | undefined) ?? (await todayFor(context));

        const { error } = await supabase
          .from("habit_logs")
          .delete()
          .eq("habit_id", habitId)
          .eq("log_date", date);
        if (error) fail(error.message);

        return { habit_id: habitId, date, done: false };
      },
    },

    {
      name: "lifeos_log_expense",
      description: "Record an expense in the active (or named) finance period.",
      inputSchema: z.object({
        description: z.string().trim().min(1).max(200),
        amount: z.number().positive().max(1e15),
        date: isoDate.optional(),
        category_id: uuid.optional(),
        period: z.string().trim().min(1).max(120).optional(),
      }),
      execute: (args) => addTransaction(context, "expense", args),
    },

    {
      name: "lifeos_set_income",
      description: "Record income in the active (or named) finance period.",
      inputSchema: z.object({
        description: z.string().trim().min(1).max(200),
        amount: z.number().positive().max(1e15),
        date: isoDate.optional(),
        category_id: uuid.optional(),
        period: z.string().trim().min(1).max(120).optional(),
      }),
      execute: (args) => addTransaction(context, "income", args),
    },

    {
      name: "lifeos_create_note",
      description: "Create a note. Every edit is versioned by a database trigger.",
      inputSchema: z.object(noteFields),
      execute: async (args) => {
        const { data, error } = await supabase
          .from("notes")
          .insert({
            user_id: userIdOf(context),
            title: (args.title as string | undefined) ?? "Untitled note",
            body: (args.body as string | undefined) ?? "",
          })
          .select("id")
          .single();
        if (error) fail(error.message);
        return { id: (data as { id: string }).id };
      },
    },

    {
      name: "lifeos_update_note",
      description: "Update a note's title and/or body.",
      inputSchema: z.object({ id: uuid, patch: z.object(noteFields) }),
      execute: async (args) => {
        const id = args.id as string;
        const patch = args.patch as { title?: string; body?: string };
        const { data, error } = await supabase
          .from("notes")
          .update(patch)
          .eq("id", id)
          .select("id")
          .maybeSingle();
        if (error) fail(error.message);
        if (!data) fail("Note not found.");
        return { id };
      },
    },

    {
      name: "lifeos_delete_note",
      description: "Permanently delete a note and its revisions.",
      inputSchema: z.object({ id: uuid }),
      execute: async (args) => {
        const id = args.id as string;
        const { data, error } = await supabase
          .from("notes")
          .delete()
          .eq("id", id)
          .select("id")
          .maybeSingle();
        if (error) fail(error.message);
        if (!data) fail("Note not found.");
        return { id, deleted: true };
      },
    },
  ];
}

async function addTransaction(
  context: McpToolContext,
  kind: "income" | "expense",
  args: Record<string, unknown>,
): Promise<unknown> {
  const period = await periodId(context, args.period as string | undefined);
  const categoryId = args.category_id as string | undefined;

  if (categoryId) {
    const { data: category, error } = await context.supabase
      .from("finance_categories")
      .select("id, period_id")
      .eq("id", categoryId)
      .maybeSingle();
    if (error) fail(error.message);
    if (!category) fail("Category not found.");
    if ((category as { period_id: string }).period_id !== period) {
      fail("That category belongs to a different finance period.");
    }
  }

  const { data, error } = await context.supabase
    .from("finance_transactions")
    .insert({
      user_id: userIdOf(context),
      period_id: period,
      category_id: categoryId ?? null,
      kind,
      description: args.description,
      amount: args.amount,
      occurred_on: (args.date as string | undefined) ?? (await todayFor(context)),
    })
    .select("id")
    .single();
  if (error) fail(error.message);

  return { id: (data as { id: string }).id, kind, amount: args.amount };
}
