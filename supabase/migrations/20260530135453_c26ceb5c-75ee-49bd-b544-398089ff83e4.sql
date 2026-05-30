-- Возвращаем EXECUTE на security-definer функции для authenticated,
-- иначе RLS-политики, вызывающие is_admin(auth.uid()), не могут пройти проверку прав
-- и записи блокируются с "new row violates row-level security policy".
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;