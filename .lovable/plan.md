## Подключаем «Уголок потребителя» + «Надзорные органы» к Lovable Cloud

Оба раздела используют один `renderConsumer()` и общий объект `dbConsumer = { categories, authorities }`. Делаем в одном проходе.

## 1. Уголок потребителя (`consumer_categories` + `consumer_documents`)

### Загрузка
- `loadConsumerData()` — параллельно `select` из `consumer_categories` (id, name, sort_order, created_at) и `consumer_documents` (id, title, file_url, category_id, sort_order, created_at).
- Маппинг → `dbConsumer.categories = [{ id, title: name, icon: 'folder', documents: [{ id, name: title, fileName: <basename(file_url)>, fileSize: '', dataUrl: file_url }] }]` — структура совместима с текущим `renderConsumer`.

### Override
- `addConsumerCategory()` → `insert` в `consumer_categories` (name, sort_order = max+1) → push → `renderConsumer()`.
- `renameConsumerCategory(id, value)` → `update {name}` в БД.
- `deleteConsumerCategory(id)` → `delete` из `consumer_documents` по `category_id`, затем из `consumer_categories`.
- `addConsumerDocument(catId, input)` — убрать ограничение 4 МБ (теперь ≤25 МБ). Тип файла `.pdf,.doc,.docx,.jpg,.jpeg,.png`. Загрузка: `sb.storage.from('documents').upload('consumer/<ts>-<rand>.<ext>', file)` → `getPublicUrl` → `insert` в `consumer_documents` (title, file_url, category_id, sort_order). После — push в `cat.documents` и render.
- `renameConsumerDocument(catId, docId, value)` → `update {title}`.
- `deleteConsumerDocument(catId, docId)` → `delete` в БД (Storage-файл не трогаем, как в `clinic_documents`).

### Bucket
`documents` уже существует и public — миграция не нужна.

## 2. Надзорные органы (`authorities`)

### Загрузка
- `loadAuthorities()` — `select(id, name, address, phone, sort_order)` order by `sort_order, created_at`. Маппинг → `dbConsumer.authorities = [{ id, name, address, phone }]`.

### Override
- `addAuthority()` → `insert {name:'', address:'', phone:'', sort_order: max+1}` → push → render → автофокус на name.
- `updateAuthority(id, field, value)` → `update { [field]: value }` (debounce не делаем — `onchange` уже срабатывает редко).
- `deleteAuthority(id)` → `delete`.
- `saveAuthorities()` — оставляем как есть, либо превращаем в no-op + toast «Сохранено» (изменения уже летят в БД через `updateAuthority`).

## 3. Bootstrap
В блоке инициализации (там же где `await loadCatCategories()`) добавить:
```
await Promise.all([loadConsumerData(), loadAuthorities()]);
renderConsumer();
```
Перед этим — `overrideConsumer(); overrideAuthorities();`.

## Файлы
- `public/clinic-admin.html` — новые блоки `loadConsumerData`, `loadAuthorities`, `overrideConsumer`, `overrideAuthorities` в конце скрипта (рядом с `overrideCatCategories`).

## Не трогаем
- `public/clinic-site.html`, схему БД, бакеты Storage, остальные разделы админки, существующий `renderConsumer` (оставляем как fallback, наши override’ы только подменяют CRUD-функции).