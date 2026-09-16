-- Public wrapper must execute as invoker; authorization remains enforced by the internal routine.
alter function public.set_client_habilitation_status(uuid,boolean,text) security invoker;