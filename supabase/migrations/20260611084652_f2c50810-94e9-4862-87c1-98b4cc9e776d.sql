
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin','ai_owner','reviewer','auditor');
CREATE TYPE public.deployment_status AS ENUM ('proposed','testing','production','retired');
CREATE TYPE public.risk_level AS ENUM ('low','medium','high');
CREATE TYPE public.approval_stage AS ENUM ('security','privacy','legal','compliance');
CREATE TYPE public.approval_status AS ENUM ('pending','approved','rejected','changes_requested');
CREATE TYPE public.incident_severity AS ENUM ('low','medium','high','critical');
CREATE TYPE public.incident_status AS ENUM ('open','investigating','resolved');
CREATE TYPE public.compliance_framework AS ENUM ('nist_ai_rmf','iso_42001','eu_ai_act');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  department TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_read_all" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_self_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "roles_read_all" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "roles_admin_manage" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Auto-create profile + bootstrap first user as admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count INT;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'ai_owner');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- AI Systems
CREATE TABLE public.ai_systems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  department TEXT,
  business_owner TEXT,
  ai_model TEXT,
  vendor TEXT,
  data_sources TEXT,
  use_case_category TEXT,
  deployment_status deployment_status NOT NULL DEFAULT 'proposed',
  risk_level risk_level,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_systems TO authenticated;
GRANT ALL ON public.ai_systems TO service_role;
ALTER TABLE public.ai_systems ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_read_all" ON public.ai_systems FOR SELECT TO authenticated USING (true);
CREATE POLICY "ai_write_owners" ON public.ai_systems FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'ai_owner'));
CREATE POLICY "ai_update_owners" ON public.ai_systems FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'ai_owner'));
CREATE POLICY "ai_delete_admin" ON public.ai_systems FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- Risk Assessments
CREATE TABLE public.risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_system_id UUID NOT NULL REFERENCES public.ai_systems(id) ON DELETE CASCADE,
  decisions_about_people BOOLEAN NOT NULL DEFAULT false,
  processes_personal_data BOOLEAN NOT NULL DEFAULT false,
  customer_facing BOOLEAN NOT NULL DEFAULT false,
  financial_harm BOOLEAN NOT NULL DEFAULT false,
  legal_harm BOOLEAN NOT NULL DEFAULT false,
  externally_hosted BOOLEAN NOT NULL DEFAULT false,
  sensitive_data BOOLEAN NOT NULL DEFAULT false,
  risk_score INT NOT NULL DEFAULT 0,
  risk_level risk_level NOT NULL DEFAULT 'low',
  assessed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.risk_assessments TO authenticated;
GRANT ALL ON public.risk_assessments TO service_role;
ALTER TABLE public.risk_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "risk_read_all" ON public.risk_assessments FOR SELECT TO authenticated USING (true);
CREATE POLICY "risk_write_auth" ON public.risk_assessments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "risk_update_auth" ON public.risk_assessments FOR UPDATE TO authenticated USING (true);

-- Approvals
CREATE TABLE public.approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_system_id UUID NOT NULL REFERENCES public.ai_systems(id) ON DELETE CASCADE,
  stage approval_stage NOT NULL,
  status approval_status NOT NULL DEFAULT 'pending',
  reviewer_id UUID REFERENCES auth.users(id),
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(ai_system_id, stage)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.approvals TO authenticated;
GRANT ALL ON public.approvals TO service_role;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "appr_read_all" ON public.approvals FOR SELECT TO authenticated USING (true);
CREATE POLICY "appr_write_auth" ON public.approvals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "appr_update_reviewers" ON public.approvals FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'reviewer'));

-- Incidents
CREATE TABLE public.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  severity incident_severity NOT NULL DEFAULT 'low',
  status incident_status NOT NULL DEFAULT 'open',
  ai_system_id UUID REFERENCES public.ai_systems(id) ON DELETE SET NULL,
  reported_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.incidents TO authenticated;
GRANT ALL ON public.incidents TO service_role;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inc_read_all" ON public.incidents FOR SELECT TO authenticated USING (true);
CREATE POLICY "inc_write_auth" ON public.incidents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "inc_update_auth" ON public.incidents FOR UPDATE TO authenticated USING (true);
CREATE POLICY "inc_delete_admin" ON public.incidents FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- Audit log
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT,
  action TEXT NOT NULL,
  object_type TEXT,
  object_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_read_all" ON public.audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "audit_write_auth" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Compliance controls
CREATE TABLE public.compliance_controls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework compliance_framework NOT NULL,
  control_code TEXT NOT NULL,
  control_name TEXT NOT NULL,
  description TEXT,
  completed BOOLEAN NOT NULL DEFAULT false,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(framework, control_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_controls TO authenticated;
GRANT ALL ON public.compliance_controls TO service_role;
ALTER TABLE public.compliance_controls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ctrl_read_all" ON public.compliance_controls FOR SELECT TO authenticated USING (true);
CREATE POLICY "ctrl_update_auth" ON public.compliance_controls FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'auditor'));

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER ai_systems_ts BEFORE UPDATE ON public.ai_systems FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER incidents_ts BEFORE UPDATE ON public.incidents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER approvals_ts BEFORE UPDATE ON public.approvals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed compliance controls
INSERT INTO public.compliance_controls (framework, control_code, control_name, description) VALUES
('nist_ai_rmf','GOVERN-1.1','AI risk management policies','Establish AI risk management strategies, policies, and procedures'),
('nist_ai_rmf','GOVERN-2.1','Accountability structures','Roles and responsibilities for AI risk are documented'),
('nist_ai_rmf','MAP-1.1','AI context documentation','Context, capabilities, and impacts of AI system are documented'),
('nist_ai_rmf','MEASURE-2.1','AI performance metrics','Metrics for trustworthiness characteristics are identified and applied'),
('nist_ai_rmf','MANAGE-1.1','Risk treatment plans','Plans for responding to identified risks are documented'),
('iso_42001','4.1','Organizational context','Internal and external issues affecting the AI management system'),
('iso_42001','5.2','AI policy','Top management establishes an AI policy'),
('iso_42001','6.1','Risk and opportunities','Actions to address risks and opportunities for AI'),
('iso_42001','8.1','Operational planning','Operational planning and control for AI lifecycle'),
('iso_42001','9.1','Monitoring and evaluation','Performance monitoring of the AI management system'),
('eu_ai_act','Art.9','Risk management system','Establish, implement and maintain a risk management system'),
('eu_ai_act','Art.10','Data governance','Training, validation and testing data sets quality criteria'),
('eu_ai_act','Art.13','Transparency to users','Provide clear information to deployers and users'),
('eu_ai_act','Art.14','Human oversight','Effective human oversight measures during AI use'),
('eu_ai_act','Art.15','Accuracy and robustness','Appropriate level of accuracy, robustness and cybersecurity');
