-- =====================================================================
-- MOZZAFIATO — DONATIVOS: darte acceso de administrador
-- =====================================================================
-- Corre esto DESPUÉS de donativos.sql.
--
-- 1) Cambia el correo de abajo por el de TU cuenta de login de Supabase
--    (el mismo con el que entras a PMS Regina Book / Producción).
--    Si no lo recuerdas: Supabase → Authentication → Users.
-- 2) SQL Editor → New query → pega esto → Run.
--    Debe salir una fila con tu correo. Si no sale nada, el correo no coincide.
-- =====================================================================

insert into donativos.admins (user_id)
select id from auth.users where lower(email) = lower('TU_CORREO@ejemplo.com')
on conflict do nothing;

select u.email as admin_de_donativos
from donativos.admins a join auth.users u on u.id = a.user_id;
