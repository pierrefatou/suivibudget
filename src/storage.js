import { supabase } from "./supabaseClient";

// Clé de synchronisation : un identifiant aléatoire (pas un compte), stocké
// dans le navigateur, qui sert à retrouver tes données dans Supabase. Copie-la
// pour la coller sur un autre appareil et accéder aux mêmes données.
const SYNC_KEY_STORAGE_NAME = "sync_key";

export function getSyncKey() {
  let key = window.localStorage.getItem(SYNC_KEY_STORAGE_NAME);
  if (!key) {
    key = crypto.randomUUID();
    window.localStorage.setItem(SYNC_KEY_STORAGE_NAME, key);
  }
  return key;
}

export function setSyncKey(newKey) {
  window.localStorage.setItem(SYNC_KEY_STORAGE_NAME, newKey.trim());
}

// Même interface que l'API window.storage d'origine (get/set retournent/
// acceptent une chaîne JSON), pour ne pas avoir à modifier App.jsx.
export const storage = {
  async get(key) {
    try {
      const sync_key = getSyncKey();
      const { data, error } = await supabase
        .from("kv_store")
        .select("value")
        .eq("sync_key", sync_key)
        .eq("key", key)
        .maybeSingle();
      if (error || !data) return null;
      return { key, value: JSON.stringify(data.value) };
    } catch (e) {
      return null;
    }
  },
  async set(key, value) {
    try {
      const sync_key = getSyncKey();
      const parsed = JSON.parse(value);
      const { error } = await supabase
        .from("kv_store")
        .upsert(
          { sync_key, key, value: parsed, updated_at: new Date().toISOString() },
          { onConflict: "sync_key,key" }
        );
      if (error) return null;
      return { key, value };
    } catch (e) {
      return null;
    }
  },
};
