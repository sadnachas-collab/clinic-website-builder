(function () {
  "use strict";

  function apiFetch(path, options) {
    return fetch(path, Object.assign({ credentials: "include" }, options || {}));
  }

  function toError(message) {
    return { message: message || "Неизвестная ошибка" };
  }

  function normalizeError(error) {
    if (!error) return null;
    if (typeof error === "string") return toError(error);
    return toError(error.message || error.error || String(error));
  }

  async function jsonRequest(path, body) {
    try {
      const res = await apiFetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body || {}),
      });
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) return { data: null, error: normalizeError(data.error || res.statusText) };
      return { data: data.data !== undefined ? data.data : data, error: null };
    } catch (e) {
      return { data: null, error: normalizeError(e) };
    }
  }

  function QueryBuilder(table) {
    this.table = table;
    this.action = "select";
    this.columns = "*";
    this.returningColumns = "";
    this.filters = [];
    this.orders = [];
    this.limitValue = undefined;
    this.singleValue = false;
    this.maybeSingleValue = false;
    this.payload = undefined;
    this.onConflict = undefined;
  }

  QueryBuilder.prototype.select = function (columns) {
    if (this.action === "insert" || this.action === "update" || this.action === "upsert") {
      this.returningColumns = columns || "*";
    } else {
      this.columns = columns || "*";
    }
    return this;
  };

  QueryBuilder.prototype.order = function (column, options) {
    this.orders.push({ column: column, ascending: !options || options.ascending !== false });
    return this;
  };

  QueryBuilder.prototype.limit = function (count) {
    this.limitValue = count;
    return this;
  };

  QueryBuilder.prototype.eq = function (column, value) {
    this.filters.push({ column: column, op: "eq", value: value });
    return this;
  };

  QueryBuilder.prototype.neq = function (column, value) {
    this.filters.push({ column: column, op: "neq", value: value });
    return this;
  };

  QueryBuilder.prototype.not = function (column, operator, value) {
    this.filters.push({ column: column, op: "not", operator: operator, value: value });
    return this;
  };

  QueryBuilder.prototype.insert = function (payload) {
    this.action = "insert";
    this.payload = payload;
    return this;
  };

  QueryBuilder.prototype.update = function (payload) {
    this.action = "update";
    this.payload = payload;
    return this;
  };

  QueryBuilder.prototype.delete = function () {
    this.action = "delete";
    return this;
  };

  QueryBuilder.prototype.upsert = function (payload, options) {
    this.action = "upsert";
    this.payload = payload;
    this.onConflict = options && options.onConflict;
    return this;
  };

  QueryBuilder.prototype.single = function () {
    this.singleValue = true;
    return this.execute();
  };

  QueryBuilder.prototype.maybeSingle = function () {
    this.maybeSingleValue = true;
    return this.execute();
  };

  QueryBuilder.prototype.then = function (resolve, reject) {
    return this.execute().then(resolve, reject);
  };

  QueryBuilder.prototype.catch = function (reject) {
    return this.execute().catch(reject);
  };

  QueryBuilder.prototype.execute = function () {
    return jsonRequest("/api/clinic/db", {
      table: this.table,
      action: this.action,
      columns: this.columns,
      returningColumns: this.returningColumns || undefined,
      filters: this.filters,
      orders: this.orders,
      limit: this.limitValue,
      single: this.singleValue,
      maybeSingle: this.maybeSingleValue,
      payload: this.payload,
      onConflict: this.onConflict,
    });
  };

  function StorageBucket(bucket) {
    this.bucket = bucket;
  }

  StorageBucket.prototype.upload = async function (path, file, options) {
    try {
      const form = new FormData();
      form.set("bucket", this.bucket);
      form.set("path", path);
      form.set(
        "contentType",
        (options && options.contentType) || file.type || "application/octet-stream",
      );
      form.set("file", file);
      const res = await apiFetch("/api/clinic/storage/upload", { method: "POST", body: form });
      const data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) return { data: null, error: normalizeError(data.error || res.statusText) };
      return { data: { path: data.path, fullPath: data.path }, error: null };
    } catch (e) {
      return { data: null, error: normalizeError(e) };
    }
  };

  StorageBucket.prototype.getPublicUrl = function (path) {
    var encoded = String(path || "")
      .split("/")
      .map(encodeURIComponent)
      .join("/");
    return {
      data: {
        publicUrl: "/api/clinic/storage/object/" + encodeURIComponent(this.bucket) + "/" + encoded,
      },
    };
  };

  StorageBucket.prototype.remove = async function (paths) {
    var result = await jsonRequest("/api/clinic/storage/delete", {
      bucket: this.bucket,
      paths: Array.isArray(paths) ? paths : [],
    });
    return result.error ? { data: null, error: result.error } : { data: result.data, error: null };
  };

  function createClient() {
    return {
      from: function (table) {
        return new QueryBuilder(table);
      },
      storage: {
        from: function (bucket) {
          return new StorageBucket(bucket);
        },
      },
      auth: {
        setSession: async function () {
          return { data: {}, error: null };
        },
        getUser: async function () {
          var res = await apiFetch("/api/clinic/auth/session");
          var data = await res.json().catch(function () {
            return {};
          });
          if (!res.ok)
            return { data: { user: null }, error: normalizeError(data.error || res.statusText) };
          return { data: { user: data.user || null }, error: null };
        },
        signOut: async function () {
          var res = await apiFetch("/api/clinic/auth/logout", { method: "POST" });
          if (!res.ok) return { error: toError("Не удалось выйти") };
          return { error: null };
        },
      },
    };
  }

  window.supabase = { createClient: createClient };
})();
