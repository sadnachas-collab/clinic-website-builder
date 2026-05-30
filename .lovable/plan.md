## Проблема

Кнопка «Выйти» сверху в `public/clinic-admin.html` (строка 179) сейчас вызывает:

```js
if(window.top) window.top.location.href='/logout'; else window.location.href='/logout';
```

Админка работает внутри `<iframe src="/clinic-admin.html">` (route `/admin`), а сама страница `/admin` в превью Lovable открыта внутри ещё одного, **cross-origin** iframe. Поэтому:
- `window.top.location.href = ...` молча блокируется браузером (cross-origin) — ничего не происходит.
- Старая кнопка «Выйти» в сайдбаре (строка 152, `handleLogout`) чистит только `localStorage` и делает `location.reload()`, но Supabase-сессия остаётся → после reload снова попадаешь в админку.

## Что сделать

1. **`public/clinic-admin.html`** — заменить обе кнопки выхода (сайдбар + верхняя панель) на единый обработчик:
   - Отправлять `parent.postMessage({ type: 'admin-logout' }, '*')` (parent = `/admin`, same-origin → работает всегда).
   - Fallback: `window.location.href = '/logout'` через 300 мс, если родитель не ответил (на случай прямого открытия HTML).
   - Удалить старую логику с `lsDel/ssDel + reload` — Supabase-сессия не очищается в iframe.

2. **`src/routes/admin.tsx`** — добавить `window.addEventListener('message', ...)`:
   - При получении `{ type: 'admin-logout' }` от same-origin вызывать `supabase.auth.signOut()` и `navigate({ to: '/login', replace: true })`.
   - Существующий `onAuthStateChange` сам уведёт на `/login` после signOut — но явная навигация надёжнее.

3. **`src/routes/logout.tsx`** — оставить как есть (работает как прямой URL-фолбэк).

## Что НЕ меняем

- Дизайн, разметку, иконки кнопок.
- Логику логина, миграции, RLS, схему БД.
- Структуру роутов.

## Проверка после реализации

Залогиниться `admin/123456` → нажать «Выйти» в верхней панели → должен быть редирект на `/login`. Повторить для кнопки в сайдбаре.