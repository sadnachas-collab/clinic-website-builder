## Проблема

В админке сейчас два экрана входа:

1. **Реальный** — `/login` (Supabase, через `src/routes/login.tsx`). После успешного входа `src/routes/admin.tsx` пускает пользователя и грузит iframe `public/clinic-admin.html`.
2. **Лишний (legacy)** — внутри iframe `public/clinic-admin.html` (строки 61–86, 831–940) есть собственная форма входа `#login-screen` с проверкой логина/пароля по `localStorage` (`dbAdmins` / `loggedInAdminId`). Этот экран остался от старой версии до подключения Supabase и сейчас просто дублирует авторизацию.

То есть пользователь авторизуется в Supabase, затем iframe показывает свою старую форму и просит ввести `admin` / `123456` ещё раз.

## Что сделаю

Полностью уберу legacy-логин из iframe. Авторизация будет только через Supabase на `/login`. iframe `clinic-admin.html` будет считать пользователя авторизованным по факту получения от родителя сообщения `admin-supabase-init` (родитель шлёт его только при наличии сессии Supabase).

### Изменения в `public/clinic-admin.html`

1. **Удалить блок формы входа** `#login-screen` (≈ строки 61–86) — он больше не нужен.
2. **Снять с `#admin-panel` стартовые классы `hidden opacity-0`**, чтобы панель показывалась сразу.
3. **Удалить функции/обработчики**: `handleLogin`, `doLogin`, `togglePasswordVisibility`, авто-логин по `loggedInAdminId` в `DOMContentLoaded`, а также вызовы `openAdminPanel`/работу с `#login-screen`. Оставлю только `updateHeaderUser`, `requestLogout` (он постит `admin-logout` в родителя — это уже корректный путь выхода через Supabase).
4. **В `bootstrap(m)`** (точка приёма `admin-supabase-init`) после загрузки админов из облака:
   - найти текущего админа в `window.dbAdmins` по `window.__currentAdminUserId` (его уже выставляет `loadAdmins()`);
   - вызвать `updateHeaderUser(me)`, чтобы в шапке появились имя/роль.
5. **`initAllData()` вызывать из `bootstrap`** (после успешной инициализации Supabase), а не из `openAdminPanel`. Так гарантируется, что панель работает на реальных данных, а не на дефолтных моках.
6. Очистить ненужные ключи `localStorage`/`sessionStorage` (`loggedInAdminId`, `savedAdminLogin`, `savedAdminPwd`) при загрузке — чтобы не оставались следы старой схемы.

### `src/routes/admin.tsx`

Менять не нужно — он уже корректно: проверяет Supabase-сессию, при её отсутствии редиректит на `/login`, при наличии монтирует iframe и шлёт ему `admin-supabase-init`.

### Что станет с поведением

- Открытие `/admin` без сессии → редирект на `/login` (как и сейчас).
- Ввод логина/пароля на `/login` (Supabase) → редирект на `/admin` → iframe сразу показывает панель, без второй формы.
- Кнопка «Выйти» в админке → постит `admin-logout` родителю → `supabase.auth.signOut()` + редирект на `/login` (уже работает).

## Что НЕ трогаю

- Логику Supabase-аутентификации и серверные функции `src/lib/admins.functions.ts`.
- Внешний вид и контент админки (кроме удаления окна логина).
- Сайт `clinic-site.html`.
