CREATE OR REPLACE FUNCTION public.tl_selection_note_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.project_timeline_events (project_id, category, title, description, related_spec_card_id, created_by)
  VALUES (NEW.project_id, 'selections', 'Note Added', NEW.author_name || ': ' || left(NEW.body, 200), NEW.option_id, NEW.author_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_selection_note_added
AFTER INSERT ON public.selection_notes
FOR EACH ROW
EXECUTE FUNCTION public.tl_selection_note_added();