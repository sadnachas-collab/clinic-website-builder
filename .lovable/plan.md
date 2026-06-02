## Фикс: направления на главной не обновляются из админки

### Причина
В `public/clinic-site.html` (строка 1179) объявлена локальная `const DB = {…}` с захардкоженными категориями и процедурами. В `public/clinic-site-data.js` (строки 130-132) данные из БД пишутся в `window.DB.categories` / `window.DB.procedures`. Это **разные объекты в памяти** — функция `initHomeCategories()` читает из локального `DB`, поэтому всегда показывает старые захардкоженные данные.

То же касается секций «Категория → процедуры» (`openCategoryPage`) и «Процедура» (`openProcedurePage`) — они тоже читают из локального `DB` и тоже не обновляются.

### Фикс (минимальный, одна точка)
В `public/clinic-site.html` заменить:
```js
const DB = { categories: {...}, procedures: {...} };
```
на:
```js
window.DB = window.DB || { categories: {}, procedures: {} };
const DB = window.DB;
```

Это связывает локальный `DB` и `window.DB` в один объект. Когда `clinic-site-data.js` после загрузки делает `window.DB.categories = catMap`, локальный `DB.categories` тоже видит новые данные (одна ссылка). Следующий вызов `window.initHomeCategories()` рендерит свежие категории.

Захардкоженный объект из site.html **удаляем** — он не нужен, потому что:
- если БД пустая, `renderCategoriesAndProcedures` уже умеет скрывать секцию `services` (строка 96 site-data.js: `hideSection('services')`);
- если БД заполнена, всё рендерится из неё.

### Что НЕ трогаем
- `clinic-site-data.js` — логика загрузки и записи в `window.DB` уже корректна.
- Админка `clinic-admin.html` — данные в БД пишутся правильно (проверено: «Игкоукалывание», «Ботекс»).
- Функции `openCategoryPage` / `openProcedurePage` / `initHomeCategories` — они читают `DB.categories[...]`, после фикса автоматически увидят свежие данные.
- Никакой работы с БД / миграций / RLS.

### Файлы
- `public/clinic-site.html` — одна правка вокруг строки 1179.