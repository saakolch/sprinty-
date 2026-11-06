-- ---------------------------------------------------------------------------
-- 0007 — Automatic note revision history
--
-- `note_revisions` existed from 0004 but nothing wrote to it. A trigger keeps
-- history honest: every meaningful note change is captured in the database,
-- so a bug (or a future MCP client) cannot silently skip it.
--
-- The revision insert runs as the calling user, which is fine: the RLS policy
-- on note_revisions allows inserts where user_id = auth.uid(), and new.user_id
-- is the note owner.
-- ---------------------------------------------------------------------------

create or replace function public.capture_note_revision()
returns trigger
language plpgsql
as $$
begin
  insert into public.note_revisions (user_id, note_id, title, body, event)
  values (
    new.user_id,
    new.id,
    new.title,
    new.body,
    case when tg_op = 'INSERT' then 'created' else 'saved' end
  );
  return new;
end;
$$;

drop trigger if exists notes_capture_revision on public.notes;
drop trigger if exists notes_capture_revision_insert on public.notes;
drop trigger if exists notes_capture_revision_update on public.notes;

-- Two triggers because a WHEN clause cannot reference TG_OP.
create trigger notes_capture_revision_insert
after insert on public.notes
for each row
execute function public.capture_note_revision();

-- Pin/unpin alone is not a content change, so it does not create a revision.
create trigger notes_capture_revision_update
after update on public.notes
for each row
when (
  old.title is distinct from new.title
  or old.body is distinct from new.body
)
execute function public.capture_note_revision();
