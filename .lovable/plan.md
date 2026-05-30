## Подход к миграции (общий для всех разделов)

Админка — это статичная HTML-страница в `public/clinic-admin.html`, грузится в iframe внутри `/admin`. Прямые ESM-импорты Supabase оттуда неудобны (это не Vite-модуль). Поэтому единый подход:

1. **Лёгкий DB-мост.** В `public/clinic-admin.html` добавим один блок: загрузка Supabase JS через CDN UMD (`@supabase/supabase-js`) + инициализация с публичным ключом и URL (значения уже публичны и лежат в `src/integrations/supabase/client.ts`). Получаем глобальный `window.sb` — тонкая обёртка над `supabase.from(...)` и `supabase.storage.from(...)`.
2. **Сессия наследуется через postMessage.** При загрузке iframe родитель `/admin` (где уже есть авторизованный `supabase`-клиент) шлёт текущий `access_token` + `refresh_token` через `postMessage`, iframe вызывает `sb.auth.setSession(...)`. Это даёт RLS работать как «текущий пользователь» внутри iframe.
3. **Шаблон CRUD на раздел:**
   - `load{X}()` → `await sb.from('{table}').select('*').order('sort_order')` → рендер.
   - `save{X}(row)` → `insert` если новый / `update` если есть `id` → перерендер.
   - `delete{X}(id)` → `delete().eq('id', id)` → перерендер.
   - Заменяем `Date.now()`-id на UUID из БД.
   - Снимаем `persistData()` и `localStorage.setItem('dbXxx', ...)` для мигрированного раздела.
4. **Файлы.** Картинки/PDF загружаются `sb.storage.from('photos'|'documents').upload(path, file, { upsert:true })`, далее `getPublicUrl`, в БД пишем только URL.

## Этот батч — только два пункта (чтобы можно было проверить)

### A. Общая инфраструктура (один раз)
- В `clinic-admin.html` подключить supabase-js CDN, создать `window.sb`, прокинуть сессию из родителя через `postMessage` (в `src/routes/admin.tsx` добавить отправку `{type:'admin-session', access_token, refresh_token}` после рендера iframe).
- Добавить вспомогательные `dbLoad/dbSave/dbDelete` обёртки + общий обработчик ошибок (toast).

### B. Раздел «Услуги» (`services` + `procedure_categories` + `procedures` + `price_files`)
По текущей админке «Услуги» — это четыре сущности. На этом шаге переносим именно их:
- `services` — таблица услуг (карточный список).
- `procedure_categories` + `procedures` — категории и процедуры каталога услуг.
- `price_files` — загружаемые PDF прайса (storage bucket `documents`).

Что меняется в коде:
- `renderTable()` / `addService()` / `saveService()` / `deleteService()` — переписать на `sb.from('services')`.
- `renderCatCategories()`/`renderCatProcedures()` и их add/save/delete — на `procedure_categories` / `procedures`.
- `renderPriceFile()` + загрузка/удаление прайса — на `price_files` + bucket `documents`.
- Из `persistData()` убрать `dbServices`, `dbCatCategories`, `dbCatProcedures`, `dbPriceFile` (остальные пока оставить — мигрируем дальше).
- Удалить инициализацию этих сущностей из дефолтов / localStorage.

### Что НЕ делаем в этом батче
- Врачи, отзывы, акции, FAQ, интерьер, документы, права потребителей, органы власти, контент страниц — следующими шагами по списку.
- Раздел «Заявки» и публичная форма — отдельным шагом после контента.
- Управление админами (создание editor'ов, смена паролей) — отдельным шагом сразу после первых 1-2 контентных разделов, как договаривались. План на него подготовлю позже.

## Проверка после реализации
1. Залогиниться `admin/123456`.
2. В разделе «Услуги»:
   - Добавить услугу → сохранилась после refresh.
   - Изменить, удалить — тоже.
   - Категории/процедуры — то же самое.
   - Залить PDF прайса → файл в bucket `documents`, ссылка в `price_files`, открывается публично.
3. В DevTools → Network: запросы идут на `…supabase.co/rest/v1/services`, статус 200, без 401/403.
4. В localStorage больше нет ключей `dbServices`, `dbCatCategories`, `dbCatProcedures`, `dbPriceFile` (старые — почистим при первой загрузке мигрированной версии).

## Технические детали
- Supabase URL и publishable key уже доступны через `src/integrations/supabase/client.ts` — те же значения подставим в `clinic-admin.html` (это публичные ключи, RLS защищает данные).
- CDN: `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js`.
- При получении `admin-session` iframe сразу делает `sb.auth.setSession({access_token, refresh_token})` и только после этого вызывает `init()` (рендер всех разделов).
- На случай прямого открытия `/clinic-admin.html` без родителя — показываем заглушку «Откройте через /admin».
- Все мутации обернём в try/catch с toast'ом ошибки (RLS-violation → понятное сообщение).