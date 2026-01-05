// ✅ src/api/mvpApi.js
import { api } from "./api"; // existing helper that includes credentials

export const mvpApi = {
  // 🏋️ Fitness
  async logWorkout() {
    return await api("/fitness/log", { method: "POST", body: { type: "workout" } });
  },
  async logWater() {
    return await api("/fitness/log", { method: "POST", body: { type: "water" } });
  },

  // 📚 Study
  async addJournal({ title, content }) {
    return await api("/study/journal", {
      method: "POST",
      body: { title, content },
    });
  },
  async shareTopic({ topic }) {
    return await api("/study/share", {
      method: "POST",
      body: { topic },
    });
  },

  // 🗣️ Language
  async logLanguagePractice({ language_key, recordings }) {
    return await api("/language/practice", {
      method: "POST",
      body: { language_key, practice_date: new Date(), recordings },
    });
  },

  // 🧾 Forms
  async submitForm({ form_type, form_data }) {
    return await api("/forms/submit", {
      method: "POST",
      body: { form_type, form_data },
    });
  },

  // 🤖 AI
  async startAISession({ session_id, summary }) {
    return await api("/ai/session", {
      method: "POST",
      body: { session_id, summary },
    });
  },
};
