## План: подключить «Интерьер клиники» к БД

Таблица `interior_photos` уже есть (`id`, `image_url`, `caption`, `sort_order`, `created_at`), RLS правильный — миграции не нужны.

Сейчас раздел работает через `dbMainPage.interior` и `localStorage`. Подключаем по тому же мосту, что и для FAQ/отзывов, в `public/clinic-admin.html`.

### Изменения в `public/clinic-admin.html`

1. **`loadInterior()`** — `sb.from('interior_photos').select('id,image_url,caption,sort_order,created_at').order('sort_order').order('created_at')`. Маппинг в формат фронта `{ id, img: image_url, caption, sort_order }`. Запись в `window.dbMainPage.interior`, вызов `renderInterior()`.

2. **`overrideInterior()`** — переопределяет:
   - `window.renderInterior` — та же разметка, что сейчас (картинка + ховер с «глаз»/«корзина»), но `id` приводим к строке (`String(i.id)`) в `onclick` для совместимости с UUID.
   - `window.addInteriorImg` — `prompt` URL → `sb.from('interior_photos').insert({ image_url: formatImageUrl(url), sort_order: 0 }).select('id,image_url').single()` → добавить в `dbMainPage.interior` и `renderInterior()`. Ошибки через `notify`.
   - `window.deleteInterior(id)` — `customConfirm` → `sb.from('interior_photos').delete().eq('id', id)` → удалить из массива и `renderInterior()`.

3. **Bootstrap** — добавить `overrideInterior();` и `await loadInterior();` рядом с остальными `load*` в `DOMContentLoaded`.

### Фронт

`public/clinic-site.html` пока продолжает использовать свой собственный список интерьера — не трогаем (как договорились для FAQ). Если позже понадобится — подключим отдельным шагом.

### Проверка

1. Админ → Главная → блок «Интерьер» → добавить фото по URL → перезагрузить → осталось.
2. Удалить фото → перезагрузить → удалено.

### Файлы

- `public/clinic-admin.html`
