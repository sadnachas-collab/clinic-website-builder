## Что не так

В `public/clinic-admin.html` после загрузки файла в `uploadCatPhoto` (и `uploadProcPhoto`) выставляется только `value` скрытого input'а с URL. Сама миниатюра `<img>` в карточке категории и превью в редакторе процедуры не обновляются — пользователь видит плейсхолдер «Нет фото», даже после нажатия «Сохранить» (а в редакторе процедуры превью вообще нет).

## Исправление

### 1. `uploadCatPhoto` (категории процедур)
После успешного `getPublicUrl`:
- найти строку `#cat-row-${id}` и обновить `src` её первого `<img>` на свежий `publicUrl` (с cache-busting `?t=Date.now()` чтобы обойти кэш браузера);
- так же обновить `c.img` в `window.dbCatCategories`, чтобы последующий `renderCatCategories()` (например, после отмены) сохранил картинку.

### 2. `saveCat` — подстраховка
Гарантировать, что `c.img` записывается до `renderCatCategories()` (уже так), но добавить `notify` с явной ошибкой, если БД вернула пустой `image_url`.

### 3. `uploadProcPhoto` (карточка процедуры)
- Добавить рядом с полем `#pe-img` маленький `<img id="pe-img-preview">` (рендерится в `ensureUploadButton`, инициализируется из `tempEditProc.img` в `openProcEditorModal`).
- После загрузки обновлять `pe-img-preview.src = publicUrl` и `tempEditProc.img = publicUrl`.

### 4. Cache-busting
Использовать `publicUrl + '?t=' + Date.now()` только при показе в DOM (в `dbCatCategories[i].img` и в `image_url` БД сохраняем чистый URL без query).

## Файлы
- `public/clinic-admin.html` — изменения только в блоках `overrideCatCategories` и `overrideCatProcedures` (строки ~3060–3320).

## Не трогаем
- `public/clinic-site.html`, схему БД, бакеты Storage, остальные разделы админки.