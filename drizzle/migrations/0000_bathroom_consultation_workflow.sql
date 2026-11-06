CREATE TABLE public.bathroom_consultations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 project_number bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 title text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'Saved' CHECK (status IN ('Saved','Completed')),
 selections jsonb NOT NULL DEFAULT '{}',
 approved_images jsonb NOT NULL DEFAULT '{}',
 proposal_details jsonb NOT NULL DEFAULT '{}',
 created_by uuid NOT NULL DEFAULT auth.uid(),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bathroom_consultations TO authenticated;
GRANT ALL ON public.bathroom_consultations TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.bathroom_consultations_project_number_seq TO authenticated, service_role;
ALTER TABLE public.bathroom_consultations ENABLE ROW LEVEL SECURITY;
CREATE POLICY bathroom_admin_all ON public.bathroom_consultations FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TABLE public.bathroom_settings (
 id text PRIMARY KEY CHECK (id = 'default'),
 rates jsonb NOT NULL DEFAULT '{}',
 templates jsonb NOT NULL DEFAULT '{}'
);
GRANT SELECT, INSERT, UPDATE ON public.bathroom_settings TO authenticated;
GRANT ALL ON public.bathroom_settings TO service_role;
ALTER TABLE public.bathroom_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY bathroom_settings_admin ON public.bathroom_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TABLE public.bathroom_proposal_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 consultation_id uuid NOT NULL REFERENCES public.bathroom_consultations(id) ON DELETE CASCADE,
 version integer NOT NULL,
 snapshot jsonb NOT NULL,
 created_by uuid NOT NULL DEFAULT auth.uid(),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(consultation_id, version)
);
GRANT SELECT, INSERT ON public.bathroom_proposal_versions TO authenticated;
GRANT ALL ON public.bathroom_proposal_versions TO service_role;
ALTER TABLE public.bathroom_proposal_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY bathroom_versions_admin_read ON public.bathroom_proposal_versions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY bathroom_versions_admin_insert ON public.bathroom_proposal_versions FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND created_by = auth.uid());
CREATE POLICY bathroom_storage_admin ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'bathroom-designs' AND public.has_role(auth.uid(), 'admin')) WITH CHECK (bucket_id = 'bathroom-designs' AND public.has_role(auth.uid(), 'admin'));
CREATE FUNCTION public.save_bathroom_proposal(p_id uuid, p_snapshot jsonb) RETURNS integer LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v integer;
BEGIN
 IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
 PERFORM id FROM public.bathroom_consultations WHERE id = p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Project not found'; END IF;
 SELECT COALESCE(MAX(version),0)+1 INTO v FROM public.bathroom_proposal_versions WHERE consultation_id=p_id;
 INSERT INTO public.bathroom_proposal_versions(consultation_id,version,snapshot,created_by) VALUES(p_id,v,p_snapshot,auth.uid());
 RETURN v;
END; $$;
REVOKE ALL ON FUNCTION public.save_bathroom_proposal(uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_bathroom_proposal(uuid,jsonb) TO authenticated;
